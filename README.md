# hero-sandbox

Empezó como copia aislada del hero de `Gabriel-Arias-Portfolio` (tracking de manos/cabeza
con MediaPipe, three.js, HUD de privacidad, voces Web Audio). Ahora es además un **sitio
que se recorre como un mundo**: cada sección del portfolio es una formación de partículas
en línea, a lo largo de una avenida, y navegar es volar la cámara de una a otra: el destino
se ve chico a lo lejos y crece, y las secciones intermedias pasan al costado. Hacia atrás, la
cámara retrocede mirando al frente.

```bash
npm install
npm run dev          # http://localhost:5180        el sitio
                     # http://localhost:5180/?lab   los experimentos del hero (globo)
                     #   ?lab&scene=circle | lattice
npm test             # node --test: router, gestos, formas, perfil de la mano
npm run e2e          # Chromium + mano simulada (ver "Pruebas de punta a punta")
npm run build
npm run sync         # trae proyectos/experiencia/skills del portfolio (portadas → WebP)
npm run make:model   # regenera public/models/knot.glb
npm run make:models  # regenera public/models/projects/*.glb con Blender (headless)
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
| Cursor quieto 1.25 s sobre un link o botón | lo abre (un anillo se llena alrededor del cursor) |
| Apuntando: flechas en los bordes | izquierda/derecha cambian de página; en el detalle de un proyecto, arriba/abajo pasan al anterior/siguiente |
| Las dos palmas abiertas | separarlas/juntarlas acerca o aleja la figura (0.6–1.4×); girarlas como un volante la rota; al soltar vuelve sola |
| (teléfono) botón **Tilt** | inclinar el teléfono mueve la cámara por el giroscopio, en lugar de la mano |

El cursor se congela donde empezaste a cerrar el pellizco, porque juntar el pulgar arrastra
la punta del índice. Con la palma abierta, la mano además agarra la formación y mueve la
cámara (paralaje).

**Calibración.** Los umbrales (palma abierta, apuntar, pellizco, recorrido del swipe, zona
muerta del scroll) tienen valores por defecto, pero el panel de la cámara ofrece **Tune to
your hand**: seis poses de unos segundos, y `engine/handProfile.js` deriva los umbrales de lo
medido (medianas, acotadas para que una calibración mala no deje la mano inservible). Se
guarda en `localStorage` de este navegador y se aplica en vivo.

**Panel de la cámara.** Compacto: la vista previa con "Local · 0 sent" y dos íconos (sonido,
apagar). Telemetría y la nota de la CSP, detrás de **More**. `?fakehud` (sólo en dev) lo
muestra sin cámara, para diseñarlo.

### Bienvenida

La primera visita abre con una pantalla (`site/ui/Welcome.jsx`) que dice lo único que no se
descubre mirando: que el sitio suena y que se maneja con la mano (o inclinando el teléfono).
El mismo botón lo enciende: **Enter with sound and camera** (o *and tilt*), **Sound only**, o
entrar sin nada. Se recuerda en `localStorage` (`welcomed`); `?nowelcome` la salta. La
presentación del título con partículas espera a que se cierre.

### El biplano

**Fly to my projects** lo hace literal: la esfera de Home se reordena, con sus mismos puntos,
en un biplano rojo de perfil (`engine/shapes/biplane.js`: fuselaje, alas con montantes, cola,
tren de aterrizaje y hélice). Cuando terminó de armarse, despega: en el mismo cuadro la
formación se apaga y aparece un biplano idéntico que sí puede volar (`engine/particlePlane.js`,
hélice girando y dos estelas). Vuela delante de la cámara, que lo persigue, y se estrella
hasta la formación de Projects, que lo absorbe: el avión se encoge hacia su centro y desaparece
dentro, y desde ahí sale una onda que recorre la forma (la levanta y la tiñe de rojo al pasar)
y se apaga en el mismo orden, devolviéndole sus colores (`cloud.wave()` en `pointCloud.js`).
La esfera vuelve a armarse fuera de cuadro.
El botón avisa con el evento `world-plane`; si el mundo contesta con `detail.delay`, espera
ese tiempo (el armado) antes de navegar. Sin mundo, navega en el acto.

### Títulos de partículas

Al llegar a una página o abrir un proyecto, partículas salen de la figura y forman el título
del panel letra por letra, en su sitio exacto; el texto real aparece al llegar las últimas.
Al irse, el título se deshace en partículas. `engine/titleParticles.js` rasteriza el título
palabra por palabra desde el DOM (con la fuente computada de cada una) y la nube vive en el
espacio de la cámara, así que pantalla → 3D es directo aunque la cámara vuele.

### Una formación por proyecto

`blender/build_models.py` construye un modelo procedural por proyecto (velocímetro, fábrica,
lupa con check, velas, engranajes, globo de diálogo con pluma, montañas con pin, engranaje con
play, prensa, teclas, cello) y los exporta a `public/models/projects/<id>.glb` (3–27 KB). Abrir
un proyecto transforma la formación en su modelo. Están pensados como silueta: casi planos, de
frente (`face: true` evita que giren hasta quedar de canto).

### El cursor (mouse o dedo)

- **Sobre la figura:** las partículas bajo el cursor se apartan y se encienden; el campo se
  coloca sobre la cara visible, no en el plano medio. **Arrastrar** la gira con inercia
  (el texto vuelve solo al frente). **Clic**, o pellizco con la mano, la hace estallar y
  rearmarse. En touch, arrastrar sobre la figura la gira y no navega.
- **Sobre el texto:** cada palabra del panel es un `<span class="w">` (lo genera `<Rich>`).
  Las cercanas al cursor se apartan de él como limaduras ante un imán, se tuercen y se
  desdoblan en rojo/cian. `site/useTextLens.js` escribe `--t`, `--dx` y `--dy` por palabra;
  la fuerza (`--push`, `--twist`, `--split`) se ajusta en `site.css`.

### Sonido

Todo sintetizado en vivo con Web Audio (`engine/audio/worldSound.js`): cero archivos, cero
peticiones. Despierta con el primer clic o tecla (el navegador no deja antes) y se apaga con
el botón del altavoz en la barra, o el del panel de la cámara; se recuerda en este navegador.

| Qué pasa | Qué suena |
|---|---|
| Estar en una estación | Un fondo propio: cada sección tiene su nota base, su brillo y su movimiento (Home La, About Do, Skills Re brillante, Experience Mi grave y oscuro, Projects Sol con pulso, Contact La agudo) — tabla `STATIONS` en `worldSound.js` |
| Volar a otra | El acorde se desliza al de destino, aire que cruza de un oído al otro, un grave que empuja |
| Llegar | Tres campanas con el acorde de la estación |
| Título que se forma / se deshace | Chispas que suben / que bajan |
| Cursor sobre la figura | Un soplo que canta según la posición; más fuerte si la girás rápido |
| Clic en la figura | Un golpe grave y un estallido de chispas |
| Cursor sobre el texto | Un arpa: cada palabra es una nota, más aguda cuanto más arriba |
| Algo clicable / clic | Un tic / dos notas que suben (también con la mano) |
| Anillo de espera del dedo | Una nota que sube escalón a escalón |
| Dos manos | Separarlas abre el fondo, juntarlas lo apaga |

Todo está en la misma pentatónica (`audio/scale.js`), así que nada choca con nada, y comparte
una reverb y un eco sintéticos: los sonidos sueltos parecen ocurrir en el mismo lugar. La
pestaña oculta suspende el audio. En el lab siguen las voces por dedo (`heroVoices.js`).

**Probar sin webcam (sólo en `npm run dev`):**

```js
window.__depth.pose({ hands: 1, fingers: 5, y: 0.7 })          // palma baja → scroll
window.__depth.pose({ hands: 1, fingers: 1, point: 1, px: .2, py: .5 })  // cursor
window.__depth.pose({ pinch: 1 })                                // clic
```

## Pruebas de punta a punta

`npm run e2e` levanta Vite en modo dev (puerto 5191), abre Chromium headless con WebGL por
software y recorre el sitio con la mano simulada por `window.__depth` (sólo existe en dev).
21 comprobaciones: vuelo con teclado y rueda, deep links y atrás, modelo por proyecto, títulos
de partículas, lupa de texto, agarre de la figura, scroll/swipe/pellizco/espera con la mano,
flechas de borde, dos manos, calibración completa, giroscopio, reduced motion, móvil, y que un
recorrido entero no haga peticiones fuera del sitio (fuentes aparte). El sonido no se
escucha pero se mide: un analizador (sólo en dev) comprueba que el vuelo y el clic en la
figura suben el nivel, que nada satura y que el botón lo deja en silencio exacto. Falla también ante
cualquier error de consola o respuesta ≥ 400.

Playwright no es dependencia: `npm i --no-save playwright@1.63.0`. Si su Chromium no está
descargado, usa el Google Chrome instalado.

## Estructura

```
src/
  engine/            reutilizable, no sabe nada del portfolio
    signal/          useDepthSignal (puntero/mano/cabeza/giroscopio → una señal),
                     cameraSource (MediaPipe local), oneEuro, useCameraControl
    gestures.js      swipe, modo de la mano, dos manos, joystick de scroll, pellizco, espera (puros)
    handProfile.js   umbrales de la mano: por defecto o calibrados (localStorage)
    titleParticles.js  títulos que se forman y se deshacen en partículas
    stage.js         renderer + cámara + resize + pausa fuera de pantalla
    pointCloud.js    nube morfable: forma y paleta viajan punto a punto
    dust.js          polvo a lo largo de la avenida (la sensación de velocidad)
    shapes/          procedural.js (7 formas) y sources.js (procedural | text | model)
    audio/           worldSound (el sonido del sitio), heroVoices (lab), scale (la pentatónica)
    ui/              PrivacyHUD, TrackButton, TiltButton
  content/           lo que dice el sitio
    data/*.json      GENERADO por `npm run sync` desde el portfolio — no editar
    profile.js       lo que vive dentro de componentes del portfolio (bio, contacto)
  site/              el sitio-mundo
    pages/           una página = un archivo (componente + escena) + una línea en index.js
    router.js        navegación como datos (puro, testeado)
    useNavigation.js teclado, rueda, touch, historial
    World.jsx        la avenida, las estaciones y el vuelo
    flight.js        cuánto dura un vuelo (lo comparten el mundo y el panel)
    pointer.js       un solo puntero (mouse o dedo) para la lupa
    useTextLens.js   la lupa de texto (y el arpa)
    useSiteSound.js  despertar/silenciar el audio, tic y clic de lo clicable
    ui/              Nav, RouteMap (la avenida vista desde arriba), HandControls
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

y agregarla a `src/site/pages/index.js`. El orden de esa lista es el orden de la avenida.
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
