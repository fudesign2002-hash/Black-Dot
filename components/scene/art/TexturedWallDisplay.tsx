import React, { useMemo, useState, useEffect, Suspense, useRef } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ArtworkDimensions } from '../../../types';

interface TexturedWallDisplayProps {
  textureUrl?: string;
  maxDimension?: number;
  orientation?: 'portrait' | 'landscape' | 'square';
  aspectRatio?: number;
  isPainting?: boolean;
  onDimensionsCalculated?: (width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => void;
  isFocused: boolean;
  lightsOn: boolean;
}

const TexturedWallDisplay: React.FC<TexturedWallDisplayProps> = ({ textureUrl, maxDimension = 5.0, orientation, aspectRatio, isPainting, onDimensionsCalculated, isFocused, lightsOn }) => {
  const [isLoadingError, setIsLoadingError] = useState(false);
  

  const loadedTexture = useLoader(THREE.TextureLoader, textureUrl || '', 
    (loader) => {
      loader.crossOrigin = 'anonymous';
    },
    (errorEvent) => {
      console.error(`[TexturedWallDisplay] Texture loading error for URL: ${textureUrl}`, errorEvent);
      setIsLoadingError(true);
    }
  );

  useEffect(() => {
    setIsLoadingError(false);
  }, [textureUrl]);

  const MAX_ART_DIMENSION = maxDimension;
  const WALL_BORDER_WIDTH = 1.0;
  const ARTWORK_MAT_WIDTH = 0.25;
  const FRAME_VISUAL_DEPTH = 0.1;
  const ARTWORK_RECESS_INTO_FRAME = 0.02;
  const MIN_WALL_HEIGHT = 2.0; 
  const MIN_WALL_WIDTH = 2.0;

  const artworkFrameDepth = isPainting ? 0 : FRAME_VISUAL_DEPTH;

  const [artDims, wallDims] = useMemo((): [[number, number], [number, number]] => {
    let calculatedAspect = 1;

    if (aspectRatio !== undefined && aspectRatio !== null) {
      calculatedAspect = aspectRatio;
    } 
    else if (textureUrl && loadedTexture && (loadedTexture.image as HTMLImageElement)?.width && (loadedTexture.image as HTMLImageElement)?.height) {
      calculatedAspect = (loadedTexture.image as HTMLImageElement).width / (loadedTexture.image as HTMLImageElement).height;
    } 
    else if (orientation) {
      switch(orientation) {
          case 'portrait':
              calculatedAspect = 3 / 4;
              break;
          case 'landscape':
              calculatedAspect = 16 / 9;
              break;
          case 'square':
          default:
              calculatedAspect = 1;
              break;
      }
    }

    let artWidth, artHeight;
    if (calculatedAspect >= 1) {
      artWidth = MAX_ART_DIMENSION;
      artHeight = artWidth / calculatedAspect;
    } else {
      artHeight = MAX_ART_DIMENSION;
      artWidth = artHeight * calculatedAspect;
    }
    
    const desiredWallWidth = artWidth + (ARTWORK_MAT_WIDTH * 2) + (WALL_BORDER_WIDTH * 2);
    const desiredWallHeight = artHeight + (ARTWORK_MAT_WIDTH * 2) + (WALL_BORDER_WIDTH * 2);

    const finalWallWidth = Math.max(MIN_WALL_WIDTH, desiredWallWidth);
    const finalWallHeight = Math.max(MIN_WALL_HEIGHT, desiredWallHeight);

    const wallBackingDepth = 0.4;
    const artGroupY = finalWallHeight * 0.55;
    const artSurfaceZ = wallBackingDepth + artworkFrameDepth - ARTWORK_RECESS_INTO_FRAME;

    if (onDimensionsCalculated) {
      onDimensionsCalculated(artWidth, artHeight, artSurfaceZ, artGroupY);
    }
    
    return [
        [artWidth, artHeight],
        [finalWallWidth, finalWallHeight]
    ];
  }, [aspectRatio, loadedTexture, MAX_ART_DIMENSION, orientation, textureUrl, isPainting, onDimensionsCalculated]);

  const [artWidth, artHeight] = artDims;
  const [wallWidth, wallHeight] = wallDims;

  const matWidth = artWidth + ARTWORK_MAT_WIDTH * 2;
  const matHeight = artHeight + ARTWORK_MAT_WIDTH * 2;
  const matDepth = artworkFrameDepth;

  const artGroupY = wallHeight * 0.55;
  const wallBackingDepth = 0.4;

  const PAINTING_RED_PLANE_MARGIN = 0.5;
  const PAINTING_FRAME_THICKNESS = 0.05;
  const PAINTING_FRAME_COLOR = '#000000';
  const PAINTING_FRAME_MARGIN = 0.05;

  const [redPlaneWidth, redPlaneHeight, frameWidth, frameHeight] = useMemo(() => {
    const rpWidth = wallWidth - (2 * PAINTING_RED_PLANE_MARGIN);
    const rpHeight = wallHeight - (2 * PAINTING_RED_PLANE_MARGIN);
    const fWidth = rpWidth + (2 * PAINTING_FRAME_MARGIN);
    const fHeight = rpHeight + (2 * PAINTING_FRAME_MARGIN);
    return [rpWidth, rpHeight, fWidth, fHeight];
  }, [wallWidth, wallHeight]);

  if (isLoadingError || !textureUrl) {
    return (
      <group>
        <mesh receiveShadow position={[0, wallHeight / 2, wallBackingDepth / 2]}>
          <boxGeometry args={[wallWidth, wallHeight, wallBackingDepth]} />
          <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0} />
        </mesh>
        <group position={[0, artGroupY, wallBackingDepth + matDepth / 2]}>
             {!isPainting && (
                <mesh receiveShadow castShadow>
                    <boxGeometry args={[matWidth, matHeight, matDepth]} />
                    <meshStandardMaterial color="#333333" roughness={0.5} />
                </mesh>
             )}
             <mesh position={[0, 0, matDepth / 2 - ARTWORK_RECESS_INTO_FRAME]}>
                <planeGeometry args={[artWidth, artHeight]} />
                <meshStandardMaterial color="#cccccc" roughness={1} />
             </mesh>
        </group>
      </group>
    );
  }
  
