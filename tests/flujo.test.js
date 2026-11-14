// Pruebas de integración del flujo principal: login, roles, ventas, stock, alertas y kardex.
// Usan una base de datos propia que se BORRA al iniciar, por eso nunca apuntan a la base real:
//   MONGO_URI_TEST=mongodb://127.0.0.1:27017/nova_salud_test npm test
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas'
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { io: clienteSocket } = require('socket.io-client')

const { server } = require('../app')
const connect = require('../database/connection')
const sembrar = require('../seed')
const Product = require('../models/productModel')
const StockMovement = require('../models/stockMovementModel')

const URI_TEST = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/nova_salud_test'
const PASSWORD = process.env.SEED_PASSWORD || 'NovaSalud2026!'

let base
let datos
const tokens = {}

async function llamar(metodo, ruta, { token, body } = {}) {
    const res = await fetch(base + ruta, {
        method: metodo,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    })
    return { status: res.status, data: await res.json().catch(() => null) }
}

const productoPorNombre = (texto) => datos.productos.find((p) => p.nombre.startsWith(texto))
const stockActual = async (id) => (await Product.findById(id)).stock

before(async () => {
    await connect(URI_TEST)
    datos = await sembrar({ reset: true })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${server.address().port}`
    for (const [rol, email] of [['admin', 'admin@novasalud.pe'], ['vendedor', 'vendedor@novasalud.pe'], ['almacen', 'almacen@novasalud.pe']]) {
        const { data } = await llamar('POST', '/auth/login', { body: { email, password: PASSWORD } })
        tokens[rol] = data.token
    }
})

after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await mongoose.disconnect()
})

test('login: credenciales incorrectas o inexistentes dan 401 con el mismo mensaje', async () => {
    const malaClave = await llamar('POST', '/auth/login', { body: { email: 'admin@novasalud.pe', password: 'incorrecta' } })
    const noExiste = await llamar('POST', '/auth/login', { body: { email: 'nadie@novasalud.pe', password: 'incorrecta' } })
    assert.equal(malaClave.status, 401)
    assert.equal(noExiste.status, 401)
    assert.equal(malaClave.data.error, noExiste.data.error)
    assert.equal((await llamar('POST', '/auth/login', { body: {} })).status, 400)
})

test('seguridad: sin token 401, token falso 401, rol insuficiente 403', async () => {
    assert.equal((await llamar('GET', '/productos')).status, 401)
    assert.equal((await llamar('GET', '/productos', { token: 'token.falso.aqui' })).status, 401)
    assert.equal((await llamar('GET', '/reportes/resumen', { token: tokens.vendedor })).status, 403)
    assert.equal((await llamar('POST', '/productos', { token: tokens.vendedor, body: { nombre: 'X', precio: 1 } })).status, 403)
    assert.equal((await llamar('GET', '/productos/bajo-stock', { token: tokens.vendedor })).status, 403)
    assert.equal((await llamar('POST', '/ventas', { token: tokens.almacen, body: { items: [] } })).status, 403)
})

test('venta: descuenta stock, usa el precio de la base y registra el kardex', async () => {
    const p = productoPorNombre('Paracetamol')
    const antes = await stockActual(p._id)
    const { status, data } = await llamar('POST', '/ventas', {
        token: tokens.vendedor,
        // El precio enviado por el navegador se ignora
        body: { items: [{ producto: p._id, cantidad: 3, precioUnitario: 0.01 }] }
    })
    assert.equal(status, 201)
    assert.equal(data.total, 19.5)
    assert.equal(data.items[0].precioUnitario, 6.5)
    assert.equal(await stockActual(p._id), antes - 3)

    const mov = await StockMovement.findOne({ venta: data._id })
    assert.equal(mov.tipo, 'salida')
    assert.equal(mov.cantidad, -3)
    assert.equal(mov.stockResultante, antes - 3)
})

test('venta: datos inválidos dan 400', async () => {
    const p = productoPorNombre('Paracetamol')
    for (const cantidad of [0, -1, 1.5, 'abc']) {
        const { status } = await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: p._id, cantidad }] } })
        assert.equal(status, 400, `cantidad ${cantidad}`)
    }
    assert.equal((await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [] } })).status, 400)
    assert.equal((await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: 'no-es-id', cantidad: 1 }] } })).status, 400)
})

test('venta: stock insuficiente da 409 y no deja descuentos a medias', async () => {
    const ok = productoPorNombre('Ibuprofeno')
    const escaso = productoPorNombre('Naproxeno') // stock 8
    const antesOk = await stockActual(ok._id)
    const { status, data } = await llamar('POST', '/ventas', {
        token: tokens.vendedor,
        body: { items: [{ producto: ok._id, cantidad: 2 }, { producto: escaso._id, cantidad: 9 }] }
    })
    assert.equal(status, 409)
    assert.match(data.error, /Stock insuficiente/)
    assert.equal(await stockActual(ok._id), antesOk) // el primer descuento se revirtió
    assert.equal(await stockActual(escaso._id), 8)
})

test('venta: no se puede vender un producto vencido ni uno agotado', async () => {
    const vencido = productoPorNombre('Loperamida')
    const agotado = productoPorNombre('Aspirina')
    const a = await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: vencido._id, cantidad: 1 }] } })
    assert.equal(a.status, 409)
    assert.match(a.data.error, /vencido/)
    const b = await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: agotado._id, cantidad: 1 }] } })
    assert.equal(b.status, 409)
})

test('concurrencia: 5 ventas simultáneas de la última unidad, solo una gana', async () => {
    const p = await Product.create({ nombre: 'Producto de una unidad', precio: 10, stock: 1, stockMinimo: 0 })
    const resultados = await Promise.all(Array.from({ length: 5 }, () =>
        llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: p._id, cantidad: 1 }] } })))
    const estados = resultados.map((r) => r.status).sort()
    assert.deepEqual(estados, [201, 409, 409, 409, 409])
    assert.equal(await stockActual(p._id), 0)
})

test('alertas: stock:bajo llega a admin y almacén, no al vendedor; sin token no conecta', async () => {
    const conectar = (token) => new Promise((resolve) => {
        const socket = clienteSocket(base, { auth: { token }, reconnection: false })
        socket.on('connect', () => resolve({ socket, ok: true }))
        socket.on('connect_error', (error) => { socket.close(); resolve({ ok: false, error }) })
    })

    const sinToken = await conectar(undefined)
    assert.equal(sinToken.ok, false)
    assert.match(sinToken.error.message, /No autorizado/)

    const admin = await conectar(tokens.admin)
    const almacen = await conectar(tokens.almacen)
    const vendedor = await conectar(tokens.vendedor)
    assert.ok(admin.ok && almacen.ok && vendedor.ok)

    const alertas = { admin: [], almacen: [], vendedor: [] }
    const actualizaciones = { vendedor: [] }
    admin.socket.on('stock:bajo', (a) => alertas.admin.push(a))
    almacen.socket.on('stock:bajo', (a) => alertas.almacen.push(a))
    vendedor.socket.on('stock:bajo', (a) => alertas.vendedor.push(a))
    vendedor.socket.on('stock:actualizado', (a) => actualizaciones.vendedor.push(a))

    // Alcohol: stock 80, mínimo 20. Vender 65 lo deja en 15 (<= mínimo)
    const p = productoPorNombre('Alcohol')
    const { status } = await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: p._id, cantidad: 65 }] } })
    assert.equal(status, 201)
    await new Promise((resolve) => setTimeout(resolve, 300))

    assert.equal(alertas.admin.length, 1)
    assert.equal(alertas.admin[0].stock, 15)
    assert.equal(alertas.admin[0].stockMinimo, 20)
    assert.equal(alertas.almacen.length, 1)
    assert.equal(alertas.vendedor.length, 0)
    assert.equal(actualizaciones.vendedor.length, 1) // el vendedor sí refresca su pantalla

    for (const c of [admin, almacen, vendedor]) c.socket.close()
})

test('anulación: devuelve el stock, no se repite y solo la hace el admin', async () => {
    const p = productoPorNombre('Curitas')
    const antes = await stockActual(p._id)
    const { data: venta } = await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: p._id, cantidad: 4 }] } })
    assert.equal(await stockActual(p._id), antes - 4)

    assert.equal((await llamar('PATCH', `/ventas/${venta._id}/anular`, { token: tokens.vendedor })).status, 403)
    assert.equal((await llamar('PATCH', `/ventas/${venta._id}/anular`, { token: tokens.admin })).status, 200)
    assert.equal(await stockActual(p._id), antes)
    assert.equal((await llamar('PATCH', `/ventas/${venta._id}/anular`, { token: tokens.admin })).status, 409)
    assert.equal(await stockActual(p._id), antes) // no se devolvió dos veces
})

test('ventas: el vendedor solo ve las suyas; el admin ve todas', async () => {
    const p = productoPorNombre('Pasta dental')
    await llamar('POST', '/ventas', { token: tokens.admin, body: { items: [{ producto: p._id, cantidad: 1 }] } })
    const propias = await llamar('GET', '/ventas', { token: tokens.vendedor })
    const todas = await llamar('GET', '/ventas', { token: tokens.admin })
    assert.ok(todas.data.length > propias.data.length)
    assert.ok(propias.data.every((v) => v.vendedor.nombre === 'Rosa Vendedora'))
})

test('inventario: entrada suma stock y queda en el kardex; ajuste exige motivo', async () => {
    const p = productoPorNombre('Gasas')
    const antes = await stockActual(p._id)

    const entrada = await llamar('POST', '/inventario/entrada', { token: tokens.almacen, body: { producto: p._id, cantidad: 20, motivo: 'Pedido #1' } })
    assert.equal(entrada.status, 201)
    assert.equal(await stockActual(p._id), antes + 20)
    assert.equal((await llamar('POST', '/inventario/entrada', { token: tokens.almacen, body: { producto: p._id, cantidad: -5 } })).status, 400)

    assert.equal((await llamar('POST', '/inventario/ajuste', { token: tokens.admin, body: { producto: p._id, stockReal: 10 } })).status, 400)
    assert.equal((await llamar('POST', '/inventario/ajuste', { token: tokens.almacen, body: { producto: p._id, stockReal: 10, motivo: 'x' } })).status, 403)
    const ajuste = await llamar('POST', '/inventario/ajuste', { token: tokens.admin, body: { producto: p._id, stockReal: 10, motivo: 'Conteo físico' } })
    assert.equal(ajuste.status, 201)
    assert.equal(ajuste.data.diferencia, 10 - (antes + 20))

    const kardex = await llamar('GET', `/inventario/kardex/${p._id}`, { token: tokens.almacen })
    assert.equal(kardex.status, 200)
    assert.deepEqual(kardex.data.movimientos.map((m) => m.tipo), ['ajuste', 'entrada', 'entrada'])
})

test('productos: PUT no modifica el stock; baja lógica; listas de alerta', async () => {
    const p = productoPorNombre('Mascarilla')
    const antes = await stockActual(p._id)
    const put = await llamar('PUT', `/productos/${p._id}`, { token: tokens.admin, body: { precio: 13, stock: 99999 } })
    assert.equal(put.status, 200)
    assert.equal(put.data.precio, 13)
    assert.equal(await stockActual(p._id), antes)

    const bajo = await llamar('GET', '/productos/bajo-stock', { token: tokens.almacen })
    assert.equal(bajo.status, 200)
    assert.ok(bajo.data.length >= 4)
    assert.ok(bajo.data.every((x) => x.stock <= x.stockMinimo))

    const porVencer = await llamar('GET', '/productos/por-vencer', { token: tokens.admin })
    assert.ok(porVencer.data.some((x) => x.nombre.startsWith('Loperamida'))) // ya vencido
    assert.ok(porVencer.data.some((x) => x.nombre.startsWith('Azitromicina'))) // vence en 20 días

    assert.equal((await llamar('DELETE', `/productos/${p._id}`, { token: tokens.admin })).status, 200)
    assert.equal((await llamar('GET', `/productos/${p._id}`, { token: tokens.admin })).status, 404)
})

test('reportes: resumen con ventas del día e indicadores de inventario', async () => {
    const { status, data } = await llamar('GET', '/reportes/resumen', { token: tokens.admin })
    assert.equal(status, 200)
    assert.ok(data.ventasHoy.cantidad >= 1)
    assert.ok(data.ventasHoy.total > 0)
    assert.ok(Array.isArray(data.topProductos))
    assert.ok(data.inventario.bajoStock >= 1)
    assert.ok(data.inventario.vencidos >= 1)
})

test('tiempo de atención: se mide con iniciadaEn y se descartan valores absurdos', async () => {
    const p = productoPorNombre('Jabón')
    const hace20s = new Date(Date.now() - 20000).toISOString()
    const venta = await llamar('POST', '/ventas', { token: tokens.vendedor, body: { items: [{ producto: p._id, cantidad: 1 }], iniciadaEn: hace20s } })
    assert.equal(venta.status, 201)
    const futura = await llamar('POST', '/ventas', {
        token: tokens.vendedor,
        body: { items: [{ producto: p._id, cantidad: 1 }], iniciadaEn: new Date(Date.now() + 3600000).toISOString() }
    })
    assert.equal(futura.data.iniciadaAt, undefined)

    const { data } = await llamar('GET', '/reportes/resumen', { token: tokens.admin })
    assert.ok(data.tiempoPromedioVentaSeg >= 20)
})

test('integridad: no se borra una categoría con productos; ids mal formados dan 400', async () => {
    const categorias = await llamar('GET', '/categorias', { token: tokens.vendedor })
    const { status, data } = await llamar('DELETE', `/categorias/${categorias.data[0]._id}`, { token: tokens.admin })
    assert.equal(status, 409)
    assert.match(data.error, /No se puede eliminar/)
    assert.equal((await llamar('GET', '/productos/abc', { token: tokens.admin })).status, 400)
})

test('usuarios: el admin no puede desactivarse a sí mismo; una cuenta desactivada pierde acceso', async () => {
    const usuarios = await llamar('GET', '/usuarios', { token: tokens.admin })
    const admin = usuarios.data.find((u) => u.rol === 'admin')
    const vend = usuarios.data.find((u) => u.rol === 'vendedor')
    assert.equal((await llamar('PUT', `/usuarios/${admin._id}`, { token: tokens.admin, body: { activo: false } })).status, 400)

    assert.equal((await llamar('PUT', `/usuarios/${vend._id}`, { token: tokens.admin, body: { activo: false } })).status, 200)
    assert.equal((await llamar('GET', '/productos', { token: tokens.vendedor })).status, 401) // el token aún no expiró, pero la cuenta está inactiva
    assert.equal((await llamar('POST', '/auth/login', { body: { email: 'vendedor@novasalud.pe', password: PASSWORD } })).status, 401)
})
