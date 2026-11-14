const mongoose = require('mongoose')
const { Schema } = mongoose

// Kardex: cada cambio de stock deja un movimiento.
// "cantidad" lleva signo: positiva suma stock (entrada), negativa lo resta (salida);
// en un ajuste es la diferencia entre el stock real y el que figuraba en el sistema.
const stockMovementSchema = new Schema({
    producto: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    tipo: { type: String, enum: ['entrada', 'salida', 'ajuste'], required: true },
    cantidad: { type: Number, required: true },
    stockResultante: { type: Number, required: true },
    motivo: { type: String, trim: true },
    usuario: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    venta: { type: Schema.Types.ObjectId, ref: 'Sale' }
}, { timestamps: { createdAt: true, updatedAt: false } })

const StockMovement = mongoose.model('StockMovement', stockMovementSchema, 'movimientos_stock')

module.exports = StockMovement
