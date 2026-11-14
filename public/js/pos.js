import { api, esc, moneda, badge, estadoStock, estadoVencimiento } from './api.js'
import { iniciarPagina, socket } from './layout.js'

const usuario = iniciarPagina()
const $ = (id) => document.getElementById(id)

// Estado de la venta en curso
const carrito = new Map() // id de producto -> { producto, cantidad }
let cliente = null // { _id, nombre, apellido, dni } o null
let iniciadaEn = null // momento en que se agregó el primer producto (mide el tiempo de atención)
let ultimosResultados = []
let clientesEncontrados = []

const total = () => [...carrito.values()].reduce((suma, l) => suma + l.producto.precio * l.cantidad, 0)

function mostrarError(texto) {
    $('mensaje').textContent = texto
    $('mensaje').classList.toggle('oculto', !texto)
}

// ---------- Búsqueda de productos ----------
const puedeVender = (p) => p.stock > 0 && !estadoVencimiento(p)?.vencido

function pintarResultados() {
    $('resultados').innerHTML = ultimosResultados.length
        ? ultimosResultados.map((p, i) => {
            const venc = estadoVencimiento(p)
            return `<button class="resultado" data-i="${i}" ${puedeVender(p) ? '' : 'disabled'}>
                <span>
                    <span class="nombre">${esc(p.nombre)}</span>
                    <span class="meta">${esc(p.categoria?.nombre || '')}</span>
                </span>
                <span style="text-align:right">
                    <strong>${moneda(p.precio)}</strong><br>
                    ${badge(estadoStock(p))} <span class="mini">${p.stock} u.</span>
                    ${venc ? badge(venc) : ''}
                    ${p.requiereReceta ? '<span class="badge info">Receta</span>' : ''}
                </span>
            </button>`
        }).join('')
        : '<p class="vacio">Sin resultados</p>'
}

async function buscar() {
    try {
        ultimosResultados = (await api('/productos', { params: { q: $('busqueda').value.trim() } })).slice(0, 15)
        pintarResultados()
    } catch (error) {
        mostrarError(error.message)
    }
}

let temporizador
$('busqueda').addEventListener('input', () => {
    clearTimeout(temporizador)
    temporizador = setTimeout(buscar, 250)
})
$('busqueda').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        const primero = ultimosResultados.find(puedeVender)
        if (primero) agregar(primero)
    }
})
$('resultados').addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-i]')
    if (boton) agregar(ultimosResultados[Number(boton.dataset.i)])
})

// ---------- Carrito ----------
function agregar(producto) {
    mostrarError('')
    $('comprobante').classList.add('oculto')
    if (!iniciadaEn) iniciadaEn = new Date()
    const linea = carrito.get(producto._id)
    if (linea) {
        if (linea.cantidad >= producto.stock) return mostrarError(`Solo hay ${producto.stock} unidades de ${producto.nombre}`)
        linea.cantidad++
    } else {
        carrito.set(producto._id, { producto, cantidad: 1 })
    }
    pintarCarrito()
    $('busqueda').select()
}

function pintarCarrito() {
    const lineas = [...carrito.values()]
    $('carrito').innerHTML = lineas.length
        ? `<div class="tabla-scroll"><table><thead><tr><th>Producto</th><th>Cant.</th><th class="num">Subtotal</th><th></th></tr></thead><tbody>${
            lineas.map(({ producto, cantidad }) => `<tr>
                <td>${esc(producto.nombre)}<br><span class="mini">${moneda(producto.precio)} c/u</span></td>
                <td><span class="cant">
                    <button class="sec chico" data-menos="${producto._id}" aria-label="Quitar una unidad">−</button>
                    <input type="number" min="1" max="${producto.stock}" value="${cantidad}" data-cant="${producto._id}" aria-label="Cantidad">
                    <button class="sec chico" data-mas="${producto._id}" aria-label="Agregar una unidad">+</button>
                </span></td>
                <td class="num">${moneda(producto.precio * cantidad)}</td>
                <td><button class="sec chico" data-quitar="${producto._id}" aria-label="Quitar producto">✕</button></td>
            </tr>`).join('')
        }</tbody></table></div>`
        : '<p class="vacio">Agrega productos desde el buscador.</p>'
    $('total').textContent = moneda(total())
    $('btnRegistrar').disabled = lineas.length === 0
}

