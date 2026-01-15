import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { gravityToHex } from '../../../services/utils/colorUtils';
import { ExhibitionArtItem } from '../../../types';

interface Props {
  artworks: ExhibitionArtItem[];
}

const ZeroGravityEffects: React.FC<Props> = ({ artworks }) => {
  const armLength = 1.2;
  const armThickness = 0.18;
  const armHeight = 0.04;

  const instancedMesh1Ref = useRef<THREE.InstancedMesh>(null);
  const instancedMesh2Ref = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!instancedMesh1Ref.current || !instancedMesh2Ref.current) return;

    artworks.forEach((art, i) => {
      const pos = art.originalPosition || art.position;
      const x = pos[0];
      const z = pos[2];
      const gravity = (typeof art.artworkGravity === 'number') ? art.artworkGravity : 50;
      const hex = gravityToHex(gravity);

      // Set matrix for the first arm
      dummy.position.set(x, -1.52, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instancedMesh1Ref.current!.setMatrixAt(i, dummy.matrix);
      instancedMesh1Ref.current!.setColorAt(i, tempColor.set(hex));

      // Set matrix for the second arm (rotated 90 degrees)
      // We can reuse the same instance mesh geometry if we just rotate the instances
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      instancedMesh2Ref.current!.setMatrixAt(i, dummy.matrix);
      instancedMesh2Ref.current!.setColorAt(i, tempColor.set(hex));
    });

    instancedMesh1Ref.current.instanceMatrix.needsUpdate = true;
    if (instancedMesh1Ref.current.instanceColor) instancedMesh1Ref.current.instanceColor.needsUpdate = true;
    
    instancedMesh2Ref.current.instanceMatrix.needsUpdate = true;
    if (instancedMesh2Ref.current.instanceColor) instancedMesh2Ref.current.instanceColor.needsUpdate = true;
  }, [artworks, dummy, tempColor]);

  return (
    <group>
      <instancedMesh ref={instancedMesh1Ref} args={[null as any, null as any, artworks.length]}>
        <boxGeometry args={[armLength, armHeight, armThickness]} />
        <meshStandardMaterial roughness={1} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={instancedMesh2Ref} args={[null as any, null as any, artworks.length]}>
        <boxGeometry args={[armLength, armHeight, armThickness]} />
        <meshStandardMaterial roughness={1} metalness={0} />
      </instancedMesh>
    </group>
  );
};

export default ZeroGravityEffects;

export default ZeroGravityEffects;
