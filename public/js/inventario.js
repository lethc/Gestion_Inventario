import { api, esc, moneda, fechaCorta, fechaHora, badge, estadoStock, estadoVencimiento } from './api.js'
import { iniciarPagina, socket } from './layout.js'

const usuario = iniciarPagina()
const $ = (id) => document.getElementById(id)

const esAdmin = usuario?.rol === 'admin'
const puedeEntrada = esAdmin || usuario?.rol === 'almacen'
const puedeKardex = puedeEntrada

let productos = []
let seleccionado = null // producto sobre el que se abrió un diálogo

// Los botones "Cancelar/Cerrar" de todos los diálogos
document.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()))

function mostrar(idError, texto) {
    $(idError).textContent = texto || ''
    $(idError).classList.toggle('oculto', !texto)
}

// ---------- Tabla ----------
function filtrados() {
    const texto = $('filtroTexto').value.trim().toLowerCase()
    const categoria = $('filtroCategoria').value
    const estado = $('filtroEstado').value
    return productos.filter((p) => {
        if (texto && !p.nombre.toLowerCase().includes(texto)) return false
        if (categoria && p.categoria?._id !== categoria) return false
        if (estado === 'bajo' && p.stock > p.stockMinimo) return false
        if (estado === 'vence' && !estadoVencimiento(p)) return false
        return true
    })
}

function pintar() {
    const lista = filtrados()
    $('filas').innerHTML = lista.length ? lista.map((p) => {
        const venc = estadoVencimiento(p)
        const acciones = [
            puedeEntrada ? `<button class="chico" data-accion="entrada" data-id="${p._id}">Entrada</button>` : '',
            puedeKardex ? `<button class="sec chico" data-accion="kardex" data-id="${p._id}">Kardex</button>` : '',
            esAdmin ? `<button class="sec chico" data-accion="ajuste" data-id="${p._id}">Ajustar</button>` : '',
            esAdmin ? `<button class="sec chico" data-accion="editar" data-id="${p._id}">Editar</button>` : '',
            esAdmin ? `<button class="peligro chico" data-accion="baja" data-id="${p._id}">Baja</button>` : ''
        ].join('')
        return `<tr>
            <td>${esc(p.nombre)} ${p.requiereReceta ? '<span class="badge info">Receta</span>' : ''}</td>
            <td>${esc(p.categoria?.nombre || '—')}</td>
            <td class="num">${moneda(p.precio)}</td>
            <td class="num">${p.stock} ${badge(estadoStock(p))}</td>
            <td class="num">${p.stockMinimo}</td>
            <td>${fechaCorta(p.fechaVencimiento)} ${venc ? badge(venc) : ''}</td>
            <td><div class="acciones">${acciones}</div></td>
        </tr>`
    }).join('') : '<tr><td colspan="7" class="vacio">No hay productos que coincidan.</td></tr>'
    $('resumen').textContent = `${lista.length} de ${productos.length} productos`
}

async function cargar() {
    try {
        mostrar('error', '')
        productos = await api('/productos')
        pintar()
    } catch (error) {
        mostrar('error', error.message)
    }
}

for (const id of ['filtroTexto', 'filtroCategoria', 'filtroEstado']) $(id).addEventListener('input', pintar)

// ---------- Acciones de fila ----------
$('filas').addEventListener('click', async (e) => {
    const boton = e.target.closest('button[data-accion]')
    if (!boton) return
    seleccionado = productos.find((p) => p._id === boton.dataset.id)
    if (!seleccionado) return

    switch (boton.dataset.accion) {
        case 'entrada':
            $('entradaProducto').textContent = `${seleccionado.nombre} — stock actual: ${seleccionado.stock}`
            $('formEntrada').reset()
            mostrar('entradaError', '')
            $('dlgEntrada').showModal()
            break
        case 'ajuste':
            $('ajusteProducto').textContent = `${seleccionado.nombre} — stock en sistema: ${seleccionado.stock}`
            $('formAjuste').reset()
            mostrar('ajusteError', '')
            $('dlgAjuste').showModal()
            break
        case 'kardex':
            await abrirKardex()
            break
        case 'editar':
            abrirProducto(seleccionado)
            break
        case 'baja':
            if (confirm(`¿Dar de baja "${seleccionado.nombre}"? Dejará de mostrarse, pero su historial se conserva.`)) {
                try {
                    await api(`/productos/${seleccionado._id}`, { metodo: 'DELETE' })
                    await cargar()
                } catch (error) {
                    mostrar('error', error.message)
                }
            }
            break
    }
})

