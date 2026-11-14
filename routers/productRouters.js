const express = require('express')
const productController = require('../controllers/productController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validateId = require('../middleware/validateId')

const router = express.Router()
router.param('id', validateId)
router.use(verifyToken)

// Consulta: todos los roles (el vendedor necesita ver precio y stock al vender)
router.get('/', productController.getAllProducts)
// Las rutas fijas van antes de '/:id' para que no se interpreten como un id
router.get('/bajo-stock', checkRole('admin', 'almacen'), productController.getLowStock)
router.get('/por-vencer', checkRole('admin', 'almacen'), productController.getExpiring)
router.get('/:id', productController.getProduct)

router.post('/', checkRole('admin'), productController.createProduct)
router.put('/:id', checkRole('admin'), productController.updateProduct)
router.delete('/:id', checkRole('admin'), productController.deleteProduct)

module.exports = router
