const Product = require('../models/productModel')
const Sale = require('../models/saleModel')
const { diasPorVencer } = require('../config')

class ReportService {
    // Indicadores para el panel. Cubre las métricas de la propuesta:
    // ventas del día, tiempo promedio de atención, quiebres de stock y vencimientos.
    static async resumen() {
        const inicioHoy = new Date()
        inicioHoy.setHours(0, 0, 0, 0)
        const hace30Dias = new Date(inicioHoy)
        hace30Dias.setDate(hace30Dias.getDate() - 30)
        const limiteVencimiento = new Date()
        limiteVencimiento.setDate(limiteVencimiento.getDate() + diasPorVencer)
        const ahora = new Date()

        const [hoy, atencion, topProductos, bajoStock, sinStock, porVencer, vencidos] = await Promise.all([
            Sale.aggregate([
                { $match: { estado: 'completada', createdAt: { $gte: inicioHoy } } },
                { $group: { _id: null, cantidad: { $sum: 1 }, total: { $sum: '$total' } } }
            ]),
            // Tiempo entre que se empezó a armar la venta y se registró (solo ventas que lo informan)
            Sale.aggregate([
                { $match: { estado: 'completada', createdAt: { $gte: hace30Dias }, iniciadaAt: { $type: 'date' } } },
                { $group: { _id: null, promedioMs: { $avg: { $subtract: ['$createdAt', '$iniciadaAt'] } }, ventas: { $sum: 1 } } }
            ]),
            Sale.aggregate([
                { $match: { estado: 'completada', createdAt: { $gte: hace30Dias } } },
                { $unwind: '$items' },
                { $group: { _id: '$items.producto', nombre: { $first: '$items.nombre' }, unidades: { $sum: '$items.cantidad' }, monto: { $sum: '$items.subtotal' } } },
                { $sort: { unidades: -1 } },
                { $limit: 5 }
            ]),
            Product.countDocuments({ activo: true, $expr: { $lte: ['$stock', '$stockMinimo'] } }),
            Product.countDocuments({ activo: true, stock: 0 }),
            Product.countDocuments({ activo: true, fechaVencimiento: { $gte: ahora, $lte: limiteVencimiento } }),
            Product.countDocuments({ activo: true, fechaVencimiento: { $lt: ahora } })
        ])

        const ventasHoy = hoy[0] || { cantidad: 0, total: 0 }
        return {
            ventasHoy: {
                cantidad: ventasHoy.cantidad,
                total: ventasHoy.total,
                ticketPromedio: ventasHoy.cantidad ? ventasHoy.total / ventasHoy.cantidad : 0
            },
            tiempoPromedioVentaSeg: atencion[0] ? Math.round(atencion[0].promedioMs / 1000) : null,
            topProductos: topProductos.map(({ _id, nombre, unidades, monto }) => ({ id: _id, nombre, unidades, monto })),
            inventario: { bajoStock, sinStock, porVencer, vencidos }
        }
    }
}

module.exports = ReportService
