// Configuración central. Los valores sensibles se leen del archivo .env (que no se sube a git).
require('dotenv').config({ quiet: true })

const env = process.env

if (!env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el archivo .env (ver .env.example).')
    process.exit(1)
}

module.exports = {
    port: Number(env.PORT) || 3000,
    mongoUri: env.MONGO_URI || 'mongodb://127.0.0.1:27017/nova_salud',
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    // Intentos de login permitidos por IP en 15 minutos
    loginMaxIntentos: Number(env.LOGIN_MAX_INTENTOS) || 20,
    // Días hacia adelante para considerar un producto "por vencer"
    diasPorVencer: 30
}
