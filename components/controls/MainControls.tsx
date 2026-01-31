
import React, { useState, useEffect } from 'react';
import { trackUmamiEvent } from '../../services/umamiService';
import { Sun, Moon, RefreshCw, Map as MapIcon, Search, Lock, Unlock, Cpu, ChevronLeft, ChevronRight, Users, Heart, Info, X, ChevronDown, Share2, ListOrdered, Orbit, ChartColumnIncreasing, FlaskConical } from 'lucide-react'; // NEW: Import Orbit, ChartColumnIncreasing, FlaskConical icon
import { Exhibition } from '../../types';
// REMOVED: import { EffectRegistry } from '../../effect_bundle'; // NEW: Import EffectRegistry

interface MainControlsProps {
  uiConfig: any;
  isInfoOpen: boolean;
  lightsOn: boolean;
  onLightToggle: () => void;
  hideLightsControl?: boolean; // NEW: Add hideLightsControl prop
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
  focusedArtworkArtist?: string | null;
  focusedArtworkMedium?: string | null;
  focusedArtworkDate?: string | null;
  onLikeTriggered: (artworkInstanceId: string) => void;
  isRankingMode: boolean;
  onRankingToggle: () => void;
  hideRankingControl?: boolean; // NEW: Add hideRankingControl prop
  isZeroGravityMode: boolean; // NEW: Add isZeroGravityMode prop
  onZeroGravityToggle: () => void; // NEW: Add onZeroGravityToggle prop
  hideZeroGravityControl?: boolean; // NEW: Add hideZeroGravityControl prop
  isSignedIn?: boolean; // NEW: whether current user is signed in
  isSandboxMode?: boolean; // NEW: whether sandbox mode is active
  onOpenDashboard?: () => void; // NEW: callback to open analytics dashboard
  isCameraAtDefaultPosition: boolean; // NEW: Add isCameraAtDefaultPosition prop
  isResetCameraEnable?: boolean; // NEW: Global reset-enable flag
  setHeartEmitterArtworkId: (id: string | null) => void;
  hasMotionArtwork: boolean; // NEW: Add hasMotionArtwork prop
  customCameraPosition?: [number, number, number]; // NEW: Add customCameraPosition prop
  isEmbed?: boolean; // NEW: hide certain controls when embedded
  showGlobalOverlay?: boolean; // NEW: Add showGlobalOverlay prop to prevent UI flicker
  exhibitionId?: string; // NEW: optional exhibition id for analytics attributes
  exhibit_dashboard_public?: boolean; // NEW: Whether the dashboard is public
  // REMOVED: activeEffectName: string | null; // NEW: Add activeEffectName
  // REMOVED: onEffectToggle: (effectName: string) => void; // NEW: Add onEffectToggle
}

