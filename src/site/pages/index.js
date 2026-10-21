import * as home from './Home'
import * as about from './About'
import * as skills from './Skills'
import * as experience from './Experience'
import * as projects from './Projects'
import * as contact from './Contact'

// El orden del sitio, y el orden del circuito en el mundo: la página i es la
// estación i. Para agregar una página: un archivo en esta carpeta que exporte
// `page` (id, label, scene) y un componente por defecto, y una línea acá.
//
// scene.shape acepta cualquier spec de engine/shapes/sources.js, incluido
// { type: 'model', url } para traer un diseño hecho en Blender.
const modules = [home, about, skills, experience, projects, contact]

export const PAGES = modules.map(m => ({ ...m.page, Component: m.default }))
