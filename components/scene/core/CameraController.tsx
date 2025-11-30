import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { ExhibitionArtItem } from '../../../types'; // NEW: Import ExhibitionArtItem

const INITIAL_CAMERA_POSITION: [number, number, number] = [8, -10, 25];
const INITIAL_CAMERA_TARGET: [number, number, number] = [0, 1, 0];

// NEW: Define constants for artwork focus camera position
const ARTWORK_FOCUS_CAMERA_DISTANCE_Z = 7;   // How far back from the artwork (in Z)
const ARTWORK_FOCUS_CAMERA_HEIGHT_Y = 3;     // How high above the artwork's center (in Y)
const ARTWORK_FOCUS_CAMERA_SHIFT_X = 4;      // How much to shift camera to the right (in X) for artwork to appear on left of screen

const CameraController: React.FC<{ 
  isEditorOpen: boolean; 
  resetTrigger: number;
  focusedArtworkInstanceId: string | null; // NEW: Add focusedArtworkInstanceId
  artworks: ExhibitionArtItem[]; // NEW: Add artworks prop
  isEditorMode: boolean; // NEW: Add isEditorMode
  // FIX: Updated activeEditorTab prop type to include 'admin'
  activeEditorTab: 'lighting' | 'layout' | 'artworks' | 'admin'; 
}> = React.memo(({ isEditorOpen, resetTrigger, focusedArtworkInstanceId, artworks, isEditorMode, activeEditorTab }) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const [mouseButtons, setMouseButtons] = useState({
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  });

  // NEW: Refs for target camera position and look-at point for smooth animation
  const targetCameraPosition = useRef<THREE.Vector3 | null>(null);
  const targetCameraLookAt = useRef<THREE.Vector3 | null>(null);

  // Set initial camera position and target when component mounts (instantaneous)
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(...INITIAL_CAMERA_POSITION);
      controlsRef.current.target.set(...INITIAL_CAMERA_TARGET);
      controlsRef.current.update();
    }
  }, []);

  // Handle reset trigger: instantly set camera to initial position and target
  useEffect(() => {
    if (resetTrigger > 0 && controlsRef.current) {
      camera.position.set(...INITIAL_CAMERA_POSITION);
      controlsRef.current.target.set(...INITIAL_CAMERA_TARGET);
      controlsRef.current.update();
      targetCameraPosition.current = null; // Clear animation target
      targetCameraLookAt.current = null; // Clear animation target
    }
  }, [resetTrigger, camera]);
  
  // NEW: Effect for camera focus on a specific artwork
  useEffect(() => {
    if (isEditorMode && activeEditorTab === 'artworks' && focusedArtworkInstanceId && artworks.length > 0) {
        const targetArtwork = artworks.find(art => art.id === focusedArtworkInstanceId);
        if (targetArtwork && controlsRef.current) {
            const artworkWorldPosition = new THREE.Vector3(...targetArtwork.position);
            
            // Calculate a fixed offset for the camera position relative to the artwork's world position
            const cameraOffsetFromArtwork = new THREE.Vector3(
              ARTWORK_FOCUS_CAMERA_SHIFT_X,
              ARTWORK_FOCUS_CAMERA_HEIGHT_Y,
              ARTWORK_FOCUS_CAMERA_DISTANCE_Z
            );
            
            const newCameraPosition = artworkWorldPosition.clone().add(cameraOffsetFromArtwork);
            
            targetCameraPosition.current = newCameraPosition;
            targetCameraLookAt.current = artworkWorldPosition;
        }
    } else {
        // If not in editor mode, not on artworks tab, or no focused ID, clear target
        targetCameraPosition.current = null;
        targetCameraLookAt.current = null;
    }
  }, [focusedArtworkInstanceId, artworks, isEditorMode, activeEditorTab]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        document.body.style.cursor = 'grab';
        setMouseButtons(prev => ({ ...prev, LEFT: THREE.MOUSE.PAN }));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        document.body.style.cursor = 'auto';
        setMouseButtons(prev => ({ ...prev, LEFT: THREE.MOUSE.ROTATE }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.body.style.cursor = 'auto';
    };
  }, []);
  
  useFrame((state, delta) => {
    // Smoothly animate camera to target position and look-at if set
    if (targetCameraPosition.current && targetCameraLookAt.current && controlsRef.current) {
        const lerpFactor = delta * 3; // Adjust lerp factor for animation speed
        
        camera.position.lerp(targetCameraPosition.current, lerpFactor);
        controlsRef.current.target.lerp(targetCameraLookAt.current, lerpFactor);
        controlsRef.current.update();

        // Optional: Stop lerping once close enough to save CPU
        if (camera.position.distanceTo(targetCameraPosition.current) < 0.1 && 
            controlsRef.current.target.distanceTo(targetCameraLookAt.current) < 0.1) {
            // No need to null out, it's fine for the camera to stay there while focused
        }
    } else {
        // Always update controls for user interaction when not animating to a target
        controlsRef.current?.update();
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
            minDistance={15} 
            maxDistance={60}
            target={INITIAL_CAMERA_TARGET} // Explicitly set target
            enabled={!isEditorOpen}
      />
  );
});
CameraController.displayName = 'CameraController';

export default CameraController;