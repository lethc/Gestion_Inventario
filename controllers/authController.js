const AuthService = require('../services/authService')

exports.register = async (req, res) => {
    const usuario = await AuthService.register(req.body)
    res.status(201).json({ message: 'Usuario registrado', usuario })
}

exports.login = async (req, res) => {
    const { email, password } = req.body || {}
    res.json(await AuthService.login(email, password))
}

// Datos del usuario de la sesión (los puso verifyToken en req.user)
exports.me = async (req, res) => {
    res.json(req.user)
}
