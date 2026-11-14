const bcrypt = require('bcrypt')
const User = require('../models/userModel')
const { ROLES } = require('../models/userModel')
const AppError = require('../utils/AppError')

class UserService {
    static async getAll() {
        return await User.find({}).sort({ nombre: 1 })
    }

    // Solo se pueden cambiar nombre, rol, estado y (opcionalmente) la contraseña
    static async update(id, data, solicitante) {
        const cambios = {}
        if (data.nombre !== undefined) cambios.nombre = data.nombre
        if (data.rol !== undefined) {
            if (!ROLES.includes(data.rol)) throw new AppError(400, 'Rol inválido')
            cambios.rol = data.rol
        }
        if (data.activo !== undefined) cambios.activo = Boolean(data.activo)
        if (data.password) {
            if (typeof data.password !== 'string' || data.password.length < 8) {
                throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres')
            }
            cambios.password = await bcrypt.hash(data.password, 10)
        }

        // Evita que el administrador se bloquee a sí mismo
        if (String(id) === solicitante.id && (cambios.activo === false || (cambios.rol && cambios.rol !== 'admin'))) {
            throw new AppError(400, 'No puedes desactivarte ni quitarte el rol de administrador')
        }

        const usuario = await User.findByIdAndUpdate(id, cambios, { returnDocument: 'after', runValidators: true })
        if (!usuario) throw new AppError(404, 'Usuario no encontrado')
        return usuario
    }
}

module.exports = UserService
