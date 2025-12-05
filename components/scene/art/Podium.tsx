import React from 'react';

const Podium: React.FC<{ 
  height: number; 
  shape?: 'box' | 'cylinder'; 
  width?: number; 
}> = ({ height, shape = 'box', width = 2 }) => {
  const yPos = height / 2;
  return (
    <mesh position={[0, yPos, 0]} receiveShadow={true} castShadow>
      {shape === 'box' ? (
        <boxGeometry args={[width, height, width]} />
      ) : (
        <cylinderGeometry args={[width / 2, width / 2, height, 32]} />
      )}
      <meshStandardMaterial 
        color="#eeeeee" 
        roughness={0.3}
        metalness={0}
      />
    </mesh>
  );
};

export default Podium;