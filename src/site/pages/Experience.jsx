import Rich from '../ui/Rich'
import React from 'react'
import { experience } from '../../content'

export const page = {
  id: 'experience',
  label: 'Experience',
  scene: {
    // Una hélice: el tiempo sube.
    shape: { type: 'helix' },
    palette: [0xa78bfa, 0xc4b5fd, 0x818cf8, 0xf0abfc, 0xe9d5ff, 0x6366f1],
  },
}

export default function Experience() {
  // Lo más reciente arriba: es lo que quien contrata lee primero.
  const roles = [...experience].reverse()
  return (
    <div className="experience">
      <h1 className="panel__title"><Rich text="Where I've worked" /></h1>
      <ol className="timeline">
        {roles.map(r => (
          <li key={r.date} className="timeline__item">
            <p className="timeline__when">{r.date} <span>{r.location}</span></p>
            <h3 className="timeline__role"><Rich text={r.title} /></h3>
            {[].concat(r.description).map((d, i) => <p key={i} className="panel__text"><Rich text={d} /></p>)}
          </li>
        ))}
      </ol>
    </div>
  )
}
