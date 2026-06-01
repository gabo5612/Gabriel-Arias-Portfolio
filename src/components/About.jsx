import React, { useState, useEffect } from "react";
import '../styles/about.css';
import { motion } from "framer-motion";
import AnimatedSection from "../animations/AnimatedSection";

/* ── Animated counter ── */
function StatCard({ number, suffix = '+', label, delay = 0 }) {
  const [count,   setCount]   = useState(0);
  const [started, setStarted] = useState(false);

  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      onViewportEnter={() => setStarted(true)}
      transition={{ duration: 0.5, delay }}
    >
      <CountUp end={number} started={started} onUpdate={setCount} />
      <div className="stat-number">
        {count}{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}

function CountUp({ end, started, onUpdate }) {
  useEffect(() => {
    if (!started) return;
    const duration = 1800;
    let startTime;

    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      onUpdate(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [started, end, onUpdate]);

  return null;
}

const STATS = [
  { number: 10,   suffix: '+', label: 'Years Experience', delay: 0 },
  { number: 50,   suffix: '+', label: 'Technologies',     delay: 0.08 },
  { number: 4,    suffix: '',  label: 'Companies',        delay: 0.16 },
  { number: 2014, suffix: '',  label: 'Year Started',     delay: 0.24 },
];

export default function About() {
  return (
    <section className="about" id="about" aria-labelledby="about-heading">
      <div className="about__inner">

        <div className="about__header">
          <AnimatedSection>
            <span className="section-badge">About Me</span>
            <h2 id="about-heading" className="about__title">
              Developer. Creator.<br />
              <span className="gradient-text">Problem Solver.</span>
            </h2>
          </AnimatedSection>
        </div>

        <div className="about__grid">
          {/* Bio */}
          <AnimatedSection>
            <div className="about__bio">
              <p>
                Hi! I'm a <strong>full-stack developer</strong> with over 10 years of experience
                building clean, responsive websites and web applications. I'm driven by the
                intersection of great design and solid engineering.
              </p>
              <p>
                My toolkit spans <strong>React, Next.js, Node.js, WordPress</strong>, and{' '}
                <strong>Shopify</strong>. I've shipped everything from high-traffic e-commerce
                platforms to custom web apps — always with a focus on performance and user
                experience.
              </p>
              <p>
                Beyond code, I bring experience in <strong>SEO strategy, web production</strong>,
                and collaborating with cross-functional teams to deliver impactful digital products.
                I'm currently open to new opportunities.
              </p>
            </div>
          </AnimatedSection>

          {/* Stats */}
          <div className="about__stats">
            {STATS.map(s => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
