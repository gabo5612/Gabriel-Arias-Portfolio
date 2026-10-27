// El href de una sección o de un ítem, con la subcarpeta del sitio. Los links
// son links de verdad (los sigue un buscador y se abren en otra pestaña); el
// clic normal lo intercepta la navegación y vuela en vez de recargar.
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'

export const href = (id = '', item = '') =>
  BASE + [id, item].filter(Boolean).map(encodeURIComponent).join('/')

// Un clic que pide otra pestaña o ventana: se deja pasar al navegador.
export const newTab = e => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
