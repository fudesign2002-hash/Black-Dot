


import React, { useMemo } from 'react';
import * as THREE from 'three'; // NEW: Import THREE

// NEW: Pre-allocate unit geometries for reuse across all Podium instances
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);

const Podium: React.FC<{ 
  height: number; 
  shape?: 'box' | 'cylinder'; 
  width?: number; 
}> = ({ height, shape = 'box', width = 2 }) => {
  const yPos = height / 2;
  
  const position = useMemo(() => new THREE.Vector3(0, yPos, 0), [yPos]);
  const scale = useMemo(() => new THREE.Vector3(width, height, width), [width, height]);
  const color = useMemo(() => new THREE.Color("#eeeeee"), []);

  return (
    // FIX: Use memoized position and scale with shared geometries
    <mesh position={position} scale={scale} receiveShadow={true} castShadow>
      {shape === 'box' ? (
        <primitive object={boxGeo} attach="geometry" />
      ) : (
        <primitive object={cylinderGeo} attach="geometry" />
      )}
      {/* FIX: Use memoized color */}
      <meshStandardMaterial 
        attach="material"
        color={color} 
        roughness={0.3}
        metalness={0}
      />
    </mesh>
  );
};

export default Podium;