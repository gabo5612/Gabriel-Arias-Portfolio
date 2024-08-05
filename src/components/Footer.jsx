import React from "react";
import '../styles/footer.css'
import email from '../images/Navbar/email.svg'

export default function Footer() {
  return (
    <footer>
      <h5>Contact Me</h5>
      <div className="footerContact">
        <a href="mailto:gabo5612@gmail.com"><img src={email} alt="email"/>gabo5612@gmail.com</a>
            <h6>"Thanks for Scrolling"</h6>
      </div>
      <ul>
        <li>
          <img src={email} alt="email" />
        </li>
        <li>
          <img src={email} alt="email" />
        </li>
        <li>
          <img src={email} alt="email" />
        </li>
      </ul>
    </footer>
  );
}
