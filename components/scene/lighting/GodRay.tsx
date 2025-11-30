import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ArtType } from '../../../types';

interface GodRayProps { 
  isActive: boolean; 
  color?: string;
  artworkType: ArtType;
}

const GodRay: React.FC<GodRayProps> = ({ isActive, color = "#ffffff", artworkType }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { rayRadiusBottom, rayHeight } = useMemo(() => {
    switch (artworkType) {
      case 'canvas_portrait':
      case 'canvas_square':
        return { rayRadiusBottom: 8, rayHeight: 25 };
      case 'canvas_landscape':
        return { rayRadiusBottom: 9, rayHeight: 30 };
      case 'sculpture_base':
      case 'sphere_exhibit':
      default:
        return { rayRadiusBottom: 3, rayHeight: 20 };
    }
  }, [artworkType]);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      const targetOpacity = isActive ? 0.05 : 0.0;
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.lerp(
        material.opacity,
        targetOpacity,
        delta * 2
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