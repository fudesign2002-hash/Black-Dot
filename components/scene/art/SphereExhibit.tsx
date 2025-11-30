import React from 'react';
import Podium from './Podium';

const SphereExhibit: React.FC = () => {
    const podiumHeight = 2.0;
    const sphereRadius = 1.0;
    return (
      <group position={[0, 0, 0]}>
        <Podium height={podiumHeight} shape="cylinder" width={2.5} />
        <mesh position={[0, podiumHeight + sphereRadius, 0]} castShadow receiveShadow>
            <sphereGeometry args={[sphereRadius, 32, 32]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.5} metalness={0.1} />
        </mesh>
      </group>
    );
};

export default SphereExhibit;