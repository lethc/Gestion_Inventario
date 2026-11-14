const mongoose = require('mongoose')
const { mongoUri } = require('../config')

// Conecta a MongoDB. Devuelve la promesa para que quien arranca el servidor
// pueda esperar la conexión (o abortar si falla).
module.exports = async function connect(uri = mongoUri) {
    await mongoose.connect(uri)
    console.log('Conexión exitosa a MongoDB')
}
