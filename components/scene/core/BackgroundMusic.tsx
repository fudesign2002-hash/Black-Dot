import React, { useEffect, useRef, useState } from 'react';

interface BackgroundMusicProps {
  url?: string;
  isMuted?: boolean; // NEW
}

const BackgroundMusic: React.FC<BackgroundMusicProps> = ({ url, isMuted = false }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const [interacted, setInteracted] = useState(false);

  const TARGET_VOLUME = 0.2;
  const FADE_DURATION = 3000; // 3 seconds fade in

  const fadeIn = () => {
    if (!audioRef.current) return;
    
    // Clear any existing fade
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    
    audioRef.current.volume = 0;
    const step = TARGET_VOLUME / (FADE_DURATION / 100); // Step every 100ms
    
    fadeIntervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        const nextVolume = Math.min(TARGET_VOLUME, audioRef.current.volume + step);
        audioRef.current.volume = nextVolume;
        
        if (nextVolume >= TARGET_VOLUME) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        }
      }
    }, 100);
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const handleInteraction = () => {
      setInteracted(true);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (url) {
        // eslint-disable-next-line no-console
        console.log('[BackgroundMusic] Setting new source:', url);
        audioRef.current.src = url;
        audioRef.current.load();
        audioRef.current.volume = 0; // Start at 0 for fade in
        
        if (interacted) {
          // eslint-disable-next-line no-console
          console.log('[BackgroundMusic] Attempting to play with fade in...');
          audioRef.current.play().then(() => {
            // eslint-disable-next-line no-console
            console.log('[BackgroundMusic] Playback started, initiating fade in');
            fadeIn();
          }).catch(err => {
            // eslint-disable-next-line no-console
            console.warn('[BackgroundMusic] Playback failed:', err);
          });
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('[BackgroundMusic] No URL provided, pausing');
        audioRef.current.pause();
        audioRef.current.src = '';
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      }
    }
  }, [url, interacted]);

  return (
    <audio
      ref={audioRef}
      loop
      style={{ display: 'none' }}
    />
  );
};

export default BackgroundMusic;
