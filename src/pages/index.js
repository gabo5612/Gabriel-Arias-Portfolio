import * as React from "react"
import Navbar from "../components/navbar"
import FirstView from "../components/FirstView"
import '../styles/global.css'
import About from "../components/about"
import MySkill from "../components/MySkills"
import Porfolio from "../components/Portfolio"
import Experience from "../components/Experience"
import Footer from "../components/footer"


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
