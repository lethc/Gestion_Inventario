const express = require('express')
const userController = require('../controllers/userController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')
const validateId = require('../middleware/validateId')

const router = express.Router()
router.param('id', validateId)

// Gestión de usuarios: solo administrador (el alta se hace con POST /auth/register)
router.use(verifyToken, checkRole('admin'))
router.get('/', userController.list)
router.put('/:id', userController.update)

module.exports = router
