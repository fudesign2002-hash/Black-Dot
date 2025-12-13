import React from 'react';
import * as THREE from 'three';
import { gravityToHex } from '../../../services/utils/colorUtils';
import { ExhibitionArtItem } from '../../../types';

interface Props {
  artworks: ExhibitionArtItem[];
}

const ZeroGravityEffects: React.FC<Props> = ({ artworks }) => {
  return (
    <>
      {artworks.map((art) => {
        const pos = art.originalPosition || art.position;
        const x = pos[0];
        const z = pos[2];
        const gravity = (typeof art.artworkGravity === 'number') ? art.artworkGravity : 50;
        const hex = gravityToHex(gravity);
        const armLength = 1.2;
        const armThickness = 0.18;
        const armHeight = 0.04;

        return (
          <group key={`gz-${art.id}`} position={new THREE.Vector3(x, -1.52, z)}>
            <mesh>
              <boxGeometry args={[armLength, armHeight, armThickness]} />
              <meshStandardMaterial color={new THREE.Color(hex)} transparent={false} opacity={1} depthWrite={true} roughness={1} metalness={0} />
            </mesh>
            <mesh>
              <boxGeometry args={[armThickness, armHeight, armLength]} />
              <meshStandardMaterial color={new THREE.Color(hex)} transparent={false} opacity={1} depthWrite={true} roughness={1} metalness={0} />
            </mesh>
          </group>
        );
      })}
    </>
  );
};

export default ZeroGravityEffects;
