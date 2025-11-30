import React, { Suspense } from 'react';

import CanvasExhibit from '../art/CanvasExhibit';
import SphereExhibit from '../art/SphereExhibit';
import SculptureExhibit from '../art/SculptureExhibit';

import { ArtworkData, ArtType } from '../../../types';

interface ArtComponentProps {
    type: ArtType;
    zone: string;
    isFocused: boolean;
    textureUrl?: string;
    artworkData?: ArtworkData;
    isMotionVideo?: boolean;
    isFaultyMotionVideo?: boolean;
    aspectRatio?: number;
    lightsOn?: boolean;
}

const ArtComponent: React.FC<ArtComponentProps> = ({ type, zone, isFocused, textureUrl, artworkData, isMotionVideo, isFaultyMotionVideo, aspectRatio, lightsOn }) => {
    const isPainting = type.startsWith('canvas_');

    const componentMap: { [key: string]: React.ReactNode } = {
        'canvas_portrait': <CanvasExhibit orientation="portrait" textureUrl={textureUrl} isMotionVideo={isMotionVideo} isFaultyMotionVideo={isFaultyMotionVideo} isPainting={isPainting} aspectRatio={aspectRatio} isFocused={isFocused} lightsOn={lightsOn} />,
        'canvas_landscape': <CanvasExhibit orientation="landscape" textureUrl={textureUrl} isMotionVideo={isMotionVideo} isFaultyMotionVideo={isFaultyMotionVideo} isPainting={isPainting} aspectRatio={aspectRatio} isFocused={isFocused} lightsOn={lightsOn} />,
        'canvas_square': <CanvasExhibit orientation="square" textureUrl={textureUrl} isMotionVideo={isMotionVideo} isFaultyMotionVideo={isFaultyMotionVideo} isPainting={isPainting} aspectRatio={aspectRatio} isFocused={isFocused} lightsOn={lightsOn} />,
        'sculpture_base': <SculptureExhibit artworkData={artworkData} zone={zone} textureUrl={textureUrl} />,
        'sphere_exhibit': <SphereExhibit />,
    };

    const componentToRender = componentMap[type] || null;

    return <Suspense fallback={null}>{componentToRender}</Suspense>;
};

export default ArtComponent;