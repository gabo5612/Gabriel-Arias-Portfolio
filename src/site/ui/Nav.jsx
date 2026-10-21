import React from 'react'
import TrackButton from '../../engine/ui/TrackButton'
import TiltButton from '../../engine/ui/TiltButton'

export default function Nav({ pages, state, go, cam, tilt, name }) {
  return (
    <header className="nav">
      <a
        className="nav__logo"
        href="#/"
        onClick={e => { e.preventDefault(); go({ type: 'goto', id: pages[0].id }) }}
      >
        {name}
      </a>
      <nav aria-label="Sections">
        <ul className="nav__links">
          {pages.map((p, i) => (
            <li key={p.id}>
              <a
                href={i === 0 ? '#/' : `#/${p.id}`}
                aria-current={state.page === i ? 'page' : undefined}
                onClick={e => { e.preventDefault(); go({ type: 'goto', id: p.id }) }}
              >
                {p.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {/* En el teléfono, inclinarlo; en el resto, la mano. */}
      {tilt.available
        ? <TiltButton tilt={tilt} compact className="nav__track" />
        : <TrackButton cam={cam} compact className="nav__track" />}
    </header>
  )
}
