// Punto único de entrada al contenido. Las páginas importan de acá, nunca de
// data/ directo: si mañana el contenido viene de un CMS, cambia este archivo
// y nada más.
//
// data/*.json lo genera `npm run sync` desde el portfolio. No editarlo a mano.

import projects from './data/projects.json'
import experience from './data/experience.json'
import skillData from './data/skills.json'
import { SKILL_GROUPS } from './profile'

export { profile, askChatGptUrl, architectureUrl, SITE_URL } from './profile'
export { projects, experience }

const byGroup = Object.fromEntries(skillData.map(g => [g.group, g.items]))
export const skills = SKILL_GROUPS
  .filter(([key]) => byGroup[key])
  .map(([key, label]) => ({ key, label, items: byGroup[key] }))
