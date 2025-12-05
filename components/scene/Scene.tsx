

import React from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SceneContent from './core/SceneContent';
import { SimplifiedLightingConfig, ExhibitionArtItem, Exhibition, ArtType } from '../../types'; // NEW: Import Exhibition, ArtType

export interface SceneProps {
  lightingConfig: SimplifiedLightingConfig;
  // REMOVED: resetTrigger: number;
  artworks: ExhibitionArtItem[];
  isEditorOpen: boolean;
  isEditorMode: boolean;
  selectedArtworkId: string | null;
  onSelectArtwork: (id: string | null) => void;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  // FIX: Updated activeEditorTab prop type to include 'admin'
  activeEditorTab: 'lighting' | 'layout' | 'artworks' | 'admin';
  // FIX: Added focusedArtworkInstanceId prop to SceneProps
  focusedArtworkInstanceId: string | null;
  setFps: (fps: number) => void; // NEW: Add setFps prop
  hasMotionArtwork: boolean;
  // NEW PROPS for ArtworkFocusControls
  uiConfig: any;
  setFocusedArtworkInstanceId: (id: string | null) => void;
  activeExhibition: Exhibition;
  onInfoOpen: () => void;
  // FIX: Updated cameraControlRef and onArtworkClicked props to include artworkType
  cameraControlRef: React.Ref<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    moveCameraToPrevious: () => void; // NEW
    moveCameraToInitial: () => void;  // NEW
  }>;
  onArtworkClicked: (e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void; // MODIFIED: Add artworkInstanceId and isMotionVideo
  isDebugMode: boolean; // NEW: Add isDebugMode prop
  // REMOVED: onCameraInteraction?: () => void; // NEW: Add onCameraInteraction prop
  triggerHeartEmitter: number; // NEW
  heartEmitterArtworkId: string | null; // NEW
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void; // NEW: Add onCanvasClick prop
  isRankingMode: boolean; // NEW: Add isRankingMode prop
}

const Scene: React.FC<SceneProps> = (props) => {
  return (
    <Canvas
      shadows
      camera={{ position: [-8, 6, 25], fov: 45 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace, // Set output color space to sRGB
      }}
      onClick={props.onCanvasClick as React.MouseEventHandler<HTMLCanvasElement>} // NEW: Add global click handler for the canvas
    >
      <SceneContent {...props} />
    </Canvas>
  );
};

export default Scene;