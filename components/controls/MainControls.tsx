import React from 'react';
import { Sun, Moon, RefreshCw, Map as MapIcon, Search, Lock, Unlock, Cpu, ChevronLeft, ChevronRight, Users, Heart, Info, X, ChevronDown, Share2, ListOrdered } from 'lucide-react';
import { Exhibition } from '../../types';

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
}) => {
  return (
    <React.Fragment>
    <div className={`absolute z-40 flex flex-col items-center gap-1 transition-all duration-500 ${isInfoOpen ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'} bottom-10 left-1/2 -translate-x-1/2`}>
        
        <div className={`flex flex-col items-center gap-2 transition-all duration-500 ease-[cubic-bezier(0.68,-0.8,0.32,1.8)] ${isArtworkFocusedForControls && !isEditorMode ? 'scale-100 opacity-100 visible' : 'scale-0 opacity-0 pointer-events-none invisible'}`}
             aria-hidden={!(isArtworkFocusedForControls && !isEditorMode)}>
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

        <div className={`backdrop-blur-xl p-1.5 rounded-full flex gap-2 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.68,-0.8,0.32,1.8)] ${!isArtworkFocusedForControls ? 'scale-100 opacity-100 visible' : 'scale-0 opacity-0 pointer-events-none invisible'} ${isEditorMode ? 'bg-cyan-500/10' : ''}`}
             aria-hidden={!!isArtworkFocusedForControls}>
            {!isEditorMode && (
                <button onClick={onLightToggle} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${!lightsOn ? uiConfig.glassActive : uiConfig.glass}`} title="Toggle Lights">
                    <div className={!lightsOn ? "text-amber-400" : ""}>{lightsOn ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</div>
                </button>
            )}
            <button onClick={onEditorModeToggle} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${isEditorMode ? uiConfig.glassActive : uiConfig.glass}`} title="Toggle Editor Mode">
                {isEditorMode ? <Unlock className={`w-4 h-4 ${lightsOn ? 'text-cyan-500' : 'text-cyan-400'}`} /> : <Lock className="w-4 h-4" />}
            </button>

            {isEditorMode && (
                <React.Fragment>
                    <button onClick={onEditorOpen} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active-scale-95 ${uiConfig.glass}`} title="Open Zone Editor">
                        <MapIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsSearchOpen(true)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active-scale-95 ${uiConfig.glass}`} title="Search Exhibitions">
                        <Search className="w-4 h-4" />
                    </button>
                </React.Fragment>
            )}

            <div className={`w-px my-3 transition-colors duration-700 ${lightsOn ? 'bg-neutral-300' : 'bg-white/10'}`} />

            {isEditorMode && (
                <button onClick={() => setIsDevToolsOpen(prev => !prev)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`} title="Toggle Dev Tools">
                    <Cpu className="w-4 h-4" />
                </button>
            )}
            <button
              onClick={onResetCamera} 
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`}
              title={"Reset View"}
            >
                <RefreshCw className="w-4 h-4" />
            </button>
            {!isEditorMode && (
                <button
                    onClick={onRankingToggle}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${isRankingMode ? uiConfig.glassActive : uiConfig.glass}`}
                    title={isRankingMode ? "Exit Ranking" : "Show Ranking"}
                    aria-label={isRankingMode ? "Exit ranking mode" : "Show artwork ranking by likes"}
                >
                    <ListOrdered className={`w-4 h-4 ${isRankingMode && (lightsOn ? 'text-cyan-500' : 'text-cyan-400')}`} />
                </button>
            )}

            {isSmallScreen && !isEditorMode && (
                <React.Fragment>
                    {!isFirstItem && prevItem && (
                        <button
                          onClick={onPrev}
                          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`}
                          title={"Previous Exhibition"}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                    {!isLastItem && nextItem && (
                        <button
                          onClick={onNext}
                          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${uiConfig.glass}`}
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
));

export default MainControls;