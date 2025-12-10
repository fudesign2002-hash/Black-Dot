


import React from 'react';
import * as THREE from 'three'; // NEW: Import THREE

const Podium: React.FC<{ 
  height: number; 
  shape?: 'box' | 'cylinder'; 
  width?: number; 
}> = ({ height, shape = 'box', width = 2 }) => {
  const yPos = height / 2;
  return (
    // FIX: Use THREE.Vector3 for position
    <mesh position={new THREE.Vector3(0, yPos, 0)} receiveShadow={true} castShadow>
      {shape === 'box' ? (
        // FIX: Use args prop for geometry
        <boxGeometry attach="geometry" args={[width, height, width]} />
      ) : (
        // FIX: Use args prop for geometry
        <cylinderGeometry attach="geometry" args={[width / 2, width / 2, height, 32]} />
      )}
      {/* FIX: Use THREE.Color for color */}
      <meshStandardMaterial 
        attach="material"
        color={new THREE.Color("#eeeeee")} 
        roughness={0.3}
        metalness={0}
      />
    </mesh>
  );
};

export default Podium;