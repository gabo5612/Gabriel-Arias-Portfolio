import React, { useState } from "react";
import '../styles/portfolio.css';
import porfolioCards from "../logic/porfolioCards";

export default function Porfolio() {
  const [hoverIndex, setHoverIndex] = useState(null);

  return (
    <div className="portfolio ">
      <h3>Porfoliooo</h3>
      <div className="pCardsContainer cardsContainer cardsMaxWidth">
        {porfolioCards.map((pCard, index) => (
          <div
            key={pCard.title}
            className="pCard"
            style={{ background: `url(${pCard.img}) no-repeat center center/cover` }}
            onMouseOver={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <span className={hoverIndex === index ? 'pCardHover' : 'pCardNotHover'}>
              {pCard.title}
            </span>
            <p className={hoverIndex === index ? 'pCardHover' : 'pCardNotHover'}>
              {pCard.description}
            </p>
            <a className={hoverIndex === index ? 'pCardHover' : 'pCardNotHover'} href={pCard.link}>
              <button className="pCardBtn">See More -X</button>
            </a>
          </div>
        ))}
      </div>

      <a href="https://github.com/gabo5612/My-portoflio/tree/master"><button className="pCardBtn pCardBtnVM">View More</button></a>
    </div>
  );
}
