const express = require('express')
const controller = require('../controllers/inventoryController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validateId = require('../middleware/validateId')

const router = express.Router()
router.param('productoId', validateId)
router.use(verifyToken)

router.post('/entrada', checkRole('admin', 'almacen'), controller.entrada)
router.post('/ajuste', checkRole('admin'), controller.ajuste)
router.get('/kardex/:productoId', checkRole('admin', 'almacen'), controller.kardex)

module.exports = router
