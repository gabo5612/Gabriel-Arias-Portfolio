import React from 'react'

// `**texto**` → <strong>. Lo justo para que el contenido siga siendo datos
// (content/profile.js) sin meter JSX ni un parser de markdown entero.
export default function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}
