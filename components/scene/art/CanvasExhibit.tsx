

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import TexturedWallDisplay from './TexturedWallDisplay';
import { Html } from '@react-three/drei';
import { getVideoEmbedUrl } from '../../../services/utils/videoUtils';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { ArtworkDimensions, ArtType } from '../../../types';


interface CanvasExhibitProps {
  orientation: 'portrait' | 'landscape' | 'square', 
  textureUrl?: string, 
  aspectRatio?: number,
  isMotionVideo?: boolean;
  isFaultyMotionVideo?: boolean;
  isPainting?: boolean;
  isFocused: boolean;
  lightsOn: boolean;
  onDimensionsCalculated?: (width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => void;
  artworkPosition: [number, number, number];
  artworkRotation: [number, number, number];
  artworkType: ArtType;
  onArtworkClickedHtml: (e: React.MouseEvent<HTMLDivElement>, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType) => void;
  isSmallScreen: boolean; // NEW: Add isSmallScreen prop
  opacity?: number; // NEW: Opacity for fading
}

const isImageUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(url.split('?')[0]); 
};

const VIDEO_SIZE_MULTIPLIER = 0.3;
const VIDEO_INNER_CONTENT_MULTIPLIER = 0.85;
const EMBED_VIDEO_VERTICAL_OFFSET = 0; 
const MOTION_WALL_BACKING_MULTIPLIER = 2.5; 

// NEW: Small screen specific Y offset for motion videos
const SMALL_SCREEN_MOTION_Y_OFFSET = 2;

