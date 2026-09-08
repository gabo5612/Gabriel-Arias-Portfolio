import React from "react";
import '../styles/architecture.css';
import { motion } from "framer-motion";
import AnimatedSection from "../animations/AnimatedSection";
import porfolioCards from "../logic/porfolioCards";

// Los mapas se sirven desde static/architecture/, no desde una página de Gatsby: cada uno
// es un HTML autocontenido de ~700 KB con su propio visor. Meterlos en un <iframe> aquí
// costaría ese peso en la home, que es justamente lo que este sitio vende que no hace.
// Por eso la sección muestra una imagen y abre el mapa real en otra pestaña.
const MAP_PATH = slug => `/architecture/${slug}.html`;

// El mapa del propio sitio no sale de porfolioCards.js — no hay tarjeta para el portfolio.
const SELF = {
  slug: 'portfolio',
  preview: '/architecture/portfolio-preview.webp',
  // Las dimensiones reales del webp. Van explícitas para que el navegador reserve el
  // hueco y la sección no empuje el contenido al cargar la imagen.
  width: 1400,
  height: 663,
};

// Lo que hace que estos mapas valgan algo es que no son dibujos. Tres hechos, no adjetivos.
const FACTS = [
  {
    k: 'Checked, not drawn',
    v: 'Every map is compiled from a typed JSON source and refuses to be written unless nine layout checks pass with zero composition errors — no edge crossing an unrelated node, no two relationships sharing a corridor, no label masking a route.',
  },
  {
    k: 'One file, no server',
    v: 'Each one is a single self-contained page: dark and light themes, node search, upstream and downstream tracing, and three guided views. It makes no network requests, so it works from disk.',
  },
  {
    k: 'It lives with the code',
    v: 'The same map is checked into its own repository at docs/architecture.html, next to the source it describes, so it goes stale visibly rather than silently.',
  },
];

export default function Architecture() {
  const maps = porfolioCards.filter(c => c.arch);

  return (
    <section className="arch" id="architecture" aria-labelledby="architecture-heading">
      <div className="arch__inner">

        <AnimatedSection>
          <span className="section-badge">Architecture</span>
          <h2 id="architecture-heading" className="arch__title">
            How all of this is built
          </h2>
          <p className="arch__lede">
            Every project here has an interactive system map — the real components, the trust
            boundaries, and the exact routes between them. Starting with this site.
          </p>
        </AnimatedSection>

        {/* ── El mapa de este sitio ── */}
        <AnimatedSection delay={0.1}>
          <a
            className="arch__feature"
            href={MAP_PATH(SELF.slug)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the interactive architecture map of this portfolio"
          >
            <img
              className="arch__feature-img"
              src={SELF.preview}
              width={SELF.width}
              height={SELF.height}
              loading="lazy"
              decoding="async"
              alt="Architecture map of this portfolio: a build-time band where verify-llms, the Gatsby build and verify-budget run before a static deploy, and a runtime band inside the visitor's browser where one page feeds a depth hero, a depth signal, a lazy three.js lattice, a pointer source, the MediaPipe camera and the privacy panel."
            />
            <span className="arch__feature-bar">
              <span className="arch__feature-label">
                This portfolio — static site, local-only camera hero
              </span>
              <span className="arch__feature-cta">
                Open the interactive map
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M2 2h9v9M2 11L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </span>
          </a>
        </AnimatedSection>

        <AnimatedSection delay={0.15}>
          <dl className="arch__facts">
            {FACTS.map(f => (
              <div className="arch__fact" key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </AnimatedSection>

        {/* ── Los mapas de cada proyecto ── */}
        <AnimatedSection delay={0.1}>
          <h3 className="arch__sub">Every project, mapped the same way</h3>
        </AnimatedSection>

        <div className="arch__grid">
          {maps.map((card, i) => (
            <motion.a
              key={card.arch}
              className="arch__card"
              href={MAP_PATH(card.arch)}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08, ease: [0.4, 0, 0.2, 1] }}
              aria-label={`Open the architecture map of ${card.title}`}
            >
              <span className="arch__card-head">
                <span className="arch__card-name">{card.title}</span>
                <svg className="arch__card-arrow" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M2 2h9v9M2 11L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="arch__card-note">{card.archNote}</span>
            </motion.a>
          ))}
        </div>

        <AnimatedSection>
          <p className="arch__credit">
            Rendered and checked with{' '}
            <a href="https://github.com/tt-a1i/archify" target="_blank" rel="noopener noreferrer">
              archify
            </a>
            , an open-source tool by tt-a1i. The maps are mine; the renderer is not.
          </p>
        </AnimatedSection>

      </div>
    </section>
  );
}
