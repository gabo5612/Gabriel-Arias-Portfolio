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
            <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Dolorem doloremque quia vel optio nobis eveniet perferendis cumque! Exercitationem, dignissimos voluptatibus, necessitatibus cum nulla, vel verisstatis aspernatur quo laudantium quidem illosss.</p>
        </div>
        </AnimatedSection>
    )
}