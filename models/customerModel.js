const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema({
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
    apellido: { type: String, required: [true, 'El apellido es obligatorio'], trim: true },
    dni: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, trim: true, lowercase: true },
    telefono: { type: String, trim: true },
    direccion: { type: String, trim: true }
}, { timestamps: true })

const Customer = mongoose.model('Customer', customerSchema, 'clientes')

module.exports = Customer
