import React, { useState, useEffect } from "react";
import '../styles/navBar.css';
import github from '../images/Navbar/github.svg';
import linkedin from '../images/Navbar/linkedin.svg';

const NAV_LINKS = [
  { label: 'About',      href: '#about' },
  { label: 'Skills',     href: '#skills' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects',   href: '#projects' },
  { label: 'Contact',    href: '#contact' },
];

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen, setMenuOpen]  = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="navbar__container">

          {/* Logo */}
          <a href="/" className="navbar__logo" onClick={close}>
            Gabriel<span className="navbar__logo-accent">.</span>
          </a>

          {/* Desktop links */}
          <ul className="navbar__links" role="list">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>

          {/* Right cluster */}
          <div className="navbar__right">
            <div className="navbar__social" aria-label="Social links">
              <a
                href="https://github.com/gabo5612/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <img src={github} alt="GitHub" />
              </a>
              <a
                href="https://www.linkedin.com/in/gabriel-oniel-arias/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <img src={linkedin} alt="LinkedIn" />
              </a>
            </div>

            <a href="#contact" className="navbar__cta">Hire Me</a>

            <button
              className={`navbar__hamburger${menuOpen ? ' navbar__hamburger--open' : ''}`}
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>

        </div>
      </nav>

      {/* Mobile full-screen menu */}
      <div
        className={`navbar__mobile-menu${menuOpen ? ' navbar__mobile-menu--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {NAV_LINKS.map(({ label, href }) => (
          <a key={label} href={href} onClick={close}>
            {label}
          </a>
        ))}
        <a href="mailto:gabo5612@gmail.com" onClick={close}>
          Say Hello ↗
        </a>
      </div>
    </>
  );
}
