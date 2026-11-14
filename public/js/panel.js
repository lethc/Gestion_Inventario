import { api, esc, moneda, fechaCorta, hoyISO, badge, estadoVencimiento } from './api.js'
import { iniciarPagina, socket } from './layout.js'

const usuario = iniciarPagina()
const $ = (id) => document.getElementById(id)

const tarjeta = (valor, etiqueta, clase = '') =>
    `<div class="tarjeta ${clase}"><div class="valor">${valor}</div><div class="etiqueta">${etiqueta}</div></div>`

function formatearTiempo(segundos) {
    if (segundos === null || segundos === undefined) return 'Sin datos'
    return segundos >= 60 ? `${Math.floor(segundos / 60)} min ${segundos % 60} s` : `${segundos} s`
}

async function cargarAdmin() {
    const r = await api('/reportes/resumen')
    $('tarjetas').innerHTML =
        tarjeta(moneda(r.ventasHoy.total), `Ventas de hoy (${r.ventasHoy.cantidad})`) +
        tarjeta(moneda(r.ventasHoy.ticketPromedio), 'Ticket promedio de hoy') +
        tarjeta(formatearTiempo(r.tiempoPromedioVentaSeg), 'Tiempo promedio por venta (30 días)') +
        tarjeta(r.inventario.bajoStock, 'Productos con stock bajo', r.inventario.bajoStock ? 'alerta' : '') +
        tarjeta(r.inventario.sinStock, 'Productos agotados', r.inventario.sinStock ? 'alerta' : '') +
        tarjeta(r.inventario.porVencer, 'Por vencer (30 días)', r.inventario.porVencer ? 'aviso' : '') +
        tarjeta(r.inventario.vencidos, 'Vencidos', r.inventario.vencidos ? 'alerta' : '')

    $('listaTop').innerHTML = r.topProductos.length
        ? `<div class="tabla-scroll"><table><thead><tr><th>Producto</th><th class="num">Unidades</th><th class="num">Monto</th></tr></thead><tbody>${
            r.topProductos.map((p) => `<tr><td>${esc(p.nombre)}</td><td class="num">${p.unidades}</td><td class="num">${moneda(p.monto)}</td></tr>`).join('')
        }</tbody></table></div>`
        : '<p class="vacio">Aún no hay ventas en el período.</p>'
}

async function cargarVendedor() {
    // El vendedor ve solo sus propias ventas de hoy
    const ventas = await api('/ventas', { params: { desde: hoyISO(), estado: 'completada' } })
    const total = ventas.reduce((suma, v) => suma + v.total, 0)
    $('tarjetas').innerHTML = tarjeta(ventas.length, 'Tus ventas de hoy') + tarjeta(moneda(total), 'Total vendido hoy')
    $('seccionAlertas').classList.add('oculto')
    $('seccionVencimientos').classList.add('oculto')
    $('seccionTop').classList.add('oculto')
}

async function cargarAlertas() {
    const productos = await api('/productos/bajo-stock')
    $('contadorAlertas').textContent = productos.length
    $('listaAlertas').innerHTML = productos.length
        ? `<div class="tabla-scroll"><table><thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Proveedor</th></tr></thead><tbody>${
            productos.map((p) => `<tr>
                <td>${esc(p.nombre)}</td>
                <td class="num"><span class="badge mal">${p.stock}</span></td>
                <td class="num">${p.stockMinimo}</td>
                <td>${esc(p.proveedor?.nombre || '—')}</td>
            </tr>`).join('')
        }</tbody></table></div>`
        : '<p class="vacio">Todo el inventario está sobre su stock mínimo.</p>'

    const vencimientos = await api('/productos/por-vencer')
    $('listaVencimientos').innerHTML = vencimientos.length
        ? `<div class="tabla-scroll"><table><thead><tr><th>Producto</th><th class="num">Stock</th><th>Vence</th></tr></thead><tbody>${
            vencimientos.map((p) => `<tr>
                <td>${esc(p.nombre)}</td>
                <td class="num">${p.stock}</td>
                <td>${fechaCorta(p.fechaVencimiento)} ${estadoVencimiento(p) ? badge(estadoVencimiento(p)) : ''}</td>
            </tr>`).join('')
        }</tbody></table></div>`
        : '<p class="vacio">No hay productos vencidos ni por vencer.</p>'
}

async function cargar() {
    try {
        $('error').classList.add('oculto')
        if (usuario.rol === 'admin') await cargarAdmin()
        else if (usuario.rol === 'vendedor') await cargarVendedor()
        else {
            $('tarjetas').innerHTML = ''
            $('seccionTop').classList.add('oculto')
        }
        if (usuario.rol !== 'vendedor') await cargarAlertas()
    } catch (error) {
        $('error').textContent = error.message
        $('error').classList.remove('oculto')
    }
}

if (usuario) {
    cargar()
    // Cada cambio de stock refresca el panel (con una pequeña espera para agrupar varios eventos seguidos)
    let temporizador
    const refrescar = () => {
        clearTimeout(temporizador)
        temporizador = setTimeout(cargar, 400)
    }
    socket?.on('stock:actualizado', refrescar)
}
