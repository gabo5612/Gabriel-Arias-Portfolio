import React, { useState } from "react";
import cards from "../logic/aboutCards";
import '../styles/mySkills.css';

export default function MySkill() {
  const [route, setRoute] = useState(cards.frontEnd);

  const skill = (x) => {
    switch (x) {
      case 0:
        setRoute(cards.frontEnd);
        break;
      case 1:
        setRoute(cards.backend);
        break;
      case 2:
        setRoute(cards.shopify);
        break;
      case 3:
        setRoute(cards.wordpress);
        break;
      case 4:
        setRoute(cards.seo);
        break;
      case 5:
        setRoute(cards.styling);
        break;
      case 6:
        setRoute(cards.tools);
        break;
      default:
        setRoute(cards.others);
        break;
    }
  };

  return (
    <div className="msContainer">
      <h3>My Skills</h3>
      <div className="msCards cardsMaxWidth">
        <ul>
          <li className="hoverEffect" onClick={() => skill(0)} onKeyDown={() => skill(0)}>Front-End</li>
          <li className="hoverEffect" onClick={() => skill(1)} onKeyDown={() => skill(1)}>Back-End</li>
          <li className="hoverEffect" onClick={() => skill(2)} onKeyDown={() => skill(2)}>Shopify</li>
          <li className="hoverEffect" onClick={() => skill(3)} onKeyDown={() => skill(3)}>WordPress</li>
          <li className="hoverEffect" onClick={() => skill(4)} onKeyDown={() => skill(4)}>SEO</li>
          <li className="hoverEffect" onClick={() => skill(5)} onKeyDown={() => skill(5)}>Styling</li>
          <li className="hoverEffect" onClick={() => skill(6)} onKeyDown={() => skill(6)}>Tools</li>
          <li className="hoverEffect" onClick={() => skill(7)} onKeyDown={() => skill(7)}>Others</li>
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
