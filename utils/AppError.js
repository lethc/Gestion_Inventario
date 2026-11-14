// Error con código HTTP. El middleware errorHandler lo convierte en respuesta JSON.
class AppError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

module.exports = AppError
