
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Sun, Moon, RefreshCw, Heart as HeartIcon, ChevronDown, Info } from 'lucide-react'; // NEW: Import HeartIcon, ChevronDown, Info
import { db } from '../firebase'; // NEW: Import db
import firebase from 'firebase/compat/app'; // NEW: Import firebase

import Scene from './scene/Scene';
import TransitionOverlay from './ui/TransitionOverlay';
import InfoPanel from './info/InfoPanel'; // NEW: Import InfoPanel
// REMOVED: import ArtworkFocusControls

import { useMuseumState } from '../hooks/useMuseumState';
import { ArtType, FirebaseArtwork } from '../types'; // NEW: Import ArtType, FirebaseArtwork

interface EmbeddedMuseumSceneProps {
  showLightToggle?: boolean;
  showResetCamera?: boolean;
}

interface SceneRipple { // NEW: Define SceneRipple for embedded mode
  id: string;
  clientX: number;
  clientY: number;
  colorClass: string;
  effectClass: 'subtle' | 'prominent'; // NEW: Add effectClass
}

const EmbeddedMuseumScene: React.FC<EmbeddedMuseumSceneProps> = ({
  showLightToggle = true,
  showResetCamera = true,
}) => {
  const [resetTrigger, setResetTrigger] = useState(0);
  const [fps, setFps] = useState(0);
  // MODIFIED: Wrap setFocusedArtworkInstanceId with useCallback for logging
  const [focusedArtworkInstanceId, _setFocusedArtworkInstanceId] = useState<string | null>(null);
  const setFocusedArtworkInstanceId = useCallback((value: string | null) => {
    // console.log(`[EmbeddedMuseumScene.tsx] Setting focusedArtworkInstanceId to:`, value); // REMOVED console.log
    _setFocusedArtworkInstanceId(value);
  }, []);

  const [isInfoOpen, setIsInfoOpen] = useState(false); // NEW: State for info panel
  // MODIFIED: State for artwork's Firebase ID to display in the InfoPanel
  const [focusedArtworkFirebaseId, setFocusedArtworkFirebaseId] = useState<string | null>(null);


  // NEW: State for heart particle emitter in embedded mode
  const [heartEmitterTrigger, setHeartEmitterTrigger] = useState(0);
  const [heartEmitterArtworkId, setHeartEmitterArtworkId] = useState<string | null>(null);

  const [sceneRipples, setSceneRipples] = useState<SceneRipple[]>([]); // NEW: State for scene-wide ripples
  const nextSceneRippleId = useRef(0); // NEW: Ref for unique ripple IDs

  // NEW: States and refs for like functionality in embedded mode
  // MODIFIED: `likedArtworksLocalCount` keys should be actual Firebase `artworkId`s
  const [likedArtworksLocalCount, setLikedArtworksLocalCount] = useState<Record<string, number>>({});
  const likeDebounceTimeouts = useRef<Record<string, number>>({});
  // NEW: useRef to store the latest likedArtworksLocalCount for debounce
  const likedArtworksLocalCountRef = useRef<Record<string, number>>({});

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialExhibitionId = urlParams.get('exhibitionId');

  // NEW: Ref for CameraController in embedded mode
  const cameraControlRef = useRef<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void; // MODIFIED: Add artworkInstanceId and isMotionVideo
    moveCameraToPrevious: () => void; // NEW
    moveCameraToInitial: () => void;  // NEW
  }>(null);

  // NEW: Ranking mode state (always false for embedded mode)
  const isRankingMode = false;


  const {
    isLoading,
    activeExhibition,
    activeZone,
    currentLayout,
    lightingConfig,
    setLightingOverride,
    exhibitions,
    handleNavigate,
    firebaseArtworks, // NEW: Import firebaseArtworks
  } = useMuseumState();

  useEffect(() => {
    if (initialExhibitionId && exhibitions.length > 0) {
      const targetIndex = exhibitions.findIndex(ex => ex.id === initialExhibitionId);
      if (targetIndex !== -1) {
        handleNavigate(targetIndex);
      } else {
        console.warn(`EmbeddedMuseumScene: Exhibition ID "${initialExhibitionId}" not found. Displaying default exhibition.`);
      }
    }
  }, [initialExhibitionId, exhibitions, handleNavigate]);


  // NEW: Cleanup for like debounce timeouts on unmount
  useEffect(() => {
    return () => {
      for (const timeoutId of Object.values(likeDebounceTimeouts.current)) {
        // FIX: Ensure timeoutId is a valid number before clearing it
        if (typeof timeoutId === 'number') {
            clearTimeout(timeoutId);
        }
      }
    };
  }, []);

  // NEW: Effect to sync likedArtworksLocalCount to its ref
  useEffect(() => {
    likedArtworksLocalCountRef.current = likedArtworksLocalCount;
  }, [likedArtworksLocalCount]);

  const { lightsOn } = lightingConfig;

  const handleLightToggle = useCallback(() => {
    const newLightsOnState = !lightsOn;
    const newConfig = { ...lightingConfig, lightsOn: newLightsOnState };
    setLightingOverride(activeZone.id, newConfig);
  }, [lightsOn, lightingConfig, setLightingOverride, activeZone.id]);

  const handleResetCamera = useCallback(() => {
    if (cameraControlRef.current) {
      cameraControlRef.current.moveCameraToInitial(); // NEW: Call CameraController method directly
    }
    setFocusedArtworkInstanceId(null); // NEW: Clear focused artwork on global reset
    setHeartEmitterArtworkId(null); // NEW: Clear heart emitter ID on reset
    // MODIFIED: Clear focusedArtworkFirebaseId on camera reset
    setFocusedArtworkFirebaseId(null);
    // REMOVED: setResetTrigger(t => t + 1);
  }, [cameraControlRef, setFocusedArtworkInstanceId, setFocusedArtworkFirebaseId]); // Add all setters to dependencies

  // NEW: Function to update artwork likes in Firebase for embedded mode
  const updateArtworkLikesInFirebase = useCallback(async (artworkId: string, incrementBy: number) => { // Parameter changed to artworkId
    console.log(`[Embed] Firebase update function invoked for ${artworkId} with increment: ${incrementBy}`);
    try {
        const artworkDocRef = db.collection('artworks').doc(artworkId);
        console.log(`[Embed] Attempting Firebase update for artwork_liked of ${artworkId} by ${incrementBy}`);
        await artworkDocRef.update({
            artwork_liked: firebase.firestore.FieldValue.increment(incrementBy)
        });
        console.log(`[Embed] Firebase update successful for ${artworkId}.`);
    } catch (error) {
        console.error(`[Embed] Firebase update failed for ${artworkId}:`, error);
    }
  }, []);

  // NEW: Dummy onLikeTriggered for embedded mode, just sets the heart emitter state
  const onLikeTriggered = useCallback((artworkInstanceId: string) => {
    console.log(`[Embed] onLikeTriggered called for instanceId: ${artworkInstanceId}`);
    // Extract the actual artworkId from the instanceId
    const artworkIdMatch = artworkInstanceId.match(/zone_art_([a-zA-Z0-9_-]+)_\d+/);
    const actualArtworkId = artworkIdMatch ? artworkIdMatch[1] : null; // FIX: Corrected typo artworkId[1] to artworkIdMatch[1]

    if (!actualArtworkId) {
        console.error("Could not extract actual artwork ID from instance ID for liking:", artworkInstanceId);
        return;
    }
    console.log(`[Embed] Extracted actualArtworkId: ${actualArtworkId}`);

    // Increment local count immediately for responsiveness (keyed by actualArtworkId)
    setLikedArtworksLocalCount(prev => {
        const newCount = (prev[actualArtworkId] || 0) + 1;
        console.log(`[Embed] After local like count update. New count for ${actualArtworkId}:`, newCount);
        return {
            ...prev,
            [actualArtworkId]: newCount,
        };
    });

    // Clear any existing debounce timeout for this artwork
    if (likeDebounceTimeouts.current[actualArtworkId]) { // Keyed by actualArtworkId
        clearTimeout(likeDebounceTimeouts.current[actualArtworkId]);
    }

    // Set a new debounce timeout
    // FIX: Separate asynchronous Firebase update from synchronous state update.
    // The setState updater must return the new state synchronously.
    likeDebounceTimeouts.current[actualArtworkId] = window.setTimeout(async () => { // Keyed by actualArtworkId
        // NEW: Read the latest accumulated count from the ref
        let totalIncrement = likedArtworksLocalCountRef.current[actualArtworkId] || 0;
        setLikedArtworksLocalCount(prev => {
            const newPrev = { ...prev };
            delete newPrev[actualArtworkId];
            console.log(`[Embed] Debounced call for ${actualArtworkId}. Total local increment:`, totalIncrement);
            return newPrev;
        });

        if (totalIncrement > 0) {
            console.log(`[Embed] Calling updateArtworkLikesInFirebase for ${actualArtworkId} with increment: ${totalIncrement}`);
            await updateArtworkLikesInFirebase(actualArtworkId, totalIncrement); // Asynchronous call outside setState updater
        } else {
            console.log(`[Embed] No increment needed for ${actualArtworkId}, totalIncrement was 0.`);
        }
        delete likeDebounceTimeouts.current[actualArtworkId]; // Keyed by actualArtworkId
    }, 1000); // 1-second debounce delay

    setHeartEmitterArtworkId(artworkInstanceId);
    setHeartEmitterTrigger(prev => prev + 1);
  }, [updateArtworkLikesInFirebase]);


  // NEW: Handler for general scene clicks to create ripples (for embedded mode)
  const handleSceneClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>, isArtwork: boolean = false, artworkColorClass?: string) => {
    const { clientX, clientY } = e;

    let colorClass = '';
    let effectClass: 'subtle' | 'prominent';

    if (isArtwork) {
      colorClass = artworkColorClass || (lightsOn ? 'text-cyan-500' : 'text-cyan-400');
      effectClass = 'prominent'; // For artwork clicks, use prominent effect
    } else {
      colorClass = (lightsOn ? 'text-neutral-300' : 'text-neutral-700'); // Default subtle colors
      effectClass = 'subtle'; // For general clicks, use subtle effect
    }

    const newRipple: SceneRipple = {
      id: `scene-ripple-${nextSceneRippleId.current++}`,
      clientX,
      clientY,
      colorClass,
      effectClass, // NEW: Assign effectClass
    };

    setSceneRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setSceneRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, effectClass === 'prominent' ? 900 : 800); // Match ripple animation duration (0.8s for prominent, 0.7s for subtle + buffer)
  }, [lightsOn, nextSceneRippleId, setSceneRipples]);

  // NEW: Handle artwork single click for focus in embedded mode
  const handleSelectArtwork = useCallback((id: string | null) => {
    // console.log(`[EmbeddedMuseumScene.tsx] handleSelectArtwork called with id:`, id); // REMOVED console.log
    // Only change focus if it's a different artwork or null
    if (focusedArtworkInstanceId !== id) { 
      setFocusedArtworkInstanceId(id); // Focus or unfocus if id is null
      const artworkInLayout = currentLayout.find(item => item.id === id); // Find artwork for Firebase ID
      if (artworkInLayout) {
        setFocusedArtworkFirebaseId(artworkInLayout.artworkId);
      } else {
        setFocusedArtworkFirebaseId(null);
      }
    }
  }, [focusedArtworkInstanceId, currentLayout, setFocusedArtworkInstanceId, setFocusedArtworkFirebaseId]);

  // NEW: Handler for artwork click to trigger camera movement via ref (for embedded mode)
  const handleArtworkClicked = useCallback((e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => { // MODIFIED: Add artworkInstanceId and isMotionVideo
    e.stopPropagation(); // Stop propagation for artwork clicks to prevent the global canvas click from also triggering.

    // NEW: Call handleSelectArtwork to set focus, which displays the buttons
    handleSelectArtwork(artworkInstanceId);

    if (cameraControlRef.current && cameraControlRef.current.moveCameraToArtwork) {
      cameraControlRef.current.moveCameraToArtwork(artworkInstanceId, position, rotation, artworkType, isMotionVideo); // MODIFIED: Pass artworkInstanceId and isMotionVideo
    }
    // Trigger the artwork-specific ripple
    handleSceneClick(e as any, true, lightsOn ? 'text-cyan-500' : 'text-cyan-400');
  }, [cameraControlRef, handleSceneClick, lightsOn, handleSelectArtwork]); // Add handleSelectArtwork to dependencies

  // MODIFIED: Centralized handler for opening the InfoPanel in embedded mode
  const handleOpenInfo = useCallback(() => {
    // If an artwork is focused, find its artworkId and set it
    if (focusedArtworkInstanceId) {
      const artworkInLayout = currentLayout.find(item => item.id === focusedArtworkInstanceId);
      if (artworkInLayout) {
        setFocusedArtworkFirebaseId(artworkInLayout.artworkId);
      } else {
        setFocusedArtworkFirebaseId(null);
      }
    } else {
      // If no artwork is focused, ensure it displays exhibition info
      setFocusedArtworkFirebaseId(null);
    }
    setIsInfoOpen(true);
  }, [focusedArtworkInstanceId, currentLayout, setFocusedArtworkFirebaseId]); // Add setFocusedArtworkFirebaseId to dependencies

  // NEW: Centralized handler for closing the InfoPanel in embedded mode
  const handleCloseInfo = useCallback(() => {
    setIsInfoOpen(false);
    // MODIFIED: Clear focusedArtworkFirebaseId when closing the panel
    setFocusedArtworkFirebaseId(null);
  }, [setFocusedArtworkFirebaseId]); // Add setFocusedArtworkFirebaseId to dependencies

  // NEW: Callback to specifically open the InfoPanel with exhibition data from artwork panel
  const handleOpenExhibitionInfoFromArtwork = useCallback(() => {
    // MODIFIED: Clear focusedArtworkFirebaseId to force exhibition display
    setFocusedArtworkFirebaseId(null);
    setIsInfoOpen(true);
  }, [setFocusedArtworkFirebaseId]); // Add setFocusedArtworkFirebaseId to dependencies

  // FIX: Complete the uiConfig object definition, copying from App.tsx to ensure all properties are present.
  const uiConfig = useMemo(() => ({
    lightsOn,
    bg: lightsOn ? 'bg-[#e4e4e4]' : 'bg-[#050505]',
    text: lightsOn ? "text-neutral-900" : "text-white",
    subtext: lightsOn ? "text-neutral-500" : "text-neutral-400",
    border: lightsOn ? "border-neutral-900/10" : "border-white/10",
    panelBg: lightsOn ? "bg-white/95" : "bg-neutral-900/95",
    glass: lightsOn
      ? "bg-white/70 text-neutral-600 hover:bg-white/90 hover:text-neutral-900"
      : "bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white",
    glassActive: lightsOn
      ? "bg-neutral-900 text-white shadow-xl hover:bg-neutral-800"
      : "bg-black text-white shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-neutral-800",
    arrowBg: lightsOn ? "hover:bg-neutral-900/5" : "hover:bg-white/5",
    input: lightsOn ? "bg-neutral-100 focus:bg-white text-neutral-900" : "bg-neutral-800 focus:bg-neutral-700 text-white"
  }), [lightsOn]);

  const hasMotionArtwork = useMemo(() => currentLayout.some(art => art.isMotionVideo), [currentLayout]);

  // FIX: Return JSX
  return (
    <React.Fragment>
      <TransitionOverlay isTransitioning={isLoading} />
      <Scene
        lightingConfig={lightingConfig}
        // REMOVED: resetTrigger={resetTrigger}
        artworks={currentLayout}
        isEditorOpen={false} // Always false in embed mode
        isEditorMode={false} // Always false in embed mode
        selectedArtworkId={null} // No selection in embed mode
        onSelectArtwork={handleSelectArtwork} // NEW: Pass single-click select handler
        focusedIndex={0} // Default to 0, or could implement a focused artwork for embeds
        onFocusChange={() => {}} // No focus change handler in embed mode
        activeEditorTab={'lighting'} // Irrelevant in embed mode
        focusedArtworkInstanceId={focusedArtworkInstanceId} // NEW: Pass focused artwork instance
        setFps={setFps}
        hasMotionArtwork={hasMotionArtwork}
        // NEW PROPS for ArtworkFocusControls
        uiConfig={uiConfig}
        setFocusedArtworkInstanceId={setFocusedArtworkInstanceId}
        activeExhibition={activeExhibition}
        onInfoOpen={handleOpenInfo} // MODIFIED: Call centralized info opener
        cameraControlRef={cameraControlRef} // NEW: Pass the camera control ref
        onArtworkClicked={handleArtworkClicked} // NEW: Pass the artwork click handler
        isDebugMode={false} // Always false in embed mode
        // onCameraInteraction is not needed in embedded scene as controls are simpler
        triggerHeartEmitter={heartEmitterTrigger} // NEW
        heartEmitterArtworkId={heartEmitterArtworkId} // NEW
        onCanvasClick={handleSceneClick} // NEW: Pass general canvas click handler
        isRankingMode={isRankingMode} // NEW: Pass ranking mode state
      />
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex gap-4 transition-opacity duration-500 ${isLoading || focusedArtworkInstanceId ? 'opacity-0' : 'opacity-100'}`}>
        <div className={`backdrop-blur-xl border p-1.5 rounded-full flex gap-2 shadow-2xl transition-colors duration-700 ${lightsOn ? 'bg-white/80 border-white/60' : 'bg-black/50 border-white/10'}`}>
          {showLightToggle && (
            <button onClick={handleLightToggle} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${!lightsOn ? uiConfig.glassActive : uiConfig.glass}`} title="Toggle Lights">
                <div className={!lightsOn ? "text-amber-400" : ""}>{lightsOn ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</div>
            </button>
          )}
          {showResetCamera && (
            <button
              onClick={handleResetCamera}
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`}
              title={"Reset View"}
            >
                <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        {focusedArtworkInstanceId && ( // NEW: Show like button when artwork is focused
          <div className={`backdrop-blur-xl p-1.5 rounded-full flex gap-2 shadow-2xl`}>
            <button
                onClick={(e) => { // MODIFIED: Add e.stopPropagation()
                  e.stopPropagation();
                  // console.log('[EmbeddedMuseumScene.tsx] Like Artwork button clicked!'); // REMOVED console.log
                  if (focusedArtworkInstanceId) {
                    onLikeTriggered(focusedArtworkInstanceId);
                  }
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 bg-pink-500 text-white hover:bg-pink-600`}
                title="Like Artwork"
                aria-label="Like this artwork"
            >
                <HeartIcon className="w-5 h-5" />
            </button>
            {/* REMOVED: NEW: Dummy Test Button for Embedded Mode */}
            {/* <button
                onClick={(e) => { // Just stop propagation, no functionality
                  e.stopPropagation();
                  console.log('[EmbeddedMuseumScene.tsx] Test Button clicked!'); // NEW: Add console.log
                  if (focusedArtworkInstanceId) { // NEW: Trigger like animation
                    onLikeTriggered(focusedArtworkInstanceId);
                  }
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 bg-pink-500 text-white hover:bg-pink-600`}
                title="Test Button"
                aria-label="Dummy button for testing"
            >
                <HeartIcon className="w-5 h-5" />
            </button> */}
            {/* NEW: Dismiss button for embedded mode, directly unfocuses artwork and triggers camera move back */}
            <button
                onClick={(e) => { // MODIFIED: Add e.stopPropagation()
                  e.stopPropagation();
                  // console.log('[EmbeddedMuseumScene.tsx] Dismiss button clicked!'); // REMOVED console.log
                  setFocusedArtworkInstanceId(null);
                  if (cameraControlRef.current) {
                    cameraControlRef.current.moveCameraToPrevious();
                  }
                  // MODIFIED: Clear focusedArtworkFirebaseId when dismissed
                  setFocusedArtworkFirebaseId(null);
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 ${uiConfig.glass}`}
                title="Dismiss Artwork Controls"
                aria-label="Dismiss artwork controls"
            >
                <ChevronDown className="w-5 h-5" />
            </button>
            {/* NEW: Info button for embedded mode */}
            <button
                onClick={(e) => { // MODIFIED: Add e.stopPropagation()
                  e.stopPropagation();
                  handleOpenInfo();
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 bg-cyan-500 text-white hover:bg-cyan-600`}
                title="Artwork Info"
                aria-label="View info for this artwork"
            >
                <Info className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
      {/* NEW: Render scene ripples for embedded mode */}
      {sceneRipples.map(ripple => (
        <div
          key={ripple.id}
          className={`ripple-effect ${ripple.effectClass} ${ripple.colorClass}`}
          style={{
            left: `${ripple.clientX}px`,
            top: `${ripple.clientY}px`,
            // REMOVED: transform: 'translate(-50%, -50%)', // Center the ripple div at the click point
          }}
        />
      ))}
      {/* NEW: Render InfoPanel in embedded mode */}
      <InfoPanel
        isOpen={isInfoOpen}
        onClose={handleCloseInfo}
        uiConfig={uiConfig}
        activeExhibition={activeExhibition}
        isLoading={isLoading}
        // MODIFIED: Pass focusedArtworkFirebaseId and all firebaseArtworks for real-time lookup
        focusedArtworkFirebaseId={focusedArtworkFirebaseId}
        allFirebaseArtworks={firebaseArtworks}
        onOpenExhibitionInfoFromArtwork={handleOpenExhibitionInfoFromArtwork} // NEW: Pass callback
      />
    </React.Fragment>
  );
};

export default EmbeddedMuseumScene;
