import React from "react";
import '../styles/navBar.css'
import frontEndMentor from '../images/Navbar/frontendmentor.svg'
import github from '../images/Navbar/github.svg'
import linkedin from '../images/Navbar/linkedin.svg'
import email from '../images/Navbar/email.svg'

export default function Navbar() {
  return (

      <nav className="navIcons">       
        <a href="https://www.frontendmentor.io/profile/gabo5612"><img src={frontEndMentor} alt="Frontend Mentor" /></a>
        <a href="https://github.com/gabo5612/"><img src={github} alt="Github" /></a>
        <a href="https://www.linkedin.com/in/gabriel-oniel-arias/"><img src={linkedin} alt="LinkedIn" /></a>
        <a href="mailto:gabo5612@gmail.com"><img src={email} alt="Gmail" /></a>
      </nav>
  
  );
}
