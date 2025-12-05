import React, { useState, useRef, useEffect, useMemo, useCallback, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { ExhibitionArtItem, ArtType } from '../../../types';

const INITIAL_CAMERA_POSITION: [number, number, number] = [-8, 6, 25];
const INITIAL_CAMERA_TARGET: [number, number, number] = [0, 1, 0];

const CAMERA_ANIMATION_DURATION = 500;
const CAMERA_ARTWORK_DISTANCE = 15;
const CAMERA_ARTWORK_HEIGHT_OFFSET = 5;

interface CameraControllerProps {
  isEditorOpen: boolean;
  focusedArtworkInstanceId: string | null;
  artworks: ExhibitionArtItem[];
  isEditorMode: boolean;
  activeEditorTab: 'lighting' | 'layout' | 'artworks' | 'admin';
  cameraControlRef: React.Ref<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    moveCameraToPrevious: () => void;
    moveCameraToInitial: () => void;
  }>;
}

const CameraController: React.FC<CameraControllerProps> = React.memo(({ isEditorOpen, focusedArtworkInstanceId, artworks, isEditorMode, activeEditorTab, cameraControlRef }) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const [mouseButtons, setMouseButtons] = useState({
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  });

  const previousCameraPosition = useRef(new THREE.Vector3());
  const previousCameraTarget = useRef(new THREE.Vector3());

  const isAnimating = useRef(false);
  const animationStartTime = useRef(0);
  const startPosition = useRef(new THREE.Vector3());
  const startLookAt = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());


  useEffect(() => {
    if (controlsRef.current) {
      camera.position.set(...INITIAL_CAMERA_POSITION);
      controlsRef.current.target.set(...INITIAL_CAMERA_TARGET);
      controlsRef.current.update();
      previousCameraPosition.current.copy(camera.position);
      previousCameraTarget.current.copy(controlsRef.current.target);
    }
  }, []);

  const handleMoveToPrevious = useCallback(() => {
    if (!controlsRef.current) return;

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    targetPosition.current.copy(previousCameraPosition.current);
    targetLookAt.current.copy(previousCameraTarget.current);

    isAnimating.current = true;
    animationStartTime.current = performance.now();
    controlsRef.current.enabled = false;
  }, [camera]);

  const handleMoveToInitial = useCallback(() => {
    if (!controlsRef.current) return;

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    targetPosition.current.set(...INITIAL_CAMERA_POSITION);
    targetLookAt.current.set(...INITIAL_CAMERA_TARGET);

    isAnimating.current = true;
    animationStartTime.current = performance.now();
    controlsRef.current.enabled = false;

    if (!isEditorOpen) {
      setMouseButtons({
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      });
    }
    previousCameraPosition.current.copy(targetPosition.current);
    previousCameraTarget.current.copy(targetLookAt.current);

  }, [camera, isEditorOpen]);


  const handleCameraMove = useCallback((artworkInstanceId: string, artworkPosition: [number, number, number], artworkRotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => {
    if (!controlsRef.current) return;

    previousCameraPosition.current.copy(camera.position);
    previousCameraTarget.current.copy(controlsRef.current.target);

    const artworkWorldPosition = new THREE.Vector3(...artworkPosition);
    const artworkWorldRotation = new THREE.Euler(...artworkRotation);

    let adjustedCameraDistance = CAMERA_ARTWORK_DISTANCE;
    let cameraYOffset = CAMERA_ARTWORK_HEIGHT_OFFSET;
    let targetYOffset = 2;

    if (isMotionVideo) {
      adjustedCameraDistance = 15;
      cameraYOffset = 5;
    } else if (artworkType === 'canvas_portrait' || artworkType === 'canvas_landscape' || artworkType === 'canvas_square') {
      adjustedCameraDistance = 25;
    } else {
    }

    let cameraPlacementDirectionLocal: THREE.Vector3;
    cameraPlacementDirectionLocal = new THREE.Vector3(0, 0, 1);


    const cameraPlacementDirectionWorld = cameraPlacementDirectionLocal.clone().applyEuler(artworkWorldRotation);

    const newCameraPosition = artworkWorldPosition
      .clone()
      .add(cameraPlacementDirectionWorld.normalize().multiplyScalar(adjustedCameraDistance))
      .add(new THREE.Vector3(0, cameraYOffset, 0));

    const newCameraTarget = artworkWorldPosition.clone().setY(artworkWorldPosition.y + targetYOffset);

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);
    targetPosition.current.copy(newCameraPosition);
    targetLookAt.current.copy(newCameraTarget);

    isAnimating.current = true;
    animationStartTime.current = performance.now();

    controlsRef.current.enabled = false;
  }, [camera]);

  useImperativeHandle(cameraControlRef, () => ({
    moveCameraToArtwork: handleCameraMove,
    moveCameraToPrevious: handleMoveToPrevious,
    moveCameraToInitial: handleMoveToInitial,
  }));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditorOpen) {
        document.body.style.cursor = 'grab';
        setMouseButtons(prev => ({ ...prev, LEFT: THREE.MOUSE.PAN }));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        document.body.style.cursor = 'auto';
        if (!isEditorOpen) {
          setMouseButtons(prev => ({ ...prev, LEFT: THREE.MOUSE.ROTATE }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.body.style.cursor = 'auto';
    };
  }, [isEditorOpen]);

  useFrame(() => {
    if (controlsRef.current) {
      if (isAnimating.current) {
        const elapsedTime = performance.now() - animationStartTime.current;
        const t = Math.min(1, elapsedTime / CAMERA_ANIMATION_DURATION);

        const smoothT = t * t * (3 - 2 * t);

        camera.position.lerpVectors(startPosition.current, targetPosition.current, smoothT);
        controlsRef.current.target.lerpVectors(startLookAt.current, targetLookAt.current, smoothT);
        controlsRef.current.update();

        if (t === 1) {
          isAnimating.current = false;
          controlsRef.current.enabled = !isEditorOpen;
        }
      } else {
        controlsRef.current.update();
      }
    }
  });

  return (
      <OrbitControls
            ref={controlsRef}
            makeDefault
            mouseButtons={mouseButtons}
            enablePan={true}
            screenSpacePanning={true}
            enableZoom={true}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.2}
            enableDamping
            dampingFactor={0.05}
            minDistance={12}
            maxDistance={60}
            target={INITIAL_CAMERA_TARGET}
            enabled={!isEditorOpen && !isAnimating.current}
            enableRotate={true}
      />
  );
});
CameraController.displayName = 'CameraController';

export default CameraController;