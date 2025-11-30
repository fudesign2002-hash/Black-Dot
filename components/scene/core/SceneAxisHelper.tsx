
import React, { useMemo } from 'react';
import * as THREE from 'three';
// FIX: Removed incorrect import of `LineSegments` from `@react-three/drei`.
// The JSX element `<lineSegments>` is provided by R3F's extension of `THREE.LineSegments`.

interface SceneAxisHelperProps {
  sizeX?: number; // Half-extent of X axis (e.g., 24 for -24 to 24)
  sizeZ?: number; // Half-extent of Z axis (e.g., 12 for -12 to 12)
  color?: THREE.ColorRepresentation;
  lineWidth?: number;
  offsetY?: number; // Small offset above floor to prevent z-fighting
}

const SceneAxisHelper: React.FC<SceneAxisHelperProps> = ({
  sizeX = 24, // Corresponds to SCENE_BOUNDS_X from LayoutTab
  sizeZ = 12, // Corresponds to SCENE_BOUNDS_Z from LayoutTab
  color = '#888888',
  lineWidth = 0.1,
  offsetY = 0.02,
}) => {
  // Create BufferGeometry for the X-axis line
  const xAxisGeometry = useMemo(() => {
    const points = [];
    points.push( new THREE.Vector3( -sizeX, 0, 0 ) );
    points.push( new THREE.Vector3( sizeX, 0, 0 ) );
    return new THREE.BufferGeometry().setFromPoints( points );
  }, [sizeX]);

  // Create BufferGeometry for the Z-axis line
  const zAxisGeometry = useMemo(() => {
    const points = [];
    points.push( new THREE.Vector3( 0, 0, -sizeZ ) );
    points.push( new THREE.Vector3( 0, 0, sizeZ ) );
    return new THREE.BufferGeometry().setFromPoints( points );
  }, [sizeZ]);

  return (
    // FIX: Use lowercase intrinsic element 'group'
    <group position={[0, offsetY, 0]}>
      {/* FIX: Use lowercase intrinsic element 'lineSegments' */}
      <lineSegments geometry={xAxisGeometry}>
        {/* FIX: Use lowercase intrinsic element 'lineBasicMaterial' */}
        <lineBasicMaterial attach="material" color={color} linewidth={lineWidth} transparent opacity={0.5} />
      </lineSegments>
      {/* FIX: Use lowercase intrinsic element 'lineSegments' */}
      <lineSegments geometry={zAxisGeometry}>
        {/* FIX: Use lowercase intrinsic element 'lineBasicMaterial' */}
        <lineBasicMaterial attach="material" color={color} linewidth={lineWidth} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
};

export default SceneAxisHelper;