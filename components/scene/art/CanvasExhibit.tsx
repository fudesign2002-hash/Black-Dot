

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import TexturedWallDisplay from './TexturedWallDisplay';
import { Html } from '@react-three/drei';
import { Play, Pause, Maximize } from 'lucide-react';
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
  sourceArtworkType?: string;
  onArtworkClickedHtml: (e: React.MouseEvent<HTMLDivElement>, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType) => void;
  isSmallScreen: boolean; // NEW: Add isSmallScreen prop
  opacity?: number; // NEW: Opacity for fading
  artworkData?: any;
}

const isImageUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(url.split('?')[0]); 
};

// NEW: Detect if running on actual mobile device (not just small screen)
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

const VIDEO_SIZE_MULTIPLIER = 0.3;
const VIDEO_INNER_CONTENT_MULTIPLIER = 0.85;
const EMBED_VIDEO_VERTICAL_OFFSET = 0; 
const MOTION_WALL_BACKING_MULTIPLIER = 2.5; 

// NEW: Y offset specifically for mobile browsers (iPhone, iPad, Android)
const MOBILE_BROWSER_MOTION_Y_OFFSET = 0.5;

const CanvasExhibit: React.FC<CanvasExhibitProps> = ({ orientation, textureUrl, aspectRatio, isMotionVideo, isFaultyMotionVideo, isPainting, isFocused, lightsOn, onDimensionsCalculated,
  artworkPosition, artworkRotation, artworkType, sourceArtworkType, onArtworkClickedHtml, isSmallScreen, opacity = 1.0, artworkData // NEW: accept artworkData
}) => {
  const [isPlaying, setIsPlaying] = useState(true); // NEW: track motion playback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [lastAction, setLastAction] = useState<'play' | 'pause' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false); // NEW: track fullscreen state
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null); // NEW: ref to the video iframe
  const containerRef = useRef<HTMLDivElement>(null); // NEW: ref for the video container

  let maxDimension = (sourceArtworkType === 'painting' || sourceArtworkType === 'photography') ? 6.0 : 3.0; 

  // NEW: Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const element = containerRef.current;
    if (!element) {
      console.error("Container element not found");
      return;
    }
    
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      const exitMethod = document.exitFullscreen || (document as any).webkitExitFullscreen;
      if (exitMethod) {
        exitMethod.call(document).catch(err => console.error("Error exiting fullscreen:", err));
      }
    } else {
      const requestMethod = element.requestFullscreen || 
                           (element as any).webkitRequestFullscreen || 
                           (element as any).webkitEnterFullscreen ||
                           (element as any).mozRequestFullScreen || 
                           (element as any).msRequestFullscreen;
      
      if (requestMethod) {
        requestMethod.call(element).catch(err => {
          console.error("Error attempting to enable fullscreen:", err);
        });
      } else {
        console.error("Fullscreen API not supported");
      }
    }
  }, []);

  // NEW: Handle playback toggle for motion videos
  const togglePlayback = useCallback(() => {
    if (!isMotionVideo || !iframeRef.current) return;
    
    const nextIsPlaying = !isPlaying;
    setIsPlaying(nextIsPlaying);
    setLastAction(nextIsPlaying ? 'play' : 'pause');
    setShowFeedback(true);

    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setShowFeedback(false);
    }, 1000);

    const isYouTube = textureUrl?.includes('youtube.com') || textureUrl?.includes('youtu.be');
    const isVimeo = textureUrl?.includes('vimeo.com');

    if (isYouTube) {
      const message = JSON.stringify({
        event: 'command',
        func: nextIsPlaying ? 'playVideo' : 'pauseVideo',
        args: ''
      });
      iframeRef.current.contentWindow?.postMessage(message, '*');
    } else if (isVimeo) {
      const message = JSON.stringify({
        method: nextIsPlaying ? 'play' : 'pause'
      });
      iframeRef.current.contentWindow?.postMessage(message, '*');
    }
  }, [isPlaying, isMotionVideo, textureUrl]);

  // NEW: Monitor fullscreen state and toggle between custom UI and Vimeo controls
  useEffect(() => {
    if (!isMotionVideo || !iframeRef.current) return;

    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isNowFullscreen);
      
      const isVimeo = textureUrl?.includes('vimeo.com');
      
      if (isVimeo && iframeRef.current) {
        // Show Vimeo controls when in fullscreen, hide when not
        const message = JSON.stringify({
          method: isNowFullscreen ? 'enableControls' : 'disableControls'
        });
        iframeRef.current.contentWindow?.postMessage(message, '*');
        
        console.log(isNowFullscreen ? 'Fullscreen: Using Vimeo controls' : 'Normal: Using custom UI');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isMotionVideo, textureUrl]);

  if (orientation === 'landscape') {
    maxDimension = 16.0; 
  }

  const wallRef = useRef<THREE.Mesh>(null);

  const embedUrl = useMemo(() => {
    if (!isMotionVideo || isFaultyMotionVideo || !textureUrl) {
      return null;
    }

    const url = getVideoEmbedUrl(textureUrl);
    if (!url) {
      return null;
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

    // NEW: Apply conditional Y offset only for actual mobile browsers
    let adjustedYOffset = EMBED_VIDEO_VERTICAL_OFFSET;
    const isMobile = isMobileDevice();
    if (isMobile) {
      adjustedYOffset += MOBILE_BROWSER_MOTION_Y_OFFSET;
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
        {/* MODIFIED: Re-enabled castShadow for the backing wall to provide floor shadows for motion artworks */}
        <mesh ref={wallRef} castShadow receiveShadow position={new THREE.Vector3(0, backingWallMeshCenterY, 0)}>
          <boxGeometry attach="geometry" args={[backingWallWidth, backingWallHeight, WALL_DEPTH]} />
          <meshStandardMaterial attach="material" color={new THREE.Color("#1a1a1a")} roughness={0.5} metalness={0} />
        </mesh>
        
        <Html
          position={new THREE.Vector3(0, htmlContentCenterY, zPosition)}
          wrapperClass="youtube-video-html"
          center
          occlude={[wallRef]}
          transform
          zIndexRange={[0, 10]}
          pointerEvents="auto"
        >
          <div 
            ref={containerRef} 
            style={{ position: 'relative', width: iframeWidthPx, height: iframeHeightPx }}
          >
            <iframe
              ref={iframeRef}
              src={embedUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; accelerometer; gyroscope"
              allowFullScreen
              webkitallowfullscreen="true"
              mozallowfullscreen="true"
              style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
              title="Embedded video player"
              aria-label="Embedded video player"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            {/* DEBUG: Display all Y-position related values */}
            <div
              style={{
                position: 'absolute',
                bottom: '-200px',
                left: 0,
                color: 'red',
                fontSize: '12px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                zIndex: 100,
                pointerEvents: 'none',
                lineHeight: '1.5',
              }}
            >
              <div>✓ maxDimension: {maxDimension}</div>
              <div>✓ videoContentBaseWidth: {videoContentBaseWidth.toFixed(3)}</div>
              <div>✓ videoContentBaseHeight: {videoContentBaseHeight.toFixed(3)}</div>
              <div>✓ iframeRenderedWidth: {iframeRenderedWidth.toFixed(3)}</div>
              <div>✓ iframeRenderedHeight: {iframeRenderedHeight.toFixed(3)}</div>
              <div>✓ backingWallHeight: {backingWallHeight.toFixed(3)}</div>
              <div>✓ backingWallMeshCenterY: {backingWallMeshCenterY.toFixed(3)}</div>
              <div>✓ EMBED_VIDEO_VERTICAL_OFFSET: {EMBED_VIDEO_VERTICAL_OFFSET}</div>
              <div>✓ isMobile: {isMobile ? 'YES' : 'NO'}</div>
              <div>✓ MOBILE_BROWSER_MOTION_Y_OFFSET: {MOBILE_BROWSER_MOTION_Y_OFFSET}</div>
              <div>✓ adjustedYOffset: {adjustedYOffset.toFixed(3)}</div>
              <div style={{ fontWeight: 'bold', color: 'lime' }}>► htmlContentCenterY: {htmlContentCenterY.toFixed(3)} ◄</div>
              <div>✓ zPosition: {zPosition.toFixed(3)}</div>
              <div>✓ HTML center prop: true (裡面還會再除以2)</div>
            </div>
          </div>
        </Html>
      </group>
    );
  }

  return (
    <React.Fragment>
      <TexturedWallDisplay 
        textureUrl={textureUrl} 
        artworkData={artworkData}
        mapTexture={null}
        maxDimension={maxDimension}
        orientation={orientation} 
        aspectRatio={aspectRatio} 
        isPainting={isPainting}
        onDimensionsCalculated={handleArtworkDimensions}
        isFocused={isFocused}
        lightsOn={lightsOn}
        artworkType={artworkType}
        sourceArtworkType={sourceArtworkType}
      />

      
    </React.Fragment>
  );
};

export default CanvasExhibit;