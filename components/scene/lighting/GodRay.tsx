


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
  // REMOVED: isMotionVideo?: boolean;
}

const GodRay: React.FC<GodRayProps> = ({ isActive, lightsOn, color = "#ffffff", artworkType, isEditorMode }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const memoColor = useMemo(() => new THREE.Color(color), [color]);

  const { rayRadiusBottom, rayHeight } = useMemo(() => {
    switch (artworkType) {
      case 'canvas_portrait':
      case 'canvas_square':
        return { rayRadiusBottom: 7, rayHeight: 25 };
      case 'canvas_landscape':
      case 'media':
      case 'motion':
        return { rayRadiusBottom: 6.5, rayHeight: 30 };
      case 'sculpture_base':
      default:
        return { rayRadiusBottom: 1.8, rayHeight: 20 };
    }
  }, [artworkType]);

  // NEW: Calculate a moderate height and adjust position so the base stays at floor level
  const visualHeight = 35; 
  const groupPosition = useMemo(() => {
    // Original logic: group at 19, mesh at -10, height 20-30. Bottom ~ 19 - 10 - 15 = -6
    // To keep bottom at ~ -6 while height is 35:
    // New center = -6 + 17.5 = 11.5
    return new THREE.Vector3(0, 11.5, 0);
  }, []);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;

      // Uniform opacity regardless of editor mode
      const targetOpacity = isActive ? 0.03 : 0.005;

      material.opacity = THREE.MathUtils.lerp(
        material.opacity,
        targetOpacity,
        delta * 8 // Speed up transition (was 3)
      );
    }
  });

  return (
    // FIX: Use THREE.Vector3 for position and ensure direct children are THREE.Object3D instances
    <group position={groupPosition}> 
      {/* FIX: Use THREE.Vector3 for position and args prop for geometry */}
      <mesh ref={meshRef}>
        <cylinderGeometry attach="geometry" args={[0, rayRadiusBottom, visualHeight, 32, 1, true]} />
        {/* FIX: Use THREE.Color for color */}
        <meshBasicMaterial 
          attach="material"
          color={memoColor} 
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