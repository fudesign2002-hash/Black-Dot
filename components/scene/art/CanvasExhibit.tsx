import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import TexturedWallDisplay from './TexturedWallDisplay';
import { Html } from '@react-three/drei';
import { getVideoEmbedUrl } from '../../../services/utils/videoUtils';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { ArtworkDimensions, ArtType } from '../../../types';
import { HelpCircle } from 'lucide-react';

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
}

const isImageUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(url.split('?')[0]); 
};

const VIDEO_SIZE_MULTIPLIER = 0.3;
const VIDEO_INNER_CONTENT_MULTIPLIER = 0.9;
const EMBED_VIDEO_VERTICAL_OFFSET = 0; 
const MOTION_WALL_BACKING_MULTIPLIER = 2.5; 

const CanvasExhibit: React.FC<CanvasExhibitProps> = ({ orientation, textureUrl, aspectRatio, isMotionVideo, isFaultyMotionVideo, isPainting, isFocused, lightsOn, onDimensionsCalculated,
  artworkPosition, artworkRotation, artworkType, onArtworkClickedHtml
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
  const [internalFaultyVideo, setInternalFaultyVideo] = useState(false);
  
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleArtworkDimensions = useCallback((width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => {
    if (mountedRef.current) {
      setArtworkInfo({ artworkRenderWidth: width, artworkRenderHeight: height, artworkSurfaceZ, artworkCenterY });
      if (onDimensionsCalculated) {
        onDimensionsCalculated(width, height, artworkSurfaceZ, artworkCenterY);
      }
    }
  }, [onDimensionsCalculated]);

  
  const showFaultyVideo = isFaultyMotionVideo || internalFaultyVideo;

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
        <mesh ref={wallRef} receiveShadow position={[0, yPosition, 0]}>
          <boxGeometry args={[placeholderSize * 1.5, placeholderSize * 1.5, WALL_DEPTH]} />
          <meshStandardMaterial color="#333333" roughness={0.5} metalness={0} />
        </mesh>
        
        <mesh position={[0, yPosition, zPosition - 0.005]} castShadow>
          <planeGeometry args={[placeholderSize, placeholderSize]} />
          <meshStandardMaterial color="#444444" roughness={0.8} />
        </mesh>

        <Html
          position={[0, yPosition, zPosition]}
          wrapperClass="faulty-video-html"
          center
          occlude={[wallRef]}
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

    const backingWallWidth = videoContentBaseWidth * MOTION_WALL_BACKING_MULTIPLIER;
    const backingWallHeight = videoContentBaseHeight * MOTION_WALL_BACKING_MULTIPLIER;

    const backingWallMeshCenterY = backingWallHeight / 2;

    const zPosition = WALL_DEPTH / 2 + 0.01;

    const htmlContentCenterY = backingWallMeshCenterY + EMBED_VIDEO_VERTICAL_OFFSET;

    const HTML_SCALE_FACTOR = 100;
    const iframeWidthPx = videoContentBaseWidth * VIDEO_INNER_CONTENT_MULTIPLIER * HTML_SCALE_FACTOR;
    const iframeHeightPx = videoContentBaseHeight * VIDEO_INNER_CONTENT_MULTIPLIER * HTML_SCALE_FACTOR;

    useEffect(() => {
      if (onDimensionsCalculated) {
        onDimensionsCalculated(
          videoContentBaseWidth,
          videoContentBaseHeight,
          zPosition,
          htmlContentCenterY
        );
      }
    }, [onDimensionsCalculated, videoContentBaseWidth, videoContentBaseHeight, zPosition, htmlContentCenterY]);

    return (
      <group>
        <mesh ref={wallRef} receiveShadow castShadow position={[0, backingWallMeshCenterY, 0]}>
          <boxGeometry args={[backingWallWidth, backingWallHeight, WALL_DEPTH]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0} />
        </mesh>
        
        <Html
          position={[0, htmlContentCenterY, zPosition]}
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
              }}
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