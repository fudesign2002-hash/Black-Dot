import React, { useState, useCallback, useMemo, useEffect } from 'react'; // NEW: Import useEffect
import { Sun, Moon, RefreshCw } from 'lucide-react';

import Scene from './scene/Scene';
import TransitionOverlay from './ui/TransitionOverlay';

import { useMuseumState } from '../hooks/useMuseumState';

interface EmbeddedMuseumSceneProps {
  showLightToggle?: boolean;
  showResetCamera?: boolean;
}

const EmbeddedMuseumScene: React.FC<EmbeddedMuseumSceneProps> = ({
  showLightToggle = true,
  showResetCamera = true,
}) => {
  const [resetTrigger, setResetTrigger] = useState(0);
  const [fps, setFps] = useState(0); // For potential dev tools or debugging in embed

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialExhibitionId = urlParams.get('exhibitionId');

  const {
    isLoading,
    activeExhibition,
    activeZone,
    currentLayout,
    lightingConfig,
    setLightingOverride,
    exhibitions, 
    handleNavigate, // NEW: Import handleNavigate from useMuseumState
  } = useMuseumState();

  // NEW: Effect to navigate to the specified exhibitionId on mount if available
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


  const { lightsOn } = lightingConfig;

  const handleLightToggle = useCallback(() => {
    const newLightsOnState = !lightsOn;
    const newConfig = { ...lightingConfig, lightsOn: newLightsOnState };
    setLightingOverride(activeZone.id, newConfig);
  }, [lightsOn, lightingConfig, setLightingOverride, activeZone.id]);

  const handleResetCamera = useCallback(() => {
    setResetTrigger(t => t + 1);
  }, []);

  const theme = useMemo(() => ({
    lightsOn,
    bg: lightsOn ? 'bg-[#e4e4e4]' : 'bg-[#050505]',
    text: lightsOn ? "text-neutral-900" : "text-white",
    subtext: lightsOn ? "text-neutral-500" : "text-neutral-400",
    border: lightsOn ? "border-neutral-900/10" : "border-white/10",
    panelBg: lightsOn ? "bg-white/95" : "bg-neutral-900/95",
    glass: lightsOn 
      ? "bg-white/70 border-white/60 text-neutral-600 hover:bg-white/90 hover:text-neutral-900" 
      : "bg-white/10 border-white/10 text-neutral-300 hover:bg-white/20 hover:text-white",
    glassActive: lightsOn
      ? "bg-neutral-900 text-white shadow-xl hover:bg-neutral-800"
      : "bg-black text-white shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-neutral-800",
    arrowBg: lightsOn ? "hover:bg-neutral-900/5" : "hover:bg-white/5",
    input: lightsOn ? "bg-neutral-100 focus:bg-white text-neutral-900" : "bg-neutral-800 focus:bg-neutral-700 text-white"
  }), [lightsOn]);

  return (
    <div className={`w-full h-full relative transition-colors duration-1000 ${theme.bg} overflow-hidden font-sans`}>
      <TransitionOverlay isTransitioning={isLoading} /> {/* Use isLoading for embed transition */}

      <div className="absolute inset-0 z-0">
        <Scene
          lightingConfig={lightingConfig}
          resetTrigger={resetTrigger}
          currentZoneTheme={activeZone.theme}
          artworks={currentLayout}
          isEditorOpen={false} // Always false in embed mode
          isEditorMode={false} // Always false in embed mode
          selectedArtworkId={null} // No selection in embed mode
          onSelectArtwork={() => {}} // No selection in embed mode
          focusedIndex={0} // No explicit focus for now in embed
          onFocusChange={() => {}} // No explicit focus for now in embed
          activeEditorTab={'lighting'} // Default, not used
          focusedArtworkInstanceId={null} // Not used in embed
          setFps={setFps}
        />
      </div>

      <div className={`absolute z-40 flex gap-2 transition-all duration-500 bottom-4 left-1/2 -translate-x-1/2`}>
        <div className={`backdrop-blur-xl border p-1.5 rounded-full flex gap-2 shadow-2xl transition-colors duration-700 ${lightsOn ? 'bg-white/80 border-white/60' : 'bg-black/50 border-white/10'}`}>
          {showLightToggle && (
            <button onClick={handleLightToggle} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${!lightsOn ? theme.glassActive : theme.glass}`} title="Toggle Lights">
                <div className={!lightsOn ? "text-amber-400" : ""}>{lightsOn ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</div>
            </button>
          )}
          {showResetCamera && (
            <button onClick={handleResetCamera} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${theme.glass}`} title="Reset View">
                <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbeddedMuseumScene;