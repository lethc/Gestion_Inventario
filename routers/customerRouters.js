const express = require('express')
const controller = require('../controllers/customerController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validateId = require('../middleware/validateId')

const router = express.Router()
router.param('id', validateId)
router.use(verifyToken, checkRole('admin', 'vendedor'))

router.get('/', controller.list)
router.get('/:id', controller.get)
router.post('/', controller.create)
router.put('/:id', controller.update)
router.delete('/:id', checkRole('admin'), controller.remove)

module.exports = router
