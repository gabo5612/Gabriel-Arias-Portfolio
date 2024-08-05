import React from "react";
import "../styles/firstView.css";
import imgGabo from '../images/FirstView/imgGabo.png'
const FirstView = () => {
  return (
    <div className="firstViewContainer">
      <div className="fvContent">
        <div className="fvcTitle">
          <span>I'M</span>
          <h1>Gabriel Arias</h1>
        </div>

        <div className="fvcTitle">
          <h2>Front-end and Production Developer</h2>
        </div>
        <button className="mainBtn">Contact Me</button>
      </div>
      <div className="fvImage">
            <img src={imgGabo} alt="Gabriel Arias" />
      </div>
    </div>
  );
};

export default FirstView;
