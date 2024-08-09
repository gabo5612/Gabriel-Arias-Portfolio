import React from "react";
import "../styles/experience.css";
import experience from "../logic/experience.json";
import AnimatedSection from "../animations/AnimatedSection";
export default function Experience() {
  return (
    <div className="experienceContainer">
      <AnimatedSection>
      <h3>Experience</h3>
      </AnimatedSection>
      <div className="experience">
        {experience.map((exp) => (
          <AnimatedSection >
          <div className="expCardsCentered">
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
          </div>
          </AnimatedSection>
        ))}
      </div>

    </div>
  );
}
