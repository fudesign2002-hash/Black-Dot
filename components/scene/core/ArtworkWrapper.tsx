
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
  onArtworkClicked: (e: React.MouseEvent<HTMLDivElement>) => void; // Pass click handler
  artworkType: ArtType; // NEW: Add artworkType prop
}

const SLIDE_DURATION = 800; // 0.8 seconds
const REVERT_DURATION = 800; // 0.8 seconds

// NEW: 彈性緩動函數 for easeOutElastic
const easeOutElastic = (t: number) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

const ArtworkWrapper: React.FC<ArtworkWrapperProps> = ({
  id,
  children,
  originalPosition,
  originalRotation,
  targetPosition,
  targetRotation,
  isRankingMode,
  onArtworkClicked,
  artworkType, // NEW: Destructure artworkType
}) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Animation state for ranking transitions
  const isAnimating = useRef(false);
  const animationStartTime = useRef(0);
  const animationState = useRef<'idle' | 'slide' | 'revert'>('idle');
  // These capture the *actual* position/rotation of the Three.js object at animation start
  const animationStartActualPosition = useRef(new THREE.Vector3()); 
  const animationStartActualRotation = useRef(new THREE.Euler());
  // NEW: Refs to store the target position/rotation for the animation
  const animationTargetActualPosition = useRef(new THREE.Vector3());
  const animationTargetActualRotation = useRef(new THREE.Euler());
  // NEW: Refs for scale animation
  const animationStartActualScale = useRef(1.0);
  const animationTargetActualScale = useRef(1.0);


  // Store the previous props to detect changes reliably
  const prevProps = useRef({
    isRankingMode: false,
    targetPosition: new THREE.Vector3(),
    targetRotation: new THREE.Euler(),
    artworkType: 'sculpture_base' as ArtType, // Initialize with a default value
  });

  // Use useEffect to trigger animations based on prop changes
  useEffect(() => {
    if (!groupRef.current) return;

    const newTargetVec = new THREE.Vector3(...targetPosition);
    const newTargetEuler = new THREE.Euler(...targetRotation);
    const newOriginalVec = new THREE.Vector3(...originalPosition);
    const newOriginalEuler = new THREE.Euler(...originalRotation);

    const isPaintingArtwork = artworkType.startsWith('canvas_');
    const newTargetScale = (isRankingMode && isPaintingArtwork) ? 0.8 : 1.0; // NEW: Calculate target scale

    // Get previous states from ref
    const { isRankingMode: prevIsRankingModeValue, targetPosition: prevTargetPositionValue, targetRotation: prevTargetRotationValue, artworkType: prevArtworkType } = prevProps.current;

    // Track if animation needs to be triggered
    let shouldAnimate = false;
    let newAnimationState: 'idle' | 'slide' | 'revert' = 'idle';
    let animStartPos = new THREE.Vector3();
    let animStartRot = new THREE.Euler();
    let animStartScale = 1.0; // NEW
    let animTargetPos = new THREE.Vector3();
    let animTargetRot = new THREE.Euler();
    let animTargetScale = 1.0; // NEW


    // --- Entering Ranking Mode ---
    if (isRankingMode && !prevIsRankingModeValue) {
      // When entering, we *always* want to animate from the original position
      // to the new ranked position.
      // Crucially, immediately set the current Three.js object's properties to the original state
      // to ensure the animation starts correctly from there without a snap/flicker.
      groupRef.current.position.copy(newOriginalVec);
      groupRef.current.rotation.copy(newOriginalEuler);
      groupRef.current.scale.setScalar(1.0); // Ensure scale starts at 1.0 (original size)

      shouldAnimate = true;
      newAnimationState = 'slide';
      animStartPos.copy(newOriginalVec); // Animation starts from original position
      animStartRot.copy(newOriginalEuler); // Animation starts from original rotation
      animStartScale = 1.0; // Animation starts from original scale

      animTargetPos.copy(newTargetVec); // Animation targets the ranked position
      animTargetRot.copy(newTargetEuler); // Animation targets the ranked rotation
      animTargetScale = newTargetScale; // Animation targets the new scaled size
    }
    // --- Exiting Ranking Mode ---
    else if (!isRankingMode && prevIsRankingModeValue) {
      // When exiting, animate from the current (ranked) position back to the original.
      shouldAnimate = true;
      newAnimationState = 'revert';
      animStartPos.copy(groupRef.current.position); // Animation starts from current actual position (should be ranked)
      animStartRot.copy(groupRef.current.rotation); // Animation starts from current actual rotation
      animStartScale = groupRef.current.scale.x; // Animation starts from current actual scale

      animTargetPos.copy(newOriginalVec); // Animation targets the original position
      animTargetRot.copy(newOriginalEuler); // Animation targets the original rotation
      animTargetScale = 1.0; // Animation targets original scale (1.0)
    }
    // --- Re-ranking (target position/rotation/scale changes while already in ranking mode) ---
    else if (isRankingMode && prevIsRankingModeValue) {
      const prevTargetScale = (prevIsRankingModeValue && prevArtworkType.startsWith('canvas_')) ? 0.8 : 1.0; // Get previous target scale

      // If already in ranking mode and targets change, animate from current position to new target.
      if (!prevTargetPositionValue.equals(newTargetVec) || !prevTargetRotationValue.equals(newTargetEuler) || prevTargetScale !== newTargetScale) {
        shouldAnimate = true;
        newAnimationState = 'slide';
        animStartPos.copy(groupRef.current.position); // Start from current actual position
        animStartRot.copy(groupRef.current.rotation); // Start from current actual rotation
        animStartScale = groupRef.current.scale.x; // Start from current actual scale

        animTargetPos.copy(newTargetVec); // Target the new ranked position
        animTargetRot.copy(newTargetEuler); // Target the new ranked rotation
        animTargetScale = newTargetScale; // Target the new scaled size
      }
    }

    if (shouldAnimate) {
      animationState.current = newAnimationState;
      animationStartTime.current = performance.now();
      animationStartActualPosition.current.copy(animStartPos);
      animationStartActualRotation.current.copy(animStartRot);
      animationStartActualScale.current = animStartScale; // NEW
      animationTargetActualPosition.current.copy(animTargetPos);
      animationTargetActualRotation.current.copy(animTargetRot);
      animationTargetActualScale.current = animTargetScale; // NEW
      isAnimating.current = true;
    } else {
      // Only reset animation state and snap if no animation is currently in progress.
      // If an animation IS in progress, it means it was triggered by a previous useEffect call,
      // and we should let it run its course via useFrame.
      if (!isAnimating.current) {
        animationState.current = 'idle';
        // Ensure it's correctly positioned and scaled immediately if no animation is needed
        const finalSnapPosition = isRankingMode ? newTargetVec : newOriginalVec;
        const finalSnapRotation = isRankingMode ? newTargetEuler : newOriginalEuler;
        const finalSnapScale = newTargetScale; // Use newTargetScale as the final idle scale for the current mode

        groupRef.current.position.copy(finalSnapPosition);
        groupRef.current.rotation.copy(finalSnapRotation);
        groupRef.current.scale.setScalar(finalSnapScale); // NEW
      }
    }


    // Update previous props for next effect run
    prevProps.current = {
      isRankingMode,
      targetPosition: newTargetVec,
      targetRotation: newTargetEuler,
      artworkType, // Store current artworkType
    };

  }, [id, isRankingMode, targetPosition, targetRotation, originalPosition, originalRotation, artworkType]); // Add artworkType to deps

  // Main animation loop
  useFrame(() => {
    if (!groupRef.current) return;

    // Perform interpolation if animating
    if (isAnimating.current) {
      const elapsed = performance.now() - animationStartTime.current;
      let t;
      let duration;
      let startVec = animationStartActualPosition.current;
      let targetVec = animationTargetActualPosition.current;
      let startEuler = animationStartActualRotation.current;
      let targetEuler = animationTargetActualRotation.current;
      let startScale = animationStartActualScale.current; // NEW
      let targetScale = animationTargetActualScale.current; // NEW


      if (animationState.current === 'slide') {
        duration = SLIDE_DURATION;
      } else if (animationState.current === 'revert') {
        duration = REVERT_DURATION;
      } else {
        // Fallback: If isAnimating.current is true but animationState.current is idle, reset
        isAnimating.current = false;
        animationState.current = 'idle';
        // Directly set to final state for robustness
        groupRef.current.position.copy(targetVec);
        groupRef.current.rotation.copy(targetEuler);
        groupRef.current.scale.setScalar(targetScale); // NEW
        return;
      }

      t = Math.min(1, elapsed / duration);
      // MODIFIED: Apply easeOutElastic for 'slide' animation, keep ease-in-out for 'revert'
      const easedT = easeOutElastic(t);

      groupRef.current.position.lerpVectors(startVec, targetVec, easedT);

      const startQ = new THREE.Quaternion().setFromEuler(startEuler);
      const targetQ = new THREE.Quaternion().setFromEuler(targetEuler);
      const interpolatedQ = new THREE.Quaternion();
      interpolatedQ.slerpQuaternions(startQ, targetQ, easedT);
      groupRef.current.rotation.setFromQuaternion(interpolatedQ);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(startScale, targetScale, easedT)); // NEW: Lerp scale

      if (t === 1) {
        isAnimating.current = false;
        animationState.current = 'idle';
        // Ensure final position/rotation is exactly the target
        groupRef.current.position.copy(targetVec);
        groupRef.current.rotation.copy(targetEuler);
        groupRef.current.scale.setScalar(targetScale); // NEW
      }
    } else {
      // If NOT animating (and not in an active transition),
      // ensure the object is at its expected static position based on `isRankingMode`.
      const finalIdlePosition = isRankingMode ? new THREE.Vector3(...targetPosition) : new THREE.Vector3(...originalPosition);
      const finalIdleRotation = isRankingMode ? new THREE.Euler(...targetRotation) : new THREE.Euler(...originalRotation);
      const isPaintingArtwork = artworkType.startsWith('canvas_'); // NEW
      const finalIdleScale = (isRankingMode && isPaintingArtwork) ? 0.8 : 1.0; // NEW

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
    }
  });

  return (
    <group ref={groupRef} onClick={onArtworkClicked}>
      {children}
    </group>
  );
};

export default ArtworkWrapper;