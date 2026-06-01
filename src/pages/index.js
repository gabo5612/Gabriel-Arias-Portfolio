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
    <title>Gabriel Arias — Frontend &amp; Web Developer</title>
    <meta name="description" content="Full-stack developer specializing in React, WordPress, Shopify, and modern web technologies. Available for new opportunities." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </>
)
