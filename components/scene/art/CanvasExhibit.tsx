
import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'; // Import useRef, useState, useCallback, useEffect
import TexturedWallDisplay from './TexturedWallDisplay';
import { Html } from '@react-three/drei'; // Import Html
import { getVideoEmbedUrl } from '../../../services/utils/videoUtils'; // Import the new utility
import * as THREE from 'three'; // Import THREE for Mesh type
import { useLoader } from '@react-three/fiber'; // Import useLoader for stamp texture
import { ArtworkDimensions } from '../../../types'; // NEW: Import ArtworkDimensions
import { HelpCircle } from 'lucide-react'; // FIX: Replaced QuestionMark with HelpCircle

interface CanvasExhibitProps {
  orientation: 'portrait' | 'landscape' | 'square', 
  textureUrl?: string, 
  aspectRatio?: number,
  isMotionVideo?: boolean; // NEW: Added isMotionVideo prop
  isFaultyMotionVideo?: boolean; // NEW: Added isFaultyMotionVideo prop
  isPainting?: boolean; // NEW: Added isPainting prop
  isFocused: boolean; // NEW: Add isFocused prop
  lightsOn: boolean; // NEW: Add lightsOn prop
}

const CanvasExhibit: React.FC<CanvasExhibitProps> = ({ orientation, textureUrl, aspectRatio, isMotionVideo, isFaultyMotionVideo, isPainting, isFocused, lightsOn }) => {
  let maxDimension = 3.0; 
  
  if (orientation === 'square') {
    maxDimension = 6.0; 
  } else if (orientation === 'landscape') {
    maxDimension = 16.0; 
  }

  // Ref for the backing wall mesh to enable occlusion
  const wallRef = useRef<THREE.Mesh>(null);

  const embedUrl = useMemo(() => {
    if (!isMotionVideo || isFaultyMotionVideo || !textureUrl) {
      return null;
    }

    const url = getVideoEmbedUrl(textureUrl);
    if (!url) {
      // console.warn('CanvasExhibit - Failed to get video embed URL for provided textureUrl. Is it a valid Vimeo link?', textureUrl);
    }
    return url;
  }, [isMotionVideo, isFaultyMotionVideo, textureUrl]);

  const WALL_DEPTH = 0.4; // Consistent with TexturedWallDisplay backing wall

  // NEW: State and handler for artwork dimensions from TexturedWallDisplay
  const [artworkInfo, setArtworkInfo] = useState<ArtworkDimensions | null>(null);
  
  // Ref to track if the component is mounted to prevent setState on unmounted component
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleArtworkDimensions = useCallback((width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => {
    if (mountedRef.current) { // Only update state if the component is still mounted
      setArtworkInfo({ artworkRenderWidth: width, artworkRenderHeight: height, artworkSurfaceZ, artworkCenterY });
    }
  }, []);

  // NEW: Load the stamp texture - now conditional based on isPainting
  const stampSourceUrl = isPainting && textureUrl
    ? textureUrl // If it's a painting, use its own textureUrl as the stamp texture
    : "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
  const stampTexture = useLoader(THREE.TextureLoader, stampSourceUrl,
    (loader) => {
      loader.crossOrigin = 'anonymous'; // FIX: Set crossOrigin to anonymous for stamp texture
    }
  );

  // NEW: Render a placeholder with a question mark if isFaultyMotionVideo is true
  if (isFaultyMotionVideo) {
    // Dimensions for a square placeholder
    const placeholderSize = maxDimension * 0.4; // A reasonable size for the question mark background
    const zPosition = WALL_DEPTH / 2 + 0.01;
    const yPosition = placeholderSize / 2;

    return (
      <group>
        {/* Backing wall for the question mark placeholder */}
        <mesh ref={wallRef} receiveShadow position={[0, yPosition, 0]}>
          <boxGeometry args={[placeholderSize * 1.5, placeholderSize * 1.5, WALL_DEPTH]} /> {/* Larger wall behind the placeholder */}
          <meshStandardMaterial color="#333333" roughness={0.5} metalness={0} />
        </mesh>
        
        {/* Placeholder mesh for the question mark background */}
        <mesh position={[0, yPosition, zPosition - 0.005]} castShadow>
          <planeGeometry args={[placeholderSize, placeholderSize]} />
          <meshStandardMaterial color="#444444" roughness={0.8} />
        </mesh>

        {/* HTML for the question mark icon */}
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
    // console.log('CanvasExhibit - Final embedUrl:', embedUrl); // Log the final embed URL

    // Calculate aspect ratio for video, default to 16/9 if not explicitly provided
    const videoAspectRatio = aspectRatio !== undefined && aspectRatio !== null ? aspectRatio : (16 / 9);

    const VIDEO_SIZE_MULTIPLIER = 0.25; // This multiplier scales the entire wall display relative to maxDimension
    const VIDEO_INNER_CONTENT_MULTIPLIER = 0.5; // This multiplier scales the video content relative to the wall display

    // Dimensions for the backing wall (the "white wall")
    const wallDisplayWidth = maxDimension * VIDEO_SIZE_MULTIPLIER;
    const wallDisplayHeight = wallDisplayWidth / videoAspectRatio;

    // Dimensions for the actual video content, scaled down within the wall display
    const videoContentWidth = wallDisplayWidth * VIDEO_INNER_CONTENT_MULTIPLIER;
    const videoContentHeight = wallDisplayHeight * VIDEO_INNER_CONTENT_MULTIPLIER;

    // Calculate dimensions for the iframe itself.
    // Html container will need width/height in pixels.
    const HTML_SCALE_FACTOR = 100; // 1 Three.js unit = 100 pixels in Html
    const iframeWidthPx = videoContentWidth * HTML_SCALE_FACTOR;
    const iframeHeightPx = videoContentHeight * HTML_SCALE_FACTOR;

    // Position of the wall and the video iframe: needs to be slightly in front of the wall
    const zPosition = WALL_DEPTH / 2 + 0.01; // Slightly in front of the wall
    const yPosition = wallDisplayHeight / 2; // Vertically centered on 0,0,0 if its origin is at its bottom

    return (
      // FIX: Use lowercase intrinsic element 'group'
      <group>
        {/* Backing wall for the video */}
        {/* FIX: Use lowercase intrinsic element 'mesh' */}
        <mesh ref={wallRef} receiveShadow position={[0, yPosition, 0]}> {/* Attach ref here */}
          {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
          <boxGeometry args={[wallDisplayWidth, wallDisplayHeight, WALL_DEPTH]} />
          {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0} />
        </mesh>
        
        <Html
          position={[0, yPosition, zPosition]} // Position relative to group
          wrapperClass="youtube-video-html"
          center // Center the HTML element around its origin
          occlude={[wallRef]} // Pass the wall ref to occlude the HTML content
        >
          {/* FIX: Ensure standard HTML elements are used as lowercase in JSX */}
          <iframe
            src={embedUrl}
            width={iframeWidthPx}
            height={iframeHeightPx}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture" // Adjusted for Vimeo
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups"
            style={{ display: 'block' }} // Prevent extra whitespace
            title="Vimeo video player" // Updated title
            aria-label="Vimeo video player"
          />
        </Html>
      </group>
    );
  }

  // For static images, use TexturedWallDisplay
  return (
    <>
      <TexturedWallDisplay 
        textureUrl={textureUrl} 
        maxDimension={maxDimension} 
        orientation={orientation} 
        aspectRatio={aspectRatio}
        isPainting={isPainting} // NEW: Pass isPainting prop
        onDimensionsCalculated={handleArtworkDimensions} // NEW: Pass callback
        isFocused={isFocused} // NEW: Pass isFocused
        lightsOn={lightsOn} // NEW: Pass lightsOn
      />

      {/* NEW: Conditional stamp rendering for paintings */}
      {isPainting && artworkInfo && (
        // FIX: Use lowercase intrinsic element 'mesh'
        <mesh
          position={[
            artworkInfo.artworkRenderWidth / 2 - 0.4, // Right side of the artwork
            artworkInfo.artworkCenterY - artworkInfo.artworkRenderHeight / 2 + 0.4, // Bottom of the artwork
            artworkInfo.artworkSurfaceZ + 0.005 // Slightly in front of the artwork surface
          ]}
          rotation={[0, 0, 0]}
          receiveShadow
        >
          {/* FIX: Use lowercase intrinsic element 'planeGeometry' */}
          <planeGeometry args={[0.8, 0.8]} /> {/* Stamp size 0.8x0.8 */}
          {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
          <meshStandardMaterial map={stampTexture} transparent /> {/* Use transparent for alpha channel */}
        </mesh>
      )}
    </>
  );
};

export default CanvasExhibit;
