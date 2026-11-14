const mongoose = require('mongoose')
const { Schema } = mongoose

// Línea de detalle. Guarda el nombre y el precio del momento de la venta,
// de modo que cambios posteriores en el producto no alteran las ventas pasadas.
const itemSchema = new Schema({
    producto: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    nombre: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    precioUnitario: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 }
}, { _id: false })

const saleSchema = new Schema({
    cliente: { type: Schema.Types.ObjectId, ref: 'Customer' },
    vendedor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [itemSchema], validate: [(v) => v.length > 0, 'La venta debe tener al menos un producto'] },
    total: { type: Number, required: true, min: 0 },
    estado: { type: String, enum: ['completada', 'anulada'], default: 'completada' },
    // Momento en que el vendedor empezó a armar la venta; sirve para medir el tiempo de atención
    iniciadaAt: Date,
    anuladaAt: Date,
    anuladaPor: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, toJSON: { virtuals: true }, id: false })

// Número corto para mostrar en comprobantes (últimos 8 caracteres del _id)
saleSchema.virtual('numero').get(function () {
    return this._id.toString().slice(-8).toUpperCase()
})

saleSchema.index({ createdAt: -1 })

const Sale = mongoose.model('Sale', saleSchema, 'ventas')

module.exports = Sale