const MainControls: React.FC<MainControlsProps> = React.memo(({
  uiConfig,
  isInfoOpen,
  lightsOn,
  onLightToggle,
  hideLightsControl, // NEW: Destructure hideLightsControl
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
  focusedArtworkArtist,
  focusedArtworkMedium,
  focusedArtworkDate,
  onLikeTriggered,
  isRankingMode,
  onRankingToggle,
  hideRankingControl, // NEW: Destructure hideRankingControl
  isZeroGravityMode, // NEW: Destructure isZeroGravityMode
  onZeroGravityToggle, // NEW: Destructure onZeroGravityToggle
  hideZeroGravityControl, // NEW: Destructure hideZeroGravityControl
  isSignedIn, // NEW: Destructure isSignedIn
  isSandboxMode, // NEW: Destructure isSandboxMode
  onOpenDashboard, // NEW: Destructure onOpenDashboard
  isCameraAtDefaultPosition, // NEW: Destructure isCameraAtDefaultPosition
  isResetCameraEnable, // NEW: Destructure isResetCameraEnable
  isEmbed = false,
  exhibitionId,
  exhibit_dashboard_public = false, // NEW: Destructure exhibit_dashboard_public
  setHeartEmitterArtworkId,
  hasMotionArtwork, // NEW: Destructure hasMotionArtwork
  customCameraPosition, // NEW: Destructure customCameraPosition
  showGlobalOverlay = false, // NEW: Destructure showGlobalOverlay
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
  const hideNextPrevOnSmallScreen = isSmallScreen && (isArtworkFocusedForControls || isZeroGravityMode);
  const nextPrevAnimationClasses = `transition-all duration-500 ease-out ${hideNextPrevOnSmallScreen ? 'opacity-0 translate-x-full pointer-events-none' : 'opacity-100 translate-x-0'}`;

  // NEW: Logic for conditional divider rendering
  // MODIFIED: In simplified editor flow, we don't hide buttons anymore when isEditorMode is true
  const hasLightsToggle = !isRankingMode && !isZeroGravityMode && !hideLightsControl; 
  // MODIFIED: Hide editor mode toggle if in zero gravity mode. Now uses MapIcon and opens editor directly.
  // NEW: Allow editor toggle if in sandbox mode even if not signed in
  // MODIFIED: Sandbox icon now shows up in embed mode if explicitly requested
  const hasEditorModeToggle = !isRankingMode && !isZeroGravityMode && (isSandboxMode || (!!isSignedIn && !isEmbed));
  // Determine right-side buttons based on their visibility conditions
  // REMOVED: DevTools toggle button as it is now controlled via hotkey only
  const hasDevToolsToggle = false; 
  // MODIFIED: In simplified editor flow, keep reset and ranking buttons visible
  const hasResetCamera = Boolean(isResetCameraEnable) && !isRankingMode && !isZeroGravityMode;
  const hasRankingToggle = !isZeroGravityMode && !hideRankingControl; 
  const hasZeroGravityToggle = !isRankingMode && !hideZeroGravityControl; 

  // NEW: Refined dashboard button logic. In embed mode, strictly respect the exhibit_dashboard_public flag.
  // In normal mode, curators can always see it, but others see it only if it's public.
  const canShowDashboard = !!onOpenDashboard && !isRankingMode && !isZeroGravityMode && (
    isEmbed 
      ? (exhibit_dashboard_public === true) 
      : (!!isSignedIn || exhibit_dashboard_public === true)
  );

  const hasDashboard = canShowDashboard; // NEW: check if dashboard button should show
  // MODIFIED: Keep small screen navigation visible in editor mode
  const hasSmallScreenNav = isSmallScreen && !isArtworkFocusedForControls && !isRankingMode && !isZeroGravityMode && !isEmbed; 

  // Calculate if there are any visible buttons on the left or right side of the divider
  // MODIFIED: Reordered per user request: [Lights][Ranking][ZeroGravity] | [Dashboard][Editor][Reset][Nav]
  const anyLeftButtonsVisible = hasLightsToggle || hasRankingToggle || hasZeroGravityToggle; 
  const anyRightButtonsVisible = hasEditorModeToggle || hasDevToolsToggle || hasResetCamera || hasSmallScreenNav || hasDashboard;

  const shouldShowDivider = anyLeftButtonsVisible && anyRightButtonsVisible;

  // NEW: Determine if artwork controls should be visible
  const showArtworkControls = isArtworkFocusedForControls && !isEditorMode && !isRankingMode && !isZeroGravityMode && !showGlobalOverlay;
  // NEW: Determine if main navigation should be visible
  const showMainNav = !isArtworkFocusedForControls && !showGlobalOverlay;

  // NEW: Completely hide the container if the global overlay is visible to prevent any transition flickers
  if (showGlobalOverlay) return null;

  return (
    <React.Fragment>
    <div className={`absolute z-40 flex flex-col items-center gap-1 transition-all duration-500 ${isInfoOpen ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'} bottom-10 left-1/2 -translate-x-1/2`}>
        
        
        <div ref={artworkControlsRef}
             className={`flex flex-col items-center gap-4 transition-all duration-500 ease-[cubic-bezier(0.68,-0.8,0.32,1.8)] ${showArtworkControls ? 'scale-100 opacity-100 visible' : 'scale-0 opacity-0 pointer-events-none invisible'}`} // MODIFIED: Hide if in zero gravity mode
             aria-hidden={!showArtworkControls}
             inert={!showArtworkControls}>
            {focusedArtworkTitle && (
                <div className={`flex flex-col items-start text-left px-6 pt-5 pb-8 rounded-none backdrop-blur-3xl shadow-2xl border
                    ${uiConfig.text} ${lightsOn ? 'bg-white/95 border-neutral-200 shadow-xl' : 'bg-neutral-900/95 border-neutral-800 shadow-neutral-950/50'} w-max max-w-[85vw] sm:max-w-xl`}>
                    <h2 className="text-lg font-serif font-medium tracking-wide leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">
                        {focusedArtworkTitle}
                    </h2>
                    <div className={`w-full h-[0.5px] ${lightsOn ? 'bg-black/10' : 'bg-white/10'} my-3`} />
                    <span className="text-sm font-serif italic tracking-[0.05em] opacity-90 capitalize whitespace-nowrap">
                        {(focusedArtworkArtist || 'Unknown Artist').toLowerCase()}
                    </span>
                    <span className="text-[9px] font-serif opacity-45 mt-1 tracking-[0.2em] uppercase whitespace-nowrap">
                        {[focusedArtworkDate, focusedArtworkMedium].filter(Boolean).join(' \u00B7 ')}
                    </span>
                </div>
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
                      try {
                        if (focusedArtworkInstanceId) {
                          trackUmamiEvent('Artwork-Info', { artworkInstanceId: focusedArtworkInstanceId });
                        }
                      } catch(e) {}
                      onInfoOpen();
                    }}
                    disabled={focusedArtworkArtist?.toUpperCase() === 'OOTB'}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-300 active:scale-95 bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none`}
                    title={focusedArtworkArtist?.toUpperCase() === 'OOTB' ? "Info locked" : "Artwork Info"}
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
             className={`backdrop-blur-xl p-1.5 rounded-full flex gap-2 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.68,-0.8,0.32,1.8)] ${showMainNav ? 'scale-100 opacity-100 visible' : 'scale-0 opacity-0 pointer-events-none invisible'} ${isEditorMode || isZeroGravityMode ? 'bg-cyan-500/10' : ''}`} // MODIFIED: Add isZeroGravityMode to background color condition
             aria-hidden={!showMainNav}
             inert={!showMainNav}>
            {hasLightsToggle && (
                <button onClick={() => {
                  setHeartEmitterArtworkId(null);
                  onLightToggle();
                }} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${!lightsOn ? uiConfig.glassActive : uiConfig.glass}`} title="Toggle Lights">
                    <div className={!lightsOn ? "text-amber-400" : ""}>{lightsOn ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</div>
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

            {/* REMOVED: Effect buttons section */}

            {shouldShowDivider && (
              <div className={`w-px my-3 transition-colors duration-700 ${lightsOn ? 'bg-neutral-300' : 'bg-white/10'}`} />
            )}

            {hasEditorModeToggle && (
                <button 
                  onClick={() => {
                    setHeartEmitterArtworkId(null);
                    onEditorOpen();
                  }} 
                  className={`relative w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${isEditorMode ? uiConfig.glassActive : uiConfig.glass}`} 
                  title={isSandboxMode ? "Enter Sandbox Mode" : "Open Exhibit Editor"}
                >
                    {isSandboxMode ? (
                      <FlaskConical className={`w-5 h-5 ${isEditorMode && (lightsOn ? 'text-amber-500' : 'text-amber-400')}`} />
                    ) : (
                      <MapIcon className={`w-4 h-4 ${isEditorMode && (lightsOn ? 'text-cyan-500' : 'text-cyan-400')}`} />
                    )}
                    
                    {isSandboxMode && (
                      <span className="absolute -top-1 -right-1 text-[7px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold tracking-tighter shadow-sm border border-white/20">SANDBOX</span>
                    )}
                </button>
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

            {hasSmallScreenNav && (
                <React.Fragment>
                    {/* Only show mobile nav arrows, not button bar arrows, on small screens */}
                    {isSmallScreen && !isFirstItem && prevItem && (
                        <button
                          onClick={() => {
                            setHeartEmitterArtworkId(null);
                            onPrev();
                          }}
                          style={{ position: 'fixed', left: -50, top: '55%', transform: 'translateY(-50%)', zIndex: 50, background: 'none', boxShadow: 'none', border: 'none', padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          className={`mobile-nav-arrow-left`}
                          title={"Previous Exhibition"}
                        >
                            <ChevronLeft className="w-5 h-5 text-black" />
                        </button>
                    )}
                    {isSmallScreen && !isLastItem && nextItem && (
                        <button
                          onClick={() => {
                            setHeartEmitterArtworkId(null);
                            onNext();
                          }}
                          style={{ position: 'fixed', right: -50, top: '55%', transform: 'translateY(-50%)', zIndex: 50, background: 'none', boxShadow: 'none', border: 'none', padding: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          className={`mobile-nav-arrow-right`}
                          title={"Next Exhibition"}
                        >
                            <ChevronRight className="w-5 h-5 text-black" />
                        </button>
                    )}
                </React.Fragment>
            )}

            {hasDashboard && onOpenDashboard && (
              <button
                onClick={() => {
                  setHeartEmitterArtworkId(null);
                  onOpenDashboard();
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`}
                title="Open Analytics Dashboard"
                aria-label="Open analytics dashboard"
              >
                <ChartColumnIncreasing className="w-4 h-4" />
              </button>
            )}
        </div>
    </div>
    </React.Fragment>
      );
    });

export default MainControls;
