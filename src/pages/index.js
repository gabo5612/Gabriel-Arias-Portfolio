import * as React from "react"
import Navbar from "../components/Navbar"
import FirstView from "../components/FirstView"
import About from "../components/About"
import MySkill from "../components/MySkills"
import Porfolio from "../components/Portfolio"
import Experience from "../components/Experience"
import Footer from "../components/Footer"
import '../styles/global.css'

const IndexPage = () => {
  return (
    <>
   <body>
    <header>
      <Navbar/>
      <FirstView/>
    </header>
    <main>
      <About/>
      <MySkill/>
      <Porfolio/>
      <Experience/>
    </main>
    </body>
    <Footer/>
    </>
  )
}

export default IndexPage

export const Head = () => <title>Gabriel Arias Portfolio</title>
