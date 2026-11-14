const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/userModel')
const { ROLES } = require('../models/userModel')
const AppError = require('../utils/AppError')
const { jwtSecret, jwtExpiresIn } = require('../config')

// Hash de relleno: si el email no existe igual se ejecuta bcrypt.compare,
// para que el tiempo de respuesta no revele qué correos están registrados.
const HASH_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10)

class AuthService {
    static async register(data) {
        const { nombre, email, password, rol } = data || {}
        if (typeof password !== 'string' || password.length < 8) {
            throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres')
        }
        if (rol !== undefined && !ROLES.includes(rol)) throw new AppError(400, 'Rol inválido')

        const hash = await bcrypt.hash(password, 10)
        const usuario = await User.create({ nombre, email, password: hash, rol })
        return AuthService.publico(usuario)
    }

    static async login(email, password) {
        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
            throw new AppError(400, 'Email y contraseña son obligatorios')
        }
        const usuario = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')
        const coincide = await bcrypt.compare(password, usuario ? usuario.password : HASH_RELLENO)

        // Mismo mensaje para "no existe", "contraseña incorrecta" y "cuenta desactivada"
        if (!usuario || !coincide || !usuario.activo) {
            throw new AppError(401, 'Credenciales incorrectas')
        }
        return { token: AuthService.generateToken(usuario), usuario: AuthService.publico(usuario) }
    }

    // El payload no lleva datos sensibles: el JWT va firmado, no cifrado
    static generateToken(usuario) {
        return jwt.sign(
            { rol: usuario.rol, nombre: usuario.nombre },
            jwtSecret,
            { subject: String(usuario._id), expiresIn: jwtExpiresIn, algorithm: 'HS256' }
        )
    }

    // Valida el token y confirma en la base que el usuario sigue activo.
    // Así, desactivar una cuenta o cambiar su rol surte efecto de inmediato.
    // Devuelve { id, nombre, email, rol } o null si el token no sirve.
    static async verificarToken(token) {
        try {
            const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
            const usuario = await User.findById(payload.sub)
            if (!usuario || !usuario.activo) return null
            return AuthService.publico(usuario)
        } catch {
            return null
        }
    }

    static publico(usuario) {
        return { id: String(usuario._id), nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
    }
}

module.exports = AuthService
