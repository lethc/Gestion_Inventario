const Supplier = require('../models/supplierModel')
const Product = require('../models/productModel')
const BaseService = require('./baseService')

module.exports = new BaseService(Supplier, {
    etiqueta: 'Proveedor',
    campos: ['nombre', 'ruc', 'email', 'telefono', 'direccion'],
    busqueda: ['nombre', 'ruc'],
    dependencias: [{ Model: Product, campo: 'proveedor', mensaje: 'hay productos de este proveedor' }]
})
