const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, unique: true },
    descripcion: { type: String, trim: true },
    activa: { type: Boolean, default: true }
})

const Category = mongoose.model('Category', categorySchema, 'categorias')

module.exports = Category