$('formEntrada').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
        await api('/inventario/entrada', {
            metodo: 'POST',
            cuerpo: { producto: seleccionado._id, cantidad: Number($('entradaCantidad').value), motivo: $('entradaMotivo').value.trim() || undefined }
        })
        $('dlgEntrada').close()
        await cargar()
    } catch (error) {
        mostrar('entradaError', error.message)
    }
})

$('formAjuste').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
        await api('/inventario/ajuste', {
            metodo: 'POST',
            cuerpo: { producto: seleccionado._id, stockReal: Number($('ajusteStock').value), motivo: $('ajusteMotivo').value }
        })
        $('dlgAjuste').close()
        await cargar()
    } catch (error) {
        mostrar('ajusteError', error.message)
    }
})

async function abrirKardex() {
    try {
        const { producto, movimientos } = await api(`/inventario/kardex/${seleccionado._id}`)
        $('kardexTitulo').textContent = `Kardex — ${producto.nombre}`
        const clase = { entrada: 'ok', salida: 'aviso', ajuste: 'info' }
        $('kardexFilas').innerHTML = movimientos.length ? movimientos.map((m) => `<tr>
            <td>${fechaHora(m.createdAt)}</td>
            <td><span class="badge ${clase[m.tipo]}">${esc(m.tipo)}</span></td>
            <td class="num">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</td>
            <td class="num">${m.stockResultante}</td>
            <td>${esc(m.motivo || '')}</td>
            <td>${esc(m.usuario?.nombre || '')}</td>
        </tr>`).join('') : '<tr><td colspan="6" class="vacio">Sin movimientos.</td></tr>'
        $('dlgKardex').showModal()
    } catch (error) {
        mostrar('error', error.message)
    }
}

// ---------- Alta y edición de producto (administrador) ----------
async function llenarSelects() {
    const [categorias, proveedores] = await Promise.all([
        api('/categorias'),
        esAdmin ? api('/proveedores') : Promise.resolve([])
    ])
    $('filtroCategoria').insertAdjacentHTML('beforeend', categorias.map((c) => `<option value="${c._id}">${esc(c.nombre)}</option>`).join(''))
    $('pCategoria').insertAdjacentHTML('beforeend', categorias.map((c) => `<option value="${c._id}">${esc(c.nombre)}</option>`).join(''))
    $('pProveedor').insertAdjacentHTML('beforeend', proveedores.map((p) => `<option value="${p._id}">${esc(p.nombre)}</option>`).join(''))
}

function abrirProducto(p) {
    $('formProducto').reset()
    mostrar('productoError', '')
    $('productoTitulo').textContent = p ? 'Editar producto' : 'Nuevo producto'
    // El stock no se edita aquí: cambia solo con entradas, ajustes y ventas (queda en el kardex)
    $('pStockWrap').classList.toggle('oculto', Boolean(p))
    if (p) {
        $('pNombre').value = p.nombre
        $('pDescripcion').value = p.descripcion || ''
        $('pPrecio').value = p.precio
        $('pMinimo').value = p.stockMinimo
        $('pVence').value = p.fechaVencimiento ? p.fechaVencimiento.slice(0, 10) : ''
        $('pCategoria').value = p.categoria?._id || ''
        $('pProveedor').value = p.proveedor?._id || ''
        $('pReceta').checked = p.requiereReceta
    }
    $('dlgProducto').showModal()
}

$('formProducto').addEventListener('submit', async (e) => {
    e.preventDefault()
    const cuerpo = {
        nombre: $('pNombre').value.trim(),
        descripcion: $('pDescripcion').value.trim(),
        precio: Number($('pPrecio').value),
        stockMinimo: Number($('pMinimo').value),
        fechaVencimiento: $('pVence').value || null,
        categoria: $('pCategoria').value || null,
        proveedor: $('pProveedor').value || null,
        requiereReceta: $('pReceta').checked
    }
    const editando = seleccionado && $('productoTitulo').textContent === 'Editar producto'
    if (!editando) cuerpo.stock = Number($('pStock').value || 0)
    try {
        await api(editando ? `/productos/${seleccionado._id}` : '/productos', { metodo: editando ? 'PUT' : 'POST', cuerpo })
        $('dlgProducto').close()
        await cargar()
    } catch (error) {
        mostrar('productoError', error.message)
    }
})

if (esAdmin) {
    $('btnNuevo').classList.remove('oculto')
    $('btnNuevo').addEventListener('click', () => {
        seleccionado = null
        abrirProducto(null)
    })
}

if (usuario) {
    llenarSelects().then(cargar).catch((error) => mostrar('error', error.message))
    let espera
    socket?.on('stock:actualizado', () => {
        clearTimeout(espera)
        espera = setTimeout(cargar, 400)
    })
}
