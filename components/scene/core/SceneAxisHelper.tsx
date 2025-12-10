


import React, { useMemo } from 'react';
import * as THREE from 'three';


interface SceneAxisHelperProps {
  sizeX?: number;
  sizeZ?: number;
  color?: THREE.ColorRepresentation;
  lineWidth?: number;
  offsetY?: number;
}

const SceneAxisHelper: React.FC<SceneAxisHelperProps> = ({
  sizeX = 12,
  sizeZ = 12,
  color = '#888888',
  lineWidth = 0.1,
  offsetY = 0.02,
}) => {
  const xAxisGeometry = useMemo(() => {
    const points = [];
    points.push( new THREE.Vector3( -sizeX, 0, 0 ) );
    points.push( new THREE.Vector3( sizeX, 0, 0 ) );
    return new THREE.BufferGeometry().setFromPoints( points );
  }, [sizeX]);

  const zAxisGeometry = useMemo(() => {
    const points = [];
    points.push( new THREE.Vector3( 0, 0, -sizeZ ) );
    points.push( new THREE.Vector3( 0, 0, sizeZ ) );
    return new THREE.BufferGeometry().setFromPoints( points );
  }, [sizeZ]);

  return (
    // FIX: Use JSX intrinsic elements explicitly declared or extended in r3f-declarations.ts
    // FIX: Use THREE.Vector3 for position
    <group position={new THREE.Vector3(0, offsetY, 0)}>
      {/* FIX: Explicitly assign a single material to lineSegments */}
      <lineSegments geometry={xAxisGeometry}>
        {/* FIX: Use attach="material" for lineBasicMaterial and THREE.Color for color */}
        <lineBasicMaterial attach="material" color={new THREE.Color(color)} linewidth={lineWidth} transparent opacity={0.5} />
      </lineSegments>
      {/* FIX: Explicitly assign a single material to lineSegments */}
      <lineSegments geometry={zAxisGeometry}>
        {/* FIX: Use attach="material" for lineBasicMaterial and THREE.Color for color */}
        <lineBasicMaterial attach="material" color={new THREE.Color(color)} linewidth={lineWidth} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
};

export default SceneAxisHelper;