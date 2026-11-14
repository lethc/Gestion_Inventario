const mongoose = require('mongoose')

const ROLES = ['admin', 'vendedor', 'almacen']

// Usuario del sistema: unifica los datos personales y las credenciales
// (en el repo base estaban separados en User y UserAuth).
const userSchema = new mongoose.Schema({
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
    email: {
        type: String,
        required: [true, 'El email es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El email no es válido']
    },
    // select:false -> el hash nunca sale en las consultas a menos que se pida con .select('+password')
    password: { type: String, required: true, select: false },
    rol: { type: String, enum: { values: ROLES, message: 'Rol inválido' }, default: 'vendedor' },
    activo: { type: Boolean, default: true }
}, { timestamps: true })

const User = mongoose.model('User', userSchema, 'usuarios')

module.exports = User
module.exports.ROLES = ROLES
