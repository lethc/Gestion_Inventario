const mongoose = require('mongoose')
const { Schema } = mongoose

const entero = {
    validator: Number.isInteger,
    message: '{PATH} debe ser un número entero'
}

const productSchema = new Schema({
    nombre: { type: String, required: [true, 'El nombre del producto es obligatorio'], trim: true },
    descripcion: { type: String, trim: true },
    precio: {
        type: Number,
        required: [true, 'El precio es obligatorio'],
        min: [0, 'El precio no puede ser negativo']
    },
    // El stock solo cambia por ventas, entradas y ajustes (inventoryService / saleService),
    // nunca editando el producto directamente.
    stock: { type: Number, default: 0, min: [0, 'El stock no puede ser negativo'], validate: entero },
    // Por debajo (o igual) de este valor se dispara la alerta de reposición
    stockMinimo: { type: Number, default: 5, min: [0, 'El stock mínimo no puede ser negativo'], validate: entero },
    fechaVencimiento: Date,
    requiereReceta: { type: Boolean, default: false },
    categoria: { type: Schema.Types.ObjectId, ref: 'Category' },
    proveedor: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    // Baja lógica: un producto dado de baja conserva su historial de ventas y movimientos
    activo: { type: Boolean, default: true }
}, { timestamps: true })

productSchema.index({ nombre: 1 })

const Product = mongoose.model('Product', productSchema, 'productos')

module.exports = Product
