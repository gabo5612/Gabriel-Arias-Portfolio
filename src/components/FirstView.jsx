import React from "react";
import "../styles/firstView.css";
import imgGabo from '../images/FirstView/imgGabo.png';
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
            delay: 0.55,
            ease: [0, 0.71, 0.2, 1.01]
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
            delay: 0.6,
            ease: [0, 0.71, 0.2, 1.01]
          }}
        >
          <h2>Front-end and Production Developer</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.8,
            delay: 0.65,
            ease: [0, 0.71, 0.2, 1.01]
          }}
        >
          <motion.div whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}> <button className="mainBtn">Contact Me</button>
            </motion.div>

        </motion.div>
      </div>

      <motion.div className="fvImage"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.8,
          delay: 0.5,
          ease: [0, 0.71, 0.2, 1.01]
        }}
      >
        <img src={imgGabo} alt="Gabriel Arias" />
      </motion.div>
    </div>
  );
};

export default FirstView;
