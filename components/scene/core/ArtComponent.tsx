

import React, { Suspense, useCallback, useRef, useState, useEffect, useMemo } from 'react';

import { ArtworkData, ArtType, Exhibition } from '../../../types';
import { Html } from '@react-three/drei';
import HeartEmitter from '../../ui/HeartEmitter';
import * as THREE from 'three'; // NEW: Import THREE

const LazyCanvasExhibit = React.lazy(() => import('../art/CanvasExhibit'));
const LazySculptureExhibit = React.lazy(() => import('../art/SculptureExhibit'));

interface ExhibitVisualDimensions {
    width: number;
    height: number;
    depth: number;
    surfaceZ: number;
    centerOffsetY: number;
    podiumHeight?: number;
}

const CONTROLS_OFFSET_X = 1;
const CONTROLS_OFFSET_Y = -1.5;
const CONTROLS_OFFSET_Z = -4.5;

const HEART_EMITTER_OFFSET_Z = 1.0; // 愛心發射器的 Z 軸偏移
const HEART_EMITTER_OFFSET_Y_CANVAS = 8; // 畫布愛心發射器的 Y 軸偏移
const HEART_EMITTER_OFFSET_Y_SCULPTURE = 0.5;

const LIKES_DISPLAY_OFFSET_Z = 0.2;
const LIKES_DISPLAY_OFFSET_Y_CANVAS = 0;
const LIKES_DISPLAY_OFFSET_Y_SCULPTURE = 0; 

// NEW: Constant for fixed Y-position of likes display in ranking mode
const RANKING_LIKES_FIXED_Y_POSITION = 2.5; // 固定按讚數顯示的 Y 軸位置，所有藝術品皆使用此高度

// NEW: Constants for ranking mode likes display positioning
// World X for the left edge of the entire numbers block (including the line's start)
const BASE_LIKES_DISPLAY_LEFT_ANCHOR_WORLD_X = -4; // Base value
const HTML_DISTANCE_FACTOR = 11; // Corresponds to Html component's distanceFactor prop

// NEW: Fixed world width for the entire HTML block in ranking mode, ensuring consistent sizing.
// Calculated as: (Text block width 100px + left/right margin 3px + Line width 20px + left/right margin 3px) / HTML_DISTANCE_FACTOR
// (100 + 3 + 20 + 3) / 11 = 126 / 11 = ~11.45 world units
const RANKING_MODE_HTML_WORLD_WIDTH = 11.5; 

// NEW: Default dimensions for canvas artworks when actual dimensions are not yet loaded
const DEFAULT_CANVAS_WALL_DEPTH = 0.4; // Consistent with CanvasExhibit.tsx
const DEFAULT_CANVAS_SURFACE_Z = DEFAULT_CANVAS_WALL_DEPTH / 2 + 0.01;

