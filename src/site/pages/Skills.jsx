import React from 'react'
import { skills } from '../../content'

export const page = {
  id: 'skills',
  label: 'Skills',
  scene: {
    // Muchos puntos sueltos que forman un sistema: una galaxia.
    shape: { type: 'galaxy' },
    palette: [0x2dd4bf, 0x7dd3fc, 0x38bdf8, 0x5eead4, 0xa5f3fc, 0x0ea5e9],
  },
}

export default function Skills() {
  return (
    <div className="skills">
      <h2 className="panel__title">What I work with</h2>
      <dl className="skills__list">
        {skills.map(g => (
          <div key={g.key} className="skills__group">
            <dt>{g.label}</dt>
            <dd>
              <ul>{g.items.map(s => <li key={s}>{s}</li>)}</ul>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
