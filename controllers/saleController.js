const SaleService = require('../services/saleService')
const { str } = require('../utils/helpers')

exports.create = async (req, res) => {
    const venta = await SaleService.crear(req.body || {}, req.user)
    res.status(201).json(venta)
}

// Administrador: todas las ventas. Vendedor: solo las suyas.
exports.list = async (req, res) => {
    const soloPropias = req.user.rol === 'vendedor'
    res.json(await SaleService.listar({
        desde: str(req.query.desde),
        hasta: str(req.query.hasta),
        estado: str(req.query.estado),
        vendedor: soloPropias ? req.user.id : undefined
    }))
}

exports.get = async (req, res) => {
    const soloPropias = req.user.rol === 'vendedor'
    res.json(await SaleService.getById(req.params.id, { vendedor: soloPropias ? req.user.id : undefined }))
}

exports.cancel = async (req, res) => {
    res.json(await SaleService.anular(req.params.id, req.user))
}
