import React from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SceneContent from './core/SceneContent';
import { SimplifiedLightingConfig, ExhibitionArtItem, Exhibition, ArtType } from '../../types';

export interface SceneProps {
  lightingConfig: SimplifiedLightingConfig;
  artworks: ExhibitionArtItem[];
  isEditorOpen: boolean;
  isEditorMode: boolean;
  selectedArtworkId: string | null;
  onSelectArtwork: (id: string | null) => void;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  activeEditorTab: 'lighting' | 'layout' | 'artworks' | 'admin';
  focusedArtworkInstanceId: string | null;
  setFps: (fps: number) => void;
  hasMotionArtwork: boolean;
  uiConfig: any;
  setFocusedArtworkInstanceId: (id: string | null) => void;
  activeExhibition: Exhibition;
  onInfoOpen: () => void;
  cameraControlRef: React.Ref<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    moveCameraToPrevious: () => void;
    moveCameraToInitial: () => void;
  }>;
  onArtworkClicked: (e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
  isDebugMode: boolean;
  triggerHeartEmitter: number;
  heartEmitterArtworkId: string | null;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  isRankingMode: boolean;
}

const Scene: React.FC<SceneProps> = (props) => {
  return (
    <Canvas
      shadows
      camera={{ position: [-8, 6, 25], fov: 45 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      // FIX: Removed incorrect type assertion, onClick should be MouseEventHandler<HTMLCanvasElement>
      onClick={props.onCanvasClick}
    >
      <SceneContent {...props} />
    </Canvas>
  );
};

export default Scene;