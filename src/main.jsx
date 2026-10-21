import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'

// ?lab abre los experimentos sueltos del hero (globo, círculo, retícula); sin
// eso, el sitio. Dos árboles separados: el lab no carga nada del sitio.
const lab = new URLSearchParams(window.location.search).has('lab')
const root = createRoot(document.getElementById('root'))

if (lab) {
  import('./lab/Lab').then(({ default: Lab }) => root.render(<Lab />))
} else {
  import('./site/App').then(({ default: App }) => root.render(<App />))
}
