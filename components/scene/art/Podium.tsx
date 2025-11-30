// components/scene/art/Podium.tsx

import React from 'react';

const Podium: React.FC<{ 
  height: number; 
  shape?: 'box' | 'cylinder'; 
  width?: number; 
}> = ({ height, shape = 'box', width = 2 }) => {
  const yPos = height / 2;
  return (
    // FIX: Use lowercase intrinsic element 'mesh'
    <mesh position={[0, yPos, 0]} receiveShadow castShadow>
      {shape === 'box' ? (
        // FIX: Use lowercase intrinsic element 'boxGeometry'
        <boxGeometry args={[width, height, width]} />
      ) : (
        // FIX: Use lowercase intrinsic element 'cylinderGeometry'
        <cylinderGeometry args={[width / 2, width / 2, height, 32]} />
      )}
      {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
      <meshStandardMaterial 
        color="#ffffff" 
        roughness={0.4} // Adjusted roughness to 0.4
        metalness={0.1} // Kept metalness at 0.1
      />
    </mesh>
  );
};

export default Podium;