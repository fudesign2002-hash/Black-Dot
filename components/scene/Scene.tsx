

import React from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SceneContent from './core/SceneContent';
import { SimplifiedLightingConfig, ExhibitionArtItem, Exhibition, ArtType, EffectRegistryType } from '../../types';

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
  activeEditorTab: 'lighting' | 'scene' | 'layout' | 'artworks' | 'admin';
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
    moveCameraToInitial: (customCameraPosition?: [number, number, number]) => void;  // NEW
    moveCameraToRankingMode: (position: [number, number, number], target: [number, number, number]) => void; // NEW
  }>;
  onArtworkClicked: (e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void; // MODIFIED: Add artworkInstanceId and isMotionVideo
  isDebugMode: boolean; // NEW: Add isDebugMode prop
  // REMOVED: onCameraInteraction?: () => void; // NEW: Add onCameraInteraction prop
  triggerHeartEmitter: number; // NEW
  heartEmitterArtworkId: string | null; // NEW
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void; // NEW: Add onCanvasClick prop
  isRankingMode: boolean; // NEW: Add isRankingMode prop
  isZeroGravityMode: boolean; // NEW: Add isZeroGravityMode prop
  // FIX: Add isSmallScreen prop to SceneProps
  isSmallScreen: boolean;
  onCameraPositionChange: (isAtDefault: boolean) => void; // NEW: Add onCameraPositionChange prop
  rankingCameraPosition?: [number, number, number]; // NEW
  rankingCameraTarget?: [number, number, number];   // NEW
  useExhibitionBackground: boolean; // NEW: Add useExhibitionBackground
  // FIX: 新增 activeEffectName 屬性
  activeEffectName: string | null; 
  effectRegistry: EffectRegistryType | null; // NEW: Add effectRegistry
  zoneGravity: number | undefined; // NEW: Add zoneGravity prop
  isEffectRegistryLoading: boolean; // NEW: Add isEffectRegistryLoading prop
}

const Scene: React.FC<SceneProps> = (props) => {
  return (
    <Canvas
      shadows
      gl={{
        // FIX: 更正 'antial.ias' 為 'antialias'
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace, // Set output color space to sRGB
      }}
      // FIX: Cast onClick handler to any to bypass incorrect type inference due to environment-specific type definition issues.
      onClick={props.onCanvasClick as any}
    >
      <SceneContent {...props} />
    </Canvas>
  );
};

export default Scene;
