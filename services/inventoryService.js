const Product = require('../models/productModel')
const StockMovement = require('../models/stockMovementModel')
const AppError = require('../utils/AppError')
const { enteroPositivo } = require('../utils/helpers')
const realtime = require('../realtime')

class InventoryService {
    // Ingreso de mercadería: suma al stock y deja constancia en el kardex
    static async registrarEntrada({ producto, cantidad, motivo }, usuario) {
        const unidades = enteroPositivo(cantidad)

        const actualizado = await Product.findOneAndUpdate(
            { _id: producto, activo: true },
            { $inc: { stock: unidades } },
            { returnDocument: 'after' }
        )
        if (!actualizado) throw new AppError(404, 'Producto no encontrado')

        await StockMovement.create({
            producto: actualizado._id,
            tipo: 'entrada',
            cantidad: unidades,
            stockResultante: actualizado.stock,
            motivo: motivo || 'Ingreso de mercadería',
            usuario: usuario.id
        })
        realtime.stockActualizado([actualizado])
        return actualizado
    }

    // Ajuste por conteo físico: fija el stock en el valor real y registra la diferencia.
    // Exige un motivo, porque es la operación que más se presta a errores o abusos.
    static async ajustar({ producto, stockReal, motivo }, usuario) {
        const real = Number(stockReal)
        if (!Number.isInteger(real) || real < 0) {
            throw new AppError(400, 'El stock real debe ser un número entero mayor o igual a 0')
        }
        if (!motivo || !String(motivo).trim()) throw new AppError(400, 'El motivo del ajuste es obligatorio')

        // returnDocument: 'before' devuelve el documento anterior, que da el stock que había antes del ajuste
        const antes = await Product.findOneAndUpdate(
            { _id: producto, activo: true },
            { $set: { stock: real } },
            { returnDocument: 'before' }
        )
        if (!antes) throw new AppError(404, 'Producto no encontrado')

        const diferencia = real - antes.stock
        await StockMovement.create({
            producto: antes._id,
            tipo: 'ajuste',
            cantidad: diferencia,
            stockResultante: real,
            motivo: String(motivo).trim(),
            usuario: usuario.id
        })

        const actualizado = { _id: antes._id, nombre: antes.nombre, stock: real, stockMinimo: antes.stockMinimo }
        realtime.stockActualizado([actualizado])
        realtime.notificarSiBajo(actualizado)
        return { ...actualizado, diferencia }
    }

    static async kardex(productoId) {
        const producto = await Product.findById(productoId).select('nombre stock stockMinimo')
        if (!producto) throw new AppError(404, 'Producto no encontrado')
        const movimientos = await StockMovement.find({ producto: productoId })
            .populate('usuario', 'nombre')
            .sort({ createdAt: -1 })
            .limit(200)
        return { producto, movimientos }
    }
}

module.exports = InventoryService
