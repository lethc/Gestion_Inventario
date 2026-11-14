const Customer = require('../models/customerModel')
const Sale = require('../models/saleModel')
const BaseService = require('./baseService')

module.exports = new BaseService(Customer, {
    etiqueta: 'Cliente',
    campos: ['nombre', 'apellido', 'dni', 'email', 'telefono', 'direccion'],
    busqueda: ['nombre', 'apellido', 'dni'],
    orden: { apellido: 1, nombre: 1 },
    dependencias: [{ Model: Sale, campo: 'cliente', mensaje: 'el cliente tiene ventas registradas' }]
})
