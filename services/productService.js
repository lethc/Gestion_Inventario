const Product = require('../models/productModel')
const StockMovement = require('../models/stockMovementModel')
const AppError = require('../utils/AppError')
const { pick, escapeRegex } = require('../utils/helpers')
const { diasPorVencer } = require('../config')

// "stock" no está aquí a propósito: solo se modifica desde inventoryService y saleService.
const CAMPOS_EDITABLES = ['nombre', 'descripcion', 'precio', 'stockMinimo', 'fechaVencimiento',
    'requiereReceta', 'categoria', 'proveedor']

class ProductService {
    static async getAll({ q, categoria } = {}) {
        const filtro = { activo: true }
        if (q) {
            const regex = new RegExp(escapeRegex(q), 'i')
            filtro.$or = [{ nombre: regex }, { descripcion: regex }]
        }
        if (categoria) filtro.categoria = categoria
        return await Product.find(filtro)
            .populate('categoria', 'nombre')
            .populate('proveedor', 'nombre')
            .sort({ nombre: 1 })
            .limit(500)
    }

    static async getById(id) {
        const producto = await Product.findOne({ _id: id, activo: true })
            .populate('categoria', 'nombre')
            .populate('proveedor', 'nombre')
        if (!producto) throw new AppError(404, 'Producto no encontrado')
        return producto
    }

    // Productos en o por debajo de su stock mínimo (los más críticos primero)
    static async bajoStock() {
        return await Product.find({ activo: true, $expr: { $lte: ['$stock', '$stockMinimo'] } })
            .populate('proveedor', 'nombre')
            .sort({ stock: 1, nombre: 1 })
    }

    // Productos ya vencidos o que vencen dentro de "dias" días
    static async porVencer(dias = diasPorVencer) {
        const limite = new Date()
        limite.setDate(limite.getDate() + dias)
        return await Product.find({ activo: true, fechaVencimiento: { $lte: limite } })
            .sort({ fechaVencimiento: 1 })
    }

    // El stock inicial es opcional y queda registrado como una entrada en el kardex
    static async create(data, usuario) {
        const producto = await Product.create({
            ...pick(data, CAMPOS_EDITABLES),
            stock: data.stock === undefined || data.stock === '' ? 0 : data.stock
        })
        if (producto.stock > 0) {
            await StockMovement.create({
                producto: producto._id,
                tipo: 'entrada',
                cantidad: producto.stock,
                stockResultante: producto.stock,
                motivo: 'Stock inicial',
                usuario: usuario.id
            })
        }
        return producto
    }

    static async update(id, data) {
        const producto = await Product.findOneAndUpdate(
            { _id: id, activo: true },
            pick(data, CAMPOS_EDITABLES),
            { returnDocument: 'after', runValidators: true }
        )
        if (!producto) throw new AppError(404, 'Producto no encontrado')
        return producto
    }

    // Baja lógica: el producto deja de aparecer pero su historial se conserva
    static async remove(id) {
        const producto = await Product.findOneAndUpdate({ _id: id, activo: true }, { activo: false })
        if (!producto) throw new AppError(404, 'Producto no encontrado')
    }
}

module.exports = ProductService
