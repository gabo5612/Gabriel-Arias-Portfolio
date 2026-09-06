// Gate para los SVG generados. Falla con exit 1 y un mensaje concreto por archivo.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

const target = process.argv[2]
if (!target) { console.error('uso: node scripts/verify-svg.mjs <dir|archivo.svg>'); process.exit(1) }
if (!existsSync(target)) { console.error(`no existe: ${target}`); process.exit(1) }

// Acepta un directorio (valida todos) o un solo .svg (gate acotado a una tarea).
const isFile = statSync(target).isFile()
const dir = isFile ? dirname(target) : target
const files = isFile
  ? [basename(target)]
  : readdirSync(target).filter(f => f.endsWith('.svg'))
if (files.length === 0) { console.error(`sin .svg en ${target}`); process.exit(1) }

const errors = []
for (const f of files) {
  const p = join(dir, f)
  const s = readFileSync(p, 'utf8')
  const fail = m => errors.push(`${f}: ${m}`)

  if (!/^\s*<svg[\s>]/.test(s))              fail('no empieza con <svg')
  if (!/<\/svg>\s*$/.test(s))                fail('no cierra con </svg>')
  if (!/viewBox="0 0 24 24"/.test(s))        fail('falta viewBox="0 0 24 24"')
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(s)) fail('falta xmlns')
  if (/<image\b/i.test(s))                   fail('usa <image> (prohibido)')
  if (/href\s*=\s*"(?!#)/i.test(s))          fail('referencia externa por href (prohibido)')
  if (/<script\b/i.test(s))                  fail('contiene <script> (prohibido)')
  if (/\bstyle\s*=/.test(s))                 fail('usa atributo style (prohibido, usa atributos SVG)')
  if (!/currentColor/.test(s))               fail('no usa currentColor')
  if (/#[0-9a-fA-F]{3,6}\b/.test(s))         fail('tiene color hardcodeado (usa currentColor)')

  // balance de etiquetas basico
  const open = (s.match(/<(?!\/)(?!!)[a-zA-Z]/g) || []).length
  const close = (s.match(/<\//g) || []).length
  const self = (s.match(/\/>/g) || []).length
  if (open !== close + self) fail(`etiquetas desbalanceadas (abre ${open}, cierra ${close}, self ${self})`)
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`ok: ${files.length} svg valido(s)`)
