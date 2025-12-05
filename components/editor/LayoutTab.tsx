import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { RefreshCw, Lightbulb, Sun } from 'lucide-react';
import { ExhibitionArtItem, ArtType, SimplifiedLightingConfig } from '../../types'; 

interface LayoutTabProps {
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
  };
  currentLayout: ExhibitionArtItem[];
  onEditorLayoutChange: (updater: (prevLayout: ExhibitionArtItem[]) => ExhibitionArtItem[]) => void;
  selectedArtworkId: string | null;
  onSelectArtwork: (id: string | null) => void;
  selectedArtworkTitle: string;
  selectedArtworkArtist: string;
  lightingConfig: SimplifiedLightingConfig;
  onUpdateLighting: (newConfig: SimplifiedLightingConfig) => void;
}

const PADDING_PERCENT = 3;
const SCENE_BOUNDS_X = 24;
const SCENE_BOUNDS_Z = 12;

const ARTWORK_DIMENSIONS_2D: Record<ArtType, { width: number; depth: number }> = {
  canvas_portrait: { width: 8.0, depth: 1.0 },
  canvas_landscape: { width: 17.0, depth: 1.0 },
  canvas_square: { width: 7.0, depth: 1.0 },
  sculpture_base: { width: 6.0, depth: 6.0 },
  media: { width: 17.0, depth: 1.0 },
  motion: { width: 17.0, depth: 1.0 },
};

const DIRECTIONAL_LIGHT_Y = 5; 

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Ripple {
  id: string;
  left: number;
  top: number;
  timestamp: number;
}

const getArtworkCollisionBox = (
  art: ExhibitionArtItem,
  currentPosition: [number, number, number],
): CollisionBox => {
  const { width, depth } = ARTWORK_DIMENSIONS_2D[art.type] || { width: 3, depth: 3 };

  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  const minX = currentPosition[0] - halfWidth;
  const maxX = currentPosition[0] + halfWidth;
  const minZ = currentPosition[2] - halfDepth;
  const maxZ = currentPosition[2] + halfDepth;

  return { minX, maxX, minZ, maxZ };
};

const checkCollision = (
  movingArt: ExhibitionArtItem,
  potentialPos: [number, number, number],
  staticArts: ExhibitionArtItem[],
): { collided: boolean; id: string | null } => {
  const movingBox = getArtworkCollisionBox(movingArt, potentialPos);

  for (const staticArt of staticArts) {
    if (movingArt.id === staticArt.id) continue;

    const staticBox = getArtworkCollisionBox(staticArt, staticArt.position);

    if (movingBox.maxX > staticBox.minX &&
        movingBox.minX < staticBox.maxX &&
        movingBox.maxZ > staticBox.minZ &&
        movingBox.minZ < staticBox.maxZ) {
      return { collided: true, id: staticArt.id };
    }
  }
  return { collided: false, id: null };
};

