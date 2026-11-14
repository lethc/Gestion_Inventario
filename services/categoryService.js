const Category = require('../models/categoryModel')
const Product = require('../models/productModel')
const BaseService = require('./baseService')

module.exports = new BaseService(Category, {
    etiqueta: 'Categoría',
    campos: ['nombre', 'descripcion', 'activa'],
    dependencias: [{ Model: Product, campo: 'categoria', mensaje: 'hay productos en esta categoría' }]
})
