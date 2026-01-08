


import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import GodRay from './GodRay';
import { ArtType } from '../../../types';

interface SmartSpotlightProps {
  isActive: boolean;
  lightsOn: boolean;
  color?: string;
  // REMOVED: spotlightMode: 'auto' | 'manual' | 'off';
  artworkType: ArtType;
  isEditorMode: boolean;
  // REMOVED: isMotionVideo?: boolean;
  artworkRotation?: [number, number, number];
}

const SmartSpotlight: React.FC<SmartSpotlightProps> = ({ isActive, lightsOn, color = "white", artworkType, isEditorMode, artworkRotation }) => {
  const lightRef = useRef<THREE.SpotLight>(null);
  const [castShadow, setCastShadow] = React.useState(false); // NEW: State for soft-start shadows
  const spotPosition = useMemo(() => new THREE.Vector3(0, 100, 0), []);
  const memoColor = useMemo(() => new THREE.Color(color), [color]);

  const { spotlightAngle, spotlightDistance, spotlightHeight } = useMemo(() => {
    switch (artworkType) {
      case 'canvas_portrait':
      case 'canvas_square':
      case 'media':
      case 'motion':
        return { spotlightAngle: 0.8, spotlightDistance: 45, spotlightHeight: 18 };
      case 'canvas_landscape':
        return { spotlightAngle: 0.6, spotlightDistance: 60, spotlightHeight: 22 };
      case 'sculpture_base':
      default:
        return { spotlightAngle: 0.4, spotlightDistance: 35, spotlightHeight: 30 };
    }
  }, [artworkType]);

  const pointLightLocalPosition = useMemo(() => {
    const baseOffset = new THREE.Vector3(0, 6, 2);

    if (!artworkRotation || artworkRotation[1] === 0) {
      return baseOffset;
    }
    
    const rotationAxis = new THREE.Vector3(0, 1, 0);
    const inverseRotationAngle = -artworkRotation[1];
    return baseOffset.clone().applyAxisAngle(rotationAxis, inverseRotationAngle);
  }, [artworkRotation]);
  
  useFrame((state, delta) => {
    if (lightRef.current) {
      let targetIntensity = 0;
      if (isActive) {
        // Uniform intensity regardless of editor mode
        if (!lightsOn) {
          targetIntensity = 0.2;
        } else {
          targetIntensity = 0.2; // Keep it subtly active even when lights are on if focused
        }
      }
        
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity,
        delta * 8 // Speed up transition (was 3)
      );
      
      lightRef.current.angle = THREE.MathUtils.lerp(lightRef.current.angle, spotlightAngle, delta * 8); // Speed up transition (was 3)
      lightRef.current.distance = THREE.MathUtils.lerp(lightRef.current.distance, spotlightDistance, delta * 8); // Speed up transition (was 3)

      // NEW: Soft-start shadows - only enable when intensity is high enough
      // This avoids sudden shadow map allocation lag at the very start of the transition
      const shouldCast = lightRef.current.intensity > 0.1;
      if (castShadow !== shouldCast) {
        setCastShadow(shouldCast);
      }
    }
  });

  const shouldShowEffects = (isActive && (isEditorMode || !lightsOn));

  return (
    <group>
      {/* FIX: Use THREE.Vector3 for position and THREE.Color for color */}
      <spotLight 
        ref={lightRef}
        position={spotPosition}
        angle={spotlightAngle}
        penumbra={0.8} 
        distance={spotlightDistance}
        decay={2} 
        castShadow={castShadow} 
        color={memoColor}
        shadow-bias={-0.0001}
        shadow-normalBias={0.03}
        shadow-mapSize={[1024, 1024]}
        shadow-radius={5}
      />
      {shouldShowEffects && <pointLight 
        position={pointLightLocalPosition} 
        intensity={isActive ? 8.0 : 0} 
        distance={12} 
        decay={1.2} 
        color={memoColor} 
        castShadow={false} 
        shadow-mapSize={[1024, 1024]}
        shadow-radius={5}
        shadow-bias={-0.0001}
        shadow-normalBias={0.05}
      />}
      {shouldShowEffects && <GodRay isActive={isActive} lightsOn={lightsOn} color={color} artworkType={artworkType} isEditorMode={isEditorMode} />}
    </group>
  );
};

export default SmartSpotlight;