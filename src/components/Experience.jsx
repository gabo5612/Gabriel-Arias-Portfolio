import React from "react";
import "../styles/experience.css";
import experience from "../logic/experience.json";
import { motion } from "framer-motion";
import AnimatedSection from "../animations/AnimatedSection";

export default function Experience() {
  return (
    <section className="experience" id="experience" aria-labelledby="experience-heading">
      <div className="experience__inner">

        <AnimatedSection>
          <span className="section-badge">Journey</span>
          <h2 id="experience-heading" className="experience__title">Experience</h2>
        </AnimatedSection>

        <div className="timeline" role="list">
          {experience.map((exp, i) => {
            const isPresent = exp.date.includes('Present');

            return (
              <motion.div
                key={exp.title}
                className="timeline-item"
                role="listitem"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="timeline-card">

                  {/* Date badge */}
                  <div className="timeline-card__date">
                    {exp.date}
                    {isPresent && (
                      <span className="timeline-card__present" aria-label="Current position">
                        <span className="timeline-card__present-dot" aria-hidden="true" />
                        Current
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="timeline-card__title">{exp.title}</h3>

                  {/* Location */}
                  <div className="timeline-card__location">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.95 3.5 6.5 3.5 6.5s3.5-3.55 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 4.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" fill="currentColor" />
                    </svg>
                    {exp.location}
                  </div>

                  {/* Description */}
                  <p className="timeline-card__description">{exp.description}</p>

                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