interface ArtComponentProps {
    id: string;
    type: ArtType;
    artworkPosition: [number, number, number];
    artworkRotation: [number, number, number];
    artworkType: ArtType;
    sourceArtworkType?: string | undefined;
    isFocused: boolean;
    textureUrl?: string;
    artworkData?: ArtworkData;
    isMotionVideo?: boolean;
    isFaultyMotionVideo?: boolean;
    aspectRatio?: number;
    lightsOn?: boolean;
    uiConfig: any;
    setFocusedArtworkInstanceId: (id: string | null) => void;
    activeExhibition: Exhibition;
    onInfoOpen: () => void;
    isDebugMode: boolean;
    triggerHeartEmitter: number;
    heartEmitterArtworkId: string | null;
    onArtworkClicked: (e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    isRankingMode: boolean;
    isCameraMovingToArtwork: boolean; // NEW: Camera moving state
    displayLikes?: number | null;
    isSmallScreen: boolean; // NEW: Add isSmallScreen prop
    thresholdLevel?: number; // NEW: Threshold level for confetti animation
    activeZoneId?: string; // NEW: Add activeZoneId for zone-specific artwork data
}


const ArtComponent: React.FC<ArtComponentProps> = ({
    id,
    type, artworkPosition, artworkRotation, artworkType,
    isFocused, textureUrl, artworkData, isMotionVideo, isFaultyMotionVideo, aspectRatio, lightsOn,
      uiConfig, setFocusedArtworkInstanceId, activeExhibition, onInfoOpen, isDebugMode,
      triggerHeartEmitter, heartEmitterArtworkId, onArtworkClicked,
      isRankingMode, isCameraMovingToArtwork, displayLikes, isSmallScreen, sourceArtworkType, thresholdLevel, activeZoneId // NEW: Destructure noReflections
}) => {
  // Debug logging removed to reduce console noise in production/dev
    const [visualDimensions, setVisualDimensions] = useState<ExhibitVisualDimensions | null>(null);

    const isPaintingArtwork = artworkType.startsWith('canvas_');

    // NEW: Memoized effective visual dimensions, providing defaults if state is null
    const effectiveVisualDimensions = useMemo(() => {
        if (visualDimensions) return visualDimensions;

        // Provide a reasonable fallback for canvas types if dimensions haven't been calculated yet
        if (isPaintingArtwork || isMotionVideo || isFaultyMotionVideo) {
            const isLargeCanvas = sourceArtworkType === 'painting' || sourceArtworkType === 'photography';
            let width = isLargeCanvas ? 12.0 : 6.0; 
            let height = isLargeCanvas ? 8.0 : 4.0;
            let centerOffsetY = isLargeCanvas ? 6.0 : 3.0; 

            return {
                width,
                height,
                depth: 0, // Paintings don't have depth in this context
                surfaceZ: DEFAULT_CANVAS_SURFACE_Z,
                centerOffsetY,
            };
        }
        // For sculptures, it's harder to guess, so keep it null if not loaded
        return null; 
    }, [visualDimensions, isPaintingArtwork, isMotionVideo, isFaultyMotionVideo, artworkType]);


    const handleCanvasDimensionsCalculated = useCallback((
      width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number
    ) => {
        const dims = {
            width, height,
            depth: 0,
            surfaceZ: artworkSurfaceZ,
            centerOffsetY: artworkCenterY,
        };
        setVisualDimensions(dims);
    }, [id]);

    const handleSculptureDimensionsCalculated = useCallback((
      width: number, height: number, depth: number, podiumHeight: number, finalGroupYPosition: number
    ) => {
      const dims = {
          width, height, depth,
          // FIX: 修正 'finalGroupYYPosition' 為 'finalGroupYPosition'
          surfaceZ: finalGroupYPosition + depth / 2,
          centerOffsetY: finalGroupYPosition + height / 2,
          podiumHeight,
      };
      setVisualDimensions(dims);
    }, [id]);

    const handleArtworkClickedHtml = useCallback((e: React.MouseEvent<HTMLDivElement>, position: [number, number, number], rotation: [number, number, number], type: ArtType) => {
        onArtworkClicked(e, id, position, rotation, type, !!isMotionVideo);
    }, [onArtworkClicked, id, isMotionVideo]);

    const materialJson = React.useMemo(() => {
      try { return artworkData ? JSON.stringify(artworkData.material || {}) : ''; } catch (e) { return ''; }
    }, [artworkData]);

    const commonProps = React.useMemo(() => ({
      isFocused,
      textureUrl,
      artworkData,
      isMotionVideo,
      isFaultyMotionVideo,
      aspectRatio,
      lightsOn,
      artworkPosition,
      artworkRotation,
      artworkType,
      sourceArtworkType,
      onArtworkClickedHtml: handleArtworkClickedHtml,
      isSmallScreen,
      isCameraMovingToArtwork,
      materialJson,
      thresholdLevel, // NEW: Add thresholdLevel
    }), [
      isFocused,
      textureUrl,
      isMotionVideo,
      isFaultyMotionVideo,
      aspectRatio,
      lightsOn,
      artworkPosition[0],
      artworkPosition[1],
      artworkPosition[2],
      artworkRotation[0],
      artworkRotation[1],
      artworkRotation[2],
      artworkType,
      sourceArtworkType,
      handleArtworkClickedHtml,
      isSmallScreen,
      isCameraMovingToArtwork,
      materialJson,
      artworkData,
      thresholdLevel, // NEW: Add thresholdLevel dependency
    ]);

    const componentMap: { [key: string]: React.ReactNode } = {
        'canvas_portrait': <LazyCanvasExhibit orientation="portrait" {...commonProps} isPainting={isPaintingArtwork} onDimensionsCalculated={handleCanvasDimensionsCalculated} artworkData={artworkData} />,
        'canvas_landscape': <LazyCanvasExhibit orientation="landscape" {...commonProps} isPainting={isPaintingArtwork} onDimensionsCalculated={handleCanvasDimensionsCalculated} artworkData={artworkData} />,
        'canvas_square': <LazyCanvasExhibit orientation="square" {...commonProps} isPainting={isPaintingArtwork} onDimensionsCalculated={handleCanvasDimensionsCalculated} artworkData={artworkData} />,
        'sculpture_base': <LazySculptureExhibit {...commonProps} onDimensionsCalculated={handleSculptureDimensionsCalculated} activeZoneId={activeZoneId} />,
    };

    const componentToRender = componentMap[type] || null;

    const htmlPosition = useRef<THREE.Vector3>(new THREE.Vector3()); // FIX: Use THREE.Vector3

    // MODIFIED: Use effectiveVisualDimensions
    if (effectiveVisualDimensions && isFocused) {
      const finalX = effectiveVisualDimensions.width / 2 + CONTROLS_OFFSET_X;
      const finalY = effectiveVisualDimensions.centerOffsetY + CONTROLS_OFFSET_Y;
      const finalZ = effectiveVisualDimensions.surfaceZ + CONTROLS_OFFSET_Z;

      htmlPosition.current.set(finalX, finalY, finalZ); // FIX: Use .set()
    }

    const heartEmitterHtmlPosition = useRef<THREE.Vector3>(new THREE.Vector3()); // FIX: Use THREE.Vector3
    // MODIFIED: Use effectiveVisualDimensions
    if (effectiveVisualDimensions) {
      if (isPaintingArtwork || isMotionVideo || isFaultyMotionVideo) {
        heartEmitterHtmlPosition.current.set(0, effectiveVisualDimensions.centerOffsetY - (effectiveVisualDimensions.height / 2) + HEART_EMITTER_OFFSET_Y_CANVAS, effectiveVisualDimensions.surfaceZ + HEART_EMITTER_OFFSET_Z); // FIX: Use .set()
      } else {
        heartEmitterHtmlPosition.current.set(0, (effectiveVisualDimensions.podiumHeight || 0) + HEART_EMITTER_OFFSET_Y_SCULPTURE, effectiveVisualDimensions.depth / 2 + HEART_EMITTER_OFFSET_Z); // FIX: Use .set()
      }
    } else {
      heartEmitterHtmlPosition.current.set(0, 0.5 + HEART_EMITTER_OFFSET_Y_SCULPTURE, 0.5 + HEART_EMITTER_OFFSET_Z); // FIX: Use .set()
    }

    const likesTextHtmlPosition = useRef<THREE.Vector3>(new THREE.Vector3()); // FIX: Use THREE.Vector3
    // The requiredHtmlWorldWidthRef is no longer dynamically calculated but takes the fixed value.
    const requiredHtmlWorldWidthRef = useRef(RANKING_MODE_HTML_WORLD_WIDTH);

    // MODIFIED: Use effectiveVisualDimensions and new constant RANKING_MODE_HTML_WORLD_WIDTH for positioning
    if (effectiveVisualDimensions && isRankingMode && displayLikes !== null && displayLikes !== undefined) {
      // Adjust LIKES_DISPLAY_LEFT_ANCHOR_WORLD_X based on artwork type
      const LIKES_DISPLAY_LEFT_ANCHOR_WORLD_X = isPaintingArtwork
        ? BASE_LIKES_DISPLAY_LEFT_ANCHOR_WORLD_X - 5 // Shift Painting 10 units further left
        : BASE_LIKES_DISPLAY_LEFT_ANCHOR_WORLD_X; // Sculpture uses base value

      const htmlLeftEdgeWorldX = LIKES_DISPLAY_LEFT_ANCHOR_WORLD_X;
      
      let zOffset; // Only zOffset will vary per artwork type now

      if (isPaintingArtwork || isMotionVideo || isFaultyMotionVideo) {
        zOffset = effectiveVisualDimensions.surfaceZ + LIKES_DISPLAY_OFFSET_Z;
      } else {
        zOffset = effectiveVisualDimensions.depth / 2 + LIKES_DISPLAY_OFFSET_Z;
      }
      // The HTML block is positioned at its left edge.
      // Use the fixed Y position here
      likesTextHtmlPosition.current.set(htmlLeftEdgeWorldX, RANKING_LIKES_FIXED_Y_POSITION, zOffset); // FIX: Use .set()
    }


    // MODIFIED: Use effectiveVisualDimensions
    const debugLabelYPosition = effectiveVisualDimensions ? effectiveVisualDimensions.centerOffsetY : 0;
    // MODIFIED: Use effectiveVisualDimensions for calculation
    const debugLabelOffset = effectiveVisualDimensions ? Math.max(effectiveVisualDimensions.width, effectiveVisualDimensions.depth || 0) / 2 + 2 : 3;

    const debugLabelPos1 = useMemo(() => new THREE.Vector3(0, debugLabelYPosition, debugLabelOffset), [debugLabelYPosition, debugLabelOffset]);
    const debugLabelPos2 = useMemo(() => new THREE.Vector3(0, debugLabelYPosition, -debugLabelOffset), [debugLabelYPosition, debugLabelOffset]);
    const debugLabelPos3 = useMemo(() => new THREE.Vector3(debugLabelOffset, debugLabelYPosition, 0), [debugLabelYPosition, debugLabelOffset]);
    const debugLabelPos4 = useMemo(() => new THREE.Vector3(-debugLabelOffset, debugLabelYPosition, 0), [debugLabelYPosition, debugLabelOffset]);

    return (
        <group>
            <Suspense fallback={null}>
                {componentToRender}
                {(() => {
                  const shouldRenderHeartEmitter = id === heartEmitterArtworkId;
                  return shouldRenderHeartEmitter ? (
                    <Html
                      position={heartEmitterHtmlPosition.current}
                      wrapperClass="heart-emitter-wrapper"
                      distanceFactor={HTML_DISTANCE_FACTOR} // Use the constant
                    >
                      <div style={{ pointerEvents: 'none' }}>
                        <HeartEmitter trigger={triggerHeartEmitter} />
                      </div>
                    </Html>
                  ) : null;
                })()}

                {/* MODIFIED: Use effectiveVisualDimensions and dynamic width calculation */}
                {effectiveVisualDimensions && isRankingMode && displayLikes !== null && displayLikes !== undefined && (
                  <Html
                    position={likesTextHtmlPosition.current}
                    wrapperClass="likes-display-wrapper"
                    distanceFactor={HTML_DISTANCE_FACTOR} // Use the constant
                    center={false} // NEW: Explicitly set to false to align position to top-left
                  >
                    {/* Outermost div for HTML content, applies pointerEvents and dynamic width */}
                    <div style={{
                      pointerEvents: 'none',
                      // Apply computed pixel width based on the fixed world width
                      width: `${requiredHtmlWorldWidthRef.current * HTML_DISTANCE_FACTOR}px`, // 11.5 * 11 = 126.5px
                    }}>
                      {/* Flex container to hold text block and line */}
                      <div className="flex items-center w-full justify-start"> 
                        {/* Text Block (numbers + 'liked') */}
                        {/* MODIFIED: Changed min-w-[70px] to w-[100px] to fix text width for consistent line length */}
                        <div className="flex flex-col items-end justify-center w-[100px]"> 
                          <div className={`
                            font-serif text-6xl font-extrabold uppercase whitespace-nowrap leading-none
                            ${uiConfig.lightsOn ? 'text-black' : 'text-white'}
                            `}
                          >
                            {displayLikes}
                          </div>
                          <span className={`text-xs font-mono tracking-tight mt-1
                            ${uiConfig.subtext}`}
                          >
                            liked
                          </span>
                        </div>
                        {/* Horizontal Line */}
                        {/* MODIFIED: Removed flexGrow: 1 and added fixed width w-[20px] for consistent length */}
                        <div className={`h-px ml-3 mr-3 w-[20px]`}
                             style={{
                               backgroundColor: uiConfig.lightsOn ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
                             }}
                        ></div>
                      </div>
                    </div>
                  </Html>
                )}


                {isFocused && isDebugMode && (
                    <group>
                        {/* FIX: Use THREE.Vector3 for position */}
                        <Html position={debugLabelPos1} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                            <div className="text-white bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">1</div>
                        </Html>
                        {/* FIX: Use THREE.Vector3 for position */}
                        <Html position={debugLabelPos2} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                            <div className="text-white bg-red-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">2</div>
                        </Html>
                        {/* FIX: Use THREE.Vector3 for position */}
                        <Html position={debugLabelPos3} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                            <div className="text-white bg-green-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">3</div>
                        </Html>
                        {/* FIX: Use THREE.Vector3 for position */}
                        <Html position={debugLabelPos4} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                            <div className="text-white bg-yellow-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">4</div>
                        </Html>
                    </group>
                )}
            </Suspense>
        </group>
    );
};

export default ArtComponent;