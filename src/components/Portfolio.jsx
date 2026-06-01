import React from "react";
import '../styles/portfolio.css';
import porfolioCards from "../logic/porfolioCards";
import { motion } from "framer-motion";
import AnimatedSection from "../animations/AnimatedSection";

export default function Portfolio() {
  return (
    <section className="projects" id="projects" aria-labelledby="projects-heading">
      <div className="projects__inner">

        <AnimatedSection>
          <span className="section-badge">Projects</span>
          <h2 id="projects-heading" className="projects__title">Personal Projects</h2>
        </AnimatedSection>

        <div className="projects__grid">
          {porfolioCards.map((card, i) => (
            <motion.div
              key={card.title}
              className="project-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
            >
              <img
                src={card.img}
                alt={card.title}
                className="project-card__image"
                loading="lazy"
              />

              {/* Always-visible badge */}
              <div className="project-card__badge">{card.title}</div>

              {/* Hover overlay */}
              <div className="project-card__overlay">
                {/* Tags */}
                {card.tags && (
                  <div className="project-card__tags">
                    {card.tags.map(tag => (
                      <span key={tag} className="project-card__tag">{tag}</span>
                    ))}
                  </div>
                )}

                <h3 className="project-card__title">{card.title}</h3>
                <p className="project-card__desc">{card.description}</p>

                <div className="project-card__actions">
                  {/* Live demo button (if available) */}
                  {card.demo && (
                    <a
                      href={card.demo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary project-card__btn"
                      aria-label={`Live demo of ${card.title}`}
                    >
                      Live Demo
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                        <path d="M2 2h9v9M2 11L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  )}

                  {/* GitHub / main link */}
                  <a
                    href={card.github || card.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`btn project-card__btn ${card.demo ? 'btn-ghost' : 'btn-primary'}`}
                    aria-label={`GitHub repo for ${card.title}`}
                  >
                    {card.demo ? 'GitHub' : 'View Project'}
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <path d="M2 6.5h9M7 2l4.5 4.5L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatedSection>
          <div className="projects__footer">
            <a
              href="https://github.com/gabo5612/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              View All on GitHub
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
          </div>
        </AnimatedSection>

      </div>
    </section>
  );
}
