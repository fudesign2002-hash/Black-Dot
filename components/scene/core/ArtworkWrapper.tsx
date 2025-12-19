import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ArtType } from '../../../types'; // NEW: Import ArtType

interface ArtworkWrapperProps {
  id: string;
  children: React.ReactNode;
  originalPosition: [number, number, number];
  originalRotation: [number, number, number];
  targetPosition: [number, number, number]; // This is the final position (ranked or original)
  targetRotation: [number, number, number]; // This is the final rotation (ranked or original)
  isRankingMode: boolean;
  isZeroGravityMode: boolean; // NEW: Add isZeroGravityMode
  zoneGravity: number | undefined; // NEW: Add zoneGravity
  artworkGravity: number | undefined; // NEW: Add artworkGravity
  onCanvasArtworkClick: (e: React.MouseEvent<HTMLDivElement>) => void; // Pass click handler
  artworkType: ArtType; // NEW: Add artworkType prop
  externalOffsetX?: number; // NEW: external slide offset (used to slide non-focused artworks off-screen)
}

// Temporarily slow ranking transitions for inspection (5x)
const SLIDE_DURATION = 1000; // ~3.0 seconds (was 600ms)
const REVERT_DURATION = 500; // ~3.0 seconds (was 600ms)
const ZERO_GRAVITY_DURATION = 600; // NEW: Duration for zero gravity animation
// Removed ROTATION_BLEND_DURATION as rotation blend now happens over main animation duration

// NEW: 彈性緩動函數 for easeOutElastic
const easeOutElastic = (t: number) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -9 * t) * Math.sin((t * 5 - 0.75) * c4) + 1;
};

// NEW: 平滑緩動函數 for easeInOutSine
const easeInOutSine = (t: number) => {
  return -(Math.cos(Math.PI * t) - 1) / 2;
};

