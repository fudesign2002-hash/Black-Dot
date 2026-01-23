

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { RefreshCw, Lightbulb, Sun, Video, Sparkles, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'; // NEW: Add Trash2
// FIX: Added missing imports for types
import { ExhibitionArtItem, SimplifiedLightingConfig, ArtType, FirebaseArtwork, ArtworkData } from '../../types';
import ArtworkSettingsForm from './ArtworkSettingsForm'; // NEW: Import ArtworkSettingsForm

interface LayoutTabProps {
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  currentLayout: ExhibitionArtItem[];
  onEditorLayoutChange: (updater: (prevLayout: ExhibitionArtItem[]) => ExhibitionArtItem[]) => void;
  selectedArtworkId: string | null;
  onSelectArtwork: (id: string | null) => void;
  selectedArtworkTitle: string;
  selectedArtworkArtist: string;
  lightingConfig: SimplifiedLightingConfig;
  onUpdateLighting: (newConfig: SimplifiedLightingConfig) => void;
  setIsAnyLayoutItemDragging: (isDragging: boolean) => void; // NEW prop
  firebaseArtworks: FirebaseArtwork[]; // NEW: Add firebaseArtworks
  onUpdateArtworkFile: (artworkId: string, newFileUrl: string) => Promise<void>; // NEW: Add onUpdateArtworkFile
  onUpdateArtworkData: (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => Promise<void>; // NEW: Add onUpdateArtworkData
  onUpdateArtworkField: (artworkId: string, field: string, value: any) => Promise<void>; // NEW: Add onUpdateArtworkField
  onRemoveArtworkFromLayout: (artworkId: string) => Promise<void>; // NEW: Add onRemoveArtworkFromLayout
  onOpenConfirmationDialog: (itemType: 'artwork_removal', artworkId: string, artworkTitle: string) => void; // NEW: Add onOpenConfirmationDialog
  isSignedIn?: boolean; // NEW: Add isSignedIn prop
  activeZoneId: string; // NEW: Add activeZoneId for zone-specific artwork settings
  onArtworkLiftedChange?: (isLifted: boolean) => void; // NEW: Callback for artwork lifted state
}

const PADDING_PERCENT = 3;
const SCENE_BOUNDS_X = 48; // MODIFIED: Changed from 24 to 48 to zoom out the 2D map scale (halving perceived distance)
const SCENE_BOUNDS_Z = 48; // MODIFIED: Changed from 24 to 48 to zoom out the 2D map scale (halving perceived distance)

const ARTWORK_DIMENSIONS_2D: Record<ArtType, { width: number; depth: number }> = {
  canvas_portrait: { width: 12.0, depth: 1.0 },
  canvas_landscape: { width: 24.0, depth: 1.0 },
  canvas_square: { width: 10.0, depth: 1.0 },
  sculpture_base: { width: 6.0, depth: 6.0 },
  media: { width: 24.0, depth: 1.0 },
  motion: { width: 24.0, depth: 1.0 },
};

const DIRECTIONAL_LIGHT_Y = 5; 
const CAMERA_FIXED_Y_POSITION = 4; // NEW: Fixed Y position for the camera on the map
const CAMERA_MIN_DRAG_DISTANCE = 15; // MODIFIED: Adjusted to 15 as requested
const CAMERA_MAX_DRAG_DISTANCE = 35; // MODIFIED: Increased slightly to 35

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
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
        movingBox.maxX > staticBox.minX &&
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
  setIsAnyLayoutItemDragging,
  firebaseArtworks, // NEW: Destructure firebaseArtworks
  onUpdateArtworkFile, // NEW: Destructure onUpdateArtworkFile
  onUpdateArtworkData, // NEW: Destructure onUpdateArtworkData
  onUpdateArtworkField, // NEW: Destructure onUpdateArtworkField
  onRemoveArtworkFromLayout, // NEW: Destructure onRemoveArtworkFromLayout
  onOpenConfirmationDialog, // NEW: Destructure onOpenConfirmationDialog
  isSignedIn = false, // NEW: Destructure isSignedIn
  activeZoneId, // NEW: Destructure activeZoneId
  onArtworkLiftedChange, // NEW: Destructure onArtworkLiftedChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [isEditingArtwork, setIsEditingArtwork] = useState<boolean>(false); // NEW: State for edit panel
  const [collidingArtworkId, setCollidingArtworkId] = useState<string | null>(null);
  const [cameraIconRotation, setCameraIconRotation] = useState(0); // NEW: State for camera icon rotation in degrees
  const [isArtworkLifted, setIsArtworkLifted] = useState(false); // NEW: Track if artwork is lifted (first selection)

  const hasMotionArt = useMemo(() => {
    return currentLayout.some(art => art.type === 'motion') || 
           currentLayout.some(art => {
             const fbArt = firebaseArtworks.find(f => f.id === art.artworkId);
             return fbArt?.artwork_type === 'motion';
           });
  }, [currentLayout, firebaseArtworks]);

  const { lightsOn, text, subtext, border } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  const selectedArt = currentLayout.find(art => art.id === selectedArtworkId);
  const currentRotationDegrees = selectedArt ? Math.round(selectedArt.rotation[1] * (180 / Math.PI)) : 0;

  const mapRange = useCallback((value: number, in_min: number, in_max: number, out_min: number, out_max: number) => {
    const clampedValue = Math.max(in_min, Math.min(value, in_max));
    return ((clampedValue - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  }, []);

  const getArtworkMapDisplayDimensions = useCallback((artType: ArtType) => {
    switch (artType) {
        case 'canvas_square':
            return { widthClass: 'w-12', heightClass: 'h-[6px]' };
        case 'canvas_portrait':
            return { widthClass: 'w-16', heightClass: 'h-[6px]' };
        case 'canvas_landscape':
        case 'media':
        case 'motion':
            return { widthClass: 'w-32', heightClass: 'h-[6px]' };
        case 'sculpture_base':
            return { widthClass: 'w-4', heightClass: 'h-4' };
        default:
            return { widthClass: 'w-4', heightClass: 'h-[6px]' };
    }
  }, []);

  const handleElementPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    // FIX: Only call onSelectArtwork if it's an artwork, not a light
    if (id !== 'keyLight' && id !== 'fillLight' && id !== 'customCamera') { // MODIFIED: Add customCamera
      onSelectArtwork(id);
      setIsArtworkLifted(true); // NEW: Lift artwork when selected
      onArtworkLiftedChange?.(true); // NEW: Notify parent
    } else {
      // If motion art is present, camera position is fixed and cannot be dragged
      if (id === 'customCamera' && hasMotionArt) {
        return;
      }

      // onSelectArtwork(null); // Deselect artwork when interacting with lights - REMOVED for simplification
      if (!lightsOn && (id === 'keyLight' || id === 'fillLight')) { // Only disable lights if lights are off
        setDraggedElementId(null);
        return;
      }
    }
    // NEW: Add null check for setIsAnyLayoutItemDragging
    if (typeof setIsAnyLayoutItemDragging === 'function') {
      setIsAnyLayoutItemDragging(true); // NEW: Set dragging state to true
    }
    setDraggedElementId(id);      
  }, [onSelectArtwork, lightsOn, setIsAnyLayoutItemDragging, hasMotionArt]); // Add setIsAnyLayoutItemDragging to deps

  // NEW: Effect to set initial camera icon rotation
  useEffect(() => {
    const initialX = lightingConfig.customCameraPosition?.[0] || -8;
    const initialZ = lightingConfig.customCameraPosition?.[2] || 25;
    const initialAngleRadians = Math.atan2(0 - initialZ, 0 - initialX); // Angle from camera to origin
    setCameraIconRotation(initialAngleRadians * (180 / Math.PI));
  }, [lightingConfig.customCameraPosition]);


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
      else if (draggedElementId === 'customCamera') { // NEW: Handle customCamera drag
        // NEW: Enforce CAMERA_MIN_DRAG_DISTANCE and CAMERA_MAX_DRAG_DISTANCE constraints
        const currentDist = Math.sqrt(newPosX * newPosX + newPosZ * newPosZ);
        
        let clampedX = newPosX;
        let clampedZ = newPosZ;

        if (currentDist < CAMERA_MIN_DRAG_DISTANCE) {
          // If too close, project onto the boundary circle
          const factor = CAMERA_MIN_DRAG_DISTANCE / (currentDist || 0.1); // Avoid division by zero
          clampedX = newPosX * factor;
          clampedZ = newPosZ * factor;
        } else if (currentDist > CAMERA_MAX_DRAG_DISTANCE) {
          // If too far, project onto the outer boundary circle
          const factor = CAMERA_MAX_DRAG_DISTANCE / currentDist;
          clampedX = newPosX * factor;
          clampedZ = newPosZ * factor;
        }

        const newCameraPosition: [number, number, number] = [clampedX, CAMERA_FIXED_Y_POSITION, clampedZ];
        onUpdateLighting({ ...lightingConfig, customCameraPosition: newCameraPosition });
        // NEW: Calculate and set rotation for the camera icon
        const angleRadians = Math.atan2(0 - clampedZ, 0 - clampedX); // Angle from camera to origin
        // FIX: Corrected variable name from `initialAngleRadians` to `angleRadians`
        setCameraIconRotation(angleRadians * (180 / Math.PI));
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
      // NEW: Drop artwork (trigger bounce animation) but keep it selected
      setIsArtworkLifted(false);
      onArtworkLiftedChange?.(false); // NEW: Notify parent
      // Removed: onSelectArtwork(null) - keep artwork selected after drag
      // NEW: Add null check for setIsAnyLayoutItemDragging
      if (typeof setIsAnyLayoutItemDragging === 'function') {
        setIsAnyLayoutItemDragging(false); // NEW: Set dragging state to false
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      // NEW: Add null check for setIsAnyLayoutItemDragging
      if (typeof setIsAnyLayoutItemDragging === 'function') {
        setIsAnyLayoutItemDragging(false); // NEW: Reset dragging state on cleanup
      }
    };
  }, [draggedElementId, onEditorLayoutChange, mapRange, currentLayout, lightingConfig, onUpdateLighting, cameraIconRotation, setIsAnyLayoutItemDragging]); // Add setIsAnyLayoutItemDragging to deps


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
  const customCameraWorldPos = lightingConfig.customCameraPosition || [-8, CAMERA_FIXED_Y_POSITION, 25]; // NEW: Get custom camera position

  const keyLightLeft = mapRange(keyLightWorldPos[0], -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
  const keyLightTop = mapRange(keyLightWorldPos[2], -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z, PADDING_PERCENT, 100 - PADDING_PERCENT);

  const fillLightLeft = mapRange(fillLightWorldPos[0], -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
  const fillLightTop = mapRange(fillLightWorldPos[2], -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z, PADDING_PERCENT, 100 - PADDING_PERCENT);

  // NEW: Calculate custom camera position for map display
  const customCameraLeft = mapRange(customCameraWorldPos[0], -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
  const customCameraTop = mapRange(customCameraWorldPos[2], -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z, PADDING_PERCENT, 100 - PADDING_PERCENT);

  // NEW: Calculate restricted camera zone size
  const centerPercent = 50;
  const innerEdgeAtMinDist = mapRange(CAMERA_MIN_DRAG_DISTANCE, -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
  const innerRadiusPercent = innerEdgeAtMinDist - centerPercent;

  const outerEdgeAtMaxDist = mapRange(CAMERA_MAX_DRAG_DISTANCE, -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
  const outerRadiusPercent = outerEdgeAtMaxDist - centerPercent;

  return (
    <div className={`flex-1 flex flex-col p-4 bg-neutral-500/5 ${text} overflow-hidden`}>
      <div
        ref={containerRef}
        className={`w-full aspect-square rounded-lg border-2 border-dashed relative overflow-hidden touch-none flex-shrink-0 ${mapBgClass} ${mapBorderClass}`}
      >
        <div className={`absolute inset-2 border border-dashed rounded-md pointer-events-none ${innerBorderClass}`} />
        <div className={`absolute top-1/2 left-0 w-full h-px pointer-events-none ${crosshairClass}`} />
        <div className={`absolute left-1/2 top-0 h-full w-px pointer-events-none ${crosshairClass}`} />

        {/* NEW: Visual indicator for Camera Restricted Zones */}
        {/* Inner Bound */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed pointer-events-none transition-colors border-neutral-500/20"
          style={{ 
            width: `${innerRadiusPercent * 2}%`, 
            height: `${innerRadiusPercent * 2}%`,
            backgroundColor: lightsOn ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)'
          }}
        />
        {/* Outer Bound */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed pointer-events-none transition-colors border-neutral-500/10"
          style={{ 
            width: `${outerRadiusPercent * 2}%`, 
            height: `${outerRadiusPercent * 2}%`,
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <p className="text-[8px] font-mono opacity-20 whitespace-nowrap -translate-y-6">CAMERA TRACK LIMITS</p>
        </div>

        {/* FIX: Removed ripple rendering for LayoutTab as per user request (3.4.81) */}
        {/* {ripples.map(ripple => (
          <div
            key={ripple.id}
            className={`ripple-effect subtle ${rippleColorClass}`}
            style={{
              left: `${ripple.left}%`,
              top: `${ripple.top}%`,
            }}
          />
        ))} */}

        {currentLayout.map((art) => {
          const left = mapRange(art.position[0], -SCENE_BOUNDS_X, SCENE_BOUNDS_X, PADDING_PERCENT, 100 - PADDING_PERCENT);
          const top = mapRange(art.position[2], -SCENE_BOUNDS_Z, SCENE_BOUNDS_Z, PADDING_PERCENT, 100 - PADDING_PERCENT);
          const isSelected = art.id === selectedArtworkId;
          const isDragged = art.id === draggedElementId;
          const isColliding = art.id === collidingArtworkId;
          const isCanvas = art.type.startsWith('canvas_');
          const shouldShowFadedRing = isSelected && !isArtworkLifted; // NEW: Faded ring when selected but not lifted

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
              
              {isSelected && !shouldShowFadedRing && <div className={`absolute w-5 h-5 rounded-full ring-2 ring-cyan-500 ring-offset-2 ${ringOffsetClass}`} />}
              {shouldShowFadedRing && <div className={`absolute w-5 h-5 rounded-full ring-2 ring-cyan-300/50 ring-offset-2 ${ringOffsetClass}`} />}
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

        {/* NEW: Custom Camera Position */}
        <div 
          onPointerDown={(e) => handleElementPointerDown(e, 'customCamera')}
          className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform ${hasMotionArt ? 'cursor-not-allowed opacity-50' : 'cursor-grab'} z-20 ${draggedElementId === 'customCamera' ? 'scale-125' : ''}`}
          style={{ top: `${customCameraTop}%`, left: `${customCameraLeft}%` }}
          title={hasMotionArt ? "Camera position fixed for motion exhibition" : "Drag to set custom starting camera position"}
        >
          <div className="relative" style={{ transform: `rotate(${cameraIconRotation}deg)` }}> {/* NEW: Apply rotation here */}
            {/* NEW: Lucide React Video icon */}
            <Video className={`w-5 h-5 ${lightsOn ? 'text-neutral-700' : 'text-neutral-300'}`} />
            <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono whitespace-nowrap ${lightsOn ? 'text-neutral-700' : 'text-neutral-300'}`}>Camera</span>
          </div>
          {draggedElementId === 'customCamera' && <div className={`absolute w-8 h-8 rounded-full ring-2 ${lightsOn ? 'ring-neutral-700' : 'ring-neutral-300'} ring-offset-2 ${ringOffsetClass}`} />}
        </div>
      </div>

      {/* Artwork Info Section with Scrolling */}
      <div className={`flex-1 overflow-y-auto min-h-0 pt-4 mt-4 border-t ${border}`}>
        <p className={`text-[10px] uppercase tracking-widest mb-1.5 ${subtext}`}>Artwork Name</p>
        <p className="text-xl font-medium mt-1 min-h-[1.75rem]">{selectedArtworkId ? selectedArtworkTitle : ' '}</p>
        <p className={`text-sm mt-1 min-h-[1.25rem] ${subtext}`}>{selectedArtworkId && selectedArtworkArtist ? `by ${selectedArtworkArtist}` : ' '}</p>
        
        <div className={`transition-opacity duration-300 ${selectedArt ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-4 mt-6 mb-2">
            <button onClick={handleRotationReset} className={`p-2 rounded-full transition-colors ${buttonHoverClass}`} title="Reset Rotation">
              <RefreshCw size={14} className="opacity-60" />
            </button>
            <input 
              type="range"
              min="-180"
              max="180"
              step="1"
              value={currentRotationDegrees}
              onChange={handleRotationChange}
              onPointerDown={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              disabled={!selectedArt}
              className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50 ${sliderTrackClass} [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-neutral-300 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-lg`}
            />
            <span className="font-mono text-sm w-12 text-right">{currentRotationDegrees}°</span>
          </div>
        </div>

        {selectedArt && firebaseArtworks.find(fw => fw.id === selectedArt.artworkId) && (
          <div key={selectedArt.id} className={`my-4 p-4 rounded-xl border ${border} ${controlBgClass}`}>
            <div className={`flex items-center justify-between ${isEditingArtwork ? 'mb-3' : ''}`}>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm">{selectedArtworkTitle}</h4>
                {(() => {
                  const artwork = firebaseArtworks.find(fw => fw.id === selectedArt.artworkId);
                  return artwork ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      (artwork.artwork_type === 'painting' || artwork.artwork_type === 'photography')
                        ? 'bg-cyan-100 text-cyan-700' 
                        : artwork.artwork_type === 'sculpture' 
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-violet-100 text-violet-700'
                    }`}>
                      {artwork.artwork_type.charAt(0).toUpperCase() + artwork.artwork_type.slice(1)}
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center gap-2">
                {isSignedIn && (
                  <button
                    onClick={() => {
                      onOpenConfirmationDialog('artwork_removal', selectedArt.artworkId, selectedArtworkTitle);
                    }}
                    className={`p-1.5 rounded-full hover:bg-red-500/10 transition-colors ${text}`}
                    title="Remove Artwork from Layout"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                )}
                <button
                  onClick={() => setIsEditingArtwork(!isEditingArtwork)}
                  className={`p-1.5 rounded-full transition-colors ${isEditingArtwork ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'} ${text}`}
                  title={isEditingArtwork ? "Close Editor" : "Edit Artwork Settings"}
                >
                  {isEditingArtwork ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {isEditingArtwork && (
              <div className="mt-4 space-y-3">
                {firebaseArtworks.find(fw => fw.id === selectedArt.artworkId) && (
                  <ArtworkSettingsForm
                    artwork={firebaseArtworks.find(fw => fw.id === selectedArt.artworkId)!}
                    activeZoneId={activeZoneId}
                    uiConfig={uiConfig}
                    onUpdateArtworkFile={onUpdateArtworkFile}
                    onUpdateArtworkData={onUpdateArtworkData}
                    onUpdateArtworkField={onUpdateArtworkField}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* REMOVED: Theme Selection Section */}
      {/* <div className={`flex-shrink-0 pt-4 mt-4 border-t ${border}`}>
        <p className={`text-[10px] font-bold tracking-[0.2em] uppercase ${subtext}`}>Environment Theme</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.keys(EffectRegistry).map((effectName) => (
            <button
              key={effectName}
              onClick={() => onUpdateZoneTheme(effectName)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors 
                ${activeZoneTheme === effectName 
                  ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-neutral-900 shadow-md') 
                  : (lightsOn ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700' : 'bg-neutral-700 hover:bg-neutral-600 text-white')
                }`}
            >
              <Sparkles className={`inline-block w-3 h-3 mr-1 ${activeZoneTheme === effectName && (lightsOn ? 'text-cyan-500' : 'text-cyan-400')}`} />
              {effectName}
            </button>
          ))}
          {/* Button to deactivate all effects (No Theme) */}
          {/* <button
            onClick={() => onUpdateZoneTheme(null)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors 
              ${activeZoneTheme === null
                ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-neutral-900 shadow-md') 
                : (lightsOn ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700' : 'bg-neutral-700 hover:bg-neutral-600 text-white')
              }`}
          >
            <X className={`inline-block w-3 h-3 mr-1 ${activeZoneTheme === null && (lightsOn ? 'text-red-500' : 'text-red-400')}`} />
            No Theme
          </button>
        </div>
      </div> */}
    </div>
  );
});

export default LayoutTab;