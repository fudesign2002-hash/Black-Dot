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
}

const SLIDE_DURATION = 600; // 0.8 seconds
const REVERT_DURATION = 600; // 0.8 seconds
const ZERO_GRAVITY_DURATION = 800; // NEW: Duration for zero gravity animation
// Removed ROTATION_BLEND_DURATION as rotation blend now happens over main animation duration

// NEW: 彈性緩動函數 for easeOutElastic
const easeOutElastic = (t: number) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -7 * t) * Math.sin((t * 7 - 0.75) * c4) + 1;
};

// NEW: 平滑緩動函數 for easeInOutSine
const easeInOutSine = (t: number) => {
  return -(Math.cos(Math.PI * t) - 1) / 2;
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
const MAX_BASE_FLOAT_Y = 10; // Max Y offset from original position for zoneGravity=0
const MIN_BASE_FLOAT_Y = 2;   // Min Y offset from original position for zoneGravity=100

const ARTWORK_GRAVITY_MAX_UP_ADJUSTMENT = 1.5; // Max additional Y offset from artworkGravity=0
const ARTWORK_GRAVITY_MAX_DOWN_ADJUSTMENT = -1.5; // Max reduction in Y offset from artworkGravity=100

// NEW: Global offset to lower all artworks in zero gravity mode
const ZERO_GRAVITY_GLOBAL_LOWER_OFFSET = -1; 

// NEW: Constants for dynamic angular amplitude mapping
const MIN_Y_OFFSET_FOR_AMPLITUDE_MAP = 0; // Lower bound of artwork's floating height for mapping
const MAX_Y_OFFSET_FOR_AMPLITUDE_MAP = 10; // Upper bound of artwork's floating height for mapping
const MIN_ANGULAR_AMPLITUDE = 0.005; // Minimum angular amplitude (radians)
const MAX_ANGULAR_AMPLITUDE = 0.05;  // Maximum angular amplitude (radians)


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
}) => {
  const groupRef = useRef<THREE.Group>(null);
  
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
    let zeroGravityBaseYOffset = 0;
    const effectiveZoneGravity = zoneGravity ?? 50; // Default zone gravity to 50 if undefined
    const effectiveArtworkGravity = artworkGravity ?? 50; // Default artwork gravity to 50 if undefined

    // Zone gravity sets a base range (e.g., from MAX_BASE_FLOAT_Y units up to MIN_BASE_FLOAT_Y units up)
    const zoneFloatOffset = mapRange(effectiveZoneGravity, 0, 100, MAX_BASE_FLOAT_Y, MIN_BASE_FLOAT_Y);
    // Artwork gravity fine-tunes this offset (e.g., +/- ARTWORK_GRAVITY_MAX_UP_ADJUSTMENT units around zoneFloatOffset)
    const artworkFloatAdjustment = mapRange(effectiveArtworkGravity, 0, 100, ARTWORK_GRAVITY_MAX_UP_ADJUSTMENT, ARTWORK_GRAVITY_MAX_DOWN_ADJUSTMENT);
    zeroGravityBaseYOffset = zoneFloatOffset + artworkFloatAdjustment;
    // NEW: Apply global lower offset
    zeroGravityBaseYOffset += ZERO_GRAVITY_GLOBAL_LOWER_OFFSET;


    const zeroGravityTargetPositionBase = new THREE.Vector3(newOriginalVec.x, newOriginalVec.y + zeroGravityBaseYOffset, newOriginalVec.z);


    // Get previous states from ref
    // MODIFIED: Include prevIsZeroGravityModeValue, prevZoneGravity, and prevArtworkGravity
    const { isRankingMode: prevIsRankingModeValue, isZeroGravityMode: prevIsZeroGravityModeValue, targetPosition: prevTargetPositionValue, targetRotation: prevTargetRotationValue, artworkType: prevArtworkType, zoneGravity: prevZoneGravity, artworkGravity: prevArtworkGravity } = prevProps.current;

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
        // MODIFIED: Determine final snap position based on active mode
        const finalSnapPosition = isRankingMode ? newTargetVec : (isZeroGravityMode ? zeroGravityTargetPositionBase : newOriginalVec);
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
    };

  }, [id, isRankingMode, isZeroGravityMode, targetPosition, targetRotation, originalPosition, originalRotation, artworkType, zoneGravity, artworkGravity]); // MODIFIED: Add isZeroGravityMode, zoneGravity, artworkGravity to deps

  // Main animation loop
  useFrame(() => {
    if (!groupRef.current) return;

    // NEW: Recalculate zeroGravityBaseYOffset on each frame if needed (though it's derived from props, which change less often)
    // For useFrame, we just need the *current* base Y offset for oscillation.
    const newOriginalVec = new THREE.Vector3(...originalPosition);
    const newOriginalEuler = new THREE.Euler(...originalRotation);

    const effectiveZoneGravity = zoneGravity ?? 50; // Default zone gravity to 50 if undefined
    const effectiveArtworkGravity = artworkGravity ?? 50; // Default artwork gravity to 50 if undefined

    const zoneFloatOffset = mapRange(effectiveZoneGravity, 0, 100, MAX_BASE_FLOAT_Y, MIN_BASE_FLOAT_Y);
    const artworkFloatAdjustment = mapRange(effectiveArtworkGravity, 0, 100, ARTWORK_GRAVITY_MAX_UP_ADJUSTMENT, ARTWORK_GRAVITY_MAX_DOWN_ADJUSTMENT);
    let zeroGravityBaseYOffset = zoneFloatOffset + artworkFloatAdjustment;
    // NEW: Apply global lower offset during oscillation
    zeroGravityBaseYOffset += ZERO_GRAVITY_GLOBAL_LOWER_OFFSET;


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
      } else {
        easedT = easeOutElastic(t); // Use elastic for descending (exiting zero gravity, or ranking mode transitions)
      }
      
      groupRef.current.position.lerpVectors(startVec, targetVec, easedT);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(startScale, targetScale, easedT)); 

      // NEW: Rotation handling for zeroGravity and revert animations
      if (animationState.current === 'zeroGravity') {
        // When entering zero gravity, blend from start rotation to the oscillating rotation
        const time = performance.now() * 0.001;
        
        const dynamicRotationAmplitude = mapRange(
          zeroGravityBaseYOffset,
          MIN_Y_OFFSET_FOR_AMPLITUDE_MAP,
          MAX_Y_OFFSET_FOR_AMPLITUDE_MAP,
          MIN_ANGULAR_AMPLITUDE,
          MAX_ANGULAR_AMPLITUDE
        );

        const rotationX = Math.sin(time * ROTATION_SPEED_X + oscillationState.current.phaseX) * dynamicRotationAmplitude;
        const rotationZ = Math.sin(time * ROTATION_SPEED_Z + oscillationState.current.phaseZ) * dynamicRotationAmplitude;

        const oscillatingRotationTarget = new THREE.Euler(
          newOriginalEuler.x + rotationX,
          newOriginalEuler.y, // Maintain original Y rotation
          newOriginalEuler.z + rotationZ
        );

        // Blend `startEuler` (current rotation before animation) towards `oscillatingRotationTarget`
        const qStart = new THREE.Quaternion().setFromEuler(startEuler);
        const qOscillating = new THREE.Quaternion().setFromEuler(oscillatingRotationTarget);
        const qBlended = new THREE.Quaternion();
        qBlended.slerpQuaternions(qStart, qOscillating, easedT); // Use easedT to blend
        groupRef.current.rotation.setFromQuaternion(qBlended);

        rotationBlendCurrent.current = easedT; // Keep rotationBlendCurrent updated with easedT
      } else if (animationState.current === 'revert' && prevProps.current.isZeroGravityMode) {
        // When exiting zero gravity, blend from current oscillating rotation towards `newOriginalEuler`
        // `startEuler` here contains the *last* oscillating rotation from before the revert animation began.
        const qStart = new THREE.Quaternion().setFromEuler(startEuler);
        const qOriginal = new THREE.Quaternion().setFromEuler(newOriginalEuler);
        const qBlended = new THREE.Quaternion();
        qBlended.slerpQuaternions(qStart, qOriginal, easedT); // Use easedT to blend back to original
        groupRef.current.rotation.setFromQuaternion(qBlended);

        rotationBlendCurrent.current = 1 - easedT; // Blend factor goes from 1 to 0
      } else {
        // For other animations (slide, revert from ranking), just slerp between start and target
        const startQ = new THREE.Quaternion().setFromEuler(startEuler);
        const targetQ = new THREE.Quaternion().setFromEuler(targetEuler);
        const interpolatedQ = new THREE.Quaternion();
        interpolatedQ.slerpQuaternions(startQ, targetQ, easedT);
        groupRef.current.rotation.setFromQuaternion(interpolatedQ);
        rotationBlendCurrent.current = 0; // Reset for these modes
      }


      if (t === 1) {
        isAnimating.current = false;
        animationState.current = 'idle';
        // Ensure final position/rotation is exactly the target
        groupRef.current.position.copy(targetVec);
        // For zeroGravity, the final rotation target *is* the oscillating state
        if (prevProps.current.isZeroGravityMode) { // Check prevProps to see what mode just ended
          const time = performance.now() * 0.001; // Current time for final oscillation position
          const dynamicRotationAmplitude = mapRange(
            zeroGravityBaseYOffset,
            MIN_Y_OFFSET_FOR_AMPLITUDE_MAP,
            MAX_Y_OFFSET_FOR_AMPLITUDE_MAP,
            MIN_ANGULAR_AMPLITUDE,
            MAX_ANGULAR_AMPLITUDE
          );
          const rotationX = Math.sin(time * ROTATION_SPEED_X + oscillationState.current.phaseX) * dynamicRotationAmplitude;
          const rotationZ = Math.sin(time * ROTATION_SPEED_Z + oscillationState.current.phaseZ) * dynamicRotationAmplitude;
          groupRef.current.rotation.set(newOriginalEuler.x + rotationX, newOriginalEuler.y, newOriginalEuler.z + rotationZ);
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
        const dynamicRotationAmplitude = mapRange(
          zeroGravityBaseYOffset,
          MIN_Y_OFFSET_FOR_AMPLITUDE_MAP,
          MAX_Y_OFFSET_FOR_AMPLITUDE_MAP,
          MIN_ANGULAR_AMPLITUDE,
          MAX_ANGULAR_AMPLITUDE
        );

        // Y-oscillation
        const currentYOffset = zeroGravityBaseYOffset + Math.sin(time * FLOAT_SPEED_Y + oscillationState.current.phaseY) * oscillationState.current.amplitudeY;
        const oscillatingPosition = new THREE.Vector3(newOriginalVec.x, newOriginalVec.y + currentYOffset, newOriginalVec.z);
        
        // X-rotation oscillation
        const rotationX = Math.sin(time * ROTATION_SPEED_X + oscillationState.current.phaseX) * dynamicRotationAmplitude;
        // Z-rotation oscillation
        const rotationZ = Math.sin(time * ROTATION_SPEED_Z + oscillationState.current.phaseZ) * dynamicRotationAmplitude;
        
        // Target oscillating rotation
        const oscillatingRotationTarget = new THREE.Euler(
          newOriginalEuler.x + rotationX,
          newOriginalEuler.y, // Maintain original Y rotation
          newOriginalEuler.z + rotationZ
        );

        // Update position
        groupRef.current.position.copy(oscillatingPosition);

        // Blend between original rotation and oscillating target rotation
        const qOriginal = new THREE.Quaternion().setFromEuler(newOriginalEuler);
        const qOscillating = new THREE.Quaternion().setFromEuler(oscillatingRotationTarget);
        const qBlended = new THREE.Quaternion();
        qBlended.slerpQuaternions(qOriginal, qOscillating, rotationBlendCurrent.current); // Use current blend factor (should be 1 here)
        groupRef.current.rotation.setFromQuaternion(qBlended);

        if (groupRef.current.scale.x !== finalIdleScale) { // Ensure scale is correct for zero gravity
          groupRef.current.scale.setScalar(finalIdleScale);
        }
      } else {
        // Not in zero gravity mode
        const finalIdlePosition = isRankingMode ? new THREE.Vector3(...targetPosition) : newOriginalVec;
        const finalIdleRotation = isRankingMode ? new THREE.Euler(...targetRotation) : newOriginalEuler;

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
    }
  });

  return (
    <group ref={groupRef} onClick={onCanvasArtworkClick}>
      {children}
    </group>
  );
};

export default ArtworkWrapper;