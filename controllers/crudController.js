const { str } = require('../utils/helpers')

// Controlador estándar para los servicios derivados de BaseService.
// No necesita try/catch: Express 5 envía a errorHandler lo que se lance en funciones async.
module.exports = (service) => ({
    list: async (req, res) => {
        res.json(await service.getAll({ q: str(req.query.q) }))
    },
    get: async (req, res) => {
        res.json(await service.getById(req.params.id))
    },
    create: async (req, res) => {
        res.status(201).json(await service.create(req.body))
    },
    update: async (req, res) => {
        res.json(await service.update(req.params.id, req.body))
    },
    remove: async (req, res) => {
        await service.remove(req.params.id)
        res.json({ message: 'Eliminado correctamente' })
    }
})
