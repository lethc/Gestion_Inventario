const InventoryService = require('../services/inventoryService')

exports.entrada = async (req, res) => {
    const producto = await InventoryService.registrarEntrada(req.body || {}, req.user)
    res.status(201).json(producto)
}

exports.ajuste = async (req, res) => {
    res.status(201).json(await InventoryService.ajustar(req.body || {}, req.user))
}

exports.kardex = async (req, res) => {
    res.json(await InventoryService.kardex(req.params.productoId))
}
