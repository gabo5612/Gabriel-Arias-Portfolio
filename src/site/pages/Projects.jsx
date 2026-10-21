import Rich from '../ui/Rich'
import React from 'react'
import { projects, askChatGptUrl, architectureUrl } from '../../content'

const byId = Object.fromEntries(projects.map(p => [p.id, p]))

export const page = {
  id: 'projects',
  label: 'Projects',
  items: projects.map(p => p.id),
  // Nombre legible de un ítem: lo usan las flechas de la mano para decir a
  // dónde llevan.
  itemLabel: id => byId[id]?.title ?? id,
  scene: {
    shape: { type: 'cube' },
    palette: [0xf5a524, 0x2dd4bf, 0xf97316, 0x7dd3fc, 0xfbbf24, 0x4ade80],
    // Al abrir un proyecto la formación escribe su nombre en partículas.
    itemShape: id => byId[id] && { type: 'text', text: byId[id].title },
  },
}

function List({ go }) {
  return (
    <div className="projects">
      <h2 className="panel__title"><Rich text="Things I've built" /></h2>
      <p className="panel__hint">Pick one, or use ↑ ↓ to walk through them. With your hand, point and pinch.</p>
      <ul className="projects__list">
        {projects.map(p => (
          <li key={p.id}>
            <a
              className="projects__row"
              href={`#/projects/${p.id}`}
              onClick={e => { e.preventDefault(); go({ type: 'goto', id: 'projects', item: p.id }) }}
            >
              <span className="projects__name">
                <span><Rich text={p.title} /></span>
                {p.kind === 'service' && <span className="projects__kind">Paid service</span>}
              </span>
              <span className="projects__note"><Rich text={p.archNote} /></span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Detail({ p, go }) {
  const i = projects.indexOf(p)
  const prev = projects[i - 1], next = projects[i + 1]
  return (
    <article className="project">
      <button type="button" className="project__back" onClick={() => go({ type: 'close' })}>
        All projects
      </button>
      {p.cover && <img className="project__cover" src={p.cover} alt="" loading="lazy" decoding="async" />}
      <h2 className="panel__title"><Rich text={p.title} /></h2>
      {p.kind === 'service' && <p className="projects__kind">Paid service</p>}
      <p className="panel__text"><Rich text={p.description} /></p>
      <ul className="project__tags">{p.tags.map(t => <li key={t}>{t}</li>)}</ul>
      <div className="project__links">
        {p.demo && <a className="btn btn-primary" href={p.demo} target="_blank" rel="noopener noreferrer">{p.demoLabel || 'Live demo'}</a>}
        {!p.demo && p.link && <a className="btn btn-primary" href={p.link} target="_blank" rel="noopener noreferrer">Visit</a>}
        {p.github && <a className="btn btn-ghost" href={p.github} target="_blank" rel="noopener noreferrer">Code</a>}
        {p.arch && <a className="btn btn-ghost" href={architectureUrl(p.arch)} target="_blank" rel="noopener noreferrer">Architecture</a>}
        <a className="btn btn-ghost" href={askChatGptUrl(p.title)} target="_blank" rel="noopener noreferrer">Ask ChatGPT</a>
      </div>
      <nav className="project__pager" aria-label="Other projects">
        {prev
          ? <button type="button" onClick={() => go({ type: 'item', dir: -1 })}>{prev.title}</button>
          : <span />}
        {next && <button type="button" className="project__next" onClick={() => go({ type: 'item', dir: 1 })}>{next.title}</button>}
      </nav>
    </article>
  )
}

export default function Projects({ state, go }) {
  const p = state.item && byId[state.item]
  return p ? <Detail p={p} go={go} /> : <List go={go} />
}
