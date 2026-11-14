import { api, esc, moneda, fechaHora, hoyISO } from './api.js'
import { iniciarPagina } from './layout.js'

const usuario = iniciarPagina()
const $ = (id) => document.getElementById(id)

let ventas = []
let abierta = null

function mostrar(idError, texto) {
    $(idError).textContent = texto || ''
    $(idError).classList.toggle('oculto', !texto)
}

const nombreCliente = (v) => (v.cliente ? `${v.cliente.apellido}, ${v.cliente.nombre}` : '—')

async function cargar() {
    try {
        mostrar('error', '')
        ventas = await api('/ventas', { params: { desde: $('desde').value, hasta: $('hasta').value, estado: $('estado').value } })
        $('filas').innerHTML = ventas.length ? ventas.map((v) => `<tr>
            <td><strong>${esc(v.numero)}</strong></td>
            <td>${fechaHora(v.createdAt)}</td>
            <td>${esc(v.vendedor?.nombre || '')}</td>
            <td>${esc(nombreCliente(v))}</td>
            <td class="num">${moneda(v.total)}</td>
            <td><span class="badge ${v.estado === 'completada' ? 'ok' : 'mal'}">${esc(v.estado)}</span></td>
            <td><button class="sec chico" data-id="${v._id}">Ver detalle</button></td>
        </tr>`).join('') : '<tr><td colspan="7" class="vacio">No hay ventas en el período.</td></tr>'

        const completadas = ventas.filter((v) => v.estado === 'completada')
        const etiqueta = completadas.length === 1 ? 'venta completada' : 'ventas completadas'
        $('resumen').textContent = `${completadas.length} ${etiqueta} por ${moneda(completadas.reduce((s, v) => s + v.total, 0))}`
    } catch (error) {
        mostrar('error', error.message)
    }
}

$('filtros').addEventListener('submit', (e) => {
    e.preventDefault()
    cargar()
})

$('filas').addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-id]')
    if (!boton) return
    abierta = ventas.find((v) => v._id === boton.dataset.id)
    $('ventaTitulo').textContent = `Venta ${abierta.numero}`
    $('ventaMeta').textContent = `${fechaHora(abierta.createdAt)} · ${abierta.vendedor?.nombre || ''} · Cliente: ${nombreCliente(abierta)}` +
        (abierta.estado === 'anulada' ? ' · ANULADA' : '')
    $('ventaItems').innerHTML = abierta.items.map((i) => `<tr>
        <td>${esc(i.nombre)}</td><td class="num">${i.cantidad}</td>
        <td class="num">${moneda(i.precioUnitario)}</td><td class="num">${moneda(i.subtotal)}</td>
    </tr>`).join('')
    $('ventaTotal').textContent = moneda(abierta.total)
    mostrar('ventaError', '')
    // Solo el administrador anula, y solo ventas que sigan completadas
    $('btnAnular').classList.toggle('oculto', !(usuario.rol === 'admin' && abierta.estado === 'completada'))
    $('dlgVenta').showModal()
})

$('btnCerrar').addEventListener('click', () => $('dlgVenta').close())

$('btnAnular').addEventListener('click', async () => {
    if (!confirm(`¿Anular la venta ${abierta.numero}? Las unidades volverán al inventario.`)) return
    try {
        await api(`/ventas/${abierta._id}/anular`, { metodo: 'PATCH' })
        $('dlgVenta').close()
        await cargar()
    } catch (error) {
        mostrar('ventaError', error.message)
    }
})

if (usuario) {
    $('desde').value = hoyISO()
    cargar()
}
