import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { soundEffects } from '../services/soundEffects';

interface AppIntroSplashProps {
  isDataReady?: boolean;
  onFinish: () => void;
}

export const AppIntroSplash: React.FC<AppIntroSplashProps> = ({
  isDataReady,
  onFinish,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoStartedTime, setVideoStartedTime] = useState<number | null>(null);

  // Lock body scroll while splash is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Audio and Video synchronization engine
  useEffect(() => {
    // We delay the audio just a tiny bit to sync better with the native splash disappearance
    const audioTimer = setTimeout(() => {
        soundEffects.playAniLoveCinematicIntro(0);
        soundEffects.resumeAudio().catch(() => {});
    }, 100);

    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.defaultMuted = true;

      const handlePlay = () => {
        setIsVideoPlaying(true);
        setVideoStartedTime(Date.now());

        // CRITICAL: Signal the native Android layer to dismiss its logo
        // only now that the video is actually moving on the screen!
        (window as any).isWebReady = true;
      };
      v.addEventListener('playing', handlePlay);

      // Force play every 100ms if not playing (aggressive autoplay)
      const playInterval = setInterval(() => {
        if (v.paused) {
          v.play().catch(() => {});
        } else {
          clearInterval(playInterval);
        }
      }, 100);

      v.play().catch(() => {});

      return () => {
        clearTimeout(audioTimer);
        v.removeEventListener('playing', handlePlay);
        clearInterval(playInterval);
      };
    }
    return () => clearTimeout(audioTimer);
  }, []);

  // Unified exit logic
  useEffect(() => {
    if (isDataReady && videoStartedTime) {
      const elapsedVideo = Date.now() - videoStartedTime;
      const minVideoDuration = 3500;
      const remaining = Math.max(0, minVideoDuration - elapsedVideo);

      const timer = setTimeout(() => {
        soundEffects.stopAniLoveCinematicIntro();
        onFinish();
      }, remaining);

      return () => clearTimeout(timer);
    }
  }, [isDataReady, videoStartedTime, onFinish]);

  return (
    <AnimatePresence>
      <motion.div
        key="app-splash-container"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className="fixed inset-0 w-screen h-screen z-[9999999] bg-[#020005] select-none overflow-hidden flex items-center justify-center pointer-events-auto"
      >
        {/* No fallback web-logo layer - the Native Android Logo covers this space until signal */}

        {/* Cinematic Video Layer */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoPlaying ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundColor: 'transparent' }}
        >
          <source src="/assets/loading_video.mp4" type="video/mp4" />
        </video>

        {/* CSS Fix to hide play button on some Android versions */}
        <style dangerouslySetInnerHTML={{ __html: `
          video::-webkit-media-controls { display:none !important; }
          video::-webkit-media-controls-start-playback-button { display:none !important; -webkit-appearance: none; }
        `}} />
      </motion.div>
    </AnimatePresence>
  );
};
