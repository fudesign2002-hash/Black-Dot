
import React, { useState, useEffect } from 'react';
import { Sun, Moon, RefreshCw, Map as MapIcon, Search, Lock, Unlock, Cpu, ChevronLeft, ChevronRight, Users, Heart, Info, X, ChevronDown, Share2, ListOrdered, Orbit } from 'lucide-react'; // NEW: Import Orbit icon for Zero Gravity
import { Exhibition } from '../../types';
// REMOVED: import { EffectRegistry } from '../../effect_bundle'; // NEW: Import EffectRegistry

interface MainControlsProps {
  uiConfig: any;
  isInfoOpen: boolean;
  lightsOn: boolean;
  onLightToggle: () => void;
  isEditorMode: boolean;
  onEditorModeToggle: () => void;
  onEditorOpen: () => void;
  setIsSearchOpen: (open: boolean) => void;
  onResetCamera: () => void;
  setIsDevToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSmallScreen: boolean;
  isHeaderExpanded: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevItem: Exhibition | null;
  nextItem: Exhibition | null;
  isFirstItem: boolean;
  isLastItem: boolean;
  focusedArtworkInstanceId: string | null;
  isArtworkFocusedForControls: boolean;
  onDismissArtworkControls: () => void;
  onInfoOpen: () => void;
  focusedArtworkTitle: string | null;
  onLikeTriggered: (artworkInstanceId: string) => void;
  isRankingMode: boolean;
  onRankingToggle: () => void;
  isZeroGravityMode: boolean; // NEW: Add isZeroGravityMode prop
  onZeroGravityToggle: () => void; // NEW: Add onZeroGravityToggle prop
  isSignedIn?: boolean; // NEW: whether current user is signed in
  isCameraAtDefaultPosition: boolean; // NEW: Add isCameraAtDefaultPosition prop
  isResetCameraEnable?: boolean; // NEW: Global reset-enable flag
  setHeartEmitterArtworkId: (id: string | null) => void;
  hasMotionArtwork: boolean; // NEW: Add hasMotionArtwork prop
  customCameraPosition?: [number, number, number]; // NEW: Add customCameraPosition prop
  isEmbed?: boolean; // NEW: hide certain controls when embedded
  // REMOVED: activeEffectName: string | null; // NEW: Add activeEffectName
  // REMOVED: onEffectToggle: (effectName: string) => void; // NEW: Add onEffectToggle
}

