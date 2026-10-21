import { useEffect, useSyncExternalStore } from 'react'
import { sound } from '../engine/audio/worldSound'

// El sonido del sitio desde React: el estado del botón, y lo que no pertenece
// a ningún componente en particular — despertar el audio con el primer gesto,
// callarlo con la pestaña oculta, y el tic/clic de cualquier cosa clicable.
//
// El clic de la mano es un .click() sintético sobre el mismo elemento, así que
// suena igual que el del mouse sin código aparte.

const CLICKABLE = 'a[href], button:not([disabled]), [role="button"]'

export function useSound() {
  const on = useSyncExternalStore(sound.subscribe, () => sound.on, () => true)
  return { on, toggle: sound.toggle }
}

export function useSiteSound() {
  useEffect(() => {
    const unlock = () => sound.unlock()
    const onVis = () => sound.visible(!document.hidden)
    let hovered = null
    const onOver = e => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      const el = e.target.closest?.(CLICKABLE) || null
      if (el && el !== hovered) sound.tick()
      hovered = el
    }
    const onClick = e => { if (e.target.closest?.(CLICKABLE)) sound.click() }
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true, passive: true })
    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('click', onClick, { capture: true })
    if (import.meta.env.DEV) window.__sound = sound
    return () => {
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, unlock, { capture: true })
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('click', onClick, { capture: true })
    }
  }, [])
}
