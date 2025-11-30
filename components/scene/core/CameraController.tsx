import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import { ExhibitionArtItem } from '../../../types';

const INITIAL_CAMERA_POSITION: [number, number, number] = [8, -10, 25];
const INITIAL_CAMERA_TARGET: [number, number, number] = [0, 1, 0];

const ARTWORK_FOCUS_CAMERA_DISTANCE_Z = 7;
const ARTWORK_FOCUS_CAMERA_HEIGHT_Y = 3;
const ARTWORK_FOCUS_CAMERA_SHIFT_X = 4;

const CameraController: React.FC<{ 
  isEditorOpen: boolean; 
  resetTrigger: number;
  focusedArtworkInstanceId: string | null;
  artworks: ExhibitionArtItem[];
  isEditorMode: boolean;
  activeEditorTab: 'lighting' | 'layout' | 'artworks' | 'admin'; 
}> = React.memo(({ isEditorOpen, resetTrigger, focusedArtworkInstanceId, artworks, isEditorMode, activeEditorTab }) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const [mouseButtons, setMouseButtons] = useState({
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  });

  const targetCameraPosition = useRef<THREE.Vector3 | null>(null);
  const targetCameraLookAt = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.set(...INITIAL_CAMERA_POSITION);
      controlsRef.current.target.set(...INITIAL_CAMERA_TARGET);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (resetTrigger > 0 && controlsRef.current) {
      camera.position.set(...INITIAL_CAMERA_POSITION);
      controlsRef.current.target.set(...INITIAL_CAMERA_TARGET);
      controlsRef.current.update();
      targetCameraPosition.current = null;
      targetCameraLookAt.current = null;
    }
  }, [resetTrigger, camera]);
  
  useEffect(() => {
    if (isEditorMode && activeEditorTab === 'artworks' && focusedArtworkInstanceId && artworks.length > 0) {
        const targetArtwork = artworks.find(art => art.id === focusedArtworkInstanceId);
        if (targetArtwork && controlsRef.current) {
            const artworkWorldPosition = new THREE.Vector3(...targetArtwork.position);
            
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
    if (targetCameraPosition.current && targetCameraLookAt.current && controlsRef.current) {
        const lerpFactor = delta * 3;
        
        camera.position.lerp(targetCameraPosition.current, lerpFactor);
        controlsRef.current.target.lerp(targetCameraLookAt.current, lerpFactor);
        controlsRef.current.update();

        
    } else {
        
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
            target={INITIAL_CAMERA_TARGET}
            enabled={!isEditorOpen}
      />
  );
});
CameraController.displayName = 'CameraController';

export default CameraController;