
import React, { useState, useRef, useEffect, useMemo, useCallback, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { ExhibitionArtItem, ArtType, SimplifiedLightingConfig } from '../../../types';

const INITIAL_CAMERA_POSITION: [number, number, number] = [-8, 4, 25];
const INITIAL_CAMERA_TARGET: [number, number, number] = [0, 1, 0];

const CAMERA_ANIMATION_DURATION = 500;
const CAMERA_ARTWORK_DISTANCE = 5; // Adjusted from 15 to 7.5
const CAMERA_PAINTING_MOTION_DISTANCE = 7.5; // NEW: Distance for painting and motion artworks
const CAMERA_ARTWORK_HEIGHT_OFFSET = 0.5;

// NEW: Constants for painting camera adjustments
const CAMERA_PAINTING_CAMERA_Y_OFFSET = -18; // Moves camera 1 unit down relative to artwork's target Y
const CAMERA_PAINTING_CAMERA_Z_DISTANCE = 1; // Further back for paintings

const CAMERA_POSITION_TOLERANCE = 0.1; // NEW: Tolerance for camera position comparison
const CAMERA_TARGET_TOLERANCE = 0.1; // NEW: Tolerance for camera target comparison

interface CameraControllerProps {
  isEditorOpen: boolean;
  focusedArtworkInstanceId: string | null;
  artworks: ExhibitionArtItem[];
  isEditorMode: boolean;
  activeEditorTab: 'lighting' | 'layout' | 'artworks' | 'admin';
  cameraControlRef: React.Ref<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    moveCameraToPrevious: () => void;
    moveCameraToInitial: (customCameraPosition?: [number, number, number]) => void;
    moveCameraToRankingMode: (position: [number, number, number], target: [number, number, number]) => void; // NEW
  }>;
  onCameraPositionChange: (isAtDefault: boolean) => void; // NEW: Add onCameraPositionChange prop
  lightingConfig: SimplifiedLightingConfig; // NEW: Add lightingConfig prop
  isRankingMode: boolean; // NEW
  isZeroGravityMode: boolean; // NEW: Add isZeroGravityMode prop
  rankingCameraPosition?: [number, number, number]; // NEW
  rankingCameraTarget?: [number, number, number];   // NEW
}

