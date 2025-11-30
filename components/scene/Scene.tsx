import React from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SceneContent from './core/SceneContent';
import { SimplifiedLightingConfig, ExhibitionArtItem } from '../../types';

export interface SceneProps {
  lightingConfig: SimplifiedLightingConfig;
  resetTrigger: number;
  currentZoneTheme: 'geometry' | 'gallery' | 'vibrant' | 'glass' | 'empty';
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
    >
      <SceneContent {...props} />
    </Canvas>
  );
};

export default Scene;