import React from 'react'
import { profile } from '../../content'
import Rich from '../ui/Rich'

export const page = {
  id: 'about',
  label: 'About',
  scene: {
    // Un diseño 3D de verdad, no una forma procedural: la prueba de que la
    // tubería Blender → glTF → puntos funciona. Ver scripts/make-sample-model.mjs.
    shape: { type: 'model', url: '/models/knot.glb' },
    palette: [0xf5a524, 0xfb923c, 0xfbbf24, 0xf97316, 0xfde68a, 0xea580c],
  },
}

export default function About() {
  const { title, bio, stats } = profile.about
  return (
    <div className="about">
      <h1 className="panel__title"><Rich text={title[0]} /><br /><Rich text={title[1]} /></h1>
      {bio.map((p, i) => <p key={i} className="panel__text"><Rich text={p} /></p>)}
      <dl className="about__stats">
        {stats.map(s => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
