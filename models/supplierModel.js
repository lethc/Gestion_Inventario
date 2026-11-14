const mongoose = require('mongoose')

const supplierSchema = new mongoose.Schema({
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
    ruc: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, trim: true, lowercase: true },
    telefono: { type: String, trim: true },
    direccion: { type: String, trim: true }
})

const Supplier = mongoose.model('Supplier', supplierSchema, 'proveedores')

module.exports = Supplier
