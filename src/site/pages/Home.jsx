import Rich from '../ui/Rich'
import React, { useEffect, useState } from 'react'
import { profile } from '../../content'
import TrackButton from '../../engine/ui/TrackButton'

export const page = {
  id: 'home',
  label: 'Home',
  scene: {
    shape: { type: 'sphere' },
    // Las seis zonas del globo del hero original: frente, atrás, este, oeste,
    // norte, sur.
    palette: [0xf5a524, 0xa78bfa, 0x2dd4bf, 0xf97316, 0x7dd3fc, 0x4ade80],
  },
}

// Escribe y borra cada rol. Respeta reduced-motion mostrando el primero fijo.
function useTypewriter(words, reduced) {
  const [text, setText] = useState(reduced ? words[0] : '')
  useEffect(() => {
    if (reduced) return
    let i = 0, n = 0, del = false, timer
    const tick = () => {
      const w = words[i % words.length]
      n += del ? -1 : 1
      setText(w.slice(0, n))
      let wait = del ? 40 : 70
      if (!del && n === w.length) { del = true; wait = 2000 }
      else if (del && n === 0) { del = false; i++; wait = 350 }
      timer = setTimeout(tick, wait)
    }
    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [words, reduced])
  return text
}

export default function Home({ go, cam, reduced }) {
  const role = useTypewriter(profile.roles, reduced)
  return (
    <div className="home">
      <p className="home__hi"><Rich text="Hi, I'm" /></p>
      <h1 className="home__name"><Rich text={profile.name} /></h1>
      <p className="home__role" aria-live="off">
        I build <span className="home__role-word">{role}</span><span className="home__caret" aria-hidden="true" />
      </p>
      <p className="home__tagline"><Rich text={profile.tagline} /></p>
      <div className="home__actions">
        <button type="button" className="btn btn-primary" onClick={() => go({ type: 'goto', id: 'projects' })}>
          Fly to my projects
        </button>
        <TrackButton cam={cam} />
      </div>
      {cam.error && <p className="hero__track-error">{cam.error}</p>}
    </div>
  )
}
