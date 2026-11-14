import { api, guardarSesion, getToken } from './api.js'

const formulario = document.getElementById('formLogin')
const mensaje = document.getElementById('mensaje')
const boton = document.getElementById('btnIngresar')

if (getToken()) window.location.replace('/panel.html')

formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    mensaje.classList.add('oculto')
    boton.disabled = true
    try {
        const { token, usuario } = await api('/auth/login', {
            metodo: 'POST',
            cuerpo: {
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            }
        })
        guardarSesion(token, usuario)
        window.location.href = '/panel.html'
    } catch (error) {
        mensaje.textContent = error.message
        mensaje.classList.remove('oculto')
        boton.disabled = false
    }
})
