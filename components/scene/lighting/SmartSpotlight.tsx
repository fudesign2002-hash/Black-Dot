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
  isEditorMode: boolean;
  isMotionVideo?: boolean;
  artworkRotation?: [number, number, number];
}

const SmartSpotlight: React.FC<SmartSpotlightProps> = ({ isActive, lightsOn, color = "white", spotlightMode, artworkType, isEditorMode, isMotionVideo, artworkRotation }) => {
  const lightRef = useRef<THREE.SpotLight>(null);

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
      const targetIntensity = (isActive && (isEditorMode || !lightsOn) ? 1.0 : 0); 
        
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity,
        delta * 3
      );
      
      lightRef.current.angle = THREE.MathUtils.lerp(lightRef.current.angle, spotlightAngle, delta * 3);
      lightRef.current.distance = THREE.MathUtils.lerp(lightRef.current.distance, spotlightDistance, delta * 3);
    }
  });

  const shouldShowEffects = (isActive && (isEditorMode || !lightsOn));

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
      {shouldShowEffects && <pointLight 
        position={pointLightLocalPosition.toArray()} 
        intensity={isActive ? 6.5 : 0} 
        distance={8} 
        decay={0.7} 
        color={color} 
        castShadow 
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.05}
      />}
      {shouldShowEffects && <GodRay isActive={isActive} lightsOn={lightsOn} color={color} artworkType={artworkType} isEditorMode={isEditorMode} isMotionVideo={isMotionVideo} />}
    </group>
  );
};

export default SmartSpotlight;