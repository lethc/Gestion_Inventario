const AppError = require('../utils/AppError')

// Uso: router.post('/', verifyToken, checkRole('admin', 'vendedor'), controlador)
// Debe ir después de verifyToken, que es quien llena req.user.
module.exports = (...rolesPermitidos) => (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
        throw new AppError(403, 'No tienes permiso para realizar esta acción')
    }
    next()
}
