import React, { useState } from "react";
import cards from "../logic/aboutCards";
import '../styles/mySkills.css';

export default function MySkill() {
  const routes = [
    cards.frontEnd,
    cards.backend,
    cards.shopify,
    cards.wordpress,
    cards.seo,
    cards.styling,
    cards.tools,
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
      <h3>My Skills</h3>
      <div className="msCards cardsMaxWidth" on>
        <ul>
          {['Front-End', 'Back-End', 'Shopify', 'WordPress', 'SEO', 'Styling', 'Tools', 'Others'].map((skillName, index) => (
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
        <div className="cardsContainer">
          {route.map((card) => (
            <div key={card.title} className="card hoverEffect">
              <img src={card.img} alt={card.title}/>
              <span>{card.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
