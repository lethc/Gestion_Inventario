const UserService = require('../services/userService')

exports.list = async (req, res) => {
    res.json(await UserService.getAll())
}

exports.update = async (req, res) => {
    res.json(await UserService.update(req.params.id, req.body, req.user))
}
