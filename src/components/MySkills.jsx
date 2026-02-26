import React, { useState } from "react";
import cards from "../logic/aboutCards";
import '../styles/mySkills.css';
import AnimatedSection from "../animations/AnimatedSection";
import { motion } from "framer-motion";

export default function MySkill() {
  const routes = [
    cards.frontEnd,
    cards.backend,
    cards.shopify,
    cards.wordpress,
    cards.seo,
    cards.styling,
    cards.tools,
    cards.IA,
    cards.others
  ];

  const [route, setRoute] = useState(routes[0]);
  const [skillActive, setSkillActive] = useState(0);

  const skill = (x) => {
    setSkillActive(x);
    setRoute(routes[x] || routes[0]); 
  };

  return (
    
    <div className="msContainer">
      <AnimatedSection>
      <h3>My Skills</h3>
      </AnimatedSection>
      <div className="msCards cardsMaxWidth" on>
      <AnimatedSection>
        <ul>
          {['Front-End', 'Back-End', 'Shopify',  'WordPress', 'SEO', 'Styling', 'Tools', 'IA', 'Others'].map((skillName, index) => (
            <li
              key={index}
              className={`hoverEffect ${skillActive === index ? 'skillActive' : ''}`} 
              onClick={() => skill(index)}
              onKeyDown={() => skill(index)}
            >
              {skillName}
            </li>
          ))}
        </ul>
        </AnimatedSection>
        <AnimatedSection>
        <div className="cardsContainer">
          {route.map((card) => (
            <motion.div key={card.title} className="card hoverEffect" whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}> 
              <img src={card.img} alt={card.title} />
              <span>{card.title}</span>
            </motion.div>
          ))}
        </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