function cambiarCantidad(id, nueva) {
    const linea = carrito.get(id)
    if (!linea) return
    if (!Number.isInteger(nueva) || nueva < 1) nueva = 1
    if (nueva > linea.producto.stock) {
        nueva = linea.producto.stock
        mostrarError(`Solo hay ${nueva} unidades de ${linea.producto.nombre}`)
    } else {
        mostrarError('')
    }
    linea.cantidad = nueva
    pintarCarrito()
}

$('carrito').addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.dataset.mas) cambiarCantidad(b.dataset.mas, carrito.get(b.dataset.mas).cantidad + 1)
    else if (b.dataset.menos) cambiarCantidad(b.dataset.menos, carrito.get(b.dataset.menos).cantidad - 1)
    else if (b.dataset.quitar) {
        carrito.delete(b.dataset.quitar)
        if (!carrito.size) iniciadaEn = null
        pintarCarrito()
    }
})
$('carrito').addEventListener('change', (e) => {
    if (e.target.dataset.cant) cambiarCantidad(e.target.dataset.cant, Number(e.target.value))
})

function vaciar() {
    carrito.clear()
    cliente = null
    iniciadaEn = null
    $('buscaCliente').value = ''
    $('clienteElegido').textContent = 'Venta sin cliente'
    mostrarError('')
    pintarCarrito()
}
$('btnLimpiar').addEventListener('click', () => {
    $('comprobante').classList.add('oculto')
    vaciar()
})

// ---------- Cliente (opcional) ----------
const etiquetaCliente = (c) => `${c.apellido}, ${c.nombre}${c.dni ? ' — ' + c.dni : ''}`
let temporizadorCliente
$('buscaCliente').addEventListener('input', () => {
    const texto = $('buscaCliente').value.trim()
    // Si el texto coincide con una opción del datalist, ese cliente queda seleccionado
    const elegido = clientesEncontrados.find((c) => etiquetaCliente(c) === texto)
    if (elegido) {
        cliente = elegido
        $('clienteElegido').textContent = 'Cliente: ' + etiquetaCliente(elegido)
        return
    }
    cliente = null
    $('clienteElegido').textContent = 'Venta sin cliente'
    clearTimeout(temporizadorCliente)
    if (texto.length < 2) return
    temporizadorCliente = setTimeout(async () => {
        try {
            clientesEncontrados = await api('/clientes', { params: { q: texto } })
            $('listaClientes').innerHTML = clientesEncontrados.map((c) => `<option value="${esc(etiquetaCliente(c))}"></option>`).join('')
        } catch { /* la búsqueda de clientes es opcional: se ignora el error */ }
    }, 250)
})

// ---------- Registrar la venta ----------
$('btnRegistrar').addEventListener('click', async () => {
    mostrarError('')
    $('btnRegistrar').disabled = true
    try {
        const venta = await api('/ventas', {
            metodo: 'POST',
            cuerpo: {
                items: [...carrito.values()].map((l) => ({ producto: l.producto._id, cantidad: l.cantidad })),
                cliente: cliente?._id,
                iniciadaEn: iniciadaEn?.toISOString()
            }
        })
        const segundos = iniciadaEn ? Math.round((Date.now() - iniciadaEn) / 1000) : null
        $('comprobante').textContent = `Venta ${venta.numero} registrada por ${moneda(venta.total)}` +
            (segundos !== null ? ` · atendida en ${segundos} s` : '')
        $('comprobante').classList.remove('oculto')
        vaciar()
        $('busqueda').value = ''
        $('busqueda').focus()
        await buscar()
    } catch (error) {
        mostrarError(error.message)
        $('btnRegistrar').disabled = carrito.size === 0
        await buscar() // refresca los stocks por si cambiaron
    }
})

if (usuario) {
    pintarCarrito()
    buscar()
    // Si otro vendedor vende un producto, se actualizan los resultados visibles
    let espera
    socket?.on('stock:actualizado', () => {
        clearTimeout(espera)
        espera = setTimeout(buscar, 400)
    })
}
