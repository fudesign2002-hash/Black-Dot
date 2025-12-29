import React, { useRef, useImperativeHandle, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import type { ArtType, SimplifiedLightingConfig } from '../../../types';

export const INITIAL_CAMERA_POSITION: [number, number, number] = [-8, 4, 25];
export const INITIAL_CAMERA_TARGET: [number, number, number] = [0, 1, 0];
// Default camera field of view (degrees). Change this constant to adjust the scene FOV.
export const DEFAULT_CAMERA_FOV = 70;

// Module-level saved camera stack. Use `NewCameraFrom` to push the current camera
// position/target before performing a move, and `moveCameraToPrevious` will pop it.
const _savedCameraStack: Array<{ pos: [number, number, number]; tgt: [number, number, number] }> = [];

export const pushSavedCamera = (pos: [number, number, number], tgt: [number, number, number]) => {
  _savedCameraStack.push({ pos, tgt });
};

export const popSavedCamera = () => {
  return _savedCameraStack.pop();
};

// Component helper: when mounted, captures current camera position/target into the stack
export const NewCameraFrom: React.FC = () => {
  const { camera, controls } = useThree() as any;
  useEffect(() => {
    if (!camera) return;
    const pos: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
    const tgt: [number, number, number] = controls ? [controls.target.x, controls.target.y, controls.target.z] : [0, 0, 0];
    pushSavedCamera(pos, tgt);
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

export interface NewCameraControlHandle {
  moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
  moveCameraToPrevious: () => void;
  moveCameraToInitial: (customCameraPosition?: [number, number, number]) => void;
  moveCameraToRankingMode: (position: [number, number, number], target: [number, number, number]) => void;
}

interface NewCameraControlProps {
  isEditorOpen?: boolean;
  isZeroGravityMode?: boolean;
  isRankingMode?: boolean;
  isCameraMovingToArtwork?: boolean;
  onCameraPositionChange?: (isAtDefault: boolean) => void;
  lightingConfig?: SimplifiedLightingConfig;
  onCameraAnimationStateChange?: (isAnimating: boolean) => void;
  onSaveCustomCamera?: (pos: [number, number, number]) => void;
  onUserInteractionStart?: () => void;
  // onUserInteractionEnd receives a boolean indicating whether the interaction was a drag (true) or a click (false)
  onUserInteractionEnd?: (wasDrag: boolean) => void;
  userCameraThrottleMs?: number;
  cameraFov?: number; // optional override for the camera field of view (degrees)
  // Additional props will be added as we migrate logic here
}

const NewCameraControl = React.forwardRef<NewCameraControlHandle, NewCameraControlProps>((props, ref) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const previousCameraPosition = useRef(new THREE.Vector3());
  const previousCameraTarget = useRef(new THREE.Vector3());
  // Preallocated temporaries to avoid occasional allocations during frame/end checks
  const tmpInitialCameraPos = useRef(new THREE.Vector3(...INITIAL_CAMERA_POSITION));
  // Additional temporaries for artwork camera moves
  const tmpArtworkWorldPosition = useRef(new THREE.Vector3());
  const tmpArtworkWorldRotation = useRef(new THREE.Euler());
  const tmpOffset = useRef(new THREE.Vector3());

  const isAnimating = useRef(false);
  const animationStartTime = useRef(0);
  const startPosition = useRef(new THREE.Vector3());
  const startLookAt = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const lastArtworkMoveTs = useRef<number>(0);

  const CAMERA_ANIMATION_DURATION = 500;
  const CAMERA_ARTWORK_DISTANCE = 5;
  const CAMERA_PAINTING_CAMERA_Z_DISTANCE = 1;
  const CAMERA_ARTWORK_HEIGHT_OFFSET = 0.5;
  const CAMERA_PAINTING_CAMERA_Y_OFFSET = -18;

  const RANKING_CAMERA_POSITION: [number, number, number] = [-8, 3, 10];
  const RANKING_CAMERA_TARGET: [number, number, number] = [0, 1, 0];

  // Minimal implementations for now — will be filled in step-by-step
  const moveCameraToInitial = useCallback((customCameraPosition?: [number, number, number]) => {
    if (!controlsRef.current) return;
    // Debug: emit stack trace to help identify who invoked this
    // debug trace removed
    const final = customCameraPosition || INITIAL_CAMERA_POSITION;
    // Preserve existing look-at target; only set camera position (customCameraPosition is position-only)
    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    targetPosition.current.set(final[0], final[1], final[2]);
    targetLookAt.current.copy(controlsRef.current.target);

    // Animate smoothly to the initial position instead of snapping
    try {
      const fromPos: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
      const fromTgt: [number, number, number] = controlsRef.current ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z] : INITIAL_CAMERA_TARGET;
      const toPos = final as [number, number, number];
      const toTgt = fromTgt;
      // trigger animation using the moveToConfig helper
      props.onCameraAnimationStateChange?.(true);
      props.onCameraPositionChange?.(false);
      // shorter duration for reset to feel quick but smooth
      const RESET_CAMERA_DURATION = 300;
      setMoveToConfig({ fromPosition: fromPos, fromTarget: fromTgt, toPosition: toPos, toTarget: toTgt, duration: RESET_CAMERA_DURATION, key: 'reset' });
      previousCameraPosition.current.copy(new THREE.Vector3(...toPos));
      previousCameraTarget.current.copy(new THREE.Vector3(...toTgt));
    } catch (e) {
      // fallback to immediate snap if animation setup fails
      camera.position.copy(targetPosition.current);
      controlsRef.current.update();
      previousCameraPosition.current.copy(targetPosition.current);
      previousCameraTarget.current.copy(targetLookAt.current);
      props.onCameraPositionChange?.(true);
    }
  }, [camera, props.onCameraPositionChange, props.onCameraAnimationStateChange]);

  const moveCameraToArtwork = useCallback((artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => {
    if (!controlsRef.current) return;

    // Save current camera state before moving
    previousCameraPosition.current.copy(camera.position);
    previousCameraTarget.current.copy(controlsRef.current.target);

    // Also push the current camera onto the module-level saved-camera stack
    // so that moveCameraToPrevious() can reliably restore it.
    try {
      const fromPos: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
      const fromTgt: [number, number, number] = controlsRef.current ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z] : INITIAL_CAMERA_TARGET;
      pushSavedCamera(fromPos, fromTgt);
    } catch (e) {
      // pushSavedCamera failure ignored
    }

    // record timestamp so lighting-prop effects can avoid racing with this explicit artwork move
    lastArtworkMoveTs.current = performance.now();

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    // Determine camera distance and Y-offset based on artwork type
    let cameraDistance = CAMERA_ARTWORK_DISTANCE;
    let cameraYOffset = CAMERA_ARTWORK_HEIGHT_OFFSET;

    if (artworkType.startsWith('canvas_') || artworkType === 'motion') {
      cameraDistance = CAMERA_PAINTING_CAMERA_Z_DISTANCE;
      cameraYOffset = CAMERA_PAINTING_CAMERA_Y_OFFSET;
    }

    const artworkTargetY = position[1] + (artworkType === 'sculpture_base' ? CAMERA_ARTWORK_HEIGHT_OFFSET : 0);
    tmpArtworkWorldPosition.current.set(position[0], artworkTargetY, position[2]);
    tmpArtworkWorldRotation.current.set(rotation[0], rotation[1], rotation[2], 'YXZ');

    tmpOffset.current.set(0, cameraYOffset, cameraDistance);
    tmpOffset.current.applyEuler(tmpArtworkWorldRotation.current);

    targetPosition.current.copy(tmpArtworkWorldPosition.current).add(tmpOffset.current);
    targetLookAt.current.copy(tmpArtworkWorldPosition.current);

    // Begin animation
    isAnimating.current = true;
    animationStartTime.current = performance.now();
    controlsRef.current.enabled = false;
    if (props.onCameraPositionChange) props.onCameraPositionChange(false);
    if (props.onCameraAnimationStateChange) props.onCameraAnimationStateChange(true);
    // artwork move initiated
  }, [camera, props]);

  const moveCameraToPrevious = useCallback(() => {
    // Pop last saved camera state and animate back to it
    const saved = popSavedCamera();
    if (!saved) {
      return;
    }
    const fromPos = [camera.position.x, camera.position.y, camera.position.z] as [number, number, number];
    const fromTgt = controlsRef.current ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z] as [number, number, number] : INITIAL_CAMERA_TARGET;
    // restoring saved camera
    props.onCameraAnimationStateChange?.(true);
    props.onCameraPositionChange?.(false);
    setMoveToConfig({ fromPosition: fromPos, fromTarget: fromTgt, toPosition: saved.pos, toTarget: saved.tgt, duration: CAMERA_ANIMATION_DURATION, key: 'restore' });
  }, [camera, props]);

  const moveCameraToRankingMode = useCallback((position: [number, number, number], target: [number, number, number]) => {
    if (!controlsRef.current) return;

    startPosition.current.copy(camera.position);
    startLookAt.current.copy(controlsRef.current.target);

    targetPosition.current.set(...position);
    targetLookAt.current.set(...target);

    isAnimating.current = true;
    animationStartTime.current = performance.now();
    controlsRef.current.enabled = false;
    if (props.onCameraPositionChange) props.onCameraPositionChange(false);
    if (props.onCameraAnimationStateChange) props.onCameraAnimationStateChange(true);
  }, [camera, props]);

  // moveToConfig state drives rendering of NewCameraMoveTo to animate between two states
  const [moveToConfig, setMoveToConfig] = useState<{
    fromPosition: [number, number, number];
    fromTarget: [number, number, number];
    toPosition: [number, number, number];
    toTarget: [number, number, number];
    duration?: number;
    key?: string;
  } | null>(null);
  // track previous prop values so we only trigger moves on actual button toggles
  const prevRankingRef = useRef<boolean | undefined>(undefined);
  const prevZeroRef = useRef<boolean | undefined>(undefined);

  // React to ranking mode changes triggered by button (detect actual transitions)
  useEffect(() => {
    // Ensure camera FOV is set from configurable prop or default on mount/prop change
    try {
      const fov = props.cameraFov ?? DEFAULT_CAMERA_FOV;
      if (camera && typeof fov === 'number') {
        camera.fov = fov;
        // update projection matrix so change takes effect
        camera.updateProjectionMatrix();
      }
    } catch (e) {
      // ignore camera update failures in non-canvas contexts
    }

    const prev = prevRankingRef.current;
    const now = props.isRankingMode;
    if (prev === undefined) {
      prevRankingRef.current = now;
      return;
    }
    if (now !== prev) {
      if (now) {
        const fromPos = [camera.position.x, camera.position.y, camera.position.z] as [number, number, number];
        const fromTgt = controlsRef.current ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z] as [number, number, number] : INITIAL_CAMERA_TARGET;
        // entering ranking mode
        // save current camera so we can restore it when exiting ranking mode
        pushSavedCamera(fromPos, fromTgt);
        props.onCameraAnimationStateChange?.(true);
        props.onCameraPositionChange?.(false);
        setMoveToConfig({ fromPosition: fromPos, fromTarget: fromTgt, toPosition: RANKING_CAMERA_POSITION, toTarget: RANKING_CAMERA_TARGET, duration: CAMERA_ANIMATION_DURATION, key: 'ranking' });
      } else {
        const fromPos = [camera.position.x, camera.position.y, camera.position.z] as [number, number, number];
        const fromTgt = controlsRef.current ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z] as [number, number, number] : INITIAL_CAMERA_TARGET;
        // Restore previously saved camera (if any), otherwise fallback to custom/initial
        const saved = popSavedCamera();
        const dest = saved ? saved.pos : (props.lightingConfig?.customCameraPosition || INITIAL_CAMERA_POSITION);
        const destTgt = saved ? saved.tgt : fromTgt;
        // exiting ranking mode
        props.onCameraAnimationStateChange?.(true);
        props.onCameraPositionChange?.(false);
        setMoveToConfig({ fromPosition: fromPos, fromTarget: fromTgt, toPosition: dest, toTarget: destTgt, duration: CAMERA_ANIMATION_DURATION, key: 'ranking-exit' });
      }
      prevRankingRef.current = now;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isRankingMode]);

  // React to zero-gravity mode button toggles
  useEffect(() => {
    const prev = prevZeroRef.current;
    const now = props.isZeroGravityMode;
    if (prev === undefined) {
      prevZeroRef.current = now;
      return;
    }
    if (now !== prev) {
      if (now) {
        const fromPos = [camera.position.x, camera.position.y, camera.position.z] as [number, number, number];
        const fromTgt = controlsRef.current ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z] as [number, number, number] : INITIAL_CAMERA_TARGET;
        const dest = [camera.position.x, camera.position.y + 2, camera.position.z + 2] as [number, number, number];
        // entering zero-gravity mode
        props.onCameraAnimationStateChange?.(true);
        props.onCameraPositionChange?.(false);
        setMoveToConfig({ fromPosition: fromPos, fromTarget: fromTgt, toPosition: dest, toTarget: fromTgt, duration: CAMERA_ANIMATION_DURATION, key: 'zerog' });
      } else {
        const fromPos = [camera.position.x, camera.position.y, camera.position.z] as [number, number, number];
        const fromTgt = controlsRef.current ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z] as [number, number, number] : INITIAL_CAMERA_TARGET;
        const dest = props.lightingConfig?.customCameraPosition || INITIAL_CAMERA_POSITION;
        // exiting zero-gravity mode
        props.onCameraAnimationStateChange?.(true);
        props.onCameraPositionChange?.(false);
        setMoveToConfig({ fromPosition: fromPos, fromTarget: fromTgt, toPosition: dest, toTarget: fromTgt, duration: CAMERA_ANIMATION_DURATION, key: 'zerog-exit' });
      }
      prevZeroRef.current = now;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.isZeroGravityMode]);

  useImperativeHandle(ref, () => ({
    moveCameraToArtwork,
    moveCameraToPrevious,
    moveCameraToInitial,
    moveCameraToRankingMode,
  }), [moveCameraToArtwork, moveCameraToPrevious, moveCameraToInitial, moveCameraToRankingMode]);

  // User drag detection: listen to OrbitControls start/change/end to capture user camera adjustments
  const isUserDraggingRef = useRef(false);
  const [isUserDragging, setIsUserDragging] = React.useState(false);
  const lastUserPos = useRef(new THREE.Vector3());
  const lastEmit = useRef(0);
  const throttleMs = props.userCameraThrottleMs || 150;

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    let interactionStartTs = 0;
    // Use only a time threshold to decide whether an interaction is a drag
    const CLICK_TIME_THRESHOLD = 300; // ms: press duration above this is considered a drag
    const startPosRef = { current: new THREE.Vector3() } as { current: THREE.Vector3 };

    const onStart = () => {
      isUserDraggingRef.current = true;
      setIsUserDragging(true);
      interactionStartTs = performance.now();
      // Start capturing
      lastUserPos.current.copy(camera.position);
      startPosRef.current.copy(camera.position);
      lastEmit.current = 0;
      if (props.onUserInteractionStart) props.onUserInteractionStart();
    };

    const onChange = () => {
      if (!isUserDraggingRef.current) return;
      // We no longer use distance to decide drag; keep updating live pos and throttle emits
      lastUserPos.current.copy(camera.position);
      const now = performance.now();
      if (now - lastEmit.current > throttleMs) {
        lastEmit.current = now;
      }
    };

    const onEnd = () => {
      isUserDraggingRef.current = false;
      setIsUserDragging(false);
      lastUserPos.current.copy(camera.position);
      const posTuple: [number, number, number] = [lastUserPos.current.x, lastUserPos.current.y, lastUserPos.current.z];
      const now = performance.now();
      // If we never received a start timestamp, treat this as a short interaction
      if (!interactionStartTs) {
        try {
          (window as any).__LAST_INTERACTION = { duration: 0, distance: 0 };
        } catch (e) {}
        if (props.onUserInteractionEnd) props.onUserInteractionEnd(false);
        interactionStartTs = 0;
        return;
      }
      const duration = now - interactionStartTs;
      // Decide drag by duration OR by movement distance (to catch short quick drags)
      const interactionDistance = startPosRef.current ? camera.position.distanceTo(startPosRef.current) : 0;
      const CLICK_DISTANCE_THRESHOLD = 0.25; // world units: treat movements above this as a drag
      const wasDrag = duration > CLICK_TIME_THRESHOLD || interactionDistance > CLICK_DISTANCE_THRESHOLD;
      try {
        (window as any).__LAST_INTERACTION = { duration: Math.round(duration), distance: Number(interactionDistance.toFixed(4)) };
      } catch (e) {
        // ignore write errors
      }
      if (props.onUserInteractionEnd) props.onUserInteractionEnd(wasDrag);
      // Only persist custom camera when the editor is open and it was a drag.
      if (wasDrag && props.isEditorOpen) {
        if (props.onSaveCustomCamera) props.onSaveCustomCamera(posTuple);
      }
      // Reset start timestamp so subsequent 'end' events don't compute large durations
      interactionStartTs = 0;
    };

    controls.addEventListener('start', onStart);
    controls.addEventListener('change', onChange);
    controls.addEventListener('end', onEnd);

    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('change', onChange);
      controls.removeEventListener('end', onEnd);
    };
  }, [camera, props, throttleMs]);

  // Animation frame handling
  useFrame(() => {
    if (!controlsRef.current) return;
    if (isAnimating.current) {
      const elapsedTime = performance.now() - animationStartTime.current;
      const t = Math.min(1, elapsedTime / CAMERA_ANIMATION_DURATION);
      const smoothT = t * t * (3 - 2 * t);

      camera.position.lerpVectors(startPosition.current, targetPosition.current, smoothT);
      controlsRef.current.target.lerpVectors(startLookAt.current, targetLookAt.current, smoothT);
      controlsRef.current.update();

      if (t === 1) {
        isAnimating.current = false;
        controlsRef.current.enabled = !props.isEditorOpen;
        if (props.onCameraAnimationStateChange) props.onCameraAnimationStateChange(false);
        if (props.onCameraPositionChange) {
          // Determine whether camera is at initial by comparing to INITIAL_CAMERA_POSITION
            const atInitial = camera.position.distanceTo(tmpInitialCameraPos.current) < 0.1;
          props.onCameraPositionChange(atInitial);
        }
        // After animation completes, log the current camera position and whether it matches user custom or system default
          try {
          // animation complete; position logged removed
        } catch (e) {
        }
      }
    } else {
      controlsRef.current.update();
    }
  });

  // On mount or when lightingConfig.customCameraPosition changes, snap to it if provided
  useEffect(() => {
    const custom = props.lightingConfig?.customCameraPosition;
    if (!custom) return;

    // Guarded snapping logic:
    // - if an animation is in progress, don't interrupt it
    // - if the app is currently performing an artwork-driven move, ignore the prop snap
    // - if an artwork move happened very recently, ignore (debounce)
    if (isAnimating.current) {
      // skipping snap: camera is animating
      return;
    }
    if (props.isCameraMovingToArtwork) {
      // skipping snap: artwork move in progress
      return;
    }
    const now = performance.now();
    if (now - lastArtworkMoveTs.current < 800) {
      // skipping snap due to recent artwork move
      return;
    }
    // snapping to customCameraPosition
    moveCameraToInitial(custom);
  }, [props.lightingConfig?.customCameraPosition, props.isCameraMovingToArtwork, moveCameraToInitial]);

  // NEW: State to track if Space key is pressed
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Dynamic mouse buttons state based on Space key
  const mouseButtons = {
    LEFT: isSpacePressed ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };

  return (
    <>
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
      // keep target in sync with INITIAL_CAMERA_TARGET until moved
      target={INITIAL_CAMERA_TARGET}
      enabled={!props.isEditorOpen}
      enableRotate={true}
    />
      {isUserDragging && (
        <NewCameraCurrent onChange={(pos, tgt) => {
          // Also log the live camera position while user drags
          // live camera position update (logging removed)
        }} throttleMs={props.userCameraThrottleMs || 150} />
      )}

      {moveToConfig && (
        <NewCameraMoveTo
          key={moveToConfig.key}
          fromPosition={moveToConfig.fromPosition}
          fromTarget={moveToConfig.fromTarget}
          toPosition={moveToConfig.toPosition}
          toTarget={moveToConfig.toTarget}
          duration={moveToConfig.duration}
          onComplete={() => {
            // finished move
            props.onCameraAnimationStateChange?.(false);
            // Determine whether the camera is now at the default initial position.
            // Treat explicit 'reset' and ranking-exit/zerog-exit as at-initial.
            const atInitial = ['ranking-exit', 'zerog-exit', 'reset'].includes(moveToConfig.key || '');
            props.onCameraPositionChange(atInitial);
            setMoveToConfig(null);
          }}
        />
      )}
    </>
  );
});

