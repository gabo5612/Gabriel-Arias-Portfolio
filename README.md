# hero-sandbox

Copia aislada del hero de `Gabriel-Arias-Portfolio` (tracking de manos/cabeza con
MediaPipe, retícula three.js, HUD de privacidad y voces Web Audio) para experimentar
sin tocar el portfolio.

```bash
npm install
npm run dev        # http://localhost:5180
```

- Origen: `Gabriel-Arias-Portfolio/src/{components/FirstView.jsx, components/hero/, hooks/, lib/, styles/}`
  y `static/mediapipe/` → `public/mediapipe/`.
- Nada de acá vuelve solo al portfolio: lo que funcione se porta a mano.
- `?delegate=cpu|gpu` sigue funcionando para forzar el backend de MediaPipe.
