
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import GodRay from './GodRay';
import { ArtType } from '../../../types'; // Import ArtType

interface SmartSpotlightProps {
  isActive: boolean;
  lightsOn: boolean;
  color?: string;
  spotlightMode: 'auto' | 'manual' | 'off';
  artworkType: ArtType; // New prop for artwork type
}

const SmartSpotlight: React.FC<SmartSpotlightProps> = ({ isActive, lightsOn, color = "white", spotlightMode, artworkType }) => {
  const lightRef = useRef<THREE.SpotLight>(null);

  // Determine spotlight properties based on artworkType
  const { spotlightAngle, spotlightDistance, spotlightHeight } = useMemo(() => {
    switch (artworkType) {
      case 'canvas_portrait':
      case 'canvas_square':
        return { spotlightAngle: 0.6, spotlightDistance: 45, spotlightHeight: 18 }; // Increased angle and distance, new height
      case 'canvas_landscape':
        return { spotlightAngle: 0.6, spotlightDistance: 60, spotlightHeight: 22 }; // Increased angle and distance, new height
      case 'sculpture_base':
      case 'sphere_exhibit':
      default:
        return { spotlightAngle: 0.4, spotlightDistance: 35, spotlightHeight: 30 }; // Increased angle and distance, new height
    }
  }, [artworkType]);
  
  useFrame((state, delta) => {
    if (lightRef.current) {
      const targetIntensity = lightsOn
        ? (isActive && spotlightMode !== 'off' ? 3.0 : 0) // Increased from 3.0 to 5.0
        : (isActive ? 1.0 : 0); // Increased from 8.0 to 12.0
        
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity,
        delta * 2
      );
      // Optional: Lerp angle and distance too if smoother transitions are desired
      lightRef.current.angle = THREE.MathUtils.lerp(lightRef.current.angle, spotlightAngle, delta * 2);
      lightRef.current.distance = THREE.MathUtils.lerp(lightRef.current.distance, spotlightDistance, delta * 2);
    }
  });

  return (
    // FIX: Use lowercase intrinsic element 'group'
    <group>
      {/* FIX: Use lowercase intrinsic element 'spotLight' */}
      <spotLight 
        ref={lightRef}
        position={[0, 100, 0]} // Adjusted position Y from 60 to dynamic spotlightHeight
        angle={spotlightAngle} // Use dynamic angle
        penumbra={0.4} 
        distance={spotlightDistance} // Use dynamic distance
        decay={1} 
        castShadow 
        color={color}
        shadow-bias={-0.0001}
        shadow-normalBias={0.03}
        shadow-mapSize={[1024, 1024]} // Reduced shadow map resolution from 2048 to 1024
      />
      {/* Adjusted pointLight intensity to match reference code when lights are off */}
      {!lightsOn && <pointLight position={[0, 8, 2]} intensity={isActive ? 4.0 : 0} distance={10} decay={0} color={color} />}
      {/* Pass artworkType to GodRay */}
      {!lightsOn && <GodRay isActive={isActive} color={color} artworkType={artworkType} />}
    </group>
  );
};

export default SmartSpotlight;