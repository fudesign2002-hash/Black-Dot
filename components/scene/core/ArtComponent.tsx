import React, { Suspense, useCallback, useRef, useState, useEffect } from 'react';

import { ArtworkData, ArtType, Exhibition } from '../../../types';
import { Html } from '@react-three/drei';
import HeartEmitter from '../../ui/HeartEmitter';
import JiggleText from '../../ui/JiggleText';

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

const HEART_EMITTER_OFFSET_Z = 1.0;
const HEART_EMITTER_OFFSET_Y_CANVAS = -1.5;
const HEART_EMITTER_OFFSET_Y_SCULPTURE = 0.5;

const LIKES_DISPLAY_OFFSET_Z = 0.2;
const LIKES_DISPLAY_OFFSET_Y_CANVAS = -0.2;
const LIKES_DISPLAY_OFFSET_Y_SCULPTURE = 0.5;
const LIKES_DISPLAY_OFFSET_X_LEFT = -4;

interface ArtComponentProps {
    id: string;
    type: ArtType;
    artworkPosition: [number, number, number];
    artworkRotation: [number, number, number];
    artworkType: ArtType;
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
    displayLikes?: number | null;
}


const ArtComponent: React.FC<ArtComponentProps> = ({
    id,
    type, artworkPosition, artworkRotation, artworkType,
    isFocused, textureUrl, artworkData, isMotionVideo, isFaultyMotionVideo, aspectRatio, lightsOn,
    uiConfig, setFocusedArtworkInstanceId, activeExhibition, onInfoOpen, isDebugMode,
    triggerHeartEmitter, heartEmitterArtworkId, onArtworkClicked,
    isRankingMode, displayLikes
}) => {
    const [visualDimensions, setVisualDimensions] = useState<ExhibitVisualDimensions | null>(null);

    const isPaintingArtwork = artworkType.startsWith('canvas_');

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
          surfaceZ: finalGroupYPosition + depth / 2,
          centerOffsetY: finalGroupYPosition + height / 2,
          podiumHeight,
      };
      setVisualDimensions(dims);
    }, [id]);

    const handleArtworkClickedHtml = useCallback((e: React.MouseEvent<HTMLDivElement>, position: [number, number, number], rotation: [number, number, number], type: ArtType) => {
        onArtworkClicked(e, id, position, rotation, type, !!isMotionVideo);
    }, [onArtworkClicked, id, isMotionVideo]);

    const commonProps = {
        isFocused, textureUrl, artworkData, isMotionVideo, isFaultyMotionVideo, aspectRatio, lightsOn,
        artworkPosition, artworkRotation, artworkType,
        onArtworkClickedHtml: handleArtworkClickedHtml,
    };

    const componentMap: { [key: string]: React.ReactNode } = {
        'canvas_portrait': <LazyCanvasExhibit orientation="portrait" {...commonProps} isPainting={isPaintingArtwork} onDimensionsCalculated={handleCanvasDimensionsCalculated} />,
        'canvas_landscape': <LazyCanvasExhibit orientation="landscape" {...commonProps} isPainting={isPaintingArtwork} onDimensionsCalculated={handleCanvasDimensionsCalculated} />,
        'canvas_square': <LazyCanvasExhibit orientation="square" {...commonProps} isPainting={isPaintingArtwork} onDimensionsCalculated={handleCanvasDimensionsCalculated} />,
        'sculpture_base': <LazySculptureExhibit {...commonProps} onDimensionsCalculated={handleSculptureDimensionsCalculated} />,
    };

    const componentToRender = componentMap[type] || null;

    const htmlPosition = useRef<[number, number, number]>([0,0,0]);

    if (visualDimensions && isFocused) {
      const finalX = visualDimensions.width / 2 + CONTROLS_OFFSET_X;
      const finalY = visualDimensions.centerOffsetY + CONTROLS_OFFSET_Y;
      const finalZ = visualDimensions.surfaceZ + CONTROLS_OFFSET_Z;

      htmlPosition.current = [finalX, finalY, finalZ];
    }

    const heartEmitterHtmlPosition = useRef<[number, number, number]>([0, 0, 0]);
    if (visualDimensions) {
      if (isPaintingArtwork || isMotionVideo || isFaultyMotionVideo) {
        heartEmitterHtmlPosition.current = [0, visualDimensions.centerOffsetY - (visualDimensions.height / 2) + HEART_EMITTER_OFFSET_Y_CANVAS, visualDimensions.surfaceZ + HEART_EMITTER_OFFSET_Z];
      } else {
        heartEmitterHtmlPosition.current = [0, (visualDimensions.podiumHeight || 0) + HEART_EMITTER_OFFSET_Y_SCULPTURE, visualDimensions.depth / 2 + HEART_EMITTER_OFFSET_Z];
      }
    } else {
      heartEmitterHtmlPosition.current = [0, 0.5 + HEART_EMITTER_OFFSET_Y_SCULPTURE, 0.5 + HEART_EMITTER_OFFSET_Z]; 
    }

    const likesTextHtmlPosition = useRef<[number, number, number]>([0, 0, 0]);
    if (visualDimensions && isRankingMode && displayLikes !== null) {
      const currentEffectiveScale = (isRankingMode && isPaintingArtwork) ? 0.8 : 1.0; 
      const effectiveWidth = visualDimensions.width * currentEffectiveScale;

      let xOffset;
      let yOffset;
      let zOffset;

      if (isPaintingArtwork || isMotionVideo || isFaultyMotionVideo) {
        xOffset = -(effectiveWidth / 2) + LIKES_DISPLAY_OFFSET_X_LEFT;
        yOffset = visualDimensions.centerOffsetY + LIKES_DISPLAY_OFFSET_Y_CANVAS;
        zOffset = visualDimensions.surfaceZ + LIKES_DISPLAY_OFFSET_Z;
      } else {
        xOffset = -(effectiveWidth / 2) + LIKES_DISPLAY_OFFSET_X_LEFT;
        yOffset = (visualDimensions.podiumHeight || 0) + LIKES_DISPLAY_OFFSET_Y_SCULPTURE;
        zOffset = visualDimensions.depth / 2 + LIKES_DISPLAY_OFFSET_Z;
      }
      likesTextHtmlPosition.current = [xOffset, yOffset, zOffset];
    }


    const debugLabelYPosition = visualDimensions ? visualDimensions.centerOffsetY : 0;
    const debugLabelOffset = visualDimensions ? Math.max(visualDimensions.width, visualDimensions.depth || 0) / 2 + 2 : 3;

    return (
        <Suspense fallback={null}>
            {componentToRender}
            {(() => {
              const shouldRenderHeartEmitter = id === heartEmitterArtworkId;
              return shouldRenderHeartEmitter ? (
                <Html
                  position={heartEmitterHtmlPosition.current}
                  wrapperClass="heart-emitter-wrapper"
                  center
                  distanceFactor={10}
                  style={{ width: '0', height: '0', pointerEvents: 'none' }}
                >
                  <HeartEmitter trigger={triggerHeartEmitter} />
                </Html>
              ) : null;
            })()}

            {isRankingMode && displayLikes !== null && visualDimensions && (
              <Html
                position={likesTextHtmlPosition.current}
                wrapperClass="likes-display-wrapper"
                center
                distanceFactor={10}
                style={{ width: '0', height: '0', pointerEvents: 'none', transform: 'rotateX(0deg) rotateY(0deg)' }} 
              >
                <div className={`
                    font-serif text-6xl font-extrabold uppercase whitespace-nowrap
                    ${uiConfig.lightsOn ? 'text-black' : 'text-white'}
                    `}
                >
                  {displayLikes}
                </div>
              </Html>
            )}


            {isFocused && isDebugMode && (
                <group>
                    <Html position={[0, debugLabelYPosition, debugLabelOffset]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                        <div className="text-white bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">1</div>
                    </Html>
                    <Html position={[0, debugLabelYPosition, -debugLabelOffset]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                        <div className="text-white bg-red-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">2</div>
                    </Html>
                    <Html position={[debugLabelOffset, debugLabelYPosition, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                        <div className="text-white bg-green-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">3</div>
                    </Html>
                    <Html position={[-debugLabelOffset, debugLabelYPosition, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
                        <div className="text-white bg-yellow-500 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">4</div>
                    </Html>
                </group>
            )}
        </Suspense>
    );
};

export default ArtComponent;