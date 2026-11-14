const express = require('express')
const rateLimit = require('express-rate-limit')
const authController = require('../controllers/authController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const { loginMaxIntentos } = require('../config')

const router = express.Router()

// Frena los intentos de adivinar contraseñas: máximo N logins por IP cada 15 minutos
const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginMaxIntentos,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos.' }
})

router.post('/login', limitarLogin, authController.login)
router.post('/register', verifyToken, checkRole('admin'), authController.register)
router.get('/me', verifyToken, authController.me)

module.exports = router
