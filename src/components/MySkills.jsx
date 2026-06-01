import React, { useState } from "react";
import cards from "../logic/aboutCards";
import '../styles/mySkills.css';
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "../animations/AnimatedSection";

const TAB_NAMES = [
  'Front-End', 'Back-End', 'Shopify', 'WordPress',
  'SEO', 'Styling', 'Tools', 'AI', 'Others',
];

const ROUTES = [
  cards.frontEnd, cards.backend, cards.shopify, cards.wordpress,
  cards.seo, cards.styling, cards.tools, cards.IA, cards.others,
];

const gridVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.045 } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
};

const cardVariant = {
  hidden:  { opacity: 0, scale: 0.88, y: 14 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.28, ease: 'easeOut' } },
};

export default function MySkill() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="skills" id="skills" aria-labelledby="skills-heading">
      <div className="skills__inner">

        <AnimatedSection>
          <span className="section-badge">Expertise</span>
          <h2 id="skills-heading" className="skills__title">My Skills</h2>
        </AnimatedSection>

        {/* Category tabs */}
        <AnimatedSection delay={0.1}>
          <div className="skills__tabs" role="tablist" aria-label="Skill categories">
            {TAB_NAMES.map((name, i) => (
              <button
                key={name}
                role="tab"
                aria-selected={activeTab === i}
                aria-controls="skills-grid"
                tabIndex={activeTab === i ? 0 : -1}
                className={`skills__tab${activeTab === i ? ' skillActive' : ''}`}
                onClick={() => setActiveTab(i)}
              >
                {name}
              </button>
            ))}
          </div>
        </AnimatedSection>

        {/* Cards grid */}
        <AnimatePresence mode="wait">
          <motion.div
            id="skills-grid"
            key={activeTab}
            className="skills__grid"
            role="tabpanel"
            variants={gridVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {ROUTES[activeTab].map(card => (
              <motion.div
                key={card.title}
                className="skill-card"
                variants={cardVariant}
                whileHover={{ y: -4, transition: { duration: 0.18 } }}
                whileTap={{ scale: 0.95 }}
              >
                <img src={card.img} alt={card.title} loading="lazy" />
                <span>{card.title}</span>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}
