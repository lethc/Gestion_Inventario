const AppError = require('./AppError')

// Copia solo los campos permitidos (evita asignación masiva desde req.body)
exports.pick = (obj, campos) => {
    const salida = {}
    for (const campo of campos) {
        if (obj && obj[campo] !== undefined) salida[campo] = obj[campo]
    }
    return salida
}

// Los query params pueden llegar como arreglo si se repiten; solo aceptamos texto
exports.str = (valor) => (typeof valor === 'string' && valor.trim() ? valor.trim() : undefined)

exports.escapeRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

exports.round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Valida un entero positivo y lo devuelve; si no lo es lanza 400
exports.enteroPositivo = (valor, nombreCampo = 'cantidad') => {
    const n = Number(valor)
    if (!Number.isInteger(n) || n < 1) {
        throw new AppError(400, `La ${nombreCampo} debe ser un número entero mayor a 0`)
    }
    return n
}

// Convierte "YYYY-MM-DD" a una fecha local; lanza 400 si es inválida.
// finDeDia=true devuelve el último instante de ese día (para filtros "hasta").
exports.parseFecha = (texto, finDeDia = false) => {
    if (!texto) return undefined
    const fecha = new Date(`${texto}T${finDeDia ? '23:59:59.999' : '00:00:00'}`)
    if (Number.isNaN(fecha.getTime())) throw new AppError(400, `Fecha inválida: ${texto}`)
    return fecha
}
