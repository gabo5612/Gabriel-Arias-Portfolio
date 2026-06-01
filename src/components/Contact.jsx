import React from "react";
import "../styles/contact.css";
import { motion } from "framer-motion";
import github from '../images/Navbar/github.svg';
import linkedin from '../images/Navbar/linkedin.svg';
import email from '../images/Navbar/email.svg';

export default function Contact() {
  return (
    <section className="contact" id="contact" aria-labelledby="contact-heading">
      <div className="contact__bg" aria-hidden="true" />

      <div className="contact__inner">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <span className="section-badge contact__badge">Get in Touch</span>

          <h2 id="contact-heading" className="contact__title">
            Let's build something{' '}
            <span className="gradient-text">great</span>{' '}
            together.
          </h2>

          <p className="contact__subtitle">
            I'm currently open to new opportunities. Whether you have a project
            in mind, a question, or just want to say hi — my inbox is always open.
          </p>

          <div className="contact__actions">
            <a href="mailto:gabo5612@gmail.com" className="btn btn-primary">
              Say Hello
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M1.5 4A1.5 1.5 0 013 2.5h9A1.5 1.5 0 0113.5 4v7A1.5 1.5 0 0112 12.5H3A1.5 1.5 0 011.5 11V4zM1.5 4.5l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/gabriel-oniel-arias/"
              className="btn btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn Profile
            </a>
          </div>

          <div className="contact__divider" aria-hidden="true" />

          <div className="contact__social" aria-label="Social links">
            <a
              href="https://github.com/gabo5612/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <img src={github} alt="" aria-hidden="true" />
            </a>
            <a
              href="https://www.linkedin.com/in/gabriel-oniel-arias/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <img src={linkedin} alt="" aria-hidden="true" />
            </a>
            <a
              href="mailto:gabo5612@gmail.com"
              aria-label="Send email"
            >
              <img src={email} alt="" aria-hidden="true" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
