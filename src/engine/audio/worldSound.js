import { NOTES, SEMIS, hz, noteIn } from './scale.js'

// El sonido del mundo. Todo sintetizado en vivo con Web Audio, como las voces
// de la mano: cero archivos, cero peticiones, y cada sonido sale de lo que
// pasó (hacia dónde volaste, dónde está el cursor, qué tan rápido gira la
// figura) en vez de ser un sample que se repite igual.
//
// Capas, de abajo arriba:
//   fondo      un acorde suave por estación. Al volar, sus notas se deslizan
//              al acorde de la estación siguiente: el viaje se oye.
//   vuelo      aire filtrado que crece a mitad de camino y cruza de un oído
//              al otro en la dirección del viaje.
//   llegada    tres campanas con el acorde de la estación.
//   títulos    chispas que suben mientras el título se forma, y bajan
//              cuando se deshace.
//   figura     un soplo que canta bajo el cursor, más fuerte cuanto más
//              rápido la girás; un clic la hace estallar con un golpe grave.
//   texto      la lupa toca un arpa: cada palabra nueva bajo el cursor es una
//              nota, más aguda cuanto más arriba en la pantalla.
//   mano       un tic al pasar sobre algo clicable, una nota que sube con el
//              anillo de espera, y el mismo "clic" que el mouse.
//
// Todo pasa por la misma pentatónica (scale.js) y por una reverb y un eco
// compartidos: así los sonidos sueltos parecen ocurrir en el mismo lugar.
//
// El navegador no deja sonar nada antes del primer gesto. unlock() se llama
// en el primer clic/tecla; hasta entonces cada método es un no-op silencioso
// (pero el fondo recuerda la estación, para arrancar en el acorde correcto).

const KEY = 'siteSound'
const PAD = 0.055          // nivel del fondo
const FIG_HZ = 30          // actualización de las voces continuas

// La identidad sonora de cada estación. No basta con cambiar de acorde: con
// notas vecinas y el mismo timbre, seis acordes de la misma escala suenan
// casi igual. Cada estación tiene además su registro (raíz distinta, del Mi
// grave de la experiencia, el Sol grave de los proyectos y el Re grave del
// contacto al Re medio de las habilidades), su brillo
// (el corte del filtro) y su movimiento (pulso de amplitud, respiración del
// filtro). Los semitonos son desde 220 Hz y todos caen en la pentatónica.
// En el registro medio a propósito: por debajo de ~200 Hz los parlantes de un
// portátil casi no suenan, y el fondo desaparecería justo donde más se usa.
export const STATIONS = [
  { chord: [0, 7, 12, 19], lp: 1000, breathe: 0.06, pulse: 0 },        // Home: La y quintas, abierto
  { chord: [3, 7, 10, 15], lp: 1300, breathe: 0.08, pulse: 0 },        // About: Do–Mi–Sol, cálido y luminoso
  { chord: [5, 10, 15, 22], lp: 2200, breathe: 0.18, pulse: 0 },       // Skills: cuartas, aireado y brillante
  { chord: [-5, 0, 7, 10], lp: 650, breathe: 0.04, pulse: 0 },         // Experience: Mi grave, oscuro, lento
  { chord: [-2, 3, 7, 10], lp: 1600, breathe: 0.1, pulse: 2.4 },      // Projects: Sol grave, con pulso: hay cosas en marcha
  { chord: [-7, -2, 3, 10], lp: 2600, breathe: 0.12, pulse: 0.8 },    // Contact: Re grave (147 Hz), cuartas abiertas, invita
]
const stationOf = i => STATIONS[((i % STATIONS.length) + STATIONS.length) % STATIONS.length]
export const stationChord = i => stationOf(i).chord
const padHz = semi => hz(semi + 12)

// La altura de una palabra: arriba agudo, abajo grave, en el registro alto.
export const wordNote = y01 => noteIn(1 - y01, 7, 15)

