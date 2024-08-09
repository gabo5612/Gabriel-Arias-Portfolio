import React from "react";
import { motion } from "framer-motion";

const AnimatedLetters = ({ text }) => {
  const letters = Array.from(text);

  return (
    <span className="fvH1">
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: index * 0.2, 
          }}
          style={{ display: "inline-block", whiteSpace: letter === " " ? "pre" : "normal" }}
        >
          {letter}
        </motion.span>
      ))}
    </span>
  );
};

export default AnimatedLetters;
