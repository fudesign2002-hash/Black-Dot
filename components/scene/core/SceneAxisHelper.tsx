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
  sizeX = 24,
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
    <group position={[0, offsetY, 0]}>
      <lineSegments geometry={xAxisGeometry}>
        <lineBasicMaterial attach="material" color={color} linewidth={lineWidth} transparent opacity={0.5} />
      </lineSegments>
      <lineSegments geometry={zAxisGeometry}>
        <lineBasicMaterial attach="material" color={color} linewidth={lineWidth} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
};

export default SceneAxisHelper;