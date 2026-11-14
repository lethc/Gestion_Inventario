const ProductService = require('../services/productService')
const { str } = require('../utils/helpers')

exports.getAllProducts = async (req, res) => {
    res.json(await ProductService.getAll({ q: str(req.query.q), categoria: str(req.query.categoria) }))
}

exports.getLowStock = async (req, res) => {
    res.json(await ProductService.bajoStock())
}

exports.getExpiring = async (req, res) => {
    const dias = Number(req.query.dias)
    res.json(await ProductService.porVencer(Number.isInteger(dias) && dias > 0 ? dias : undefined))
}

exports.getProduct = async (req, res) => {
    res.json(await ProductService.getById(req.params.id))
}

exports.createProduct = async (req, res) => {
    res.status(201).json(await ProductService.create(req.body, req.user))
}

exports.updateProduct = async (req, res) => {
    res.json(await ProductService.update(req.params.id, req.body))
}

exports.deleteProduct = async (req, res) => {
    await ProductService.remove(req.params.id)
    res.json({ message: 'Producto dado de baja correctamente' })
}
