// Título y descripción de cada ruta, en un solo lugar: los usa el sitio (el
// título de la pestaña al navegar) y scripts/prerender.mjs (el HTML que leen
// buscadores, previsualizaciones de links y asistentes). Si los dos los
// calcularan por su cuenta, tarde o temprano dirían cosas distintas.
//
// Recibe el contenido como argumento en vez de importarlo: así corre igual en
// el navegador (Vite) y en node (el pre-render), sin depender de cómo cada uno
// importa JSON.

export const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'contact', label: 'Contact' },
]

// **negrita** → texto plano.
export const plain = s => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\s+/g, ' ').trim()

// Las descripciones se cortan en una palabra, cerca de lo que muestra un
// buscador (~155 caracteres).
export function clip(s, max = 158) {
  const t = plain(s)
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '')}…`
}

// route: { id, item? }. content: { profile, projects, experience, skills }.
export function pageMeta(route, { profile, projects, experience, skills }) {
  const name = profile.name
  const who = `${name} · ${plain(profile.tagline).replace(/\.$/, '')}`
  switch (route.id) {
    case 'about':
      return { title: `About · ${name}`, description: clip(profile.about.bio[0]) }
    case 'skills':
      return {
        title: `Skills · ${name}`,
        description: clip(`What ${profile.short} works with: ${skills.map(g => `${g.label} (${g.items.slice(0, 3).join(', ')})`).join('; ')}.`),
      }
    case 'experience':
      return {
        title: `Experience · ${name}`,
        description: clip(`Where ${profile.short} has worked: ${experience.map(e => `${e.title}, ${e.date}`).join('; ')}.`),
      }
    case 'projects': {
      const p = route.item && projects.find(x => x.id === route.item)
      if (p) return { title: `${plain(p.title)} · Projects · ${name}`, description: clip(p.archNote || p.description) }
      return {
        title: `Projects · ${name}`,
        description: clip(`Things ${profile.short} has built: ${projects.map(x => plain(x.title)).join(', ')}.`),
      }
    }
    case 'contact':
      return { title: `Contact · ${name}`, description: clip(profile.contact.subtitle) }
    default:
      return {
        title: who,
        description: clip(`${plain(profile.tagline)} ${profile.roles.slice(0, 2).join(', ')}. A portfolio you fly through.`),
      }
  }
}
