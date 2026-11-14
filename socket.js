const AuthService = require('./services/authService')

// Eventos de Socket.IO del servidor. app.js lo invoca con la instancia io.
//
// Cada navegador debe enviar su JWT al conectar: io({ auth: { token } }).
// Con el token válido, el socket entra a salas según su rol y recibe:
//   - "stock:bajo"        (solo admin y almacén): un producto llegó a su stock mínimo
//   - "stock:actualizado" (todos): cambió el stock de uno o más productos
module.exports = (io) => {
    io.use(async (socket, next) => {
        const usuario = await AuthService.verificarToken(socket.handshake.auth?.token)
        if (!usuario) return next(new Error('No autorizado'))
        socket.data.usuario = usuario
        next()
    })

    io.on('connection', (socket) => {
        const { rol, nombre } = socket.data.usuario
        socket.join(['autenticados', `rol:${rol}`])
        console.log(`Socket conectado: ${nombre} (${rol})`)

        socket.on('disconnect', () => {
            console.log(`Socket desconectado: ${nombre}`)
        })
    })
}
