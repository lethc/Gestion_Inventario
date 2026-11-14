// Manejador final de errores: toda respuesta de error sale como { error: "mensaje" }.
// Express 5 envía aquí también los errores lanzados dentro de funciones async.
module.exports = (err, req, res, next) => {
    if (res.headersSent) return next(err)

    let status = err.status || 500
    let mensaje = err.message

    if (err.name === 'ValidationError') {
        status = 400
        mensaje = Object.values(err.errors).map((e) => e.message).join('; ')
    } else if (err.name === 'CastError') {
        status = 400
        mensaje = 'Identificador o valor inválido'
    } else if (err.code === 11000) {
        status = 409
        mensaje = `Ya existe un registro con ese valor (${Object.keys(err.keyValue || {}).join(', ')})`
    } else if (err.type === 'entity.parse.failed') {
        status = 400
        mensaje = 'JSON inválido'
    }

    // Los errores inesperados se registran en el servidor pero no se detallan al cliente
    if (status >= 500) {
        console.error(err)
        mensaje = 'Error interno del servidor'
    }

    res.status(status).json({ error: mensaje })
}
