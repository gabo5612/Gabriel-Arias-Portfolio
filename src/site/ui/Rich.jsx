import React from 'react'

// Texto del panel, palabra por palabra. `**texto**` → <strong>, como antes, y
// además cada palabra va en <span class="w">: es lo que la lupa del cursor
// (useTextLens) enciende. Los espacios quedan como texto entre spans, así que
// copiar y pegar, el corte de línea y los lectores de pantalla no cambian.
const words = (text, key) =>
  text.split(/(\s+)/).map((part, i) =>
    !part || /^\s+$/.test(part) ? part : <span className="w" key={`${key}-${i}`}>{part}</span>,
  )

export default function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**')
      ? <strong key={i}>{words(part.slice(2, -2), i)}</strong>
      : <React.Fragment key={i}>{words(part, i)}</React.Fragment>,
  )
}
