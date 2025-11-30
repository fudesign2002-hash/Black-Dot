
// components/scene/art/TexturedWallDisplay.tsx


import React, { useMemo, useState, useEffect, Suspense, useRef } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ArtworkDimensions } from '../../../types'; // NEW: Import ArtworkDimensions

interface TexturedWallDisplayProps {
  textureUrl?: string;
  maxDimension?: number;
  orientation?: 'portrait' | 'landscape' | 'square';
  aspectRatio?: number;
  isPainting?: boolean; // NEW: Added isPainting prop
  onDimensionsCalculated?: (width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => void; // NEW: Callback for dimensions
  isFocused: boolean; // NEW: Add isFocused prop
  lightsOn: boolean; // NEW: Add lightsOn prop
}

const TexturedWallDisplay: React.FC<TexturedWallDisplayProps> = ({ textureUrl, maxDimension = 5.0, orientation, aspectRatio, isPainting, onDimensionsCalculated, isFocused, lightsOn }) => {
  const [isLoadingError, setIsLoadingError] = useState(false);
  // materialRef removed as SaturatedMaterial is no longer used for paintings

  // Use useLoader for textures. This hook integrates better with Suspense.
  // It will suspend the component until the texture is loaded.
  // If textureUrl is falsy, useLoader will receive an empty string, which might lead to errors
  // or default to an empty texture, depending on the loader.
  const loadedTexture = useLoader(THREE.TextureLoader, textureUrl || '', 
    (loader) => {
      loader.crossOrigin = 'anonymous'; // FIX: Set crossOrigin to anonymous
    },
    (errorEvent) => {
      console.error(`[TexturedWallDisplay] Texture loading error for URL: ${textureUrl}`, errorEvent);
      setIsLoadingError(true);
    }
  );

  // Reset error state when textureUrl changes
  useEffect(() => {
    setIsLoadingError(false);
  }, [textureUrl]);

  // Dimensions for the wall and artwork
  const MAX_ART_DIMENSION = maxDimension;
  const WALL_BORDER_WIDTH = 1.0;
  const ARTWORK_MAT_WIDTH = 0.25;
  const FRAME_VISUAL_DEPTH = 0.1;
  const ARTWORK_RECESS_INTO_FRAME = 0.02;
  const MIN_WALL_HEIGHT = 2.0; 
  const MIN_WALL_WIDTH = 2.0;

  // NEW: Conditional frame depth
  const artworkFrameDepth = isPainting ? 0 : FRAME_VISUAL_DEPTH;

  const [artDims, wallDims] = useMemo((): [[number, number], [number, number]] => {
    let calculatedAspect = 1; // Default to square aspect ratio

    // 1. Highest priority: Use explicit aspectRatio prop from parent
    if (aspectRatio !== undefined && aspectRatio !== null) {
      calculatedAspect = aspectRatio;
    } 
    // 2. Second priority: Use actual texture dimensions if available (and textureUrl was provided)
    else if (textureUrl && loadedTexture && (loadedTexture.image as HTMLImageElement)?.width && (loadedTexture.image as HTMLImageElement)?.height) {
      calculatedAspect = (loadedTexture.image as HTMLImageElement).width / (loadedTexture.image as HTMLImageElement).height;
    } 
    // 3. Third priority: Use orientation to infer aspect ratio if neither above is available
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
    
    // Use artworkFrameDepth in calculations
    const desiredWallWidth = artWidth + (ARTWORK_MAT_WIDTH * 2) + (WALL_BORDER_WIDTH * 2);
    const desiredWallHeight = artHeight + (ARTWORK_MAT_WIDTH * 2) + (WALL_BORDER_WIDTH * 2);

    const finalWallWidth = Math.max(MIN_WALL_WIDTH, desiredWallWidth);
    const finalWallHeight = Math.max(MIN_WALL_HEIGHT, desiredWallHeight);

    // Calculate Z position of artwork surface for the callback
    const wallBackingDepth = 0.4;
    const artGroupY = finalWallHeight * 0.55; // This is the Y position of the artwork group
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
  const matDepth = artworkFrameDepth; // Use conditional depth

  const artGroupY = wallHeight * 0.55;
  const wallBackingDepth = 0.4;

  // NEW: Constants for painting-specific dimensions and colors (moved out of JSX)
  const PAINTING_RED_PLANE_MARGIN = 0.5; // Margin from the white wall
  const PAINTING_FRAME_THICKNESS = 0.05;
  const PAINTING_FRAME_COLOR = '#000000'; // Black frame
  const PAINTING_FRAME_MARGIN = 0.05; // Margin from red plane to black frame

  // Calculate dimensions for the red plane and black frame (moved out of JSX)
  const [redPlaneWidth, redPlaneHeight, frameWidth, frameHeight] = useMemo(() => {
    const rpWidth = wallWidth - (2 * PAINTING_RED_PLANE_MARGIN);
    const rpHeight = wallHeight - (2 * PAINTING_RED_PLANE_MARGIN);
    const fWidth = rpWidth + (2 * PAINTING_FRAME_MARGIN);
    const fHeight = rpHeight + (2 * PAINTING_FRAME_MARGIN);
    return [rpWidth, rpHeight, fWidth, fHeight];
  }, [wallWidth, wallHeight]);

  // Removed useFrame lerping for saturation/brightness/opacity as SaturatedMaterial is no longer used for paintings


  // Render a placeholder if there was a loading error or no textureUrl was provided
  if (isLoadingError || !textureUrl) {
    return (
      // FIX: Use lowercase intrinsic element 'group'
      <group>
        {/* White Wall (still render the wall structure) */}
        {/* FIX: Use lowercase intrinsic element 'mesh' */}
        <mesh receiveShadow position={[0, wallHeight / 2, wallBackingDepth / 2]}>
          {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
          <boxGeometry args={[wallWidth, wallHeight, wallBackingDepth]} />
          {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
          <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0} />
        </mesh>
        {/* Frame and Artwork Group */}
        {/* FIX: Use lowercase intrinsic element 'group' */}
        <group position={[0, artGroupY, wallBackingDepth + matDepth / 2]}>
             {/* Frame (outer border) - Conditionally render */}
             {!isPainting && (
                // FIX: Use lowercase intrinsic element 'mesh'
                <mesh receiveShadow castShadow>
                    {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
                    <boxGeometry args={[matWidth, matHeight, matDepth]} />
                    {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
                    <meshStandardMaterial color="#333333" roughness={0.5} />
                </mesh>
             )}
             {/* Error/No-Texture Placeholder Plane */}
             {/* FIX: Use lowercase intrinsic element 'mesh' */}
             <mesh position={[0, 0, matDepth / 2 - ARTWORK_RECESS_INTO_FRAME]}>
                {/* FIX: Use lowercase intrinsic element 'planeGeometry' */}
                <planeGeometry args={[artWidth, artHeight]} />
                {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
                <meshStandardMaterial color="#cccccc" roughness={1} />
             </mesh>
        </group>
      </group>
    );
  }
  
  // If we reach here, textureUrl is valid and loadedTexture is available (due to Suspense and error check)
  return (
    // FIX: Use lowercase intrinsic element 'group'
    <group>
        {/* White Wall */}
        {/* FIX: Use lowercase intrinsic element 'mesh' */}
        <mesh receiveShadow position={[0, wallHeight / 2, wallBackingDepth / 2]}>
            {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
            <boxGeometry args={[wallWidth, wallHeight, wallBackingDepth]} />
            {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
            <meshStandardMaterial 
              color="#ffffff" 
              roughness={1.0} 
              metalness={0} 
            />
        </mesh>

        {/* NEW: Red plane in front of the white wall for paintings with a black frame */}
        {isPainting && (
          <>
            {/* Black Frame */}
            {/* FIX: Use lowercase intrinsic element 'mesh' */}
            <mesh position={[0, wallHeight / 2, wallBackingDepth + (PAINTING_FRAME_THICKNESS / 2) + 0.05]} receiveShadow castShadow>
              {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
              <boxGeometry args={[frameWidth, frameHeight, PAINTING_FRAME_THICKNESS]} />
              {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
              <meshStandardMaterial color={PAINTING_FRAME_COLOR} roughness={0.8} metalness={0} />
            </mesh>

            {/* Red Plane (artwork itself) */}
            {/* FIX: Use lowercase intrinsic element 'mesh' */}
            <mesh position={[0, wallHeight / 2, wallBackingDepth + PAINTING_FRAME_THICKNESS + 0.05]} receiveShadow>
              {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
              <boxGeometry args={[redPlaneWidth, redPlaneHeight, 0.02]} /> {/* Thin red plane */}
              {/* Changed from saturatedMaterial to meshStandardMaterial for paintings */}
              <meshStandardMaterial 
                map={loadedTexture} 
                transparent 
                opacity={1} 
                emissive="#333333" // Subtle internal glow for vibrancy
                emissiveIntensity={0.5} // Increased intensity for more vibrancy
                roughness={0.85} // Slightly less matte
                metalness={0.05} // Very subtle metallic sheen
                // FIX: Removed colorSpace as it's not a direct material property in R3F JSX
              /> 
            </mesh>
          </>
        )}

        {/* Frame and Artwork Group (for non-paintings, i.e., regular textured displays) */}
        {!isPainting && (
          // FIX: Use lowercase intrinsic element 'group'
          <group position={[0, artGroupY, wallBackingDepth + matDepth / 2]}>
              {/* Frame (outer border) */}
              {/* FIX: Use lowercase intrinsic element 'mesh' */}
              <mesh receiveShadow castShadow>
                    {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
                    <boxGeometry args={[matWidth, matHeight, matDepth]} />
                    {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
                    <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
              </mesh>
              {/* Artwork Plane (recessed into the frame) */}
              {/* FIX: Use lowercase intrinsic element 'mesh' */}
              <mesh position={[0, 0, matDepth / 2 - ARTWORK_RECESS_INTO_FRAME]}>
                {/* FIX: Use lowercase intrinsic element 'planeGeometry' */}
                <planeGeometry args={[artWidth, artHeight]} />
                {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
                <meshStandardMaterial map={loadedTexture} roughness={1} metalness={0} /* FIX: Removed colorSpace */ />
              </mesh>
          </group>
        )}
    </group>
  );
};

export default TexturedWallDisplay;