let ctx = null, out = null, master = null, verb = null, echo = null, noiseBuf = null
let pad = null, fig = null, dwellV = null, analyser = null
let station = 0
let on = true
try { on = typeof localStorage === 'undefined' || localStorage.getItem(KEY) !== 'off' } catch { /* modo privado */ }
const listeners = new Set()
const live = () => ctx && on && ctx.state === 'running'

// ── Infraestructura ─────────────────────────────────────────────────────────

// Respuesta al impulso sintética: ruido que se apaga exponencialmente, un poco
// distinto en cada oído. Suena a sala grande sin descargar ningún archivo.
function impulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return false
  ctx = new AC()
  // Un compresor suave al final: varias campanas juntas no saturan.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25
  out = ctx.createGain(); out.gain.value = on ? 1 : 0
  master = ctx.createGain(); master.gain.value = 0.8
  master.connect(comp); comp.connect(out); out.connect(ctx.destination)
  if (import.meta.env?.DEV) {
    analyser = ctx.createAnalyser(); analyser.fftSize = 8192
    out.connect(analyser)
  }

  const conv = ctx.createConvolver(); conv.buffer = impulse(3.2, 3)
  verb = ctx.createGain(); verb.gain.value = 0.55
  verb.connect(conv); conv.connect(master)

  // Eco a 330 ms, cada repetición más oscura que la anterior.
  const d = ctx.createDelay(1); d.delayTime.value = 0.33
  const fb = ctx.createGain(); fb.gain.value = 0.32
  const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400
  echo = ctx.createGain(); echo.gain.value = 0.35
  echo.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); dl.connect(verb); dl.connect(master)

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

  pad = makePad()
  fig = makeFigure()
  dwellV = makeDwell()
  return true
}

// Una salida con paneo y envíos a reverb/eco. Los nodos de una nota suelta se
// desconectan solos al terminar.
function bus(pan = 0, wet = 0.4, delay = 0) {
  const g = ctx.createGain()
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p) }
  const tail = p || g
  tail.connect(master)
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; tail.connect(s); s.connect(verb) }
  if (delay) { const s = ctx.createGain(); s.gain.value = delay; tail.connect(s); s.connect(echo) }
  return g
}

const env = (param, at, peak, attack, dur) => {
  param.setValueAtTime(0.0001, at)
  param.exponentialRampToValueAtTime(peak, at + attack)
  param.exponentialRampToValueAtTime(0.0001, at + dur)
}

function tone(f, { at = ctx.currentTime, dur = 0.3, gain = 0.05, type = 'sine', pan = 0, wet = 0.4, delay = 0, attack = 0.004, glideTo = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur)
  const g = ctx.createGain()
  env(g.gain, at, gain, attack, dur)
  o.connect(g); g.connect(bus(pan, wet, delay))
  o.start(at); o.stop(at + dur + 0.05)
  o.onended = () => g.disconnect()
}

// Campana FM: un modulador inarmónico (×3.5) cuyo índice se apaga antes que
// la nota. El ataque metálico se va y queda un seno limpio que resuena.
function bell(f, at, gain, pan) {
  const c = ctx.createOscillator(); c.frequency.value = f
  const m = ctx.createOscillator(); m.frequency.value = f * 3.5
  const mg = ctx.createGain()
  mg.gain.setValueAtTime(f * 2.2, at)
  mg.gain.exponentialRampToValueAtTime(1, at + 1.1)
  m.connect(mg); mg.connect(c.frequency)
  const g = ctx.createGain()
  env(g.gain, at, gain, 0.006, 2.6)
  c.connect(g); g.connect(bus(pan, 0.7, 0.25))
  c.start(at); m.start(at); c.stop(at + 2.7); m.stop(at + 2.7)
  c.onended = () => g.disconnect()
}

function noise() {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true
  n.loopStart = Math.random(); n.loopEnd = n.loopStart + 1
  return n
}

// ── Voces continuas ─────────────────────────────────────────────────────────

