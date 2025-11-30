

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three'; // FIX: Corrected import statement for THREE
import { ArtType } from '../../../types'; // Import ArtType

interface GodRayProps { 
  isActive: boolean; 
  color?: string;
  artworkType: ArtType; // New prop for artwork type
}

const GodRay: React.FC<GodRayProps> = ({ isActive, color = "#ffffff", artworkType }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { rayRadiusBottom, rayHeight } = useMemo(() => {
    switch (artworkType) {
      case 'canvas_portrait':
      case 'canvas_square':
        return { rayRadiusBottom: 8, rayHeight: 25 }; // Wider spread for canvases
      case 'canvas_landscape':
        return { rayRadiusBottom: 9, rayHeight: 30 }; // Even wider for landscape
      case 'sculpture_base':
      case 'sphere_exhibit':
      default:
        return { rayRadiusBottom: 5, rayHeight: 20 }; // Smaller spread for sculptures
    }
  }, [artworkType]);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      const targetOpacity = isActive ? 0.05 : 0.0;
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      // FIX: Ensure THREE.MathUtils.lerp is used correctly
      material.opacity = THREE.MathUtils.lerp(
        material.opacity,
        targetOpacity,
        delta * 2
      );
    }
  });

  return (
    // FIX: Use lowercase intrinsic element 'group'
    <group position={[0, 19, 0]}> 
      {/* FIX: Use lowercase intrinsic element 'mesh' */}
      <mesh ref={meshRef} position={[0, -10, 0]}>
        {/* Dynamic cylinderGeometry args */}
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