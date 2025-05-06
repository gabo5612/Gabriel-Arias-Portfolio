import React from "react";
import "../styles/firstView.css";
import { motion } from "framer-motion";
import AnimatedLetters from "../animations/AnimatedLetterrs"
const FirstView = () => {
  return (
    <div className="firstViewContainer">
      <div className="fvContent">
        <motion.div className="fvcTitle"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.8,
            delay: 0.10,
            ease: [0, 0.71, 0.2, 0.5]
          }}
        >
          <span>I'M</span>
          <h1 >
            <AnimatedLetters text="Gabriel Arias" />
          </h1>
        </motion.div>

        <motion.div className="fvcTitle"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.8,
            delay: 2.9,
            ease: [0, 0.71, 0.2, 1.01]
          }}
        >
          <h2>Front-end and Production Developer</h2>
        </motion.div>


      </div>


    </div>
  );
};

export default FirstView;
