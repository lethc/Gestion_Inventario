const express = require('express')
const controller = require('../controllers/reportController')
const { verifyToken } = require('../middleware/verifyToken')
const checkRole = require('../middleware/checkRole')

const router = express.Router()
router.use(verifyToken, checkRole('admin'))

router.get('/resumen', controller.resumen)

module.exports = router
