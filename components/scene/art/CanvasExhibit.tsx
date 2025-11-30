import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import TexturedWallDisplay from './TexturedWallDisplay';
import { Html } from '@react-three/drei';
import { getVideoEmbedUrl } from '../../../services/utils/videoUtils';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { ArtworkDimensions } from '../../../types';
import { HelpCircle } from 'lucide-react';

interface CanvasExhibitProps {
  orientation: 'portrait' | 'landscape' | 'square', 
  textureUrl?: string, 
  aspectRatio?: number,
  isMotionVideo?: boolean;
  isFaultyMotionVideo?: boolean;
  isDirectVideoFile?: boolean; // NEW: Add isDirectVideoFile prop
  isPainting?: boolean;
  isFocused: boolean;
  lightsOn: boolean;
}

// Utility to check if a URL is likely an image
const isImageUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  // Use .split('?')[0] to ignore query parameters in extension check
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(url.split('?')[0]); 
};

const CanvasExhibit: React.FC<CanvasExhibitProps> = ({ orientation, textureUrl, aspectRatio, isMotionVideo, isFaultyMotionVideo, isDirectVideoFile, isPainting, isFocused, lightsOn }) => {
  let maxDimension = 3.0; 
  
  if (orientation === 'square') {
    maxDimension = 6.0; 
  } else if (orientation === 'landscape') {
    maxDimension = 16.0; 
  }

  const wallRef = useRef<THREE.Mesh>(null);

  const embedUrl = useMemo(() => {
    // Only generate embed URL if it's an embeddable video platform (not direct file)
    if (!isMotionVideo || isDirectVideoFile || isFaultyMotionVideo || !textureUrl) { // NEW: Add isDirectVideoFile check
      return null;
    }

    const url = getVideoEmbedUrl(textureUrl);
    if (!url) {
      
    }
    return url;
  }, [isMotionVideo, isDirectVideoFile, isFaultyMotionVideo, textureUrl]); // NEW: Add isDirectVideoFile to dependencies

  const WALL_DEPTH = 0.4;

  const [artworkInfo, setArtworkInfo] = useState<ArtworkDimensions | null>(null);
  
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
    }
  }, []);

  // Conditionally set stampSourceUrl to textureUrl only if it's a painting AND a valid image URL
  const stampSourceUrl = isPainting && isImageUrl(textureUrl)
    ? textureUrl
    : "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
  
  // Only load stampTexture if stampSourceUrl is not the default fallback (which is always an image)
  // or if stampSourceUrl is provided and is a valid image URL, which is guaranteed by the above logic.
  const stampTexture = useLoader(THREE.TextureLoader, stampSourceUrl,
    (loader) => {
      loader.crossOrigin = 'anonymous';
    },
    (errorEvent) => {
      console.error(`[CanvasExhibit] Stamp texture loading error for URL: ${stampSourceUrl}`, errorEvent);
      // Fallback to default if stamp fails to load, even after validation
      // This is a last resort, as isImageUrl should prevent most issues
    }
  );

  if (isFaultyMotionVideo) {
    const placeholderSize = maxDimension * 0.4;
    const zPosition = WALL_DEPTH / 2 + 0.01;
    const yPosition = placeholderSize / 2;

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

  // NEW: Handle direct video files as textures
  if (isMotionVideo && isDirectVideoFile) {
    return (
      <TexturedWallDisplay
        textureUrl={textureUrl}
        maxDimension={maxDimension}
        orientation={orientation}
        aspectRatio={aspectRatio}
        isPainting={isPainting} // Should be false for motion video
        isMotionVideo={isMotionVideo} // NEW: Pass isMotionVideo
        isDirectVideoFile={isDirectVideoFile} // NEW: Pass isDirectVideoFile
        onDimensionsCalculated={handleArtworkDimensions}
        isFocused={isFocused}
        lightsOn={lightsOn}
      />
    );
  }

  // Existing: Handle embeddable videos via iframe
  if (isMotionVideo && embedUrl) {
    

    const videoAspectRatio = aspectRatio !== undefined && aspectRatio !== null ? aspectRatio : (16 / 9);

    const VIDEO_SIZE_MULTIPLIER = 0.25;
    const VIDEO_INNER_CONTENT_MULTIPLIER = 0.5;

    const wallDisplayWidth = maxDimension * VIDEO_SIZE_MULTIPLIER;
    const wallDisplayHeight = wallDisplayWidth / videoAspectRatio;

    const videoContentWidth = wallDisplayWidth * VIDEO_INNER_CONTENT_MULTIPLIER;
    const videoContentHeight = wallDisplayHeight * VIDEO_INNER_CONTENT_MULTIPLIER;

    const HTML_SCALE_FACTOR = 100;
    const iframeWidthPx = videoContentWidth * HTML_SCALE_FACTOR;
    const iframeHeightPx = videoContentHeight * HTML_SCALE_FACTOR;

    const zPosition = WALL_DEPTH / 2 + 0.01;
    const yPosition = wallDisplayHeight / 2;

    return (
      <group>
        <mesh ref={wallRef} receiveShadow position={[0, yPosition, 0]}>
          <boxGeometry args={[wallDisplayWidth, wallDisplayHeight, WALL_DEPTH]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0} />
        </mesh>
        
        <Html
          position={[0, yPosition, zPosition]}
          wrapperClass="youtube-video-html"
          center
          occlude={[wallRef]}
        >
          <iframe
            src={embedUrl}
            width={iframeWidthPx}
            height={iframeHeightPx}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups"
            style={{ display: 'block' }}
            title="Vimeo video player"
            aria-label="Vimeo video player"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </Html>
      </group>
    );
  }

  // Existing: Handle regular images/paintings
  return (
    <>
      <TexturedWallDisplay 
        textureUrl={textureUrl} 
        maxDimension={maxDimension} 
        orientation={orientation} 
        aspectRatio={aspectRatio} 
        isPainting={isPainting}
        isMotionVideo={false} // NEW: Explicitly false for non-motion
        isDirectVideoFile={false} // NEW: Explicitly false for non-motion
        onDimensionsCalculated={handleArtworkDimensions}
        isFocused={isFocused}
        lightsOn={lightsOn}
      />

      {isPainting && artworkInfo && (
        <mesh
          position={[
            artworkInfo.artworkRenderWidth / 2 - 0.4,
            artworkInfo.artworkCenterY - artworkInfo.artworkRenderHeight / 2 + 0.4,
            artworkInfo.artworkSurfaceZ + 0.005
          ]}
          rotation={[0, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.8, 0.8]} />
          <meshStandardMaterial map={stampTexture} transparent />
        </mesh>
      )}
    </>
  );
};

export default CanvasExhibit;