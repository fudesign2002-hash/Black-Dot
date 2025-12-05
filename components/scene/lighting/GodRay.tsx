import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ArtType } from '../../../types';

interface GodRayProps { 
  isActive: boolean; 
  lightsOn: boolean;
  color?: string;
  artworkType: ArtType;
  isEditorMode: boolean;
  isMotionVideo?: boolean;
}

const GodRay: React.FC<GodRayProps> = ({ isActive, lightsOn, color = "#ffffff", artworkType, isEditorMode, isMotionVideo }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { rayRadiusBottom, rayHeight } = useMemo(() => {
    switch (artworkType) {
      case 'canvas_portrait':
      case 'canvas_square':
        return { rayRadiusBottom: 10, rayHeight: 25 };
      case 'canvas_landscape':
      case 'media':
      case 'motion':
        return { rayRadiusBottom: 9, rayHeight: 30 };
      case 'sculpture_base':
      default:
        return { rayRadiusBottom: 3, rayHeight: 20 };
    }
  }, [artworkType]);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;

      let targetOpacity;
      if (!lightsOn && isEditorMode) {
        targetOpacity = isActive ? 0.05 : 0.01;
      } else {
        targetOpacity = isActive ? 0.04 : 0.04;
      }

      material.opacity = THREE.MathUtils.lerp(
        material.opacity,
        targetOpacity,
        delta * 3
      );
    }
  });

  return (
    <group position={[0, 19, 0]}> 
      <mesh ref={meshRef} position={[0, -10, 0]}>
        <cylinderGeometry args={[0.2, rayRadiusBottom, rayHeight, 32, 1, true]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0} 
          side={THREE.DoubleSide} 
          blending={THREE.AdditiveBlending} 
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

export default GodRay;