const CanvasExhibit: React.FC<CanvasExhibitProps> = ({ orientation, textureUrl, aspectRatio, isMotionVideo, isFaultyMotionVideo, isPainting, isFocused, lightsOn, onDimensionsCalculated,
  artworkPosition, artworkRotation, artworkType, onArtworkClickedHtml, isSmallScreen, opacity = 1.0 // NEW: Destructure isSmallScreen and opacity
}) => {
  let maxDimension = 3.0; 
  
  if (orientation === 'square') {
    maxDimension = 6.0; 
  } else if (orientation === 'landscape') {
    maxDimension = 16.0; 
  }

  const wallRef = useRef<THREE.Mesh>(null);

  const embedUrl = useMemo(() => {
    if (!isMotionVideo || isFaultyMotionVideo || !textureUrl) {
      return null;
    }

    const url = getVideoEmbedUrl(textureUrl);
    if (!url) {
      
    }
    return url;
  }, [isMotionVideo, isFaultyMotionVideo, textureUrl]);

  const WALL_DEPTH = 0.4;

  const [artworkInfo, setArtworkInfo] = useState<ArtworkDimensions | null>(null);
  
  const handleArtworkDimensions = useCallback((width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => {
    setArtworkInfo({ artworkRenderWidth: width, artworkRenderHeight: height, artworkSurfaceZ, artworkCenterY });
    if (onDimensionsCalculated) {
      onDimensionsCalculated(width, height, artworkSurfaceZ, artworkCenterY);
    }
  }, [onDimensionsCalculated]);

  
  const showFaultyVideo = isFaultyMotionVideo;

  if (showFaultyVideo) {
    const placeholderSize = maxDimension * 0.4;
    const zPosition = WALL_DEPTH / 2 + 0.01;
    const yPosition = placeholderSize / 2;

    useEffect(() => {
      if (onDimensionsCalculated) {
        onDimensionsCalculated(
          placeholderSize,
          placeholderSize,
          zPosition,
          yPosition
        );
      }
    }, [onDimensionsCalculated, placeholderSize, zPosition, yPosition]);

    return (
      <group>
        {/* FIX: Use THREE.Vector3 for position and THREE.Color for color, and args prop for geometry */}
        <mesh ref={wallRef} receiveShadow position={new THREE.Vector3(0, yPosition, 0)}>
          <boxGeometry attach="geometry" args={[placeholderSize * 1.5, placeholderSize * 1.5, WALL_DEPTH]} />
          <meshStandardMaterial attach="material" color={new THREE.Color("#333333")} roughness={0.5} metalness={0} />
        </mesh>
        
        {/* FIX: Use THREE.Vector3 for position and THREE.Color for color, and args prop for geometry */}
        <mesh position={new THREE.Vector3(0, yPosition, zPosition - 0.005)} castShadow>
          <planeGeometry attach="geometry" args={[placeholderSize, placeholderSize]} />
          <meshStandardMaterial attach="material" color={new THREE.Color("#444444")} roughness={0.8} />
        </mesh>

        {/* FIX: Removed occlude prop as HTML is not a THREE.Object3D */}
        <Html
          position={new THREE.Vector3(0, yPosition, zPosition)}
          wrapperClass="faulty-video-html"
          center
        >
          <div className="flex items-center justify-center w-[100px] h-[100px] text-6xl font-bold text-white bg-red-500 rounded-full shadow-lg">
            ?
          </div>
        </Html>
      </group>
    );
  }

  if (isMotionVideo && embedUrl) {
    
    const videoAspectRatio = aspectRatio !== undefined && aspectRatio !== null ? aspectRatio : (16 / 9);

    const videoContentBaseWidth = maxDimension * VIDEO_SIZE_MULTIPLIER;
    const videoContentBaseHeight = videoContentBaseWidth / videoAspectRatio;

    // Calculate the iframe's actual rendered size first, then size the backing
    // wall proportionally to the rendered iframe to keep padding uniform.
    const iframeRenderedWidth = videoContentBaseWidth * VIDEO_INNER_CONTENT_MULTIPLIER;
    const iframeRenderedHeight = videoContentBaseHeight * VIDEO_INNER_CONTENT_MULTIPLIER;

    // Add fixed pixel padding (px) on each side of the iframe; convert to world units
    const PIXEL_BACKING_PADDING = 5; // px per side
    const paddingWorld = PIXEL_BACKING_PADDING / 100; // world units per side (HTML_SCALE_FACTOR = 100)

    const backingWallWidth = iframeRenderedWidth * MOTION_WALL_BACKING_MULTIPLIER + paddingWorld * 2;
    const backingWallHeight = iframeRenderedHeight * MOTION_WALL_BACKING_MULTIPLIER + paddingWorld * 2;

    const backingWallMeshCenterY = backingWallHeight / 2;

    const zPosition = WALL_DEPTH / 2 + 0.01;

    // NEW: Apply conditional Y offset for small screens
    let adjustedYOffset = EMBED_VIDEO_VERTICAL_OFFSET;
    if (isSmallScreen) {
      adjustedYOffset += SMALL_SCREEN_MOTION_Y_OFFSET;
    }
    const htmlContentCenterY = backingWallMeshCenterY + adjustedYOffset;


    const HTML_SCALE_FACTOR = 100;
    const iframeWidthPx = videoContentBaseWidth * VIDEO_INNER_CONTENT_MULTIPLIER * HTML_SCALE_FACTOR;
    const iframeHeightPx = videoContentBaseHeight * VIDEO_INNER_CONTENT_MULTIPLIER * HTML_SCALE_FACTOR;

    useEffect(() => {
      if (onDimensionsCalculated) {
        onDimensionsCalculated(
          iframeRenderedWidth,
          iframeRenderedHeight,
          zPosition,
          htmlContentCenterY
        );
      }
    }, [onDimensionsCalculated, iframeRenderedWidth, iframeRenderedHeight, zPosition, htmlContentCenterY]);

    return (
      <group>
        {/* FIX: Use THREE.Vector3 for position and THREE.Color for color, and args prop for geometry */}
        <mesh ref={wallRef} receiveShadow castShadow position={new THREE.Vector3(0, backingWallMeshCenterY, 0)}>
          <boxGeometry attach="geometry" args={[backingWallWidth, backingWallHeight, WALL_DEPTH]} />
          <meshStandardMaterial attach="material" color={new THREE.Color("#1a1a1a")} roughness={0.5} metalness={0} />
        </mesh>
        
        <Html
          position={new THREE.Vector3(0, htmlContentCenterY, zPosition)}
          wrapperClass="youtube-video-html"
          center
          occlude={[wallRef]}
          transform
        >
          <div style={{ position: 'relative', width: iframeWidthPx, height: iframeHeightPx }}>
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-share"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups"
              style={{ display: 'block', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
              title="Embedded video player"
              aria-label="Embedded video player"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                cursor: 'pointer',
                touchAction: 'manipulation', // prefer manipulation so taps are handled but small gestures won't trigger browser gesture
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={(e) => onArtworkClickedHtml(e, artworkPosition, artworkRotation, artworkType)}
            />
          </div>
        </Html>
      </group>
    );
  }

  return (
    <React.Fragment>
      <TexturedWallDisplay 
        textureUrl={textureUrl} 
        mapTexture={null}
        maxDimension={maxDimension}
        orientation={orientation} 
        aspectRatio={aspectRatio} 
        isPainting={isPainting}
        onDimensionsCalculated={handleArtworkDimensions}
        isFocused={isFocused}
        lightsOn={lightsOn}
      />

      
    </React.Fragment>
  );
};

export default CanvasExhibit;