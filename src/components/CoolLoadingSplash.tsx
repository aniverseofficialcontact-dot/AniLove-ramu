import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CoolLoadingSplashProps {
  isLoading: boolean;
}

export const CoolLoadingSplash: React.FC<CoolLoadingSplashProps> = ({ isLoading }) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="cool-loading-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 w-screen h-screen z-[9999999] bg-[#090d16] flex flex-col items-center justify-center select-none overflow-hidden"
        >
          {/* Animated Glowing Title with Drop Effect */}
          <div className="flex items-center justify-center space-x-1 sm:space-x-2">
            {["A", "n", "i", "L", "o", "v", "e"].map((letter, index) => (
              <motion.span
                key={index}
                initial={{ y: -150, opacity: 0, scale: 0.5 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 120,
                  damping: 12,
                  delay: index * 0.08,
                }}
                className={`text-4xl sm:text-6xl font-extrabold tracking-wide drop-shadow-[0_0_25px_rgba(168,85,247,0.6)] ${
                  index >= 3
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent'
                }`}
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {letter}
              </motion.span>
            ))}
          </div>

          {/* Subtitle pulse glow effect */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.8 }}
            className="mt-6 text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-purple-300/60 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]"
          >
            Loading Your Universe
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
