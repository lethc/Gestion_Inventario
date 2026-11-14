// Barra de navegación, control de acceso por rol y conexión Socket.IO.
// Cada página llama a iniciarPagina() antes de hacer cualquier otra cosa.
import { getToken, getUsuario, cerrarSesion, esc } from './api.js'

const MENU = [
    { href: '/panel.html', texto: 'Panel', roles: ['admin', 'vendedor', 'almacen'] },
    { href: '/pos.html', texto: 'Punto de venta', roles: ['admin', 'vendedor'] },
    { href: '/inventario.html', texto: 'Inventario', roles: ['admin', 'vendedor', 'almacen'] },
    { href: '/ventas.html', texto: 'Ventas', roles: ['admin', 'vendedor'] },
    { href: '/mantenimiento.html', texto: 'Mantenimiento', roles: ['admin', 'vendedor'] }
]

const NOMBRE_ROL = { admin: 'Administrador', vendedor: 'Vendedor', almacen: 'Almacén' }

export let socket = null

export function toast(mensaje, tipo = 'alerta') {
    let contenedor = document.getElementById('toasts')
    if (!contenedor) {
        contenedor = document.createElement('div')
        contenedor.id = 'toasts'
        document.body.append(contenedor)
    }
    const aviso = document.createElement('div')
    aviso.className = 'toast ' + (tipo === 'info' ? 'info' : '')
    aviso.textContent = mensaje
    contenedor.append(aviso)
    setTimeout(() => aviso.remove(), 7000)
}

// Devuelve el usuario de la sesión, o redirige al login si no hay sesión o el rol no tiene acceso.
export function iniciarPagina() {
    const usuario = getUsuario()
    if (!getToken() || !usuario) {
        cerrarSesion()
        return null
    }

    const permitido = MENU.find((m) => window.location.pathname === m.href)
    if (permitido && !permitido.roles.includes(usuario.rol)) {
        window.location.href = '/panel.html'
        return null
    }

    const enlaces = MENU.filter((m) => m.roles.includes(usuario.rol))
        .map((m) => `<a href="${m.href}" class="${window.location.pathname === m.href ? 'activo' : ''}">${m.texto}</a>`)
        .join('')
    document.getElementById('topbar').innerHTML = `
        <span class="marca">Nova Salud</span>
        <nav>${enlaces}</nav>
        <span class="sesion">
            ${esc(usuario.nombre)} <span class="rol">${esc(NOMBRE_ROL[usuario.rol] || usuario.rol)}</span>
            <button class="sec chico" id="btnSalir">Salir</button>
        </span>`
    document.getElementById('btnSalir').addEventListener('click', cerrarSesion)

    conectarSocket()
    return usuario
}

function conectarSocket() {
    // /socket.io/socket.io.js define "io" globalmente; cada página lo incluye antes del módulo
    if (typeof io === 'undefined') return
    socket = io({ auth: { token: getToken() } })
    socket.on('connect_error', (error) => {
        // Token inválido o cuenta desactivada: se vuelve al login
        if (error.message === 'No autorizado') cerrarSesion()
    })
    socket.on('stock:bajo', (p) => {
        toast(`Reponer: ${p.nombre} — quedan ${p.stock} (mínimo ${p.stockMinimo})`)
    })
}
