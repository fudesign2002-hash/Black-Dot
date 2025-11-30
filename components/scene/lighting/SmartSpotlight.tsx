import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import GodRay from './GodRay';
import { ArtType } from '../../../types';

interface SmartSpotlightProps {
  isActive: boolean;
  lightsOn: boolean;
  color?: string;
  spotlightMode: 'auto' | 'manual' | 'off';
  artworkType: ArtType;
}

const SmartSpotlight: React.FC<SmartSpotlightProps> = ({ isActive, lightsOn, color = "white", spotlightMode, artworkType }) => {
  const lightRef = useRef<THREE.SpotLight>(null);

  const { spotlightAngle, spotlightDistance, spotlightHeight } = useMemo(() => {
    switch (artworkType) {
      case 'canvas_portrait':
      case 'canvas_square':
        return { spotlightAngle: 0.6, spotlightDistance: 45, spotlightHeight: 18 };
      case 'canvas_landscape':
        return { spotlightAngle: 0.6, spotlightDistance: 60, spotlightHeight: 22 };
      case 'sculpture_base':
      case 'sphere_exhibit':
      default:
        return { spotlightAngle: 0.4, spotlightDistance: 35, spotlightHeight: 30 };
    }
  }, [artworkType]);
  
  useFrame((state, delta) => {
    if (lightRef.current) {
      const targetIntensity = 0; // Always 0, spotLight is now effectively disabled.
        
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity,
        delta * 2
      );
      
      lightRef.current.angle = THREE.MathUtils.lerp(lightRef.current.angle, spotlightAngle, delta * 2);
      lightRef.current.distance = THREE.MathUtils.lerp(lightRef.current.distance, spotlightDistance, delta * 2);
    }
  });

  return (
    <group>
      <spotLight 
        ref={lightRef}
        position={[0, 100, 0]}
        angle={spotlightAngle}
        penumbra={0.4} 
        distance={spotlightDistance}
        decay={1} 
        castShadow 
        color={color}
        shadow-bias={-0.0001}
        shadow-normalBias={0.03}
        shadow-mapSize={[512, 512]}
      />
      {!lightsOn && <pointLight position={[0, 5, 2]} intensity={isActive ? 6 : 0} distance={6} decay={0.7} color={color} />}
      {!lightsOn && <GodRay isActive={isActive} color={color} artworkType={artworkType} />}
    </group>
  );
};

export default SmartSpotlight;