NewCameraControl.displayName = 'NewCameraControl';

export default NewCameraControl;

// Named helper component: NewCameraMoveTo
// Usage: render <NewCameraMoveTo fromPos fromTarget toPos toTarget duration onComplete />
export const NewCameraMoveTo: React.FC<{
  fromPosition: [number, number, number];
  fromTarget: [number, number, number];
  toPosition: [number, number, number];
  toTarget: [number, number, number];
  duration?: number; // ms
  onComplete?: () => void;
}> = ({ fromPosition, fromTarget, toPosition, toTarget, duration = 500, onComplete }) => {
  const { camera, controls } = useThree() as any;
  const start = useRef<number | null>(null);
  const isDone = useRef(false);
  const vStart = useRef(new THREE.Vector3(...fromPosition));
  const vEnd = useRef(new THREE.Vector3(...toPosition));
  const tStart = useRef(new THREE.Vector3(...fromTarget));
  const tEnd = useRef(new THREE.Vector3(...toTarget));

  useEffect(() => {
    // initialize camera and controls to from values immediately
    camera.position.copy(vStart.current);
    if (controls) {
      controls.target.copy(tStart.current);
      controls.update();
    }
    isDone.current = false;
    start.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPosition, fromTarget]);

  useFrame(() => {
    if (isDone.current) return;
    const now = performance.now();
    if (start.current === null) start.current = now;
    const elapsed = now - start.current;
    const t = Math.min(1, elapsed / duration);
    const smoothT = t * t * (3 - 2 * t);

    camera.position.lerpVectors(vStart.current, vEnd.current, smoothT);
    if (controls) {
      controls.target.lerpVectors(tStart.current, tEnd.current, smoothT);
      controls.update();
    }

    if (t === 1) {
      isDone.current = true;
      if (onComplete) onComplete();
    }
  });

  return null;
};

// Named helper component: NewCameraCurrent
// Usage: <NewCameraCurrent onChange={(pos,target)=>{}} throttleMs={100} />
export const NewCameraCurrent: React.FC<{
  onChange?: (position: [number, number, number], target: [number, number, number]) => void;
  throttleMs?: number;
}> = ({ onChange, throttleMs = 100 }) => {
  const { camera, controls } = useThree() as any;
  const lastEmitted = useRef(0);

  useFrame(() => {
    if (!onChange) return;
    const now = performance.now();
    if (now - lastEmitted.current < throttleMs) return;
    lastEmitted.current = now;
    const pos = [camera.position.x, camera.position.y, camera.position.z] as [number, number, number];
    const tgt = controls ? [controls.target.x, controls.target.y, controls.target.z] as [number, number, number] : [0, 0, 0] as [number, number, number];
    onChange(pos, tgt);
  });

  return null;
};
