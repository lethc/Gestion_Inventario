// Carga datos de ejemplo para poder probar el sistema.
//   npm run seed            -> solo si la base está vacía
//   node seed.js --reset    -> borra TODO y vuelve a cargar
//
// Las contraseñas de los usuarios de ejemplo salen de SEED_PASSWORD (o el valor por defecto de abajo).
// Son solo para desarrollo: cámbialas o desactiva estas cuentas antes de usar el sistema de verdad.
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const connect = require('./database/connection')
const User = require('./models/userModel')
const Category = require('./models/categoryModel')
const Supplier = require('./models/supplierModel')
const Customer = require('./models/customerModel')
const Product = require('./models/productModel')
const StockMovement = require('./models/stockMovementModel')
const Sale = require('./models/saleModel')

const PASSWORD = process.env.SEED_PASSWORD || 'NovaSalud2026!'

const enDias = (dias) => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    return fecha
}

async function sembrar({ reset = false } = {}) {
    if (reset) {
        await Promise.all([User, Category, Supplier, Customer, Product, StockMovement, Sale].map((m) => m.deleteMany({})))
    } else if (await User.exists({})) {
        console.log('La base ya tiene datos. Usa "node seed.js --reset" para borrarla y recargar.')
        return null
    }

    const hash = await bcrypt.hash(PASSWORD, 10)
    const [admin, vendedor, almacen] = await User.create([
        { nombre: 'Administrador Nova Salud', email: 'admin@novasalud.pe', password: hash, rol: 'admin' },
        { nombre: 'Rosa Vendedora', email: 'vendedor@novasalud.pe', password: hash, rol: 'vendedor' },
        { nombre: 'Luis Almacén', email: 'almacen@novasalud.pe', password: hash, rol: 'almacen' }
    ])

    const cats = Object.fromEntries((await Category.create([
        { nombre: 'Analgésicos', descripcion: 'Dolor y fiebre' },
        { nombre: 'Antibióticos', descripcion: 'Requieren receta médica' },
        { nombre: 'Vitaminas y suplementos' },
        { nombre: 'Gastrointestinales' },
        { nombre: 'Cuidado personal' },
        { nombre: 'Primeros auxilios' }
    ])).map((c) => [c.nombre, c._id]))

    const [prov1, prov2, prov3] = await Supplier.create([
        { nombre: 'Distribuidora Farma Andina SAC', ruc: '20100000001', email: 'ventas@farmaandina.example', telefono: '014000001' },
        { nombre: 'Droguería Salud Total SRL', ruc: '20100000002', email: 'pedidos@saludtotal.example', telefono: '014000002' },
        { nombre: 'Laboratorios del Pacífico SA', ruc: '20100000003', telefono: '014000003' }
    ])

    await Customer.create([
        { nombre: 'Ana', apellido: 'Torres', dni: '00000001', telefono: '999000001' },
        { nombre: 'Carlos', apellido: 'Mendoza', dni: '00000002', email: 'carlos@example.com' },
        { nombre: 'María', apellido: 'Quispe', dni: '00000003', telefono: '999000003' }
    ])

    // [nombre, categoría, proveedor, precio, stock, mínimo, vencimiento, receta]
    // Hay a propósito productos con stock bajo, agotados, por vencer y vencidos para probar las alertas.
    const catalogo = [
        ['Paracetamol 500 mg x 20 tabletas', 'Analgésicos', prov1, 6.5, 120, 20, enDias(400), false],
        ['Ibuprofeno 400 mg x 10 tabletas', 'Analgésicos', prov1, 8.9, 60, 15, enDias(300), false],
        ['Naproxeno 550 mg x 10 tabletas', 'Analgésicos', prov2, 12.0, 8, 10, enDias(250), false],
        ['Aspirina 100 mg x 30 tabletas', 'Analgésicos', prov3, 15.5, 0, 10, enDias(200), false],
        ['Amoxicilina 500 mg x 12 cápsulas', 'Antibióticos', prov2, 18.0, 35, 10, enDias(180), true],
        ['Azitromicina 500 mg x 3 tabletas', 'Antibióticos', prov2, 22.0, 4, 8, enDias(20), true],
        ['Ciprofloxacino 500 mg x 10 tabletas', 'Antibióticos', prov3, 16.5, 25, 8, enDias(210), true],
        ['Vitamina C 1 g x 10 sobres efervescentes', 'Vitaminas y suplementos', prov1, 14.0, 45, 10, enDias(500), false],
        ['Complejo B x 30 cápsulas', 'Vitaminas y suplementos', prov3, 19.9, 30, 10, enDias(350), false],
        ['Multivitamínico x 60 tabletas', 'Vitaminas y suplementos', prov3, 39.9, 12, 6, enDias(15), false],
        ['Omeprazol 20 mg x 14 cápsulas', 'Gastrointestinales', prov1, 9.5, 70, 15, enDias(280), false],
        ['Sales de rehidratación oral x 1 sobre', 'Gastrointestinales', prov2, 2.5, 5, 20, enDias(150), false],
        ['Loperamida 2 mg x 12 cápsulas', 'Gastrointestinales', prov2, 7.8, 40, 10, enDias(-10), false],
        ['Alcohol medicinal 70° 250 ml', 'Primeros auxilios', prov1, 5.0, 80, 20, enDias(700), false],
        ['Gasas estériles 10x10 cm x 10 unid.', 'Primeros auxilios', prov3, 4.5, 3, 15, undefined, false],
        ['Curitas x 50 unidades', 'Primeros auxilios', prov3, 6.0, 55, 15, undefined, false],
        ['Mascarilla quirúrgica x 50 unidades', 'Primeros auxilios', prov1, 12.0, 90, 20, undefined, false],
        ['Protector solar FPS 50 x 120 ml', 'Cuidado personal', prov3, 38.0, 18, 6, enDias(600), false],
        ['Jabón antibacterial x 3 unidades', 'Cuidado personal', prov1, 9.9, 33, 10, undefined, false],
        ['Pasta dental x 100 ml', 'Cuidado personal', prov2, 7.2, 48, 12, enDias(900), false]
    ]

    const productos = await Product.create(catalogo.map(([nombre, categoria, proveedor, precio, stock, stockMinimo, fechaVencimiento, requiereReceta]) => ({
        nombre, categoria: cats[categoria], proveedor, precio, stock, stockMinimo, fechaVencimiento, requiereReceta
    })))

    await StockMovement.insertMany(productos.filter((p) => p.stock > 0).map((p) => ({
        producto: p._id, tipo: 'entrada', cantidad: p.stock, stockResultante: p.stock,
        motivo: 'Stock inicial', usuario: almacen._id
    })))

    console.log(`Datos de ejemplo cargados: ${productos.length} productos.`)
    console.log('Usuarios de ejemplo (contraseña según SEED_PASSWORD o la de seed.js):')
    console.log('  admin@novasalud.pe      (administrador)')
    console.log('  vendedor@novasalud.pe   (vendedor)')
    console.log('  almacen@novasalud.pe    (almacén)')
    return { admin, vendedor, almacen, productos }
}

module.exports = sembrar

if (require.main === module) {
    connect()
        .then(() => sembrar({ reset: process.argv.includes('--reset') }))
        .catch((error) => {
            console.error('Error al cargar los datos:', error.message)
            process.exitCode = 1
        })
        .finally(() => mongoose.disconnect())
}
