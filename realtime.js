// Puente entre los services y Socket.IO.
// app.js llama a init(io) una vez; los services emiten eventos sin conocer el servidor HTTP.
// Si no hay io (por ejemplo en scripts como seed.js) las funciones no hacen nada.
let io = null

exports.init = (instancia) => {
    io = instancia
}

// Alerta de reposición: solo la reciben administradores y almacén
exports.stockBajo = (producto) => {
    if (!io) return
    io.to('rol:admin').to('rol:almacen').emit('stock:bajo', {
        id: producto._id,
        nombre: producto.nombre,
        stock: producto.stock,
        stockMinimo: producto.stockMinimo
    })
}

// Cambio de stock: lo reciben todos los usuarios conectados para refrescar sus pantallas
exports.stockActualizado = (productos) => {
    if (!io) return
    io.to('autenticados').emit('stock:actualizado', productos.map((p) => ({
        id: p._id,
        stock: p.stock
    })))
}

// Emite la alerta solo si el producto está en o por debajo de su mínimo
exports.notificarSiBajo = (producto) => {
    if (producto.stock <= producto.stockMinimo) exports.stockBajo(producto)
}