  return (
    <group>
        <mesh receiveShadow position={[0, wallHeight / 2, wallBackingDepth / 2]}>
            <boxGeometry args={[wallWidth, wallHeight, wallBackingDepth]} />
            <meshStandardMaterial 
              color="#ffffff" 
              roughness={1.0} 
              metalness={0} 
            />
        </mesh>

        {isPainting && (
          <>
            <mesh position={[0, wallHeight / 2, wallBackingDepth + (PAINTING_FRAME_THICKNESS / 2) + 0.05]} receiveShadow castShadow>
              <boxGeometry args={[frameWidth, frameHeight, PAINTING_FRAME_THICKNESS]} />
              <meshStandardMaterial color={PAINTING_FRAME_COLOR} roughness={0.8} metalness={0} />
            </mesh>

            <mesh position={[0, wallHeight / 2, wallBackingDepth + PAINTING_FRAME_THICKNESS + 0.05]} receiveShadow>
              <boxGeometry args={[redPlaneWidth, redPlaneHeight, 0.02]} />
              <meshStandardMaterial 
                map={loadedTexture} 
                roughness={1}
                metalness={0}
              /> 
            </mesh>
          </>
        )}

        {!isPainting && (
          <group position={[0, artGroupY, wallBackingDepth + matDepth / 2]}>
              <mesh receiveShadow castShadow>
                    <boxGeometry args={[matWidth, matHeight, matDepth]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
              </mesh>
              <mesh position={[0, 0, matDepth / 2 - ARTWORK_RECESS_INTO_FRAME]}>
                <planeGeometry args={[artWidth, artHeight]} />
                <meshStandardMaterial map={loadedTexture} roughness={1} metalness={0} />
              </mesh>
          </group>
        )}
    </group>
  );
};

export default TexturedWallDisplay;