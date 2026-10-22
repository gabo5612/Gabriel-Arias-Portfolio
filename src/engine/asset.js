// Rutas a archivos de public/ que funcionan también publicadas bajo una
// subcarpeta (GitHub Pages sirve el sitio en /Gabriel-Arias-Portfolio/).
// Vite reemplaza BASE_URL al compilar; en node (los tests) no existe y vale '/'.
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'

export const asset = path =>
  /^(https?:|data:|blob:)/.test(path) ? path : BASE + String(path).replace(/^\//, '')
