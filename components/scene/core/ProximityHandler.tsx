
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ExhibitionArtItem } from '../../../types'; // Import ExhibitionArtItem

interface ProximityHandlerProps {
  artworks: ExhibitionArtItem[]; // Pass full artwork items
  setFocusedIndex: (index: number) => void;
  currentFocusedIndex: number;
}

const THROTTLE_TIME = 100; // milliseconds to throttle setFocusedIndex updates
const CAMERA_MOVE_THRESHOLD = 0.05; // Distance/angle squared threshold for camera movement

const ProximityHandler: React.FC<ProximityHandlerProps> = ({ artworks, setFocusedIndex, currentFocusedIndex }) => {
  const { camera } = useThree();
  const tempV = useMemo(() => new THREE.Vector3(), []);
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projectionScreenMatrix = useMemo(() => new THREE.Matrix4(), []);
  const artWorldPosition = useMemo(() => new THREE.Vector3(), []);
  // Removed sceneCenter as it's no longer used for scoring.

  // Refs to store last known camera state for movement detection
  const lastCameraPosition = useRef(new THREE.Vector3());
  const lastCameraQuaternion = useRef(new THREE.Quaternion());
  const lastUpdateTime = useRef(0);
  const lastBestCandidateIndex = useRef(-1); // Store the last calculated best candidate

  useFrame((state) => {
    // --- Conditional Execution: Only run full calculations if camera has moved ---
    const cameraMoved =
      lastCameraPosition.current.distanceToSquared(camera.position) > CAMERA_MOVE_THRESHOLD ||
      lastCameraQuaternion.current.angleTo(camera.quaternion) > CAMERA_MOVE_THRESHOLD;

    // Only update the last stored camera state if it actually moved
    if (cameraMoved) {
      lastCameraPosition.current.copy(camera.position);
      lastCameraQuaternion.current.copy(camera.quaternion);
    } else if (performance.now() - lastUpdateTime.current < THROTTLE_TIME && lastBestCandidateIndex.current === currentFocusedIndex) {
      // If camera hasn't moved and we're still within throttle time and focusedIndex hasn't changed,
      // and the last best candidate is still the current one, skip calculations.
      return; 
    }

    let bestScore = Infinity;
    let bestCandidateIndex = -1;

    // Update the camera's frustum for culling (only if cameraMoved or forced update)
    state.camera.updateMatrixWorld();
    projectionScreenMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionScreenMatrix);

    artworks.forEach((art, idx) => {
      artWorldPosition.set(...art.position);

      // 1. Frustum Culling (efficiently removes objects outside view, including vertical)
      if (!frustum.containsPoint(artWorldPosition)) {
        return; 
      }

      // Project artwork group position to screen coordinates
      tempV.copy(artWorldPosition).project(camera);

      // 2. "Completely within screen" horizontal check (Y-axis check removed)
      const screenPaddingX = 0.1; // Horizontal padding
      if (tempV.x < (-1 + screenPaddingX) || tempV.x > (1 - screenPaddingX) ||
          tempV.z < -1 || tempV.z > 1) { // Still check Z for depth clipping
        return; 
      }

      // Calculate distance to screen's horizontal center (X-axis)
      const distToScreenXCenter = Math.abs(tempV.x);

      // 3. Simplified Score: Only horizontal center distance (lower = better, closer to center)
      let score = distToScreenXCenter; 
      
      // Hysteresis: Make it harder to switch focus from the current item
      if (idx === currentFocusedIndex) {
          score *= 0.8; 
      }

      if (score < bestScore) {
        bestScore = score;
        bestCandidateIndex = idx;
      }
    });
    
    // Store the calculated best candidate index
    lastBestCandidateIndex.current = bestCandidateIndex;

    // --- Throttling setFocusedIndex ---
    const now = performance.now();
    if (bestCandidateIndex !== -1 && bestCandidateIndex !== currentFocusedIndex && (now - lastUpdateTime.current > THROTTLE_TIME)) {
      setFocusedIndex(bestCandidateIndex);
      lastUpdateTime.current = now;
    }
  });

  return null;
};

export default ProximityHandler;
