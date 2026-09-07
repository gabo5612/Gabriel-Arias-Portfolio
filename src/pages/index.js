import * as React from "react"
import Navbar from "../components/Navbar"
import FirstView from "../components/FirstView"
import About from "../components/About"
import MySkill from "../components/MySkills"
import Experience from "../components/Experience"
import Portfolio from "../components/Portfolio"
import Contact from "../components/Contact"
import Footer from "../components/Footer"
import '../styles/global.css'

const IndexPage = () => {
  return (
    <>
      <Navbar />
      <main>
        <FirstView />
        <About />
        <MySkill />
        <Experience />
        <Portfolio />
        <Contact />
      </main>
      <Footer />
    </>
  )
}

export default IndexPage

export const Head = () => (
  <>
    {/* La promesa del hero —"tu cámara no sale de este dispositivo"— no se
        afirma, se impone. `connect-src 'self'` hace que el navegador rechace
        cualquier salida, y eso incluye la telemetría que MediaPipe manda por su
        cuenta a odml.pa.googleapis.com. Sin esta línea el panel mentía.
        `wasm-unsafe-eval` es obligatorio para instanciar el WASM del modelo. */}
    <meta
      httpEquiv="Content-Security-Policy"
      content={[
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')}
    />
    <title>Gabriel Arias — Frontend &amp; Web Developer</title>
    <meta name="description" content="Full-stack developer specializing in React, WordPress, Shopify, and modern web technologies. Available for new opportunities." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </>
)
