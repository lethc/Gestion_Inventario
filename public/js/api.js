// Utilidades compartidas por todas las páginas: sesión, llamadas a la API y formato.

const CLAVE_TOKEN = 'token'
const CLAVE_USUARIO = 'usuario'

export const getToken = () => localStorage.getItem(CLAVE_TOKEN)

export function getUsuario() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE_USUARIO))
    } catch {
        return null
    }
}

export function guardarSesion(token, usuario) {
    localStorage.setItem(CLAVE_TOKEN, token)
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario))
}

export function cerrarSesion() {
    localStorage.removeItem(CLAVE_TOKEN)
    localStorage.removeItem(CLAVE_USUARIO)
    window.location.href = '/login.html'
}

// Llama a la API con el JWT. Lanza Error con el mensaje del servidor si la respuesta no es 2xx.
// Un 401 (token vencido o cuenta desactivada) cierra la sesión.
export async function api(ruta, { metodo = 'GET', cuerpo, params } = {}) {
    let url = ruta
    if (params) {
        const consulta = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
        if ([...consulta].length) url += '?' + consulta
    }
    const respuesta = await fetch(url, {
        method: metodo,
        headers: {
            ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
            ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {})
        },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    })
    const datos = await respuesta.json().catch(() => null)
    if (respuesta.status === 401 && ruta !== '/auth/login') {
        cerrarSesion()
        throw new Error('Tu sesión expiró. Inicia sesión nuevamente.')
    }
    if (!respuesta.ok) throw new Error(datos?.error || `Error ${respuesta.status}`)
    return datos
}

// Escapa texto antes de insertarlo en HTML (los datos vienen de usuarios: nunca confiar en ellos)
export const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

export const moneda = (n) => 'S/ ' + Number(n || 0).toFixed(2)

export const fechaCorta = (valor) => (valor ? new Date(valor).toLocaleDateString('es-PE') : '—')
export const fechaHora = (valor) => (valor ? new Date(valor).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—')

// Fecha local en formato YYYY-MM-DD para inputs type="date"
export function hoyISO() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Semáforo de stock: rojo = en o bajo el mínimo, amarillo = cerca del mínimo, verde = normal
export function estadoStock(p) {
    if (p.stock === 0) return { clase: 'mal', texto: 'Agotado' }
    if (p.stock <= p.stockMinimo) return { clase: 'mal', texto: 'Stock bajo' }
    if (p.stock <= p.stockMinimo * 1.5) return { clase: 'aviso', texto: 'Cerca del mínimo' }
    return { clase: 'ok', texto: 'Normal' }
}

// Vencimiento: null si no aplica o está lejos
export function estadoVencimiento(p, dias = 30) {
    if (!p.fechaVencimiento) return null
    const restante = (new Date(p.fechaVencimiento) - Date.now()) / 86400000
    if (restante < 0) return { clase: 'mal', texto: 'Vencido', vencido: true }
    if (restante <= dias) return { clase: 'aviso', texto: `Vence en ${Math.ceil(restante)} d`, vencido: false }
    return null
}

export const badge = (estado) => `<span class="badge ${estado.clase}">${esc(estado.texto)}</span>`
