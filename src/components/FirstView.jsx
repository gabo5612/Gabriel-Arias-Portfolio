import React, { useState, useEffect } from "react";
import "../styles/firstView.css";
import { motion } from "framer-motion";

/* ── Typewriter hook ── */
const ROLES = [
  "Front-end Developer",
  "Full-Stack Developer",
  "Web Producer",
  "React Specialist",
  "WordPress Expert",
];

function useTypewriter(words, speed = 75, deleteSpeed = 45, pause = 2000) {
  const [text,       setText]       = useState('');
  const [wordIdx,    setWordIdx]    = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused,   setIsPaused]   = useState(false);

  useEffect(() => {
    const word = words[wordIdx % words.length];

    if (isPaused) {
      const t = setTimeout(() => { setIsPaused(false); setIsDeleting(true); }, pause);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      if (!isDeleting) {
        const next = word.substring(0, text.length + 1);
        setText(next);
        if (next === word) setIsPaused(true);
      } else {
        const next = word.substring(0, text.length - 1);
        setText(next);
        if (next === '') { setIsDeleting(false); setWordIdx(i => i + 1); }
      }
    }, isDeleting ? deleteSpeed : speed);

    return () => clearTimeout(t);
  }, [text, wordIdx, isDeleting, isPaused, words, speed, deleteSpeed, pause]);

  return text;
}

/* ── Framer variants ── */
const container = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const item = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.65, ease: [0.4, 0, 0.2, 1] } },
};

export default function FirstView() {
  const role = useTypewriter(ROLES);

  return (
    <section className="hero" id="home" aria-label="Hero">

      {/* Animated background */}
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__blob hero__blob--1" />
        <div className="hero__blob hero__blob--2" />
        <div className="hero__blob hero__blob--3" />
        <div className="hero__grid" />
      </div>

      {/* Content */}
      <motion.div
        className="hero__content"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {/* Status */}
        <motion.div className="hero__status" variants={item}>
          <div className="hero__status-dot" aria-hidden="true" />
          Available for work
        </motion.div>

        {/* Greeting */}
        <motion.p className="hero__greeting" variants={item}>
          Hi, I'm
        </motion.p>

        {/* Name */}
        <motion.h1 className="hero__name" variants={item}>
          Gabriel Arias
        </motion.h1>

        {/* Typewriter */}
        <motion.div className="hero__role-wrapper" variants={item} aria-live="polite">
          <span className="hero__role-prefix">I build</span>
          <span className="hero__role">{role}</span>
          <span className="hero__role-cursor" aria-hidden="true" />
        </motion.div>

        {/* Description */}
        <motion.p className="hero__description" variants={item}>
          Full-stack developer passionate about crafting clean, performant web experiences.
          Specializing in React, WordPress, Shopify, and modern web technologies since 2014.
        </motion.p>

        {/* CTAs */}
        <motion.div className="hero__actions" variants={item}>
          <a href="#projects" className="btn btn-primary">
            View My Work
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7h9M7 2.5l4.5 4.5L7 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <a href="#contact" className="btn btn-ghost">
            Contact Me
          </a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div className="hero__scroll" variants={item} aria-hidden="true">
          <div className="hero__scroll-indicator">
            <div className="hero__scroll-dot" />
          </div>
          <span>Scroll down</span>
        </motion.div>
      </motion.div>

    </section>
  );
}
