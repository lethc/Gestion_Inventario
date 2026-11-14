// Página de inicio: si ya hay sesión se va directo al panel
import { getToken } from './api.js'

if (getToken()) window.location.replace('/panel.html')