// NEW: easeInOutCubic for smoother revert when needed
const easeInOutCubic = (t: number) => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// NEW: 輔助函數：將一個值從一個範圍映射到另一個範圍
const mapRange = (value: number, in_min: number, in_max: number, out_min: number, out_max: number) => {
  const clampedValue = Math.max(in_min, Math.min(value, in_max));
  return ((clampedValue - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
};

// NEW: Constants for Floating Effect
const FLOAT_SPEED_Y = 1.0; // Oscillations per second for Y position
const FLOAT_AMPLITUDE_Y_BASE = 0.5; // Base amplitude for Y-oscillation

const ROTATION_SPEED_X = 0.5; // Oscillations per second for X rotation
const ROTATION_SPEED_Z = 0.7; // Oscillations per second for Z rotation

// Gravity mapping constants
// Base floating height for artworks will now range between +2 and +25 relative to original Y.
const MAX_BASE_FLOAT_Y = 14; // When artwork gravity is lowest (few views) -> float higher (y + 25)
const MIN_BASE_FLOAT_Y = 2;  // When artwork gravity is highest (many views) -> float lower (y + 2)

// Global offset to fine-tune final base (keeps values reasonable); set to 0 by default
const ZERO_GRAVITY_GLOBAL_LOWER_OFFSET = 0;

// Constants for dynamic angular amplitude mapping (higher floating items tilt more)
const MIN_Y_OFFSET_FOR_AMPLITUDE_MAP = 2;  // Lower bound of artwork's floating height for mapping
const MAX_Y_OFFSET_FOR_AMPLITUDE_MAP = 20; // Upper bound of artwork's floating height for mapping
const MIN_ANGULAR_AMPLITUDE = 0.02; // Minimum angular amplitude (radians)
const MAX_ANGULAR_AMPLITUDE = 0.5;  // Maximum angular amplitude (radians) - increased for stronger tilt
// Exponent used to bias the mapping toward larger amplitudes for higher floats
const AMPLITUDE_EXPONENT = 2.0;

// --- Lightweight pointer tap vs drag thresholds (minimal, per-device) ---
const MOUSE_DURATION_THRESHOLD = 220; // ms
const MOUSE_DISTANCE_THRESHOLD = 8; // px
const TOUCH_DURATION_THRESHOLD = 400; // ms
const TOUCH_DISTANCE_THRESHOLD = 28; // px



const ArtworkWrapper: React.FC<ArtworkWrapperProps> = ({
  id,
  children,
  originalPosition,
  originalRotation,
  targetPosition,
  targetRotation,
  isRankingMode,
  isZeroGravityMode, // NEW: Destructure isZeroGravityMode
  zoneGravity, // NEW: Destructure zoneGravity
  artworkGravity, // NEW: Destructure artworkGravity
  onCanvasArtworkClick,
  artworkType, // NEW: Destructure artworkType
  externalOffsetX = 0, // NEW: external slide offset
}) => {
  const groupRef = useRef<THREE.Group>(null);
  // Reusable temporary objects to avoid per-frame allocations
  const tmpVec1 = useRef(new THREE.Vector3());
  const tmpVec2 = useRef(new THREE.Vector3());
  const tmpVec3 = useRef(new THREE.Vector3());
  const tmpEuler1 = useRef(new THREE.Euler());
  const tmpEuler2 = useRef(new THREE.Euler());
  const tmpQuat1 = useRef(new THREE.Quaternion());
  const tmpQuat2 = useRef(new THREE.Quaternion());
  const tmpQuat3 = useRef(new THREE.Quaternion());
  
  // Animation state for ranking transitions
  const isAnimating = useRef(false);
  const animationStartTime = useRef(0);
  // MODIFIED: Add 'zeroGravity' to animationState types
  const animationState = useRef<'idle' | 'slide' | 'revert' | 'zeroGravity'>('idle');
  // These capture the *actual* position/rotation of the Three.js object at animation start
  const animationStartActualPosition = useRef(new THREE.Vector3()); 
  const animationStartActualRotation = useRef(new THREE.Euler());
  // FIX: Declare targetPosition and targetLookAt using useRef
  const animationTargetActualPosition = useRef(new THREE.Vector3());
  const animationTargetActualRotation = useRef(new THREE.Euler());
  // NEW: Refs for scale animation
  const animationStartActualScale = useRef(1.0);
  const animationTargetActualScale = useRef(1.0);

  // NEW: Ref to track the rotation blend factor for zero gravity oscillation
  // This will now be driven by the main animation `t` or a continuous loop
  const rotationBlendCurrent = useRef(0); 

  // Track where a 'revert' animation originated from so we can pick easing accordingly
  const revertSource = useRef<'ranking' | 'zeroGravity' | null>(null);

  // (ground marker moved out to scene-level so it does not follow artwork oscillation)


  // NEW: Ref to store oscillation phases and individual amplitude for dynamic floating
  const oscillationState = useRef<{
    phaseY: number;
    phaseX: number;
    phaseZ: number;
    amplitudeY: number; 
  }>({
    phaseY: Math.random() * Math.PI * 2,
    phaseX: Math.random() * Math.PI * 2,
    phaseZ: Math.random() * Math.PI * 2,
    amplitudeY: mapRange(Math.random(), 0, 1, 0.05, 0.15) // Slight random amplitude for Y
  });


  // Store the previous props to detect changes reliably
  const prevProps = useRef({
    isRankingMode: false,
    isZeroGravityMode: false, // NEW
    targetPosition: new THREE.Vector3(),
    targetRotation: new THREE.Euler(),
    artworkType: 'sculpture_base' as ArtType, // Initialize with a default value
    zoneGravity: undefined as number | undefined, // NEW
    artworkGravity: undefined as number | undefined, // NEW
    externalOffsetX: 0,
  });

  // Use useEffect to trigger animations based on prop changes
  useEffect(() => {
    if (!groupRef.current) return;

    const newOriginalVec = new THREE.Vector3(...originalPosition);
    const newOriginalEuler = new THREE.Euler(...originalRotation);
    const newTargetVec = new THREE.Vector3(...targetPosition);
    const newTargetEuler = new THREE.Euler(...targetRotation);

    const isPaintingArtwork = artworkType.startsWith('canvas_');
    const newTargetScale = (isRankingMode && isPaintingArtwork) ? 0.6 : 1.0; 

    // NEW: Calculate Zero Gravity Target Position BASE (center of oscillation)
    // Artwork gravity (0..100) is normalized from view counts; map it directly to Y offset 30..10
    const effectiveArtworkGravity = artworkGravity ?? 50; // Default artwork gravity to 50 if undefined
    const zeroGravityBaseYOffset = mapRange(effectiveArtworkGravity, 0, 100, MAX_BASE_FLOAT_Y, MIN_BASE_FLOAT_Y) + ZERO_GRAVITY_GLOBAL_LOWER_OFFSET;
    const zeroGravityTargetPositionBase = new THREE.Vector3(newOriginalVec.x, newOriginalVec.y + zeroGravityBaseYOffset, newOriginalVec.z);


    // Get previous states from ref
    // MODIFIED: Include prevIsZeroGravityModeValue, prevZoneGravity, and prevArtworkGravity
    const { isRankingMode: prevIsRankingModeValue, isZeroGravityMode: prevIsZeroGravityModeValue, targetPosition: prevTargetPositionValue, targetRotation: prevTargetRotationValue, artworkType: prevArtworkType, zoneGravity: prevZoneGravity, artworkGravity: prevArtworkGravity } = prevProps.current;
    const prevExternalOffsetX = prevProps.current.externalOffsetX ?? 0;

    // Track if animation needs to be triggered
    let shouldAnimate = false;
    // MODIFIED: Allow 'zeroGravity' state
    let newAnimationState: 'idle' | 'slide' | 'revert' | 'zeroGravity' = 'idle';
    let animStartPos = new THREE.Vector3();
    let animStartRot = new THREE.Euler();
    let animStartScale = 1.0; 
    let animTargetPos = new THREE.Vector3();
    let animTargetRot = new THREE.Euler();
    let animTargetScale = 1.0; 


    // --- Entering Ranking Mode ---
    if (isRankingMode && !prevIsRankingModeValue) {
      // Ensure we start from current visual state
      groupRef.current.position.copy(newOriginalVec);
      groupRef.current.rotation.copy(newOriginalEuler);
      groupRef.current.scale.setScalar(1.0); 

      shouldAnimate = true;
      newAnimationState = 'slide';
      animStartPos.copy(newOriginalVec); 
      animStartRot.copy(newOriginalEuler); 
      animStartScale = 1.0; 

      animTargetPos.copy(newTargetVec); 
      animTargetRot.copy(newTargetEuler); 
      animTargetScale = newTargetScale; 
      rotationBlendCurrent.current = 0; // Reset rotation blend
    }
    // --- Exiting Ranking Mode ---
    else if (!isRankingMode && prevIsRankingModeValue) {
      shouldAnimate = true;
      newAnimationState = 'revert';
      revertSource.current = 'ranking';
      animStartPos.copy(groupRef.current.position); 
      animStartRot.copy(groupRef.current.rotation); 
      animStartScale = groupRef.current.scale.x; 

      animTargetPos.copy(newOriginalVec); 
      animTargetRot.copy(newOriginalEuler); 
      animTargetScale = 1.0; 
      rotationBlendCurrent.current = 0; // Reset rotation blend
    }
    // --- Entering Zero Gravity Mode --- (and not in Ranking Mode)
    // MODIFIED: Check for !isRankingMode in zero gravity entry condition
    else if (isZeroGravityMode && !prevIsZeroGravityModeValue && !isRankingMode) {
      // Start from current visual position, not necessarily originalPosition
      // This is crucial for smooth transition from wherever the artwork currently is
      animStartPos.copy(groupRef.current.position); 
      animStartRot.copy(groupRef.current.rotation);
      animStartScale = groupRef.current.scale.x;

      shouldAnimate = true;
      newAnimationState = 'zeroGravity';
      
      animTargetPos.copy(zeroGravityTargetPositionBase); // Target the zero gravity position base
      animTargetRot.copy(newOriginalEuler); // Target original rotation (flat base for oscillation)
      animTargetScale = 1.0;

      rotationBlendCurrent.current = 0; // Start blend from 0
    }
    // --- Exiting Zero Gravity Mode --- (and not in Ranking Mode)
    // MODIFIED: Check for !isRankingMode in zero gravity exit condition
    else if (!isZeroGravityMode && prevIsZeroGravityModeValue && !isRankingMode) {
      shouldAnimate = true;
      newAnimationState = 'revert'; // Use revert animation for exiting zero gravity
      revertSource.current = 'zeroGravity';
      animStartPos.copy(groupRef.current.position); // Start from current oscillating position
      animStartRot.copy(groupRef.current.rotation); // Start from current oscillating rotation
      animStartScale = groupRef.current.scale.x;

      animTargetPos.copy(newOriginalVec); // Target original position
      animTargetRot.copy(newOriginalEuler); // Target original rotation (flat)
      animTargetScale = 1.0;
      rotationBlendCurrent.current = 1; // Start blend from 1 (full oscillation) to 0
    }
    // --- Reranking (target position/rotation/scale changes while already in ranking mode) ---
    else if (isRankingMode && prevIsRankingModeValue) {
      const prevTargetScale = (prevIsRankingModeValue && prevArtworkType.startsWith('canvas_')) ? 0.6 : 1.0; 

      if (!prevTargetPositionValue.equals(newTargetVec) || !prevTargetRotationValue.equals(newTargetEuler) || prevTargetScale !== newTargetScale) {
        shouldAnimate = true;
        newAnimationState = 'slide';
        animStartPos.copy(groupRef.current.position); 
        animStartRot.copy(groupRef.current.rotation); 
        animStartScale = groupRef.current.scale.x; 

        animTargetPos.copy(newTargetVec); 
        animTargetRot.copy(newTargetEuler); 
        animTargetScale = newTargetScale; 
        rotationBlendCurrent.current = 0; // Reset rotation blend
      }
    }
    // NEW: --- Re-gravity (gravity value changes while already in zero gravity mode) ---
    else if (isZeroGravityMode && prevIsZeroGravityModeValue && !isRankingMode && (zoneGravity !== prevZoneGravity || artworkGravity !== prevArtworkGravity)) {
      shouldAnimate = true;
      newAnimationState = 'zeroGravity'; // Re-use zeroGravity animation state for gravity adjustments
      animStartPos.copy(groupRef.current.position); // Start from current oscillating position
      animStartRot.copy(groupRef.current.rotation); // Start from current oscillating rotation
      animStartScale = 1.0; // Scale doesn't change with gravity, keep it 1.0

      animTargetPos.copy(zeroGravityTargetPositionBase); // Target new zero gravity position base
      animTargetRot.copy(newOriginalEuler); // Target original rotation (flat base for oscillation)
      animTargetScale = 1.0;

      rotationBlendCurrent.current = 0; // Start blend from 0 again for smooth transition to new oscillation
    }

    // NEW: External offset driven slide (e.g., when zooming into an artwork)
    if (externalOffsetX !== undefined && externalOffsetX !== prevExternalOffsetX) {
      shouldAnimate = true;
      newAnimationState = 'slide';
      animStartPos.copy(groupRef.current.position);
      animStartRot.copy(groupRef.current.rotation);
      animStartScale = groupRef.current.scale.x;

      // Target is original position shifted by externalOffsetX on X
      animTargetPos.copy(newOriginalVec).add(tmpVec1.current.set(externalOffsetX, 0, 0));
      animTargetRot.copy(newOriginalEuler);
      animTargetScale = 1.0;
      rotationBlendCurrent.current = 0;
    }


    if (shouldAnimate) {
      animationState.current = newAnimationState;
      animationStartTime.current = performance.now();
      animationStartActualPosition.current.copy(animStartPos);
      animationStartActualRotation.current.copy(animStartRot);
      animationStartActualScale.current = animStartScale; 
      animationTargetActualPosition.current.copy(animTargetPos);
      animationTargetActualRotation.current.copy(animTargetRot);
      animationTargetActualScale.current = animTargetScale; 
      isAnimating.current = true;
    } else {
      if (!isAnimating.current) {
        animationState.current = 'idle';
        // Ensure it's correctly positioned and scaled immediately if no animation is needed
        // Determine final snap position based on active mode, but honor externalOffsetX when present
        let finalSnapPosition: THREE.Vector3;
        if (isRankingMode) {
          finalSnapPosition = newTargetVec;
        } else if (isZeroGravityMode) {
          finalSnapPosition = zeroGravityTargetPositionBase;
        } else if (externalOffsetX && externalOffsetX !== 0) {
          finalSnapPosition = tmpVec2.current.copy(newOriginalVec).add(tmpVec1.current.set(externalOffsetX, 0, 0));
        } else {
          finalSnapPosition = newOriginalVec;
        }

        const finalSnapRotation = isRankingMode ? newTargetEuler : newOriginalEuler;
        const finalSnapScale = newTargetScale;

        groupRef.current.position.copy(finalSnapPosition);
        groupRef.current.rotation.copy(finalSnapRotation);
        groupRef.current.scale.setScalar(finalSnapScale);

        // If in zero gravity mode and not animating, ensure rotation blend is 1 for immediate full oscillation
        if (isZeroGravityMode) {
          rotationBlendCurrent.current = 1;
        } else {
          rotationBlendCurrent.current = 0; // Reset for other modes
        }
      }
    }

    // Update previous props for next effect run
    prevProps.current = {
      isRankingMode,
      isZeroGravityMode, // NEW
      targetPosition: newTargetVec,
      targetRotation: newTargetEuler,
      artworkType, 
      zoneGravity, // NEW
      artworkGravity, // NEW
      externalOffsetX: externalOffsetX ?? 0,
    };

  }, [id, isRankingMode, isZeroGravityMode, targetPosition, targetRotation, originalPosition, originalRotation, artworkType, zoneGravity, artworkGravity, externalOffsetX]); // MODIFIED: Add isZeroGravityMode, zoneGravity, artworkGravity, externalOffsetX to deps

  // Main animation loop
  useFrame(() => {
    if (!groupRef.current) return;

    // Recalculate transient original vectors/rotations into preallocated temporaries to avoid allocations
    const newOriginalVec = tmpVec1.current.set(...originalPosition);
    const newOriginalEuler = tmpEuler1.current.set(...originalRotation);

    const effectiveArtworkGravity = artworkGravity ?? 50; // Default artwork gravity to 50 if undefined
    const zeroGravityBaseYOffset = mapRange(effectiveArtworkGravity, 0, 100, MAX_BASE_FLOAT_Y, MIN_BASE_FLOAT_Y) + ZERO_GRAVITY_GLOBAL_LOWER_OFFSET;


    // Perform interpolation if animating
    if (isAnimating.current) {
      const elapsed = performance.now() - animationStartTime.current;
      let t;
      let duration;
      let startVec = animationStartActualPosition.current;
      let targetVec = animationTargetActualPosition.current;
      let startEuler = animationStartActualRotation.current;
      let targetEuler = animationTargetActualRotation.current;
      let startScale = animationStartActualScale.current; 
      let targetScale = animationTargetActualScale.current; 


      // MODIFIED: Handle zeroGravity duration
      if (animationState.current === 'slide') {
        duration = SLIDE_DURATION;
      } else if (animationState.current === 'revert') {
        duration = REVERT_DURATION;
      } else if (animationState.current === 'zeroGravity') { // NEW
        duration = ZERO_GRAVITY_DURATION;
      } else {
        // Fallback: If isAnimating.current is true but animationState.current is idle, reset
        isAnimating.current = false;
        animationState.current = 'idle';
        // Directly set to final state for robustness
        groupRef.current.position.copy(targetVec);
        groupRef.current.rotation.copy(targetEuler);
        groupRef.current.scale.setScalar(targetScale); 
        return;
      }

      t = Math.min(1, elapsed / duration);
      // MODIFIED: Apply easeOutElastic for 'slide' and 'revert' from non-zero-gravity, but use easeInOutSine for 'zeroGravity' (ascending)
      let easedT;
      if (animationState.current === 'zeroGravity') {
        easedT = easeInOutSine(t); // Use smooth easing for ascending (entering zero gravity)
      } else if (animationState.current === 'slide') {
        easedT = easeOutElastic(t);
      } else if (animationState.current === 'revert') {
        // If revert came from ranking mode, use a smoother cubic easing; otherwise keep elastic
        if (revertSource.current === 'ranking') {
          easedT = easeInOutCubic(t);
        } else {
          easedT = easeOutElastic(t);
        }
      } else {
        easedT = easeOutElastic(t);
      }
      
      groupRef.current.position.lerpVectors(startVec, targetVec, easedT);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(startScale, targetScale, easedT)); 

      // NEW: Rotation handling for zeroGravity and revert animations
      if (animationState.current === 'zeroGravity') {
        // When entering zero gravity, blend from start rotation to the oscillating rotation
        const time = performance.now() * 0.001;

          // Non-linear mapping: higher Y produces disproportionately larger tilt
          const norm = Math.max(0, Math.min(1, (zeroGravityBaseYOffset - MIN_Y_OFFSET_FOR_AMPLITUDE_MAP) / (MAX_Y_OFFSET_FOR_AMPLITUDE_MAP - MIN_Y_OFFSET_FOR_AMPLITUDE_MAP)));
          const eased = Math.pow(norm, AMPLITUDE_EXPONENT);
          const dynamicRotationAmplitude = MIN_ANGULAR_AMPLITUDE + eased * (MAX_ANGULAR_AMPLITUDE - MIN_ANGULAR_AMPLITUDE);

          const rotationX = Math.sin(time * ROTATION_SPEED_X + oscillationState.current.phaseX) * dynamicRotationAmplitude;
          const rotationZ = Math.sin(time * ROTATION_SPEED_Z + oscillationState.current.phaseZ) * dynamicRotationAmplitude;

          tmpEuler2.current.set(
            newOriginalEuler.x + rotationX,
            newOriginalEuler.y,
            newOriginalEuler.z + rotationZ
          );

          // Blend `startEuler` (current rotation before animation) towards oscillating target using preallocated quaternions
          tmpQuat1.current.setFromEuler(startEuler);
          tmpQuat2.current.setFromEuler(tmpEuler2.current);
          tmpQuat3.current.slerpQuaternions(tmpQuat1.current, tmpQuat2.current, easedT);
          groupRef.current.rotation.setFromQuaternion(tmpQuat3.current);

          rotationBlendCurrent.current = easedT;
      } else if (animationState.current === 'revert' && prevProps.current.isZeroGravityMode) {
        // When exiting zero gravity, blend from current oscillating rotation towards `newOriginalEuler`
        // `startEuler` here contains the *last* oscillating rotation from before the revert animation began.
        tmpQuat1.current.setFromEuler(startEuler);
        tmpQuat2.current.setFromEuler(newOriginalEuler);
        tmpQuat3.current.slerpQuaternions(tmpQuat1.current, tmpQuat2.current, easedT);
        groupRef.current.rotation.setFromQuaternion(tmpQuat3.current);

        rotationBlendCurrent.current = 1 - easedT;
      } else {
        // For other animations (slide, revert from ranking), just slerp between start and target
        tmpQuat1.current.setFromEuler(startEuler);
        tmpQuat2.current.setFromEuler(targetEuler);
        tmpQuat3.current.slerpQuaternions(tmpQuat1.current, tmpQuat2.current, easedT);
        groupRef.current.rotation.setFromQuaternion(tmpQuat3.current);
        rotationBlendCurrent.current = 0; // Reset for these modes
      }


      if (t === 1) {
        isAnimating.current = false;
        animationState.current = 'idle';
        // Clear revert source after animation completes
        revertSource.current = null;
        // Ensure final position/rotation is exactly the target
        groupRef.current.position.copy(targetVec);
        // For zeroGravity, the final rotation target *is* the oscillating state
        if (prevProps.current.isZeroGravityMode) { // Check prevProps to see what mode just ended
          const time = performance.now() * 0.001; // Current time for final oscillation position
          const norm = Math.max(0, Math.min(1, (zeroGravityBaseYOffset - MIN_Y_OFFSET_FOR_AMPLITUDE_MAP) / (MAX_Y_OFFSET_FOR_AMPLITUDE_MAP - MIN_Y_OFFSET_FOR_AMPLITUDE_MAP)));
          const eased = Math.pow(norm, AMPLITUDE_EXPONENT);
          const dynamicRotationAmplitude = MIN_ANGULAR_AMPLITUDE + eased * (MAX_ANGULAR_AMPLITUDE - MIN_ANGULAR_AMPLITUDE);
          const rotationX = Math.sin(time * ROTATION_SPEED_X + oscillationState.current.phaseX) * dynamicRotationAmplitude;
          const rotationZ = Math.sin(time * ROTATION_SPEED_Z + oscillationState.current.phaseZ) * dynamicRotationAmplitude;
          tmpEuler2.current.set(newOriginalEuler.x + rotationX, newOriginalEuler.y, newOriginalEuler.z + rotationZ);
          groupRef.current.rotation.copy(tmpEuler2.current);
          rotationBlendCurrent.current = 1; // Full blend for continuous oscillation
        } else {
          groupRef.current.rotation.copy(targetEuler);
          rotationBlendCurrent.current = 0; // Reset for other modes
        }
        groupRef.current.scale.setScalar(targetScale); 
      }
    } else {
      // If NOT animating (and not in an active transition),
      // ensure the object is at its expected static position based on `isRankingMode` or `isZeroGravityMode`.
      const isPaintingArtwork = artworkType.startsWith('canvas_'); 
      const finalIdleScale = (isRankingMode && isPaintingArtwork) ? 0.6 : 1.0; 

      if (isZeroGravityMode) {
        // NEW: Apply continuous oscillation when in zero gravity mode
        const time = performance.now() * 0.001; // Convert to seconds

        // Calculate dynamic angular amplitude based on zeroGravityBaseYOffset
        const norm = Math.max(0, Math.min(1, (zeroGravityBaseYOffset - MIN_Y_OFFSET_FOR_AMPLITUDE_MAP) / (MAX_Y_OFFSET_FOR_AMPLITUDE_MAP - MIN_Y_OFFSET_FOR_AMPLITUDE_MAP)));
        const eased = Math.pow(norm, AMPLITUDE_EXPONENT);
        const dynamicRotationAmplitude = MIN_ANGULAR_AMPLITUDE + eased * (MAX_ANGULAR_AMPLITUDE - MIN_ANGULAR_AMPLITUDE);

        // Y-oscillation
        const currentYOffset = zeroGravityBaseYOffset + Math.sin(time * FLOAT_SPEED_Y + oscillationState.current.phaseY) * oscillationState.current.amplitudeY;
        const oscillatingPosition = tmpVec2.current.set(newOriginalVec.x, newOriginalVec.y + currentYOffset, newOriginalVec.z);
        
        // X-rotation oscillation
        const rotationX = Math.sin(time * ROTATION_SPEED_X + oscillationState.current.phaseX) * dynamicRotationAmplitude;
        // Z-rotation oscillation
        const rotationZ = Math.sin(time * ROTATION_SPEED_Z + oscillationState.current.phaseZ) * dynamicRotationAmplitude;
        
        tmpEuler2.current.set(newOriginalEuler.x + rotationX, newOriginalEuler.y, newOriginalEuler.z + rotationZ);

        // Update position
        groupRef.current.position.copy(oscillatingPosition);

        // Blend between original rotation and oscillating target rotation using preallocated quaternions
        tmpQuat1.current.setFromEuler(newOriginalEuler);
        tmpQuat2.current.setFromEuler(tmpEuler2.current);
        tmpQuat3.current.slerpQuaternions(tmpQuat1.current, tmpQuat2.current, rotationBlendCurrent.current);
        groupRef.current.rotation.setFromQuaternion(tmpQuat3.current);

        if (groupRef.current.scale.x !== finalIdleScale) { // Ensure scale is correct for zero gravity
          groupRef.current.scale.setScalar(finalIdleScale);
        }
      } else {
        // Not in zero gravity mode
        const finalIdlePosition = isRankingMode
          ? tmpVec3.current.set(...targetPosition)
          : (externalOffsetX && externalOffsetX !== 0
              ? tmpVec2.current.set(...originalPosition).add(tmpVec1.current.set(externalOffsetX, 0, 0))
              : newOriginalVec);
        tmpEuler2.current.set(...targetRotation);
        const finalIdleRotation = isRankingMode ? tmpEuler2.current : newOriginalEuler;

        // Only update if current position is different, to avoid unnecessary writes and maintain stability
        if (!groupRef.current.position.equals(finalIdlePosition)) {
          groupRef.current.position.copy(finalIdlePosition);
        }
        if (!groupRef.current.rotation.equals(finalIdleRotation)) {
          groupRef.current.rotation.copy(finalIdleRotation);
        }
        // NEW: Apply final idle scale if different
        if (groupRef.current.scale.x !== finalIdleScale) {
          groupRef.current.scale.setScalar(finalIdleScale);
        }
        // Ensure rotation blend is reset
        rotationBlendCurrent.current = 0;
      }
      // ground marker handling moved to SceneContent (fixed at world Y)
    }
  });

  // Lightweight pointer/tap vs drag state (minimal allocations)
  const activePointerId = useRef<number | null>(null);
  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const pointerStartTime = useRef(0);
  const maxMoveDistance = useRef(0);
  const isDragging = useRef(false);
  const multiTouchCount = useRef(0);
  const pointerTypeRef = useRef<'mouse' | 'touch' | 'pen' | 'unknown'>('unknown');
  const suppressClickRef = useRef(false);

  const handlePointerDown = (e: any) => {
    try {
      // Count touches only for touch pointers
      if (e.pointerType === 'touch') {
        multiTouchCount.current += 1;
      }
      // If another pointer is active and this is not the same id, mark multitouch
      if (activePointerId.current !== null && activePointerId.current !== e.pointerId) {
        multiTouchCount.current = Math.max(2, multiTouchCount.current);
      }

      activePointerId.current = e.pointerId;
      pointerTypeRef.current = e.pointerType || 'unknown';
      pointerStartX.current = e.clientX;
      pointerStartY.current = e.clientY;
      pointerStartTime.current = performance.now();
      maxMoveDistance.current = 0;
      isDragging.current = false;
      suppressClickRef.current = false;

      // Try to capture to ensure consistent move/up events
      try {
        e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
    } catch (err) {
      // defensive: don't break rendering if event is odd
    }
  };

  const handlePointerMove = (e: any) => {
    if (activePointerId.current !== e.pointerId) return;
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;
    const dist = Math.hypot(dx, dy);
    if (dist > maxMoveDistance.current) maxMoveDistance.current = dist;

    const threshold = pointerTypeRef.current === 'touch' ? TOUCH_DISTANCE_THRESHOLD : MOUSE_DISTANCE_THRESHOLD;
    if (maxMoveDistance.current > threshold) {
      isDragging.current = true;
      suppressClickRef.current = true;
    }
  };

  const handlePointerUp = (e: any) => {
    if (activePointerId.current !== e.pointerId) {
      // If pointer up for another pointer (multi-touch), decrement count and exit
      if (e.pointerType === 'touch') multiTouchCount.current = Math.max(0, multiTouchCount.current - 1);
      return;
    }

    // Release capture
    try {
      e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId);
    } catch (err) {
      // ignore
    }

    const duration = performance.now() - pointerStartTime.current;
    const dist = maxMoveDistance.current;
    const isMulti = multiTouchCount.current > 1;
    const isTouch = pointerTypeRef.current === 'touch';

    const durThreshold = isTouch ? TOUCH_DURATION_THRESHOLD : MOUSE_DURATION_THRESHOLD;
    const distThreshold = isTouch ? TOUCH_DISTANCE_THRESHOLD : MOUSE_DISTANCE_THRESHOLD;

    const consideredTap = !isDragging.current && !isMulti && duration <= durThreshold && dist <= distThreshold;

    // If it's considered tap, we allow onClick to proceed; otherwise suppress
    suppressClickRef.current = !consideredTap;

    // cleanup
    activePointerId.current = null;
    isDragging.current = false;
    if (e.pointerType === 'touch') {
      multiTouchCount.current = Math.max(0, multiTouchCount.current - 1);
    }
  };

  const handlePointerCancel = (e: any) => {
    if (activePointerId.current === e.pointerId) {
      activePointerId.current = null;
    }
    isDragging.current = false;
    suppressClickRef.current = true;
    if (e.pointerType === 'touch') multiTouchCount.current = Math.max(0, multiTouchCount.current - 1);
  };

  const handleClick = (e: any) => {
    if (suppressClickRef.current) {
      // swallow this click
      e.stopPropagation && e.stopPropagation();
      e.preventDefault && e.preventDefault();
      return;
    }
    // forward to existing handler
    onCanvasArtworkClick && onCanvasArtworkClick(e as any);
  };

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
    >
      {children}
      {/* ground marker removed from wrapper - now rendered at scene level */}
    </group>
  );
};

export default ArtworkWrapper;