// El fondo: dos osciladores apenas desafinados por nota (el batido lento es lo
// que lo hace respirar) y un filtro que un LFO muy lento abre y cierra.
function makePad() {
  const g = ctx.createGain(); g.gain.value = 0
  const st = stationOf(station)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = st.lp; lp.Q.value = 0.6
  const lfo = ctx.createOscillator(); lfo.frequency.value = st.breathe
  const lfoG = ctx.createGain(); lfoG.gain.value = 300
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start()
  // El pulso: un LFO de amplitud. trem.gain = 1 - prof/2 + seno·prof/2.
  const trem = ctx.createGain(); trem.gain.value = 1
  const pulse = ctx.createOscillator(); pulse.frequency.value = st.pulse || 1
  const pulseG = ctx.createGain(); pulseG.gain.value = 0
  pulse.connect(pulseG); pulseG.connect(trem.gain); pulse.start()
  lp.connect(trem); trem.connect(g)
  g.connect(master)
  const s = ctx.createGain(); s.gain.value = 0.8; g.connect(s); s.connect(verb)
  const oscs = st.chord.flatMap((semi, k) => [-5, 5].map(cents => {
    const o = ctx.createOscillator()
    o.type = k === 0 ? 'triangle' : 'sine'
    o.frequency.value = padHz(semi)
    o.detune.value = cents
    const og = ctx.createGain(); og.gain.value = k === 0 ? 0.3 : 0.16
    o.connect(og); og.connect(lp); o.start()
    return { o, k }
  }))
  return { g, lp, oscs, lfo, trem, pulse, pulseG }
}

// Lleva el fondo a la estación i: notas, brillo, respiración y pulso. `at` y
// `tc` son cuándo empieza y cuánto tarda (constante de tiempo, en segundos).
function applyStation(i, at, tc) {
  const st = stationOf(i)
  st.chord.forEach((semi, k) => pad.oscs.filter(v => v.k === k)
    .forEach(v => v.o.frequency.setTargetAtTime(padHz(semi), at, tc)))
  pad.lfo.frequency.setTargetAtTime(st.breathe, at, tc)
  const depth = st.pulse ? 0.55 : 0
  pad.trem.gain.setTargetAtTime(1 - depth / 2, at, tc)
  pad.pulseG.gain.setTargetAtTime(depth / 2, at, tc)
  if (st.pulse) pad.pulse.frequency.setTargetAtTime(st.pulse, at, tc)
}

// La figura bajo el cursor: aire con resonancia (un filtro estrecho sobre
// ruido) más un seno que sigue la posición, cuantizado a la escala.
function makeFigure() {
  const n = noise()
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 7
  const ng = ctx.createGain(); ng.gain.value = 0
  n.connect(bp); bp.connect(ng); ng.connect(bus(0.35, 0.6)); n.start()
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = NOTES[9]
  const trem = ctx.createOscillator(); trem.frequency.value = 5.5
  const tg = ctx.createGain(); tg.gain.value = 0.4
  const og = ctx.createGain(); og.gain.value = 0
  const sine = ctx.createGain(); sine.gain.value = 0
  trem.connect(tg); tg.connect(og.gain)
  o.connect(og); og.connect(sine); sine.connect(bus(0.35, 0.7, 0.3)); o.start(); trem.start()
  return { bp, ng, o, sine, last: 0 }
}

// La espera del dedo: una nota que sube por la escala a medida que el anillo
// se llena. Escalonada a propósito: cada escalón se oye como un tic de reloj.
function makeDwell() {
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTES[8]
  const g = ctx.createGain(); g.gain.value = 0
  o.connect(g); g.connect(bus(0, 0.35)); o.start()
  return { o, g, last: -1 }
}

// ── API ─────────────────────────────────────────────────────────────────────

const setTarget = (param, v, tc) => param.setTargetAtTime(v, ctx.currentTime, tc)

