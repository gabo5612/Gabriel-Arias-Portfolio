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
directos funcionan.

### La mano, en detalle

| Pose | Qué hace |
|---|---|
| Palma abierta, barrido lateral | vuela a la estación anterior / siguiente |
| Palma abierta, mantenida baja o alta | desplaza el texto (joystick: más lejos del centro, más rápido) |
| Índice estirado, resto plegado ("lápiz") | cursor en la punta del dedo; la cámara y la formación se congelan |
| Pellizco pulgar–índice mientras apuntás | clic en lo que está bajo el cursor |
| Cursor quieto 2 s sobre un link o botón | lo abre (un anillo se llena alrededor del cursor) |

El cursor se congela donde empezaste a cerrar el pellizco, porque juntar el pulgar arrastra
la punta del índice. Con la palma abierta, la mano además agarra la formación y mueve la
cámara (paralaje).

### El cursor (mouse o dedo)

- **Sobre la figura:** las partículas bajo el cursor se apartan y se encienden; el campo se
  coloca sobre la cara visible, no en el plano medio. **Arrastrar** la gira con inercia
  (el texto vuelve solo al frente). **Clic**, o pellizco con la mano, la hace estallar y
  rearmarse. En touch, arrastrar sobre la figura la gira y no navega.
- **Sobre el texto:** cada palabra del panel es un `<span class="w">` (lo genera `<Rich>`).
  Las cercanas al cursor se apartan de él como limaduras ante un imán, se tuercen y se
  desdoblan en rojo/cian. `site/useTextLens.js` escribe `--t`, `--dx` y `--dy` por palabra;
  la fuerza (`--push`, `--twist`, `--split`) se ajusta en `site.css`.

**Probar sin webcam (sólo en `npm run dev`):**

```js
window.__depth.pose({ hands: 1, fingers: 5, y: 0.7 })          // palma baja → scroll
window.__depth.pose({ hands: 1, fingers: 1, point: 1, px: .2, py: .5 })  // cursor
window.__depth.pose({ pinch: 1 })                                // clic
```

## Estructura

```
src/
  engine/            reutilizable, no sabe nada del portfolio
    signal/          useDepthSignal (puntero/mano/cabeza/giroscopio → una señal),
                     cameraSource (MediaPipe local), oneEuro, useCameraControl
    gestures.js      swipe, modo de la mano, joystick de scroll, clic por pellizco (puros)
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
    pointer.js       un solo puntero (mouse o dedo) para la lupa
    useTextLens.js   la lupa de texto
    ui/              Nav, RouteMap (el circuito visto desde arriba), HandControls
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
