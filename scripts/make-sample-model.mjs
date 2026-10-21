// Genera public/models/knot.glb: un modelo de ejemplo para probar la fuente
// `{ type: 'model' }` sin depender de que haya un .glb exportado de Blender.
//
// GLB (glTF binario) mínimo escrito a mano —una malla, posiciones e índices—
// porque GLTFExporter de three necesita Blob/FileReader y en node no los tiene.
// Binario y no .gltf con el buffer en base64: la CSP del sitio (connect-src
// 'self') bloquea el fetch de una URI data:, y GLB es además lo que exporta
// Blender por defecto. Un diseño real se exporta desde Blender (File → Export →
// glTF 2.0) y se deja en la misma carpeta.
//
//   node scripts/make-sample-model.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import { TorusKnotGeometry } from 'three'

const geo = new TorusKnotGeometry(1, 0.32, 220, 24, 2, 3)
const pos = geo.attributes.position.array
const idx = new Uint32Array(geo.index.array)

const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < pos.length; i += 3) {
  for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], pos[i + k])
    max[k] = Math.max(max[k], pos[i + k])
  }
}

const posBytes = Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength)
const idxBytes = Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength)
const bin = Buffer.concat([posBytes, idxBytes])

const gltf = {
  asset: { version: '2.0', generator: 'hero-sandbox/scripts/make-sample-model.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'knot' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962 },
    { buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max },
    { bufferView: 1, componentType: 5125, count: idx.length, type: 'SCALAR' },
  ],
}

// Contenedor GLB: cabecera de 12 bytes, chunk JSON y chunk BIN, cada uno
// alineado a 4 bytes (el JSON se rellena con espacios, el binario con ceros).
const pad = (buf, fill) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, fill)])
const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20)
const body = pad(bin, 0)
const chunk = (data, type) => {
  const h = Buffer.alloc(8)
  h.writeUInt32LE(data.length, 0)
  h.writeUInt32LE(type, 4)
  return Buffer.concat([h, data])
}
const chunks = Buffer.concat([chunk(json, 0x4e4f534a), chunk(body, 0x004e4942)])
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)   // 'glTF'
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + chunks.length, 8)

mkdirSync(new URL('../public/models/', import.meta.url), { recursive: true })
const out = new URL('../public/models/knot.glb', import.meta.url)
writeFileSync(out, Buffer.concat([header, chunks]))
console.log(`wrote ${out.pathname} (${((12 + chunks.length) / 1024).toFixed(0)} KB, ${idx.length / 3} triangles)`)
