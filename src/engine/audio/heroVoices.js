// Voces del hero: una por mano, una para la cabeza.
//
// Sintetizadas con Web Audio, no reproducidas desde un archivo. Cero bytes de
// audio, cero peticiones — pasa la CSP `connect-src 'self'` sin excepciones, y
// el timbre responde de forma continua al gesto en vez de disparar un sample.
//
// La altura SIGUE al gesto, pero cuantizada. Un tono libre convertiría cada
// temblor del tracker en desafinación; sobre una escala pentatónica el mismo
// temblor sólo desliza entre notas que ya suenan bien juntas.

// La menor pentatónica, de La2 a La5, en semitonos desde 110 Hz.
// Pentatónica a propósito: no tiene semitonos, así que CUALQUIER par de notas
// de esta tabla es consonante. Con dos manos sonando a la vez eso no es un
// lujo — es lo que impide que un gesto cualquiera produzca un choque.
const SEMIS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31, 34, 36]
const NOTES = SEMIS.map(n => 110 * Math.pow(2, n / 12))

// Ventana de cada voz dentro de la tabla. Se solapan poco para que las manos
// ocupen registros distintos y se oigan como dos cosas, no como una.
const RANGE = [[5, 13], [8, 15], [0, 5]]   // mano 1 · mano 2 · cabeza

const noteFor = (i, v) => {
  const [lo, hi] = RANGE[i]
  const t = Math.max(0, Math.min(1, v / 5))
  return NOTES[lo + Math.round(t * (hi - lo))]
}

// Los parámetros de audio se actualizan a 30 Hz, no a 60: un filtro no necesita
// más y así el bucle no compite con el render de la retícula.
const HZ = 30

function buildVoice(ctx, master, idx) {
  const g = ctx.createGain(); g.gain.value = 0
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.7
  const o1 = ctx.createOscillator(); o1.type = 'sine'
  const o2 = ctx.createOscillator(); o2.type = 'sine'
  const o2g = ctx.createGain(); o2g.gain.value = 0.22
  // Vibrato leve: un seno perfectamente quieto suena sintético y muerto.
  const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6
  const lfoG = ctx.createGain()

  const f0 = noteFor(idx, 0)
  o1.frequency.value = f0
  o2.frequency.value = f0 * 3
  lfoG.gain.value = f0 * 0.004

  lfo.connect(lfoG); lfoG.connect(o1.frequency)
  o1.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(g); g.connect(master)
  o1.start(); o2.start(); lfo.start()

  return {
    set(v) {                       // v ∈ [0, 5]
      const t = ctx.currentTime
      const hz = noteFor(idx, v)
      const v01 = Math.max(0, Math.min(1, v / 5))
      // El glide de 90 ms convierte el salto de nota en portamento: sin él,
      // cruzar un escalón de la escala suena a clic.
      o1.frequency.setTargetAtTime(hz, t, 0.09)
      o2.frequency.setTargetAtTime(hz * 3, t, 0.09)
      lfoG.gain.setTargetAtTime(hz * 0.004, t, 0.09)
      // Exponente 0.7: con respuesta lineal, media apertura casi no se oye y
      // todo el rango audible se apelotona al final del gesto.
      g.gain.setTargetAtTime(Math.pow(v01, 0.7) * 0.2, t, 0.08)
      lp.frequency.setTargetAtTime(300 + v01 * 5700, t, 0.08)
    },
    dispose() {
      const t = ctx.currentTime
      g.gain.setTargetAtTime(0, t, 0.05)
      for (const n of [o1, o2, lfo]) { try { n.stop(t + 0.3) } catch { /* ya parado */ } }
    },
  }
}

export function createHeroVoices() {
  let ctx = null, master = null, voices = null, timer = 0

  const stop = () => {
    clearInterval(timer); timer = 0
    if (voices) { voices.forEach(v => v.dispose()); voices = null }
  }

  return {
    async start(signal) {
      if (voices) return
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return                       // navegador sin Web Audio: sin sonido, sin drama
        ctx = new AC()
        master = ctx.createGain(); master.gain.value = 0.9
        master.connect(ctx.destination)
      }
      try { await ctx.resume() } catch { return }
      voices = [0, 1, 2].map(i => buildVoice(ctx, master, i))

      timer = setInterval(() => {
        const s = signal.current
        const hand = s.source === 'hand'
        const face = s.source === 'face'
        voices[0].set(hand ? (s.fingers ?? 0) : 0)
        voices[1].set(hand && s.hands > 1 ? (s.fingers2 ?? 0) : 0)
        // La cabeza no tiene dedos: la maneja acercarse. Sólo suena al inclinarse
        // HACIA la pantalla, así que quieto o echado atrás queda en silencio y no
        // hay un zumbido de fondo permanente.
        voices[2].set(face ? Math.max(0, Math.min(5, s.z * 5)) : 0)
      }, 1000 / HZ)
    },
    stop,
    setMuted(m) {
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05)
    },
  }
}
