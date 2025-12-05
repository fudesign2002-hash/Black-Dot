import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart as HeartIcon } from 'lucide-react'; // Import Heart icon

interface HeartParticleProps {
  trigger: number;
}

interface Heart {
  id: string;
  size: number;
  color: string;
  duration: number;
  delay: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  scaleEnd: number;
}

const HEART_COLORS = [
  '#FF69B4', // Hot Pink
  '#20B2AA', // Light Sea Green (Cyan-Green)
  '#FFD700', // Gold (Yellow)
  '#FFA07A', // Light Salmon (Orange)
  '#BA55D3', // Medium Orchid (Light Purple)
  '#66CCFF', // Sky Blue
  '#FFCC00', // Amber
  '#99FF99', // Pale Green
];

const HeartEmitter: React.FC<HeartParticleProps> = ({ trigger }) => {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const nextId = useRef(0);


  const generateHeart = useCallback((): Heart => {
    const size = Math.random() * (40 - 20) + 20; // 20px to 40px, suitable for SVG width/height
    const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
    const duration = Math.random() * (4 - 2) + 2; // 2s to 4s
    const delay = Math.random() * 0.5; // 0s to 0.5s delay
    
    // Hearts can start slightly to left or right of center
    const startX = (Math.random() - 0.5) * 40; // -20px to 20px horizontal offset from center
    const startY = (Math.random() - 0.5) * 40; // -20px to 20px vertical offset from center

    // Hearts drift upwards and slightly horizontally
    const endX = startX + (Math.random() - 0.5) * 80; // Additional horizontal drift
    const endY = startY - (Math.random() * (180 - 100) + 100); // Upwards drift, 100px to 180px
    const scaleEnd = Math.random() * (1.5 - 0.8) + 0.8; // Scales from 0.8 to 1.5

    return {
      id: `heart-${nextId.current++}`,
      size,
      color,
      duration,
      delay,
      startX,
      startY,
      endX,
      endY,
      scaleEnd,
    };
  }, []);

  useEffect(() => {
    if (trigger > 0) {
      const numHearts = Math.floor(Math.random() * (3 - 1) + 1); // 1 to 3 hearts
      const newHearts: Heart[] = Array.from({ length: numHearts }).map(generateHeart);

      setHearts(prevHearts => [...prevHearts, ...newHearts]);

      const maxHeartDuration = Math.max(...newHearts.map(h => h.duration));
      const cleanupTime = (maxHeartDuration + 0.5) * 1000;
      const timeout = setTimeout(() => {
        setHearts(prevHearts => prevHearts.filter(h => !newHearts.some(nh => nh.id === h.id)));
      }, cleanupTime);
      return () => clearTimeout(timeout);
    }
  }, [trigger, generateHeart]);

  return (
    <div className="heart-particle-container">
      {hearts.map(heart => (
        <HeartIcon // Changed from <span> to HeartIcon
          key={heart.id}
          className="heart-particle"
          style={{
            '--start-x': `${heart.startX}px`,
            '--start-y': `${heart.startY}px`,
            '--end-x': `${heart.endX}px`,
            '--end-y': `${heart.endY}px`,
            '--scale-end': heart.scaleEnd,
            width: `${heart.size}px`,   // Control SVG width
            height: `${heart.size}px`,  // Control SVG height
            fill: heart.color,          // Set fill color
            stroke: heart.color,        // Set stroke color for a fully colored look
            animation: `floatAndFade ${heart.duration}s ease-out ${heart.delay}s forwards`,
          } as React.CSSProperties} // Cast to React.CSSProperties to allow custom properties
        />
      ))}
    </div>
  );
};

export default HeartEmitter;