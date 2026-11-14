const AuthService = require('../services/authService')
const AppError = require('../utils/AppError')

// Exige "Authorization: Bearer <token>" con un JWT válido y un usuario aún activo.
// Deja el usuario en req.user: { id, nombre, email, rol }.
exports.verifyToken = async (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new AppError(401, 'Token no enviado')
    }
    const usuario = await AuthService.verificarToken(authorization.slice(7))
    if (!usuario) throw new AppError(401, 'Token inválido o expirado')
    req.user = usuario
    next()
}
