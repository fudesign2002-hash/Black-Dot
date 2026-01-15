import React, { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ExhibitionArtItem } from '../../../types';

interface ProximityHandlerProps {
  artworks: ExhibitionArtItem[];
  setFocusedIndex: (index: number) => void;
  currentFocusedIndex: number;
  focusedArtworkInstanceId: string | null;
  // Optional camera control ref to allow coordination with camera logic (NewCameraControl)
  cameraControlRef?: RefObject<any>;
}

const THROTTLE_TIME = 2000;
const CAMERA_MOVE_THRESHOLD = 0.5;
const DETECTION_INTERVAL = 100; // NEW: Detection frequency limit (ms)

const ProximityHandler: React.FC<ProximityHandlerProps> = ({ artworks, setFocusedIndex, currentFocusedIndex, focusedArtworkInstanceId, cameraControlRef }) => {
  const { camera } = useThree();
  const tempV = useMemo(() => new THREE.Vector3(), []);
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projectionScreenMatrix = useMemo(() => new THREE.Matrix4(), []);
  const artWorldPosition = useMemo(() => new THREE.Vector3(), []);


  const lastCameraPosition = useRef(new THREE.Vector3());
  const lastCameraQuaternion = useRef(new THREE.Quaternion());
  const lastUpdateTime = useRef(0);
  const lastDetectionTime = useRef(0); // NEW: Track last detection timestamp
  const lastBestCandidateIndex = useRef(-1);

  useFrame((state) => {
    if (focusedArtworkInstanceId) {
      if (currentFocusedIndex !== -1) {
        setFocusedIndex(-1);
      }
      return;
    }

    const now = performance.now();
    // NEW: Enforce detection interval to save CPU
    if (now - lastDetectionTime.current < DETECTION_INTERVAL) {
      return;
    }
    lastDetectionTime.current = now;

    const cameraMoved =
      lastCameraPosition.current.distanceToSquared(camera.position) > CAMERA_MOVE_THRESHOLD ||
      lastCameraQuaternion.current.angleTo(camera.quaternion) > CAMERA_MOVE_THRESHOLD;

    if (cameraMoved) {
      lastCameraPosition.current.copy(camera.position);
      lastCameraQuaternion.current.copy(camera.quaternion);
    } else if (now - lastUpdateTime.current < THROTTLE_TIME && lastBestCandidateIndex.current === currentFocusedIndex) {
      return;
    }

    let bestScore = Infinity;
    let bestCandidateIndex = -1;

    state.camera.updateMatrixWorld();
    projectionScreenMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projectionScreenMatrix);

    artworks.forEach((art, idx) => {
      artWorldPosition.set(...art.position);

      if (!frustum.containsPoint(artWorldPosition)) {
        return;
      }

      tempV.copy(artWorldPosition).project(camera);

      const screenPaddingX = 0.1;
      if (tempV.x < (-1 + screenPaddingX) || tempV.x > (1 - screenPaddingX) ||
          tempV.z < -1 || tempV.z > 1) {
        return;
      }

      const distToScreenXCenter = Math.abs(tempV.x);

      let score = distToScreenXCenter;

      if (idx === currentFocusedIndex) {
          score *= 0.8;
      }

      if (score < bestScore) {
        bestScore = score;
        bestCandidateIndex = idx;
      }
    });

    lastBestCandidateIndex.current = bestCandidateIndex;

    if (bestCandidateIndex !== -1 && bestCandidateIndex !== currentFocusedIndex && (now - lastUpdateTime.current > THROTTLE_TIME)) {
      setFocusedIndex(bestCandidateIndex);
      lastUpdateTime.current = now;
      // cameraControlRef is accepted to allow future coordination (e.g. subtle camera nudge),
      // currently we do not trigger camera moves here to avoid unexpected jumps.
      // Example hook point: if (cameraControlRef?.current?.highlightArtwork) { cameraControlRef.current.highlightArtwork(bestCandidateIndex); }
    }
  });

  return null;
};

export default ProximityHandler;