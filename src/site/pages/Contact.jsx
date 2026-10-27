import Rich from '../ui/Rich'
import React from 'react'
import { profile } from '../../content'

export const page = {
  id: 'contact',
  label: 'Contact',
  scene: {
    shape: { type: 'text', text: 'HELLO' },
    palette: [0xf5a524, 0xfb7185, 0xfbbf24, 0xf97316, 0xfde68a, 0xf472b6],
  },
}

export default function Contact() {
  const c = profile.contact
  return (
    <div className="contact">
      <h1 className="panel__title"><Rich text={c.title.join(' ')} /></h1>
      <p className="panel__text"><Rich text={c.subtitle} /></p>
      <div className="contact__actions">
        <a className="btn btn-primary" href={`mailto:${c.email}`}>Email me</a>
        <a className="btn btn-ghost" href={c.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a className="btn btn-ghost" href={c.github} target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
      <p className="contact__email">{c.email}</p>
    </div>
  )
}