export const sound = {
  get on() { return on },

  // Llamar dentro de un gesto (clic, tecla, toque).
  async unlock() {
    if (!ctx && !build()) return
    if (ctx.state !== 'running' && on) { try { await ctx.resume() } catch { return } }
    if (!live()) return
    // Lo que se navegó antes de que hubiera sonido: el fondo arranca en la
    // estación donde estás, no en la primera.
    applyStation(station, ctx.currentTime, 0.05)
    pad.lp.frequency.setTargetAtTime(stationOf(station).lp, ctx.currentTime, 0.05)
    setTarget(pad.g.gain, PAD, 1.2)
  },

  setOn(next) {
    on = next
    try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* modo privado */ }
    listeners.forEach(fn => fn())
    if (!ctx) return
    setTarget(out.gain, on ? 1 : 0, 0.08)
    // Apagado de verdad: tras el fundido se suspende, y no se sintetiza nada.
    // Antes de suspender, la ganancia va a cero exacto: el fundido es
    // exponencial y nunca llega solo, y lo que quede sonando al suspender
    // se congela ahí.
    if (!on) setTimeout(() => {
      if (on) return
      out.gain.cancelScheduledValues(ctx.currentTime)
      out.gain.setValueAtTime(0, ctx.currentTime)
      // 250 ms de silencio antes de suspender: lo que se suspende queda
      // congelado, y así hasta el analizador de desarrollo (≈190 ms de
      // memoria) termina vacío.
      setTimeout(() => { if (!on) ctx.suspend().catch(() => {}) }, 250)
    }, 400)
    else {
      ctx.resume().then(() => {
        applyStation(station, ctx.currentTime, 0.05)
        pad.lp.frequency.setTargetAtTime(stationOf(station).lp, ctx.currentTime, 0.05)
        setTarget(pad.g.gain, PAD, 1.2)
        const t = ctx.currentTime + 0.05
        stationChord(station).slice(0, 3).forEach((s, k) => tone(hz(s + 24), { at: t + k * 0.07, dur: 0.6, gain: 0.04, pan: k - 1, wet: 0.6 }))
      }).catch(() => {})
    }
  },
  toggle() { sound.setOn(!on) },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },

  // La pestaña oculta no suena (y no gasta CPU en sintetizar).
  visible(v) {
    if (!ctx) return
    if (!v) ctx.suspend().catch(() => {})
    else if (on) ctx.resume().catch(() => {})
  },

  // La estación donde está la cámara, sin vuelo (al montar el mundo).
  station(i) {
    station = i
    if (!ctx) return
    applyStation(i, ctx.currentTime, 0.3)
  },

  // Despegue hacia la estación `to`. El acorde se desliza durante el vuelo,
  // el filtro del fondo se abre en la mitad, y el aire cruza de un lado al otro.
  // stops: las estaciones que se cruzan en el camino, con el segundo en que
  // se les pasa al lado. El fondo cambia a cada una a su turno (con una
  // campana suave), y recién después al destino: el viaje se oye por tramos.
  fly(dir, ms, to, stops = []) {
    station = to
    if (!live()) return
    const t = ctx.currentTime, d = ms / 1000
    let last = 0
    for (const s of stops) {
      applyStation(s.i, t + Math.max(0, s.at - 0.25), 0.16)
      bell(padHz(stationChord(s.i)[0] + 12), t + s.at, 0.022, 0.5)
      last = s.at
    }
    applyStation(to, t + Math.max(d * 0.15, last + 0.3), stops.length ? 0.2 : d * 0.22)
    // El filtro se abre a mitad de vuelo y aterriza en el brillo del destino.
    const f = pad.lp.frequency
    f.cancelScheduledValues(t); f.setValueAtTime(f.value, t)
    f.linearRampToValueAtTime(3200, t + d * 0.5); f.linearRampToValueAtTime(stationOf(to).lp, t + d)

    const n = noise()
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1
    bp.frequency.setValueAtTime(260, t)
    bp.frequency.exponentialRampToValueAtTime(2400, t + d * 0.5)
    bp.frequency.exponentialRampToValueAtTime(320, t + d)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.13, t + d * 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    n.connect(bp); bp.connect(g)
    if (p) {
      p.pan.setValueAtTime(-0.7 * dir, t); p.pan.linearRampToValueAtTime(0.7 * dir, t + d)
      g.connect(p); p.connect(master)
      const s = ctx.createGain(); s.gain.value = 0.4; p.connect(s); s.connect(verb)
    } else g.connect(master)
    n.start(t); n.stop(t + d + 0.05)
    n.onended = () => { g.disconnect(); p?.disconnect() }
    // Un grave que sube con el despegue: el empuje.
    tone(55, { at: t, dur: d * 0.6, gain: 0.07, attack: d * 0.25, glideTo: 82.5, wet: 0.2 })
  },

  // El avión de papel: un zumbido de hélice (dos sierras desafinadas que
  // baten) que se acerca, sube un poco de tono y al final cae, como al pasar
  // de largo. Cruza de izquierda a derecha.
  plane(ms) {
    if (!live()) return
    const t = ctx.currentTime, d = ms / 1000
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2
    lp.frequency.setValueAtTime(300, t)
    lp.frequency.linearRampToValueAtTime(1400, t + d * 0.5)
    lp.frequency.linearRampToValueAtTime(500, t + d)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + d * 0.2)
    g.gain.setValueAtTime(0.05, t + d * 0.75)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    const flutter = ctx.createOscillator(); flutter.frequency.value = 22
    const fg = ctx.createGain(); fg.gain.value = 0.35
    const amp = ctx.createGain(); amp.gain.value = 0.65
    flutter.connect(fg); fg.connect(amp.gain)
    const oscs = [0, 7].map(cents => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = cents
      o.frequency.setValueAtTime(130, t)
      o.frequency.linearRampToValueAtTime(175, t + d * 0.6)
      o.frequency.linearRampToValueAtTime(120, t + d)
      o.connect(lp); o.start(t); o.stop(t + d + 0.05)
      return o
    })
    lp.connect(amp); amp.connect(g)
    const out = bus(0, 0.35)
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (p) {
      p.pan.setValueAtTime(-0.6, t); p.pan.linearRampToValueAtTime(0.5, t + d)
      g.connect(p); p.connect(out)
    } else g.connect(out)
    flutter.start(t); flutter.stop(t + d + 0.05)
    oscs[0].onended = () => { g.disconnect(); p?.disconnect() }
  },

  // La formación se traga al avión: un grave que cae (el trago) y, sobre la
  // onda, el acorde de la estación subiendo como campanas.
  absorb() {
    if (!live()) return
    const t = ctx.currentTime
    tone(240, { at: t, dur: 0.55, gain: 0.14, glideTo: 50, wet: 0.4 })
    tone(120, { at: t + 0.02, dur: 0.9, gain: 0.08, type: 'triangle', glideTo: 40, wet: 0.5 })
    stationChord(station).forEach((s, k) => bell(padHz(s + 12), t + 0.18 + k * 0.12, 0.04, (k / 3 - 0.5) * 0.9))
  },

  // Llegada: el acorde de la estación como campanas, de izquierda a derecha.
  arrive(i) {
    if (!live()) return
    const t = ctx.currentTime
    stationChord(i).forEach((s, k) => bell(padHz(s + 12), t + k * 0.09, 0.045, (k / 3 - 0.5) * 0.9))
  },

  // Chispas del título. Formar: suben y se aprietan hacia el final, como letras
  // que encajan. Deshacer: menos, más bajas, y bajando.
  sparkle(kind, ms) {
    if (!live()) return
    const form = kind === 'form'
    const n = form ? 20 : 11
    const t = ctx.currentTime, d = ms / 1000
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1)
      const at = t + d * (form ? 0.15 + 0.7 * Math.pow(u, 0.6) : 0.6 * u)
      const v = form ? u : 1 - u
      tone(noteIn(v + (Math.random() - 0.5) * 0.15, form ? 8 : 6, 15), {
        at, dur: 0.16 + Math.random() * 0.1, gain: form ? 0.022 : 0.014,
        pan: Math.random() * 1.6 - 0.8, wet: 0.75, delay: 0.25,
      })
    }
    // El título está entero: una nota final que lo asienta.
    if (form) tone(padHz(stationChord(station)[0] + 24), { at: t + d * 0.85, dur: 1.2, gain: 0.03, wet: 0.8, delay: 0.3 })
  },

  // Clic sobre la figura: un golpe grave y el estallido de chispas.
  poke() {
    if (!live()) return
    const t = ctx.currentTime
    tone(150, { at: t, dur: 0.35, gain: 0.22, glideTo: 42, wet: 0.3 })
    for (let k = 0; k < 9; k++) {
      tone(noteIn(Math.random(), 9, 15), {
        at: t + 0.02 + Math.random() * 0.28, dur: 0.12, gain: 0.02,
        pan: Math.random() * 2 - 1, wet: 0.7, delay: 0.3,
      })
    }
  },

  // Cada cuadro desde el mundo: over 0..1 (cursor sobre la figura), x/y en
  // pantalla 0..1, spin = velocidad de giro, zoom de las dos manos.
  figure(over, x01, y01, spin, zoom = 1) {
    if (!live()) return
    const now = ctx.currentTime
    if (now - fig.last < 1 / FIG_HZ) return
    fig.last = now
    const s = Math.min(1, Math.abs(spin) * 12)
    setTarget(fig.ng.gain, over * 0.05 + s * 0.12, 0.08)
    setTarget(fig.bp.frequency, 400 + (1 - y01) * 1800 + s * 1600, 0.06)
    setTarget(fig.sine.gain, over * 0.035, 0.12)
    setTarget(fig.o.frequency, noteIn(x01, 6, 13), 0.05)
    // Separar las manos abre el fondo; juntarlas lo apaga. Va por `detune`
    // (en cents) y no por `frequency`, que es donde el vuelo programa su
    // rampa: dos automatizaciones sobre el mismo parámetro se pisan.
    setTarget(pad.lp.detune, 2400 * Math.log2(zoom), 0.2)
  },

  // La lupa pasó a una palabra nueva.
  pluck(y01, x11) {
    if (!live()) return
    const f = wordNote(y01)
    tone(f, { dur: 0.32, gain: 0.018, type: 'triangle', pan: x11 * 0.6, wet: 0.5, delay: 0.2 })
    tone(f * 2, { dur: 0.12, gain: 0.006, pan: x11 * 0.6, wet: 0.3 })
  },

  // Algo clicable bajo el cursor (mouse o dedo).
  tick() {
    if (!live()) return
    tone(NOTES[12], { dur: 0.06, gain: 0.02, wet: 0.25 })
  },

  // Clic de verdad: dos notas que suben.
  click() {
    if (!live()) return
    const t = ctx.currentTime
    tone(NOTES[10], { at: t, dur: 0.12, gain: 0.04, wet: 0.35 })
    tone(NOTES[13], { at: t + 0.05, dur: 0.22, gain: 0.035, wet: 0.45, delay: 0.2 })
  },

  // El anillo de espera del dedo, p ∈ [0, 1]; 0 la apaga.
  dwell(p) {
    if (!live()) return
    const step = p > 0 ? Math.min(6, Math.floor(p * 7)) : -1
    if (step === dwellV.last) return
    dwellV.last = step
    setTarget(dwellV.g.gain, step < 0 ? 0 : 0.012 + step * 0.003, 0.03)
    if (step >= 0) setTarget(dwellV.o.frequency, NOTES[7 + step], 0.015)
  },

  // Sólo en desarrollo: el pico de la salida en el último bloque (para e2e).
  level() {
    if (!analyser) return 0
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    let peak = 0
    for (const v of buf) peak = Math.max(peak, Math.abs(v))
    return peak
  },
  // Sólo en desarrollo: la frecuencia más fuerte de la salida, en Hz (para
  // comprobar que el fondo cambia de estación a estación).
  dominant() {
    if (!analyser) return 0
    const bins = new Float32Array(analyser.frequencyBinCount)
    analyser.getFloatFrequencyData(bins)
    let k = 1
    for (let i = 1; i < bins.length; i++) if (bins[i] > bins[k]) k = i
    return Math.round((k * ctx.sampleRate) / analyser.fftSize)
  },
  // Sólo para pruebas: la nota grave del fondo ahora mismo, en Hz.
  padRoot() { return pad ? Math.round(pad.oscs[0].o.frequency.value) : 0 },
  get state() { return ctx?.state ?? 'none' },
}
