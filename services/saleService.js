const mongoose = require('mongoose')
const Product = require('../models/productModel')
const Sale = require('../models/saleModel')
const Customer = require('../models/customerModel')
const StockMovement = require('../models/stockMovementModel')
const AppError = require('../utils/AppError')
const { enteroPositivo, round2, parseFecha } = require('../utils/helpers')
const realtime = require('../realtime')

const MAX_LINEAS = 100
const DOS_HORAS = 2 * 60 * 60 * 1000

// Devuelve al inventario las unidades ya descontadas (compensación si la venta falla a mitad)
async function revertirDescuentos(descontados) {
    for (const { id, cantidad } of descontados) {
        await Product.updateOne({ _id: id }, { $inc: { stock: cantidad } })
    }
}

class SaleService {
    // Registra una venta y descuenta el stock.
    //
    // El descuento es atómico por producto: findOneAndUpdate con la condición stock >= cantidad.
    // Si dos vendedores venden la última unidad a la vez, solo uno de los descuentos se aplica
    // y el otro recibe "Stock insuficiente"; el stock nunca queda en negativo.
    // Los precios se toman siempre de la base de datos, nunca de lo que envía el navegador.
    static async crear({ items, cliente, iniciadaEn }, vendedor) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError(400, 'La venta debe tener al menos un producto')
        }
        if (items.length > MAX_LINEAS) throw new AppError(400, `Máximo ${MAX_LINEAS} líneas por venta`)

        // Si el mismo producto viene repetido se suman las cantidades
        const pedido = new Map()
        for (const item of items) {
            if (!item || !mongoose.isValidObjectId(item.producto)) {
                throw new AppError(400, 'Producto inválido en la venta')
            }
            const clave = String(item.producto)
            pedido.set(clave, (pedido.get(clave) || 0) + enteroPositivo(item.cantidad))
        }

        const ids = [...pedido.keys()]
        const productos = await Product.find({ _id: { $in: ids }, activo: true })
        if (productos.length !== ids.length) {
            throw new AppError(404, 'Algún producto no existe o fue dado de baja')
        }

        const ahora = new Date()
        for (const p of productos) {
            if (p.fechaVencimiento && p.fechaVencimiento < ahora) {
                throw new AppError(409, `${p.nombre} está vencido y no se puede vender`)
            }
        }

        if (cliente) {
            if (!mongoose.isValidObjectId(cliente) || !(await Customer.exists({ _id: cliente }))) {
                throw new AppError(404, 'Cliente no encontrado')
            }
        }

        // Solo se acepta un inicio razonable: no futuro y de menos de 2 horas atrás
        let iniciadaAt
        if (iniciadaEn) {
            const fecha = new Date(iniciadaEn)
            if (!Number.isNaN(fecha.getTime()) && fecha <= ahora && ahora - fecha <= DOS_HORAS) iniciadaAt = fecha
        }

        const descontados = []
        const actualizados = []
        let venta = null
        try {
            for (const p of productos) {
                const cantidad = pedido.get(String(p._id))
                const actualizado = await Product.findOneAndUpdate(
                    { _id: p._id, activo: true, stock: { $gte: cantidad } },
                    { $inc: { stock: -cantidad } },
                    { returnDocument: 'after' }
                )
                if (!actualizado) {
                    throw new AppError(409, `Stock insuficiente de ${p.nombre} (disponible: ${p.stock})`)
                }
                descontados.push({ id: p._id, cantidad })
                actualizados.push({ producto: actualizado, cantidad })
            }

            const lineas = actualizados.map(({ producto, cantidad }) => ({
                producto: producto._id,
                nombre: producto.nombre,
                cantidad,
                precioUnitario: producto.precio,
                subtotal: round2(producto.precio * cantidad)
            }))

            venta = await Sale.create({
                cliente: cliente || undefined,
                vendedor: vendedor.id,
                items: lineas,
                total: round2(lineas.reduce((suma, l) => suma + l.subtotal, 0)),
                iniciadaAt
            })

            await StockMovement.insertMany(actualizados.map(({ producto, cantidad }) => ({
                producto: producto._id,
                tipo: 'salida',
                cantidad: -cantidad,
                stockResultante: producto.stock,
                motivo: `Venta ${venta.numero}`,
                usuario: vendedor.id,
                venta: venta._id
            })))
        } catch (error) {
            // Sin transacciones (que requieren réplica de MongoDB) se deshace a mano
            if (venta) await Sale.deleteOne({ _id: venta._id })
            await revertirDescuentos(descontados)
            throw error
        }

        const productosActualizados = actualizados.map((a) => a.producto)
        realtime.stockActualizado(productosActualizados)
        productosActualizados.forEach(realtime.notificarSiBajo)

        return venta
    }

    // Anula una venta completada y devuelve las unidades al stock
    static async anular(id, usuario) {
        // La transición completada -> anulada es atómica: dos anulaciones simultáneas
        // no pueden devolver el stock dos veces.
        const venta = await Sale.findOneAndUpdate(
            { _id: id, estado: 'completada' },
            { estado: 'anulada', anuladaAt: new Date(), anuladaPor: usuario.id },
            { returnDocument: 'after' }
        )
        if (!venta) {
            const existe = await Sale.exists({ _id: id })
            throw new AppError(existe ? 409 : 404, existe ? 'La venta ya estaba anulada' : 'Venta no encontrada')
        }

        const repuestos = []
        for (const item of venta.items) {
            const producto = await Product.findByIdAndUpdate(
                item.producto,
                { $inc: { stock: item.cantidad } },
                { returnDocument: 'after' }
            )
            if (!producto) continue
            repuestos.push(producto)
            await StockMovement.create({
                producto: producto._id,
                tipo: 'entrada',
                cantidad: item.cantidad,
                stockResultante: producto.stock,
                motivo: `Anulación de venta ${venta.numero}`,
                usuario: usuario.id,
                venta: venta._id
            })
        }
        realtime.stockActualizado(repuestos)
        return venta
    }

    // Historial. Un vendedor solo ve sus propias ventas (el controlador pasa "vendedor").
    static async listar({ desde, hasta, vendedor, estado } = {}) {
        const filtro = {}
        const fechaDesde = parseFecha(desde)
        const fechaHasta = parseFecha(hasta, true)
        if (fechaDesde || fechaHasta) {
            filtro.createdAt = {}
            if (fechaDesde) filtro.createdAt.$gte = fechaDesde
            if (fechaHasta) filtro.createdAt.$lte = fechaHasta
        }
        if (vendedor) filtro.vendedor = vendedor
        if (estado) filtro.estado = estado
        return await Sale.find(filtro)
            .populate('vendedor', 'nombre')
            .populate('cliente', 'nombre apellido dni')
            .sort({ createdAt: -1 })
            .limit(300)
    }

    static async getById(id, { vendedor } = {}) {
        const filtro = { _id: id }
        if (vendedor) filtro.vendedor = vendedor
        const venta = await Sale.findOne(filtro)
            .populate('vendedor', 'nombre')
            .populate('cliente', 'nombre apellido dni')
        if (!venta) throw new AppError(404, 'Venta no encontrada')
        return venta
    }
}

module.exports = SaleService
