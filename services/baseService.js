const AppError = require('../utils/AppError')
const { pick, escapeRegex } = require('../utils/helpers')

// CRUD común para las tablas maestras (categorías, proveedores, clientes).
// Cada módulo lo instancia indicando qué campos se pueden escribir, por cuáles se busca
// y qué otras colecciones dependen de él (para no dejar referencias huérfanas al borrar).
class BaseService {
    constructor(Model, { etiqueta, campos, busqueda = ['nombre'], dependencias = [], orden = { nombre: 1 } }) {
        this.Model = Model
        this.etiqueta = etiqueta
        this.campos = campos
        this.busqueda = busqueda
        this.dependencias = dependencias
        this.orden = orden
    }

    // Los textos vacíos de un formulario se descartan: un "" en un campo único
    // (por ejemplo dni) chocaría con otros registros vacíos.
    limpiar(data) {
        const limpio = pick(data, this.campos)
        for (const [clave, valor] of Object.entries(limpio)) {
            if (valor === '') delete limpio[clave]
        }
        return limpio
    }

    async getAll({ q } = {}) {
        const filtro = {}
        if (q) {
            const regex = new RegExp(escapeRegex(q), 'i')
            filtro.$or = this.busqueda.map((campo) => ({ [campo]: regex }))
        }
        return await this.Model.find(filtro).sort(this.orden).limit(500)
    }

    async getById(id) {
        const doc = await this.Model.findById(id)
        if (!doc) throw new AppError(404, `${this.etiqueta} no encontrado`)
        return doc
    }

    async create(data) {
        return await this.Model.create(this.limpiar(data))
    }

    async update(id, data) {
        const doc = await this.Model.findByIdAndUpdate(id, this.limpiar(data), {
            returnDocument: 'after',
            runValidators: true
        })
        if (!doc) throw new AppError(404, `${this.etiqueta} no encontrado`)
        return doc
    }

    async remove(id) {
        for (const dep of this.dependencias) {
            if (await dep.Model.exists({ [dep.campo]: id })) {
                throw new AppError(409, `No se puede eliminar: ${dep.mensaje}`)
            }
        }
        const resultado = await this.Model.deleteOne({ _id: id })
        if (resultado.deletedCount === 0) throw new AppError(404, `${this.etiqueta} no encontrado`)
    }
}

module.exports = BaseService
