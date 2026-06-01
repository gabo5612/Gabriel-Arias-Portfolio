import React from "react";
import "../styles/footer.css";
import email from "../images/Navbar/email.svg";
import frontEndMentor from '../images/Navbar/frontendmentor.svg';
import github from '../images/Navbar/github.svg';
import linkedin from '../images/Navbar/linkedin.svg';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">

        <div className="footer__logo">
          Gabriel<span>.</span>
        </div>

        <ul className="footer__links" aria-label="Social links">
          <li>
            <a href="https://www.frontendmentor.io/profile/gabo5612" target="_blank" rel="noopener noreferrer" aria-label="Frontend Mentor">
              <img src={frontEndMentor} alt="Frontend Mentor" />
            </a>
          </li>
          <li>
            <a href="https://github.com/gabo5612/" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <img src={github} alt="GitHub" />
            </a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/gabriel-oniel-arias/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <img src={linkedin} alt="LinkedIn" />
            </a>
          </li>
          <li>
            <a href="mailto:gabo5612@gmail.com" aria-label="Email">
              <img src={email} alt="Email" />
            </a>
          </li>
        </ul>

        <p className="footer__copy">
          © {year} Gabriel Arias. All rights reserved.
        </p>

      </div>
    </footer>
  );
}
