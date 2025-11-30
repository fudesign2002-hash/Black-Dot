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
  isMotionVideo?: boolean; // NEW: Add isMotionVideo
  isDirectVideoFile?: boolean; // NEW: Add isDirectVideoFile
  onDimensionsCalculated?: (width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => void;
  isFocused: boolean;
  lightsOn: boolean;
}

const TexturedWallDisplay: React.FC<TexturedWallDisplayProps> = ({ textureUrl, maxDimension = 5.0, orientation, aspectRatio, isPainting, isMotionVideo, isDirectVideoFile, onDimensionsCalculated, isFocused, lightsOn }) => {
  const [isLoadingError, setIsLoadingError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Use state to hold the texture/video element or texture instance
  const [loadedMedia, setLoadedMedia] = useState<THREE.Texture | HTMLVideoElement | null>(null);

  // Memoize video element creation and setup
  const videoElement = useMemo(() => {
    if (!isDirectVideoFile || !textureUrl) return null;

    const video = document.createElement('video');
    video.src = textureUrl;
    video.loop = true;
    video.muted = true; // Essential for autoplay in most browsers
    video.autoplay = true;
    video.playsInline = true; // Important for mobile browsers
    video.crossOrigin = 'anonymous'; // For CORS
    video.preload = 'auto'; // Load video metadata
    video.setAttribute('webkit-playsinline', 'webkit-playsinline'); // iOS support

    video.onloadedmetadata = () => {
      // Attempt to play immediately once metadata is loaded
      video.play().catch(e => console.error("Video autoplay failed (metadata):", e));
      setLoadedMedia(video); // Set video element directly for aspect ratio calculation
    };
    video.onerror = (e) => {
      console.error(`[TexturedWallDisplay] Video element error for URL: ${textureUrl}`, e);
      setIsLoadingError(true);
    };
    videoRef.current = video; // Assign to ref
    return video;
  }, [isDirectVideoFile, textureUrl]);

  // Use useLoader for the actual THREE.VideoTexture, dependent on videoElement
  const videoTexture = useLoader(THREE.VideoTexture, videoElement ? videoElement : null,
    (loader) => {
      // This callback fires when video texture is successfully created
      if (videoElement && videoElement.paused) {
        videoElement.play().catch(e => console.error("Video texture play failed:", e));
      }
    },
    (error) => {
      console.error(`[TexturedWallDisplay] Video texture creation error for URL: ${textureUrl}`, error);
      setIsLoadingError(true);
    }
  );

  // Use useLoader for image texture
  const imageTexture = useLoader(THREE.TextureLoader, !isDirectVideoFile && textureUrl ? textureUrl : null,
    (loader) => {
      loader.crossOrigin = 'anonymous';
    },
    (errorEvent) => {
      console.error(`[TexturedWallDisplay] Image texture loading error for URL: ${textureUrl}`, errorEvent);
      setIsLoadingError(true);
    }
  );

  useEffect(() => {
    setIsLoadingError(false);
    // When direct video file is active, prioritize video texture
    if (isDirectVideoFile && videoTexture) {
        setLoadedMedia(videoTexture);
    } 
    // Otherwise, if not motion video, use image texture
    else if (!isMotionVideo && imageTexture) { // Changed condition to !isMotionVideo
        setLoadedMedia(imageTexture);
    } else {
        setLoadedMedia(null);
    }
  }, [isDirectVideoFile, isMotionVideo, textureUrl, videoTexture, imageTexture]);

  // Handle video play/pause based on focus or lightsOn (if needed, currently always plays)
  useEffect(() => {
    if (isDirectVideoFile && videoElement) {
      if (lightsOn || isFocused) { // For simplicity, always play video if lights are on or artwork is focused
        videoElement.play().catch(e => console.error("Video play failed:", e));
      } else {
        videoElement.pause();
      }
    }
  }, [isDirectVideoFile, videoElement, lightsOn, isFocused]);


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
    // NEW: Prioritize video dimensions for aspect ratio if it's a direct video
    else if (isDirectVideoFile && videoElement && videoElement.videoWidth && videoElement.videoHeight) {
        calculatedAspect = videoElement.videoWidth / videoElement.videoHeight;
    }
    else if (loadedMedia && (loadedMedia as THREE.Texture).image?.width && (loadedMedia as THREE.Texture).image?.height) {
      calculatedAspect = (loadedMedia as THREE.Texture).image.width / (loadedMedia as THREE.Texture).image.height;
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
  }, [aspectRatio, loadedMedia, videoElement, MAX_ART_DIMENSION, orientation, isPainting, isDirectVideoFile, onDimensionsCalculated]);

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

  // Adjusted error condition to use loadedMedia
  if (isLoadingError || !textureUrl || !loadedMedia) {
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
                map={loadedMedia as THREE.Texture} // Use loadedMedia as map
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
                <meshStandardMaterial map={loadedMedia as THREE.Texture} roughness={1} metalness={0} />
              </mesh>
          </group>
        )}
    </group>
  );
};

export default TexturedWallDisplay;