const LayoutTab: React.FC<LayoutTabProps> = React.memo(({
  uiConfig,
  currentLayout,
  onEditorLayoutChange,
  selectedArtworkId,
  onSelectArtwork,
  selectedArtworkTitle,
  selectedArtworkArtist,
  lightingConfig,
  onUpdateLighting,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [collidingArtworkId, setCollidingArtworkId] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextRippleId = useRef(0);

  const { lightsOn, text, subtext, border } = uiConfig;

  const selectedArt = currentLayout.find(art => art.id === selectedArtworkId);
  const currentRotationDegrees = selectedArt ? Math.round(selectedArt.rotation[1] * (180 / Math.PI)) : 0;

  const mapRange = useCallback((value: number, in_min: number, in_max: number, out_min: number, out_max: number) => {
    const clampedValue = Math.max(in_min, Math.min(value, in_max));
    return ((clampedValue - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  }, []);

  const getArtworkMapDisplayDimensions = useCallback((artType: ArtType) => {
    switch (artType) {
        case 'canvas_square':
            return { widthClass: 'w-4', heightClass: 'h-[6px]' };
        case 'canvas_portrait':
            return { widthClass: 'w-6', heightClass: 'h-[6px]' };
        case 'canvas_landscape':
        case 'media':
        case 'motion':
            return { widthClass: 'w-24', heightClass: 'h-[6px]' };
        case 'sculpture_base':
            return { widthClass: 'w-4', heightClass: 'h-4' };
        default:
            return { widthClass: 'w-4', heightClass: 'h-[6px]' };
    }
  }, []);

  const handleElementPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    if (id !== 'keyLight' && id !== 'fillLight') {
      onSelectArtwork(id);      
    } else {
      onSelectArtwork(null);
      if (!lightsOn) {
        setDraggedElementId(null);
        return;
      }
    }
    setDraggedElementId(id);      
  }, [onSelectArtwork, lightsOn]);


  useEffect(() => {
    if (!draggedElementId) {
      setCollidingArtworkId(null);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const minPixelX = rect.width * (PADDING_PERCENT / 100);
      const maxPixelX = rect.width * (1 - (PADDING_PERCENT / 100));
      const minPixelY = rect.height * (PADDING_PERCENT / 100);
      const maxPixelY = rect.height * (1 - (PADDING_PERCENT / 100));

      const newPosX = mapRange(x, minPixelX, maxPixelX, -SCENE_BOUNDS_X, SCENE_BOUNDS_X);
      const newPosZ = mapRange(y, minPixelY, maxPixelY, -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z);

      if (draggedElementId === 'keyLight') {
        const currentKeyLight = lightingConfig.keyLightPosition || [-2, 7, 10];
        const newKeyLightPosition: [number, number, number] = [newPosX, currentKeyLight[1], newPosZ];
        onUpdateLighting({ ...lightingConfig, keyLightPosition: newKeyLightPosition });
      } 
      else if (draggedElementId === 'fillLight') {
        const currentFillLight = lightingConfig.fillLightPosition || [5, 2, 5];
        const newFillLightPosition: [number, number, number] = [newPosX, currentFillLight[1], newPosZ];
        onUpdateLighting({ ...lightingConfig, fillLightPosition: newFillLightPosition });
      }
      else {
        const movingArt = currentLayout.find(art => art.id === draggedElementId);
        if (!movingArt) return;

        const potentialPosition: [number, number, number] = [newPosX, movingArt.position[1], newPosZ];
        
        const tempMovingArtForBounds: ExhibitionArtItem = { ...movingArt, position: potentialPosition };
        const potentialMovingBoxForBounds = getArtworkCollisionBox(tempMovingArtForBounds, potentialPosition);

        const outOfGlobalBounds =
          potentialMovingBoxForBounds.minX < -SCENE_BOUNDS_X ||
          potentialMovingBoxForBounds.maxX > SCENE_BOUNDS_X ||
          potentialMovingBoxForBounds.minZ < -SCENE_BOUNDS_Z ||
          potentialMovingBoxForBounds.maxZ > SCENE_BOUNDS_Z;

        const otherArts = currentLayout.filter(art => art.id !== draggedElementId);
        const collisionResult = checkCollision(movingArt, potentialPosition, otherArts); 

        setCollidingArtworkId(collisionResult.id);

        if (!outOfGlobalBounds) { 
          onEditorLayoutChange(prevLayout =>
            prevLayout.map(art =>
              art.id === draggedElementId
                ? { ...art, position: potentialPosition }
                : art
            )
          );
        }
      }
    };
    
    const handlePointerUp = () => {
      setDraggedElementId(null);
      setCollidingArtworkId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggedElementId, onEditorLayoutChange, mapRange, currentLayout, lightingConfig, onUpdateLighting]);


  const handleRotationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedArt) return;
    const degrees = parseInt(e.target.value, 10);
    const radians = degrees * (Math.PI / 180);

    const movingArt = selectedArt;
    const potentialPosition = movingArt.position;
    const potentialRotationY = radians; 

    const tempMovingArtForBounds: ExhibitionArtItem = {
      ...movingArt,
      rotation: [movingArt.rotation[0], potentialRotationY, movingArt.rotation[2]] as [number, number, number],
    };

    const potentialMovingBoxForBounds = getArtworkCollisionBox(tempMovingArtForBounds, potentialPosition);

    const outOfGlobalBounds =
      potentialMovingBoxForBounds.minX < -SCENE_BOUNDS_X ||
      potentialMovingBoxForBounds.maxX > SCENE_BOUNDS_X ||
      potentialMovingBoxForBounds.minZ < -SCENE_BOUNDS_Z ||
      potentialMovingBoxForBounds.maxZ > SCENE_BOUNDS_Z;

    const otherArts = currentLayout.filter(art => art.id !== selectedArtworkId);
    const collisionResult = checkCollision(movingArt, potentialPosition, otherArts); 
    setCollidingArtworkId(collisionResult.id);

    if (!outOfGlobalBounds) { 
      onEditorLayoutChange(prevLayout => prevLayout.map(art =>
        art.id === selectedArtworkId ? { ...art, rotation: [art.rotation[0], radians, art.rotation[2]] as [number, number, number] } : art
      ));
    }
  }, [selectedArt, selectedArtworkId, onEditorLayoutChange, currentLayout]);

  const handleRotationReset = useCallback(() => {
    if (!selectedArt) return;

    const movingArt = selectedArt;
    const potentialPosition = movingArt.position;
    const potentialRotationY = 0; 

    const tempMovingArtForBounds: ExhibitionArtItem = {
      ...movingArt,
      rotation: [movingArt.rotation[0], potentialRotationY, movingArt.rotation[2]] as [number, number, number],
    };

    const potentialMovingBoxForBounds = getArtworkCollisionBox(tempMovingArtForBounds, potentialPosition);

    const outOfGlobalBounds =
      potentialMovingBoxForBounds.minX < -SCENE_BOUNDS_X ||
      potentialMovingBoxForBounds.maxX > SCENE_BOUNDS_X ||
      potentialMovingBoxForBounds.minZ < -SCENE_BOUNDS_Z ||
      potentialMovingBoxForBounds.maxZ > SCENE_BOUNDS_Z;

    const otherArts = currentLayout.filter(art => art.id !== selectedArtworkId);
    const collisionResult = checkCollision(movingArt, potentialPosition, otherArts); 
    setCollidingArtworkId(collisionResult.id);

    if (!outOfGlobalBounds) { 
      onEditorLayoutChange(prevLayout => prevLayout.map(art =>
        art.id === selectedArtworkId ? { ...art, rotation: [art.rotation[0], 0, art.rotation[2]] as [number, number, number] } : art
      ));
    }
  }, [selectedArt, selectedArtworkId, onEditorLayoutChange, currentLayout]);

  const mapBgClass = lightsOn ? 'bg-white' : 'bg-[#212121]';
  const mapBorderClass = lightsOn ? 'border-neutral-200' : 'border-neutral-700/50';
  const innerBorderClass = lightsOn ? 'border-neutral-200/80' : 'border-neutral-700/30';
  const crosshairClass = lightsOn ? 'bg-neutral-300' : 'bg-neutral-700/30';
  const ringOffsetClass = lightsOn ? 'ring-offset-white' : 'ring-offset-[#212121]';
  const sliderTrackClass = lightsOn ? 'bg-neutral-200' : 'bg-neutral-700';
  const buttonHoverClass = lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700';
  const rippleColorClass = lightsOn ? 'text-cyan-500' : 'text-cyan-400';


  const keyLightWorldPos = lightingConfig.keyLightPosition || [-2, DIRECTIONAL_LIGHT_Y, 10];
  const fillLightWorldPos = lightingConfig.fillLightPosition || [5, DIRECTIONAL_LIGHT_Y, 5];

  const keyLightLeft = mapRange(keyLightWorldPos[0], -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
  const keyLightTop = mapRange(keyLightWorldPos[2], -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z, PADDING_PERCENT, 100 - PADDING_PERCENT);

  const fillLightLeft = mapRange(fillLightWorldPos[0], -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
  const fillLightTop = mapRange(fillLightWorldPos[2], -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z, PADDING_PERCENT, 100 - PADDING_PERCENT);

  return (
    <div className={`flex-1 flex flex-col p-4 overflow-hidden bg-neutral-500/5 ${text}`}>
      <div
        ref={containerRef}
        className={`w-full aspect-[2/1] rounded-lg border-2 border-dashed relative overflow-hidden touch-none ${mapBgClass} ${mapBorderClass}`}
      >
        <div className={`absolute inset-2 border border-dashed rounded-md pointer-events-none ${innerBorderClass}`} />
        <div className={`absolute top-1/2 left-0 w-full h-px pointer-events-none ${crosshairClass}`} />
        <div className={`absolute left-1/2 top-0 h-full w-px pointer-events-none ${crosshairClass}`} />

        {ripples.map(ripple => (
          <div
            key={ripple.id}
            className={`ripple-effect subtle ${rippleColorClass}`}
            style={{
              left: `${ripple.left}%`,
              top: `${ripple.top}%`,
            }}
          />
        ))}

        {currentLayout.map((art) => {
          const left = mapRange(art.position[0], -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
          const top = mapRange(art.position[2], -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z, PADDING_PERCENT, 100 - PADDING_PERCENT);
          const isSelected = art.id === selectedArtworkId;
          const isDragged = art.id === draggedElementId;
          const isColliding = art.id === collidingArtworkId;
          const isCanvas = art.type.startsWith('canvas_');

          return (
            <div
              key={art.id}
              onPointerDown={(e) => handleElementPointerDown(e, art.id)}
              className={`absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform ${isDragged ? 'cursor-grabbing scale-125 z-10' : 'cursor-grab'}`}
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{ transform: isCanvas ? `rotate(${-art.rotation[1]}rad)` : 'none' }}
              >
                {isCanvas ? (
                  <div className={`relative ${getArtworkMapDisplayDimensions(art.type).widthClass} ${getArtworkMapDisplayDimensions(art.type).heightClass} rounded-full overflow-hidden`}>
                    <div className={`w-full h-full ${lightsOn ? 'bg-neutral-800' : 'bg-neutral-200'}`} />
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400" />
                  </div>
                ) : (
                  <div className={`w-3 h-3 rounded-full ${lightsOn ? 'bg-black' : 'bg-white'} border-2 ${lightsOn ? 'border-white' : 'border-[#212121]'}`} />
                )}
              </div>
              
              {isSelected && <div className={`absolute w-5 h-5 rounded-full ring-2 ring-cyan-500 ring-offset-2 ${ringOffsetClass}`} />}
              {isColliding && <div className={`absolute w-5 h-5 rounded-full ring-2 ring-red-500 ring-offset-2 ${ringOffsetClass} colliding-ring`} />}
            </div>
          );
        })}

        <div
          onPointerDown={(e) => handleElementPointerDown(e, 'keyLight')}
          className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform cursor-grab z-20 ${draggedElementId === 'keyLight' ? 'scale-125' : ''} ${!lightsOn ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ top: `${keyLightTop}%`, left: `${keyLightLeft}%` }}
          title="Key Light"
        >
          <div className="relative">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono text-yellow-400 whitespace-nowrap">Key</span>
          </div>
          {draggedElementId === 'keyLight' && <div className={`absolute w-8 h-8 rounded-full ring-2 ring-yellow-400 ring-offset-2 ${ringOffsetClass}`} />}
        </div>

        <div
          onPointerDown={(e) => handleElementPointerDown(e, 'fillLight')}
          className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform cursor-grab z-20 ${draggedElementId === 'fillLight' ? 'scale-125' : ''} ${!lightsOn ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ top: `${fillLightTop}%`, left: `${fillLightLeft}%` }}
          title="Fill Light"
        >
          <div className="relative">
            <Sun className="w-5 h-5 text-blue-300" />
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono text-blue-300 whitespace-nowrap">Fill</span>
          </div>
          {draggedElementId === 'fillLight' && <div className={`absolute w-8 h-8 rounded-full ring-2 ring-blue-300 ring-offset-2 ${ringOffsetClass}`} />}
        </div>
      </div>

      <div className={`flex-shrink-0 pt-4 mt-4 border-t ${border}`}>
        <p className={`text-[10px] font-bold tracking-[0.2em] uppercase ${subtext}`}>Artwork Name</p>
        <p className="text-lg font-medium mt-1 min-h-[1.75rem]">{selectedArtworkId ? selectedArtworkTitle : ' '}</p>
        <p className={`text-sm mt-1 min-h-[1.25rem] ${subtext}`}>{selectedArtworkId && selectedArtworkArtist ? `by ${selectedArtworkArtist}` : ' '}</p>
        
        <div className={`transition-opacity duration-300 ${selectedArt ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-4 mt-4">
            <button onClick={handleRotationReset} className={`p-2 rounded-full transition-colors ${buttonHoverClass}`} title="Reset Rotation">
              <RefreshCw className="w-4 h-4" />
            </button>
            <input 
              type="range"
              min="-180"
              max="180"
              step="1"
              value={currentRotationDegrees}
              onChange={handleRotationChange}
              disabled={!selectedArt}
              className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50 ${sliderTrackClass}`}
            />
            <span className="font-mono text-sm w-12 text-right">{currentRotationDegrees}°</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LayoutTab;