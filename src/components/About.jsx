import React from "react";
import '../styles/about.css'
import AnimatedSection from "../animations/AnimatedSection";

export default function About(){
    return(
        <AnimatedSection>
        <div className="aboutSection"  initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}>
            <h3>About</h3>
            <p>Hi! I'm a full-stack developer who loves creating clean, responsive websites and web apps. I’ve worked with tools like WordPress, React, and Node.js, and I enjoy building things that are both useful and easy to use. I also have experience with SEO and enjoy learning new tech to improve my work every day.</p>
        </div>
        </AnimatedSection>
    )
}