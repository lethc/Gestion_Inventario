const mongoose = require('mongoose')
const AppError = require('../utils/AppError')

// Se registra con router.param('id', validateId) y rechaza ids mal formados con 400
// antes de llegar a la base de datos.
module.exports = (req, res, next, valor) => {
    if (!mongoose.isValidObjectId(valor)) throw new AppError(400, 'Identificador inválido')
    next()
}
