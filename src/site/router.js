// Navegación como datos: dónde estás, a dónde lleva cada acción y cómo se
// escribe en la URL. Sin React ni DOM, para que la prueben los tests de node y
// para que todas las entradas —teclado, rueda, touch, la mano, los clics—
// pasen por las mismas reglas en vez de inventarse cada una las suyas.
//
// Dos niveles: páginas (izquierda/derecha) e ítems dentro de una página que
// los tenga (arriba/abajo), como los proyectos. La URL es el estado:
//   #/                     primera página
//   #/projects             la página, sin ítem abierto
//   #/projects/shopfloor   el ítem abierto
//
// `pages` es [{ id, items?: string[] }]: lo mínimo que hace falta para decidir.

export const HOME = { page: 0, item: null }

export function parseHash(hash, pages) {
  const [id, item] = String(hash || '').replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  const page = pages.findIndex(p => p.id === id)
  if (page === -1) return HOME
  const items = pages[page].items || []
  return { page, item: item && items.includes(item) ? item : null }
}

export function toHash(state, pages) {
  if (state.page === 0 && !state.item) return '#/'
  const id = encodeURIComponent(pages[state.page].id)
  return state.item ? `#/${id}/${encodeURIComponent(state.item)}` : `#/${id}`
}

export const same = (a, b) => a.page === b.page && a.item === b.item

// Acciones:
//   { type: 'page', dir: ±1 }          página vecina, da la vuelta en los extremos
//   { type: 'goto', id, item? }        directo a una página (y un ítem)
//   { type: 'item', dir: ±1 }          ítem vecino dentro de la página
//   { type: 'close' }                  cierra el ítem abierto
export function step(state, action, pages) {
  const n = pages.length
  switch (action.type) {
    case 'page':
      // Dar la vuelta: con un swipe de la mano no hay "pared", y pararse en el
      // extremo sin aviso se siente como que el gesto no se reconoció.
      return { page: (state.page + action.dir + n) % n, item: null }

    case 'goto': {
      const page = pages.findIndex(p => p.id === action.id)
      if (page === -1) return state
      const items = pages[page].items || []
      return { page, item: action.item && items.includes(action.item) ? action.item : null }
    }

    case 'item': {
      const items = pages[state.page].items || []
      if (!items.length) return state
      if (state.item === null) {
        // Sin ítem abierto, bajar abre el primero y subir el último.
        return { ...state, item: action.dir > 0 ? items[0] : items[items.length - 1] }
      }
      const i = items.indexOf(state.item) + action.dir
      // Pasarse por arriba o por abajo vuelve a la lista, no da la vuelta: en
      // una lista larga, aparecer en la otra punta desorienta.
      return { ...state, item: i < 0 || i >= items.length ? null : items[i] }
    }

    case 'close':
      return state.item ? { ...state, item: null } : state

    default:
      return state
  }
}
