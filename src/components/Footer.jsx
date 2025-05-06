import React from "react";
import "../styles/footer.css";
import email from "../images/Navbar/email.svg";
import frontEndMentor from '../images/Navbar/frontendmentor.svg';
import github from '../images/Navbar/github.svg';
import linkedin from '../images/Navbar/linkedin.svg';
import AnimatedSection from "../animations/AnimatedSection";

      
export default function Footer() {
  return (
    <footer>
     
      <ul>
      <AnimatedSection>
        <li>
          <a href="https://www.frontendmentor.io/profile/gabo5612">
            <img src={frontEndMentor} alt="Frontend Mentor" />
          </a>
        </li>
        </AnimatedSection>
        <AnimatedSection>
        <li>
          <a href="https://github.com/gabo5612/">
            <img src={github} alt="Github" />
          </a>
        </li>
        </AnimatedSection>
        <AnimatedSection>
        <li>
          <a href="https://www.linkedin.com/in/gabriel-oniel-arias/">
            <img src={linkedin} alt="LinkedIn" />
          </a>
        </li>
        </AnimatedSection>
        <AnimatedSection>
        <li>
          <a href="mailto:gabo5612@gmail.com">
            <img src={email} alt="Gmail" />
          </a>
        </li>
        </AnimatedSection>
       
      </ul>
    
    </footer>
  );
}
