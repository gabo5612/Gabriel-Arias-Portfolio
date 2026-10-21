# hero-sandbox

Empezó como copia aislada del hero de `Gabriel-Arias-Portfolio` (tracking de manos/cabeza
con MediaPipe, three.js, HUD de privacidad, voces Web Audio). Ahora es además un **sitio
que se recorre como un mundo**: cada sección del portfolio es una formación de partículas
en un circuito cerrado, y navegar es volar la cámara de una a otra.

```bash
npm install
npm run dev          # http://localhost:5180        el sitio
                     # http://localhost:5180/?lab   los experimentos del hero (globo)
                     #   ?lab&scene=circle | lattice
npm test             # node --test: router, gestos, formas
npm run build
npm run sync         # trae proyectos/experiencia/skills del portfolio
npm run make:model   # regenera public/models/knot.glb
```

`?delegate=cpu|gpu` sigue forzando el backend de MediaPipe.

## Cómo se mueve uno

| Entrada | Página anterior / siguiente | Dentro de Projects |
|---|---|---|
| Teclado | ← → (y 1–6 para saltar) | ↑ ↓ recorre, Esc vuelve a la lista |
| Rueda / trackpad | un gesto = una estación | el panel desplaza; en el borde, navega |
| Touch | swipe horizontal | scroll vertical normal |
| Mano (cámara) | swipe con la mano abierta | swipe vertical |
| Clic | nav de arriba, mapa de ruta de abajo | la lista y ↑/↓ del detalle |

La URL es el estado (`#/projects/shopfloor`): atrás/adelante del navegador y los links
directos funcionan. La mano además agarra la formación actual y mueve la cámara
(paralaje); abrir los dedos abre el campo de la formación.

## Estructura

```
src/
  engine/            reutilizable, no sabe nada del portfolio
    signal/          useDepthSignal (puntero/mano/cabeza/giroscopio → una señal),
                     cameraSource (MediaPipe local), oneEuro, useCameraControl
    gestures.js      detector de swipe puro (lo usan el sitio, el lab y los tests)
    stage.js         renderer + cámara + resize + pausa fuera de pantalla
    pointCloud.js    nube morfable: forma y paleta viajan punto a punto
    dust.js          polvo alrededor del circuito (la sensación de velocidad)
    shapes/          procedural.js (7 formas) y sources.js (procedural | text | model)
    audio/, ui/      voces Web Audio, PrivacyHUD, TrackButton
  content/           lo que dice el sitio
    data/*.json      GENERADO por `npm run sync` desde el portfolio — no editar
    profile.js       lo que vive dentro de componentes del portfolio (bio, contacto)
  site/              el sitio-mundo
    pages/           una página = un archivo (componente + escena) + una línea en index.js
    router.js        navegación como datos (puro, testeado)
    useNavigation.js teclado, rueda, touch, historial
    World.jsx        el circuito, las estaciones y el vuelo
    ui/              Nav, RouteMap (el circuito visto desde arriba), GestureGuide
  lab/               los experimentos originales del hero, intactos
```

### Agregar una página

```js
// src/site/pages/Talks.jsx
export const page = {
  id: 'talks', label: 'Talks',
  scene: { shape: { type: 'torus' }, palette: [/* 6 colores: frente, atrás, este, oeste, norte, sur */] },
}
export default function Talks({ state, go }) { /* … */ }
```

y agregarla a `src/site/pages/index.js`. El orden de esa lista es el orden del circuito.
Con `items` + `scene.itemShape(id)` la página tiene sub-navegación (como Projects).

### Traer un diseño 3D (Blender → partículas)

1. En Blender: File → Export → glTF 2.0, formato **glb**.
2. Dejarlo en `public/models/`.
3. En la página: `shape: { type: 'model', url: '/models/mi-diseno.glb' }`.

Se muestrea la superficie ponderada por área y se normaliza a radio fijo, así que la
escala y el origen del archivo no importan. Tiene que ser `.glb` (o `.gltf` con buffers
en archivos aparte): la CSP `connect-src 'self'` bloquea los buffers `data:` embebidos.
About usa `public/models/knot.glb`, generado por `scripts/make-sample-model.mjs`.

Las otras fuentes: cualquier nombre de `procedural.js` (`sphere`, `cube`, `torus`,
`helix`, `galaxy`, `heart`, `wave`) y `{ type: 'text', text: 'HELLO' }`.

## Reglas que se mantienen

- **Local-first.** MediaPipe, modelos y WASM se sirven desde `public/mediapipe/`; la CSP de
  `index.html` impone `connect-src 'self'`, y el HUD cuenta las peticiones salientes reales.
- **three.js y MediaPipe nunca en el primer chunk**: el contenido se lee y se navega antes
  de que exista el mundo. Sin WebGL o con `prefers-reduced-motion`, el sitio funciona igual
  sin mundo.
- Nada vuelve solo al portfolio: lo que funcione se porta a mano.
