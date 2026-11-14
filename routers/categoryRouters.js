const express = require('express')
const controller = require('../controllers/categoryController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validateId = require('../middleware/validateId')

const router = express.Router()
router.param('id', validateId)
router.use(verifyToken)

router.get('/', controller.list) // todos los roles: filtros y formularios de producto
router.get('/:id', controller.get)
router.post('/', checkRole('admin'), controller.create)
router.put('/:id', checkRole('admin'), controller.update)
router.delete('/:id', checkRole('admin'), controller.remove)

module.exports = router