const MainControls: React.FC<MainControlsProps> = React.memo(({
  uiConfig,
  isInfoOpen,
  lightsOn,
  onLightToggle,
  isEditorMode,
  onEditorModeToggle,
  onEditorOpen,
  setIsSearchOpen,
  onResetCamera,
  setIsDevToolsOpen,
  isSmallScreen,
  isHeaderExpanded,
  onPrev,
  onNext,
  prevItem,
  nextItem,
  isFirstItem,
  isLastItem,
  focusedArtworkInstanceId,
  isArtworkFocusedForControls,
  onDismissArtworkControls,
  onInfoOpen,
  focusedArtworkTitle,
  onLikeTriggered,
  isRankingMode,
  onRankingToggle,
  isZeroGravityMode, // NEW: Destructure isZeroGravityMode
  onZeroGravityToggle, // NEW: Destructure onZeroGravityToggle
  isSignedIn, // NEW: Destructure isSignedIn
  isCameraAtDefaultPosition, // NEW: Destructure isCameraAtDefaultPosition
  isResetCameraEnable, // NEW: Destructure isResetCameraEnable
  isEmbed = false,
  setHeartEmitterArtworkId,
  hasMotionArtwork, // NEW: Destructure hasMotionArtwork
  customCameraPosition, // NEW: Destructure customCameraPosition
  // REMOVED: activeEffectName, // NEW: Destructure activeEffectName
  // REMOVED: onEffectToggle, // NEW: Destructure onEffectToggle
}) => {
  const artworkControlsRef = React.useRef<HTMLDivElement>(null);
  const mainNavRef = React.useRef<HTMLDivElement>(null);

  // NEW: Blur focused element when controls become inert to avoid aria-hidden warnings
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;

    const isFocusedInArtworkControls = artworkControlsRef.current?.contains(active);
    const isFocusedInMainNav = mainNavRef.current?.contains(active);

    const artworkControlsInert = !(isArtworkFocusedForControls && !isEditorMode && !isRankingMode && !isZeroGravityMode);
    const mainNavInert = isArtworkFocusedForControls;

    if ((isFocusedInArtworkControls && artworkControlsInert) || (isFocusedInMainNav && mainNavInert)) {
      active.blur();
    }
  }, [isArtworkFocusedForControls, isEditorMode, isRankingMode, isZeroGravityMode]);

  // Debug logging removed
  
  // NEW: Determine if next/prev buttons should be hidden for small screens when artwork is focused
  // MODIFIED: Also hide if in zero gravity mode
  const hideNextPrevOnSmallScreen = isSmallScreen && (focusedArtworkInstanceId || isZeroGravityMode);
  const nextPrevAnimationClasses = `transition-all duration-500 ease-out ${hideNextPrevOnSmallScreen ? 'opacity-0 translate-x-full pointer-events-none' : 'opacity-100 translate-x-0'}`;

  // NEW: Logic for conditional divider rendering
  // MODIFIED: Hide lights toggle if in zero gravity mode
  const hasLightsToggle = !isEditorMode && !isRankingMode && !isZeroGravityMode;
  // MODIFIED: Hide editor mode toggle if in zero gravity mode
  const hasEditorModeToggle = !isRankingMode && !isZeroGravityMode && !!isSignedIn && !isEmbed;
  const hasEditorOpenSearch = isEditorMode; // Includes both editor open and search
  // REMOVED: const hasEffectButtons = !isEditorMode && !isRankingMode && !isArtworkFocusedForControls; // NEW: Effects can be toggled if not in editor or ranking mode, and not focused on artwork

  // Determine right-side buttons based on their visibility conditions
  // Temporarily hide DevTools toggle
  const hasDevToolsToggle = false;
  // MODIFIED: Hide if in ranking mode, focused on artwork, or in zero gravity mode
  // Show reset iff global flag is enabled AND not in ranking/zero-gravity modes
  const hasResetCamera = Boolean(isResetCameraEnable) && !isRankingMode && !isZeroGravityMode;
  const hasRankingToggle = !isEditorMode && !isZeroGravityMode; // Render ranking toggle; may be disabled when motion artwork present
  const hasZeroGravityToggle = !isEditorMode && !isRankingMode; // Zero Gravity Toggle (may be disabled when motion artwork present)
  // MODIFIED: Add !isRankingMode, !isZeroGravityMode to hide small screen navigation in ranking/zero gravity mode
  const hasSmallScreenNav = isSmallScreen && !isEditorMode && !focusedArtworkInstanceId && !isRankingMode && !isZeroGravityMode && !isEmbed; // Only show if not focused AND not in ranking/zero gravity mode and not embed

  // Calculate if there are any visible buttons on the left or right side of the divider
  // MODIFIED: Remove effect buttons from condition
  const anyLeftButtonsVisible = hasLightsToggle || hasEditorModeToggle || hasEditorOpenSearch; 
  // MODIFIED: Include hasZeroGravityToggle in right buttons
  const anyRightButtonsVisible = hasDevToolsToggle || hasResetCamera || hasRankingToggle || hasZeroGravityToggle || hasSmallScreenNav;

  const shouldShowDivider = anyLeftButtonsVisible && anyRightButtonsVisible;


  return (
    <React.Fragment>
    <div className={`absolute z-40 flex flex-col items-center gap-1 transition-all duration-500 ${isInfoOpen ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'} bottom-10 left-1/2 -translate-x-1/2`}>
        
        
        <div ref={artworkControlsRef}
             className={`flex flex-col items-center gap-2 transition-all duration-500 ease-[cubic-bezier(0.68,-0.8,0.32,1.8)] ${isArtworkFocusedForControls && !isEditorMode && !isRankingMode && !isZeroGravityMode ? 'scale-100 opacity-100 visible' : 'scale-0 opacity-0 pointer-events-none invisible'}`} // MODIFIED: Hide if in zero gravity mode
             aria-hidden={!(isArtworkFocusedForControls && !isEditorMode && !isRankingMode && !isZeroGravityMode)}
             inert={!(isArtworkFocusedForControls && !isEditorMode && !isRankingMode && !isZeroGravityMode)}>
            {focusedArtworkTitle && (
                <p className={`text-base font-serif font-medium uppercase px-4 py-2 rounded-full backdrop-blur-xl shadow-lg 
        ${uiConfig.text} ${uiConfig.border} whitespace-nowrap`}>
                    {focusedArtworkTitle}
                </p>
            )}
            <div className={`backdrop-blur-xl p-1.5 rounded-full flex gap-2 shadow-2xl
                `}>
                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (focusedArtworkInstanceId) {
                        onLikeTriggered(focusedArtworkInstanceId);
                      }
                    }}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 bg-pink-500 text-white hover:bg-pink-600`}
                    title="Like Artwork"
                    aria-label="Like this artwork"
                >
                    <Heart className="w-5 h-5" />
                </button>
                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHeartEmitterArtworkId(null);
                      onInfoOpen();
                    }}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 bg-cyan-500 text-white hover:bg-cyan-600`}
                    title="Artwork Info"
                    aria-label="View info for this artwork"
                >
                    <Info className="w-5 h-5" />
                </button>
                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHeartEmitterArtworkId(null);
                      onDismissArtworkControls();
                    }}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 ${uiConfig.glass}`}
                    title="Dismiss Artwork Controls"
                    aria-label="Dismiss artwork controls"
                >
                    <ChevronDown className="w-5 h-5" />
                </button>
            </div>
        </div>

        <div ref={mainNavRef}
             className={`backdrop-blur-xl p-1.5 rounded-full flex gap-2 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.68,-0.8,0.32,1.8)] ${!isArtworkFocusedForControls ? 'scale-100 opacity-100 visible' : 'scale-0 opacity-0 pointer-events-none invisible'} ${isEditorMode || isZeroGravityMode ? 'bg-cyan-500/10' : ''}`} // MODIFIED: Add isZeroGravityMode to background color condition
             aria-hidden={!!isArtworkFocusedForControls}
             inert={isArtworkFocusedForControls}>
            {hasLightsToggle && (
                <button onClick={() => {
                  setHeartEmitterArtworkId(null);
                  onLightToggle();
                }} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${!lightsOn ? uiConfig.glassActive : uiConfig.glass}`} title="Toggle Lights">
                    <div className={!lightsOn ? "text-amber-400" : ""}>{lightsOn ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</div>
                </button>
            )}
            {hasEditorModeToggle && (
                <button onClick={() => {
                  setHeartEmitterArtworkId(null);
                  onEditorModeToggle();
                }} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${isEditorMode ? uiConfig.glassActive : uiConfig.glass}`} title="Toggle Editor Mode">
                    {isEditorMode ? <Unlock className={`w-4 h-4 ${lightsOn ? 'text-cyan-500' : 'text-cyan-400'}`} /> : <Lock className="w-4 h-4" />}
                </button>
            )}

            {hasEditorOpenSearch && (
                <React.Fragment>
                    <button onClick={() => {
                      setHeartEmitterArtworkId(null);
                      onEditorOpen();
                    }} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active-scale-95 ${uiConfig.glass}`} title="Open Zone Editor">
                        <MapIcon className="w-4 h-4" />
                    </button>
                    {/* Temporarily hide Search Exhibitions button */}
                </React.Fragment>
            )}

            {/* REMOVED: Effect buttons section */}
            {/* {hasEffectButtons && ( 
              <React.Fragment>
                {shouldShowDivider && (
                  <div className={`w-px my-3 transition-colors duration-700 ${lightsOn ? 'bg-neutral-300' : 'bg-white/10'}`} />
                )}
                {Object.keys(EffectRegistry).map((effectName) => (
                  <button
                    key={effectName}
                    onClick={() => {
                      setHeartEmitterArtworkId(null);
                      onEffectToggle(effectName);
                    }}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${activeEffectName === effectName ? uiConfig.glassActive : uiConfig.glass}`}
                    title={`Toggle ${effectName} Effect`}
                    aria-label={`Toggle ${effectName} Effect`}
                  >
                    <Sparkles className={`w-4 h-4 ${activeEffectName === effectName && (lightsOn ? 'text-cyan-500' : 'text-cyan-400')}`} />
                  </button>
                ))}
                {activeEffectName && ( 
                  <button
                    onClick={() => {
                      setHeartEmitterArtworkId(null);
                      onEffectToggle(activeEffectName); 
                    }}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`}
                    title="Deactivate Effect"
                    aria-label="Deactivate current effect"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </React.Fragment>
            )} */}

            {shouldShowDivider && (
              <div className={`w-px my-3 transition-colors duration-700 ${lightsOn ? 'bg-neutral-300' : 'bg-white/10'}`} />
            )}

            {hasDevToolsToggle && (
                <button onClick={() => {
                  setHeartEmitterArtworkId(null);
                  setIsDevToolsOpen(prev => !prev);
                }} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`} title="Toggle Dev Tools">
                    <Cpu className="w-4 h-4" />
                </button>
            )}
            {hasResetCamera && (
              <button
                onClick={() => {
                  setHeartEmitterArtworkId(null);
                  onResetCamera(); 
                }}
                className={`
                  flex items-center justify-center rounded-full transition-all duration-300 ease-out
                  ${uiConfig.glass} 
                  w-12 h-12 p-3 opacity-100 scale-100 pointer-events-auto
                `}
                title={"Reset View"}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {hasRankingToggle && (
              <button
                onClick={() => {
                  if (hasMotionArtwork) return;
                  setHeartEmitterArtworkId(null);
                  onRankingToggle();
                }}
                disabled={hasMotionArtwork}
                aria-disabled={hasMotionArtwork}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${isRankingMode ? uiConfig.glassActive : uiConfig.glass} ${hasMotionArtwork ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={hasMotionArtwork ? 'Disabled while scene contains motion artworks' : (isRankingMode ? 'Exit Ranking' : 'Show Ranking')}
                aria-label={isRankingMode ? 'Exit ranking mode' : 'Show artwork ranking by likes'}
              >
                <ListOrdered className={`w-4 h-4 ${isRankingMode && (lightsOn ? 'text-cyan-500' : 'text-cyan-400')}`} />
              </button>
            )}
            {hasZeroGravityToggle && (
              <button
                onClick={() => {
                  if (hasMotionArtwork) return;
                  setHeartEmitterArtworkId(null);
                  onZeroGravityToggle();
                }}
                disabled={hasMotionArtwork}
                aria-disabled={hasMotionArtwork}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${isZeroGravityMode ? uiConfig.glassActive : uiConfig.glass} ${hasMotionArtwork ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={hasMotionArtwork ? 'Disabled while scene contains motion artworks' : (isZeroGravityMode ? 'Exit Zero Gravity' : 'Enter Zero Gravity')}
                aria-label={isZeroGravityMode ? 'Exit zero gravity mode' : 'Enter zero gravity mode'}
              >
                <Orbit className={`w-4 h-4 ${isZeroGravityMode && (lightsOn ? 'text-cyan-500' : 'text-cyan-400')}`} />
              </button>
            )}

            {hasSmallScreenNav && (
                <React.Fragment>
                    {!isFirstItem && prevItem && (
                        <button
                          onClick={() => {
                            setHeartEmitterArtworkId(null);
                            onPrev();
                          }}
                          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass} ${nextPrevAnimationClasses}`}
                          title={"Previous Exhibition"}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                    {!isLastItem && nextItem && (
                        <button
                          onClick={() => {
                            setHeartEmitterArtworkId(null);
                            onNext();
                          }}
                          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass} ${nextPrevAnimationClasses}`}
                          title={"Next Exhibition"}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </React.Fragment>
            )}
        </div>
    </div>
    </React.Fragment>
      );
    });

export default MainControls;
