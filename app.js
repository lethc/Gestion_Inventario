const path = require('path')
const http = require('http')
const express = require('express')
const helmet = require('helmet')
const { Server } = require('socket.io')

const config = require('./config')
const connect = require('./database/connection')
const realtime = require('./realtime')
const errorHandler = require('./middleware/errorHandler')

const authRouter = require('./routers/authRouters')
const userRouter = require('./routers/userRouters')
const productRouter = require('./routers/productRouters')
const categoryRouter = require('./routers/categoryRouters')
const supplierRouter = require('./routers/supplierRouters')
const customerRouter = require('./routers/customerRouters')
const saleRouter = require('./routers/saleRouters')
const inventoryRouter = require('./routers/inventoryRouters')
const reportRouter = require('./routers/reportRouters')

const app = express()

// Cabeceras de seguridad. Se desactiva solo "upgrade-insecure-requests" para poder usar http en local
// (en helmet, un valor null apaga una directiva de las que trae por defecto).
app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } } }))

app.use(express.json({ limit: '100kb' }))

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// Frontend estático: login, panel, punto de venta, etc.
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.render('index', { title: 'Nova Salud' })
})

app.use('/auth', authRouter)
app.use('/usuarios', userRouter)
app.use('/productos', productRouter)
app.use('/categorias', categoryRouter)
app.use('/proveedores', supplierRouter)
app.use('/clientes', customerRouter)
app.use('/ventas', saleRouter)
app.use('/inventario', inventoryRouter)
app.use('/reportes', reportRouter)

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
})
app.use(errorHandler)

// Socket.IO comparte puerto con Express a través de un servidor HTTP propio
const server = http.createServer(app)
const io = new Server(server)
require('./socket')(io)
realtime.init(io)

async function iniciar() {
    try {
        await connect()
    } catch (error) {
        console.error('No se pudo conectar a MongoDB:', error.message)
        process.exit(1)
    }
    server.listen(config.port, () => {
        console.log(`Nova Salud ejecutándose en http://localhost:${config.port}`)
    })
}

// Se arranca solo con "node app.js"; los tests importan app y server sin levantar nada
if (require.main === module) iniciar()

module.exports = { app, server, io }
