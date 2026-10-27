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

**Si la mano se pierde a mitad de gesto** (sale del cuadro, la luz, un cuadro malo del
modelo): durante 1 s todo queda en pausa. El cursor se queda donde desapareció como un
fantasma (aro punteado, apagándose), el anillo de espera conserva su progreso, nada hace clic,
suenan dos notas suaves que bajan y la guía dice *Lost your hand*. Si vuelve a tiempo, cerca
del mismo lugar, sigue desde ahí (y suenan las mismas notas subiendo); si no, se suelta todo.
**El mouse manda si se mueve de verdad** (más de 6 px): la mano cede el cursor 1.2 s desde el
último movimiento, y lo retoma cuando el mouse queda quieto. `createPresence` y
`dwell.pause/resume` en `engine/gestures.js`, con tests.

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

### El cohete

Dura 10 s del clic a la absorción (1 s armándose, 9 s volando; `site/flight.js`).

**Fly to my projects** lo hace literal: la esfera de Home se reordena, con sus mismos puntos,
en un cohete de dibujo inclinado hacia arriba (`engine/shapes/rocket.js`: cuerpo de bala,
punta roja, ventanilla, tres aletas, tobera y llama). Cuando terminó de armarse, despega: en
el mismo cuadro la formación se apaga y aparece un cohete idéntico que sí puede volar
(`engine/particleRocket.js`: se endereza, la ventanilla es azul, la llama titila y deja una
estela de humo). Vuela delante de la cámara haciendo slalom entre las figuras que hay en el
camino —a la izquierda de la primera, a la derecha de la siguiente—, y llega hasta la
formación de Projects, que lo absorbe: se encoge hacia su centro y desaparece dentro, y
desde ahí sale una onda que recorre la forma (la levanta y la tiñe de rojo al pasar) y se
apaga en el mismo orden (`cloud.wave()` en `pointCloud.js`). Suena un rugido de motor que
cruza de izquierda a derecha. La esfera vuelve a armarse fuera de cuadro. El botón avisa con
el evento `world-plane`; si el mundo contesta con `detail.delay`, espera ese tiempo (el
armado) antes de navegar. Sin mundo, navega en el acto.

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
| Estar en una estación | Un fondo propio: cada sección tiene su nota base, su brillo y su movimiento (Home La, About Do, Skills Re brillante, Experience Mi grave y oscuro, Projects Sol grave con pulso, Contact Re grave) — tabla `STATIONS` en `worldSound.js` |
| Volar a otra | El acorde pasa por el de cada sección que se cruza (con una campana suave al pasarle al lado) hasta el de destino; aire que cruza de un oído al otro, un grave que empuja |
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

## SEO, llms.txt y lo que se lee sin JavaScript

Las secciones son rutas de verdad (`/about`, `/projects/shopfloor`), no `#/…`: un buscador
ignora todo lo que va después de `#`, así que con hash el sitio era una sola URL. Los
enlaces viejos con hash siguen funcionando: se reescriben a ruta al cargar. Una ruta
desconocida vuelve al inicio (y en producción es un 404 de verdad, `404.html`, noindex).

`npm run build` = `vite build` + `scripts/prerender.mjs` + `scripts/verify-seo.mjs`:

- **prerender** escribe un `.html` por ruta (17: seis secciones y once proyectos) con su
  título, descripción, canonical, Open Graph, Twitter Card, JSON-LD (`Person`, `WebSite` y
  por página `ProfilePage`, `AboutPage`, `CollectionPage`, `SoftwareSourceCode`/
  `CreativeWork`, `ContactPage`, `BreadcrumbList`) y el contenido de la sección como HTML
  semántico dentro de `#root`. React lo reemplaza al montar; sin JS, eso es la página. Más
  `sitemap.xml`, `robots.txt` (todos los rastreadores, incluidos los de asistentes),
  `404.html` y **`llms.txt`**.
- Títulos y descripciones salen de `src/content/seo.js`, que también usa el sitio para el
  título de la pestaña: no hay dos versiones.
- `llms.txt` se arma del contenido del sitio (perfil, secciones con sus URLs, experiencia,
  skills, contacto) más las notas largas de cada proyecto, que viven en
  `src/content/llms-projects.md` bajo `### <título exacto>`. El botón **Ask ChatGPT** de cada
  proyecto le pide al modelo justo esa sección.
- **verify-seo** falla el build si una ruta no tiene título o descripción únicos (≤ 160),
  canonical correcto, exactamente un `<h1>`, Open Graph y JSON-LD que parsea; si el sitemap no
  coincide con las rutas, si `llms.txt` no tiene la sección de algún proyecto, o si el 404 es
  indexable.
- `public/og.jpg` (1200×630) es la imagen de las previsualizaciones de links: una captura del
  inicio. Se regenera a mano si cambia el diseño.
- `vercel.json` agrega `cleanUrls` (sirve `about.html` en `/about`), cabeceras de seguridad
  (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` con cámara y
  giroscopio sólo para el propio sitio) y caché inmutable para `/assets`.

## Publicación

`main` de `gabo5612/Gabriel-Arias-Portfolio` se publica solo en GitHub Pages
(`.github/workflows/pages.yml`): tests, `vite build` con `BASE_PATH=/Gabriel-Arias-Portfolio/`
y deploy de `dist/`. Toda ruta a `public/` pasa por `engine/asset.js` para respetar esa
subcarpeta. `public/llms.txt` y `public/architecture/` se trajeron del sitio Gatsby anterior
para que sus URLs sigan respondiendo. Vercel (`gabriel-arias-portfolio.vercel.app`) también publica cada push a `main`, en la raíz
(sin subcarpeta). `vercel.json` fija Vite y `dist/`: el proyecto venía configurado como
Gatsby, que publica `public/`, y servía la salida vieja de Gatsby que tenía en caché.
Probar la build publicada en local:

```bash
BASE_PATH=/Gabriel-Arias-Portfolio/ npm run build
BASE_PATH=/Gabriel-Arias-Portfolio/ npx vite preview   # → /Gabriel-Arias-Portfolio/
```

## Pruebas de punta a punta

`npm run e2e` levanta Vite en modo dev (puerto 5191), abre Chromium headless con WebGL por
software y recorre el sitio con la mano simulada por `window.__depth` (sólo existe en dev).
26 comprobaciones: vuelo con teclado y rueda, deep links y atrás, modelo por proyecto, títulos
de partículas, lupa de texto, agarre de la figura, scroll/swipe/pellizco/espera con la mano,
flechas de borde, mano perdida a mitad de gesto (pausa y retoma, suelta tras el margen), el
mouse que le quita el cursor a la mano, dos manos, calibración completa, giroscopio, reduced motion, móvil, y que un
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

## Terceros

Se usan, no son de autoría propia:

- **MediaPipe Tasks Vision** (Google, Apache License 2.0). `public/mediapipe/` redistribuye
  sin cambios su WASM (`vision_wasm_internal.*`) y los modelos `hand_landmarker.task` y
  `blaze_face_short_range.tflite`, copiados de `@mediapipe/tasks-vision@1.0.1`. Licencia:
  https://www.apache.org/licenses/LICENSE-2.0
- **three.js** (MIT), **React** (MIT), **framer-motion** (MIT), **Vite** (MIT), como
  dependencias npm.
- **Blender** (GPL) se usa como herramienta para generar los modelos de `public/models/`;
  los `.glb` son salida de `blender/build_models.py`, no código de Blender.
