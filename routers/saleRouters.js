const express = require('express')
const controller = require('../controllers/saleController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validateId = require('../middleware/validateId')

const router = express.Router()
router.param('id', validateId)
router.use(verifyToken, checkRole('admin', 'vendedor'))

router.post('/', controller.create)
router.get('/', controller.list)
router.get('/:id', controller.get)
router.patch('/:id/anular', checkRole('admin'), controller.cancel)

module.exports = router
