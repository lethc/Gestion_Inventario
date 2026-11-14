// Pantalla genérica de mantenimiento: cada entidad se describe con un objeto y el mismo código
// dibuja la tabla, el formulario y las llamadas a la API.
import { api, esc } from './api.js'
import { iniciarPagina } from './layout.js'

const usuario = iniciarPagina()
const $ = (id) => document.getElementById(id)

const ENTIDADES = {
    clientes: {
        titulo: 'Clientes', ruta: '/clientes', roles: ['admin', 'vendedor'], borrar: ['admin'],
        campos: [
            { n: 'nombre', l: 'Nombre', req: true }, { n: 'apellido', l: 'Apellido', req: true },
            { n: 'dni', l: 'DNI' }, { n: 'telefono', l: 'Teléfono' },
            { n: 'email', l: 'Email', tipo: 'email' }, { n: 'direccion', l: 'Dirección' }
        ],
        columnas: ['apellido', 'nombre', 'dni', 'telefono', 'email']
    },
    categorias: {
        titulo: 'Categorías', ruta: '/categorias', roles: ['admin'], borrar: ['admin'],
        campos: [{ n: 'nombre', l: 'Nombre', req: true }, { n: 'descripcion', l: 'Descripción' }, { n: 'activa', l: 'Activa', tipo: 'bool', defecto: true }],
        columnas: ['nombre', 'descripcion', 'activa']
    },
    proveedores: {
        titulo: 'Proveedores', ruta: '/proveedores', roles: ['admin'], borrar: ['admin'],
        campos: [
            { n: 'nombre', l: 'Nombre', req: true }, { n: 'ruc', l: 'RUC' }, { n: 'telefono', l: 'Teléfono' },
            { n: 'email', l: 'Email', tipo: 'email' }, { n: 'direccion', l: 'Dirección' }
        ],
        columnas: ['nombre', 'ruc', 'telefono', 'email']
    },
    usuarios: {
        titulo: 'Usuarios', ruta: '/usuarios', rutaAlta: '/auth/register', roles: ['admin'], borrar: [],
        campos: [
            { n: 'nombre', l: 'Nombre', req: true },
            { n: 'email', l: 'Email', tipo: 'email', req: true, soloAlta: true },
            { n: 'password', l: 'Contraseña (mínimo 8 caracteres)', tipo: 'password', soloAlta: true, req: true },
            { n: 'password', l: 'Nueva contraseña (vacío = no cambiar)', tipo: 'password', soloEdicion: true },
            { n: 'rol', l: 'Rol', tipo: 'select', opciones: ['admin', 'vendedor', 'almacen'], defecto: 'vendedor' },
            { n: 'activo', l: 'Cuenta activa', tipo: 'bool', defecto: true }
        ],
        columnas: ['nombre', 'email', 'rol', 'activo']
    }
}

const disponibles = Object.entries(ENTIDADES).filter(([, e]) => e.roles.includes(usuario?.rol))
let clave = disponibles[0]?.[0]
let filas = []
let editando = null // documento en edición o null si es alta

const entidad = () => ENTIDADES[clave]
const etiquetaColumna = (n) => entidad().campos.find((c) => c.n === n)?.l.replace(/ \(.*\)/, '') || n

function mostrar(idError, texto) {
    $(idError).textContent = texto || ''
    $(idError).classList.toggle('oculto', !texto)
}

function celda(valor) {
    if (typeof valor === 'boolean') return `<span class="badge ${valor ? 'ok' : 'mal'}">${valor ? 'Sí' : 'No'}</span>`
    return esc(valor ?? '—')
}

function pintarPestanas() {
    $('pestanas').innerHTML = disponibles.map(([k, e]) =>
        `<button class="${k === clave ? '' : 'sec'}" data-clave="${k}">${e.titulo}</button>`).join('')
}

async function cargar() {
    const e = entidad()
    try {
        mostrar('error', '')
        filas = await api(e.ruta, { params: { q: $('buscar').value.trim() } })
        $('cabecera').innerHTML = `<tr>${e.columnas.map((c) => `<th>${esc(etiquetaColumna(c))}</th>`).join('')}<th>Acciones</th></tr>`
        $('filas').innerHTML = filas.length ? filas.map((f) => `<tr>
            ${e.columnas.map((c) => `<td>${celda(f[c])}</td>`).join('')}
            <td><div class="acciones">
                <button class="sec chico" data-editar="${f._id}">Editar</button>
                ${e.borrar.includes(usuario.rol) ? `<button class="peligro chico" data-borrar="${f._id}">Eliminar</button>` : ''}
            </div></td>
        </tr>`).join('') : `<tr><td colspan="${e.columnas.length + 1}" class="vacio">Sin registros.</td></tr>`
    } catch (error) {
        mostrar('error', error.message)
    }
}

function campoHTML(c, valor) {
    if (c.tipo === 'bool') {
        return `<label class="check"><input type="checkbox" name="${c.n}" ${valor ? 'checked' : ''}> ${esc(c.l)}</label>`
    }
    if (c.tipo === 'select') {
        return `<label>${esc(c.l)}<select name="${c.n}">${c.opciones.map((o) => `<option ${o === valor ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`
    }
    return `<label>${esc(c.l)}<input name="${c.n}" type="${c.tipo || 'text'}" value="${esc(c.tipo === 'password' ? '' : valor ?? '')}" ${c.req ? 'required' : ''} ${c.tipo === 'password' ? 'minlength="8" autocomplete="new-password"' : ''}></label>`
}

function abrirFormulario(doc) {
    editando = doc
    const e = entidad()
    $('formTitulo').textContent = `${doc ? 'Editar' : 'Nuevo'} — ${e.titulo}`
    const campos = e.campos.filter((c) => !(doc ? c.soloAlta : c.soloEdicion))
    $('campos').innerHTML = campos.map((c) => campoHTML(c, doc ? doc[c.n] : c.defecto)).join('')
    mostrar('formError', '')
    $('dlgForm').showModal()
}

$('formulario').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const e = entidad()
    const cuerpo = {}
    for (const c of e.campos.filter((c) => !(editando ? c.soloAlta : c.soloEdicion))) {
        const entrada = $('formulario').elements[c.n]
        cuerpo[c.n] = c.tipo === 'bool' ? entrada.checked : entrada.value
    }
    if (editando && cuerpo.password === '') delete cuerpo.password
    try {
        if (editando) await api(`${e.ruta}/${editando._id}`, { metodo: 'PUT', cuerpo })
        else await api(e.rutaAlta || e.ruta, { metodo: 'POST', cuerpo })
        $('dlgForm').close()
        await cargar()
    } catch (error) {
        mostrar('formError', error.message)
    }
})

$('btnCancelar').addEventListener('click', () => $('dlgForm').close())
$('btnNuevo').addEventListener('click', () => abrirFormulario(null))

$('pestanas').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-clave]')
    if (!b) return
    clave = b.dataset.clave
    $('buscar').value = ''
    pintarPestanas()
    cargar()
})

$('filas').addEventListener('click', async (ev) => {
    const b = ev.target.closest('button')
    if (!b) return
    if (b.dataset.editar) abrirFormulario(filas.find((f) => f._id === b.dataset.editar))
    if (b.dataset.borrar && confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) {
        try {
            await api(`${entidad().ruta}/${b.dataset.borrar}`, { metodo: 'DELETE' })
            await cargar()
        } catch (error) {
            mostrar('error', error.message)
        }
    }
})

let espera
$('buscar').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(cargar, 250)
})

if (usuario) {
    pintarPestanas()
    cargar()
}