const CameraController: React.FC<CameraControllerProps> = React.memo(({ isEditorOpen, focusedArtworkInstanceId, artworks, isEditorMode, activeEditorTab, cameraControlRef, onCameraPositionChange, lightingConfig, isRankingMode, isZeroGravityMode, rankingCameraPosition, rankingCameraTarget }) => {
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
  // FIX: Declare targetPosition and targetLookAt using useRef
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  const prevIsAtInitialPositionRef = useRef(true); // NEW: Ref to track previous initial position state

  // NEW: Ref to store previous `isRankingMode` state
  const prevIsRankingModeRef = useRef(isRankingMode);
  // NEW: Ref to store previous `isZeroGravityMode` state
  const prevIsZeroGravityModeRef = useRef(isZeroGravityMode);


  // NEW: Ref to store the actual values of customCameraPosition for deep comparison
  const lastProcessedCustomCameraPositionRef = useRef<[number, number, number] | undefined>(undefined);

  // 將 handleMoveToInitial 宣告移至 useEffect 之前
  const handleMoveToInitial = useCallback((customCameraPosition?: [number, number, number]) => {
    if (!controlsRef.current) {
      return;
    }

    const finalCameraPosition = customCameraPosition || INITIAL_CAMERA_POSITION;

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    // FIX: Access targetPosition and targetLookAt via .current
    targetPosition.current.set(...finalCameraPosition);
    targetLookAt.current.set(...INITIAL_CAMERA_TARGET);

    // Snap camera directly to the target position and look-at
    camera.position.copy(targetPosition.current);
    controlsRef.current.target.copy(targetLookAt.current);
    controlsRef.current.update(); // Important to update controls after manual position change

    isAnimating.current = false; // Ensure animation is off
    // MODIFIED: Disable controls if in editor mode OR zero gravity mode
    controlsRef.current.enabled = !isEditorOpen && !isZeroGravityMode; // Enable/disable controls based on editor/zero gravity state

    if (!isEditorOpen && !isZeroGravityMode) { // MODIFIED: Only set mouse buttons if controls are enabled
      setMouseButtons({
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      });
    }
    previousCameraPosition.current.copy(targetPosition.current);
    previousCameraTarget.current.copy(targetLookAt.current);

    
    // After snapping, the camera is at the initial/custom position
    onCameraPositionChange(true);
    prevIsAtInitialPositionRef.current = true;
    lastProcessedCustomCameraPositionRef.current = finalCameraPosition; // NEW: Update the ref with the processed position

  }, [camera, isEditorOpen, isZeroGravityMode, onCameraPositionChange]); // MODIFIED: Add isZeroGravityMode to deps

  const handleMoveToRankingMode = useCallback((position: [number, number, number], target: [number, number, number]) => {
    if (!controlsRef.current) {
      return;
    }

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    // FIX: Access targetPosition and targetLookAt via .current
    targetPosition.current.set(...position);
    targetLookAt.current.set(...target);

    isAnimating.current = true;
    animationStartTime.current = performance.now();
    controlsRef.current.enabled = false; // Disable controls during animation
    onCameraPositionChange(false); // When in ranking mode, camera is not at default
    prevIsAtInitialPositionRef.current = false;

    
  }, [camera, onCameraPositionChange]);

  // NEW: Implement handleCameraMove
  const handleCameraMove = useCallback((artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => {
    if (!controlsRef.current) {
      return;
    }

    // Save current camera state before moving
    previousCameraPosition.current.copy(camera.position);
    previousCameraTarget.current.copy(controlsRef.current.target);

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    // Determine camera distance and Y-offset based on artwork type
    let cameraDistance = CAMERA_ARTWORK_DISTANCE;
    let cameraYOffset = CAMERA_ARTWORK_HEIGHT_OFFSET; // Default vertical offset for camera position

    if (artworkType.startsWith('canvas_') || artworkType === 'motion') { // If painting or motion
      cameraDistance = CAMERA_PAINTING_CAMERA_Z_DISTANCE;
      cameraYOffset = CAMERA_PAINTING_CAMERA_Y_OFFSET;
    } else if (artworkType === 'sculpture_base') {
      // Sculptures use CAMERA_ARTWORK_DISTANCE and CAMERA_ARTWORK_HEIGHT_OFFSET
      // This path is already default, but for clarity:
      cameraDistance = CAMERA_ARTWORK_DISTANCE;
      cameraYOffset = CAMERA_ARTWORK_HEIGHT_OFFSET;
    }

    // Calculate new target position based on artwork position and type
    const artworkTargetY = position[1] + (artworkType === 'sculpture_base' ? CAMERA_ARTWORK_HEIGHT_OFFSET : 0); // Look at artwork's Y or slightly above for sculptures

    const artworkWorldPosition = new THREE.Vector3(position[0], artworkTargetY, position[2]);
    const artworkWorldRotation = new THREE.Euler(...rotation, 'YXZ'); // Assuming YXZ for artwork rotations

    const offset = new THREE.Vector3(0, cameraYOffset, cameraDistance); // Use determined cameraYOffset and cameraDistance
    offset.applyEuler(artworkWorldRotation); // Apply artwork rotation to the offset

    // FIX: Access targetPosition and targetLookAt via .current
    targetPosition.current.copy(artworkWorldPosition).add(offset);
    targetLookAt.current.copy(artworkWorldPosition); // Look directly at the artwork center

    isAnimating.current = true;
    animationStartTime.current = performance.now();
    controlsRef.current.enabled = false; // Disable controls during animation
    onCameraPositionChange(false); // Camera is no longer at default position
    prevIsAtInitialPositionRef.current = false;

    
  }, [camera, onCameraPositionChange]);

  // NEW: Implement handleMoveToPrevious
  const handleMoveToPrevious = useCallback(() => {
    if (!controlsRef.current) {
      return;
    }

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    // FIX: Access targetPosition and targetLookAt via .current
    targetPosition.current.copy(previousCameraPosition.current);
    targetLookAt.current.copy(previousCameraTarget.current);

    isAnimating.current = true;
    animationStartTime.current = performance.now();
    controlsRef.current.enabled = false; // Disable controls during animation
    onCameraPositionChange(false); // Going back to a previous specific view, not necessarily default
    prevIsAtInitialPositionRef.current = false;

    
  }, [camera, onCameraPositionChange]);

  useEffect(() => {
    const currentCustomCameraPosition = lightingConfig.customCameraPosition;
    const lastProcessedCustomCameraPosition = lastProcessedCustomCameraPositionRef.current;

    

    // Check if both are defined and their values are identical
    const arePositionsEqual = 
      currentCustomCameraPosition && lastProcessedCustomCameraPosition &&
      currentCustomCameraPosition[0] === lastProcessedCustomCameraPosition[0] &&
      currentCustomCameraPosition[1] === lastProcessedCustomCameraPosition[1] &&
      currentCustomCameraPosition[2] === lastProcessedCustomCameraPosition[2];

    

    if (!arePositionsEqual) {
      
      if (controlsRef.current) {
        handleMoveToInitial(currentCustomCameraPosition);
      }
      // lastProcessedCustomCameraPositionRef is updated inside handleMoveToInitial
    } else {
      
    }
  }, [lightingConfig.customCameraPosition, handleMoveToInitial]);

  // NEW: Effect to handle camera movement when entering/exiting ranking mode
  useEffect(() => {
    

    // Check if isRankingMode actually changed from its previous value
    if (isRankingMode !== prevIsRankingModeRef.current) {
      
      if (isRankingMode) {
        // Entering Ranking Mode
        
        if (rankingCameraPosition && rankingCameraTarget) {
          
          handleMoveToRankingMode(rankingCameraPosition, rankingCameraTarget);
        } else {
          
          // When falling back to initial view, ensure to use the customCameraPosition from lightingConfig
          handleMoveToInitial(lightingConfig.customCameraPosition); // Pass customCameraPosition here
        }
      } else {
        // Exiting Ranking Mode
        
        handleMoveToInitial(lightingConfig.customCameraPosition); // Pass customCameraPosition here
      }
      // Update the ref to the current `isRankingMode` for the next comparison
      prevIsRankingModeRef.current = isRankingMode;
      
    } else {
      
    }
  }, [isRankingMode, handleMoveToRankingMode, handleMoveToInitial, rankingCameraPosition, rankingCameraTarget, lightingConfig.customCameraPosition]);

  // NEW: Effect to handle camera movement when entering/exiting Zero Gravity mode
  useEffect(() => {
    // Check if isZeroGravityMode actually changed from its previous value
    if (isZeroGravityMode !== prevIsZeroGravityModeRef.current) {
      if (isZeroGravityMode) {
        // Entering Zero Gravity Mode
        // Always reset camera to initial/custom position for a clear view of floating artworks
        handleMoveToInitial(lightingConfig.customCameraPosition);
      } else {
        // Exiting Zero Gravity Mode
        // Always reset camera to initial/custom position
        handleMoveToInitial(lightingConfig.customCameraPosition);
      }
      // Update the ref to the current `isZeroGravityMode` for the next comparison
      prevIsZeroGravityModeRef.current = isZeroGravityMode;
    }
  }, [isZeroGravityMode, handleMoveToInitial, lightingConfig.customCameraPosition]);


  useImperativeHandle(cameraControlRef, () => ({
    moveCameraToArtwork: handleCameraMove,
    moveCameraToPrevious: handleMoveToPrevious,
    moveCameraToInitial: handleMoveToInitial,
    moveCameraToRankingMode: handleMoveToRankingMode, // NEW
  }));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditorOpen && !isZeroGravityMode) { // MODIFIED: Also check !isZeroGravityMode
        document.body.style.cursor = 'grab';
        setMouseButtons(prev => ({ ...prev, LEFT: THREE.MOUSE.PAN }));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        document.body.style.cursor = 'auto';
        if (!isEditorOpen && !isZeroGravityMode) { // MODIFIED: Also check !isZeroGravityMode
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
  }, [isEditorOpen, isZeroGravityMode]); // MODIFIED: Add isZeroGravityMode to deps

  useFrame(() => {
    if (controlsRef.current) {
      if (isAnimating.current) {
        const elapsedTime = performance.now() - animationStartTime.current;
        const t = Math.min(1, elapsedTime / CAMERA_ANIMATION_DURATION);

        const smoothT = t * t * (3 - 2 * t);

        // FIX: Access targetPosition and targetLookAt via .current
        camera.position.lerpVectors(startPosition.current, targetPosition.current, smoothT);
        controlsRef.current.target.lerpVectors(startLookAt.current, targetLookAt.current, smoothT);
        controlsRef.current.update();

        if (t === 1) {
          isAnimating.current = false;
          // MODIFIED: After animation, enable controls if not in editor mode OR zero gravity mode
          controlsRef.current.enabled = !isEditorOpen && !isZeroGravityMode; 
          
        }
      } else {
        controlsRef.current.update();
      }

      // NEW: Check if camera is at initial position and notify parent
      // MODIFIED: Compare against the actual target for initial position, which might be customCameraPosition
      // FIX: Access targetPosition via .current
      const currentInitialPosition = targetPosition.current; 
      const isAtInitialPosition =
        camera.position.distanceTo(currentInitialPosition) < CAMERA_POSITION_TOLERANCE &&
        controlsRef.current.target.distanceTo(new THREE.Vector3(...INITIAL_CAMERA_TARGET)) < CAMERA_TARGET_TOLERANCE;

      if (isAtInitialPosition !== prevIsAtInitialPositionRef.current) {
        onCameraPositionChange(isAtInitialPosition);
        prevIsAtInitialPositionRef.current = isAtInitialPosition;
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
            maxPolarAngle={Math.PI / 2}
            enableDamping
            dampingFactor={0.05}
            minDistance={9}
            maxDistance={40}
            target={INITIAL_CAMERA_TARGET}
            // MODIFIED: Enable controls if not animating and not in editor mode OR zero gravity mode
            enabled={!isEditorOpen && !isZeroGravityMode && !isAnimating.current} 
            enableRotate={true}
      />
  );
});
CameraController.displayName = 'CameraController';

export default CameraController;