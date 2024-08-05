import React from "react";
import "../styles/experience.css";
import experience from "../logic/experience.json";
export default function Experience() {
  return (
    <div className="experienceContainer">
      <h3>Experience</h3>
      <div className="experience">
        {experience.map((exp) => (
          <div key={exp.title} className="expCard">
            <div className="expDate">
              <span>{exp.date}</span>
            </div>
            <div>
              <div className="yellowDot"></div>
              <div className="line"></div>
            </div>
            <div className="expTexts">
              <h4>{exp.title}</h4>
              <span>{exp.location}</span>
              <p>{exp.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
