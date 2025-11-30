import React from 'react';
import { Sun, Moon, RefreshCw, Map as MapIcon, Search, Lock, Unlock, Database, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Exhibition } from '../../types';

interface MainControlsProps {
  theme: any;
  isInfoOpen: boolean;
  lightsOn: boolean;
  onLightToggle: () => void;
  isEditorMode: boolean;
  onEditorModeToggle: () => void;
  onEditorOpen: () => void;
  setIsFirebaseViewerOpen: (open: boolean) => void;
  setIsSearchOpen: (open: boolean) => void;
  setResetTrigger: React.Dispatch<React.SetStateAction<number>>;
  setIsDevToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSmallScreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevItem: Exhibition | null;
  nextItem: Exhibition | null;
  isFirstItem: boolean;
  isLastItem: boolean;
}

const MainControls: React.FC<MainControlsProps> = React.memo(({
  theme,
  isInfoOpen,
  lightsOn,
  onLightToggle,
  isEditorMode,
  onEditorModeToggle,
  onEditorOpen,
  setIsFirebaseViewerOpen,
  setIsSearchOpen,
  setResetTrigger,
  setIsDevToolsOpen,
  isSmallScreen,
  onPrev,
  onNext,
  prevItem,
  nextItem,
  isFirstItem,
  isLastItem,
}) => (
    <div className={`absolute z-40 flex gap-4 transition-all duration-500 ${isInfoOpen ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'} bottom-8 left-1/2 -translate-x-1/2`}>
        <div className={`backdrop-blur-xl border p-1.5 rounded-full flex gap-2 shadow-2xl transition-colors duration-700 ${lightsOn ? 'bg-white/80 border-white/60' : 'bg-black/50 border-white/10'}`}>
            {!isEditorMode && (
              <button onClick={onLightToggle} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${!lightsOn ? theme.glassActive : theme.glass}`} title="Toggle Lights">
                  <div className={!lightsOn ? "text-amber-400" : ""}>{lightsOn ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</div>
              </button>
            )}
            <button onClick={onEditorModeToggle} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-500 ease-out ${isEditorMode ? theme.glassActive : theme.glass}`} title="Toggle Editor Mode">
                {isEditorMode ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>
            
            {isEditorMode && (
                <>
                    <button onClick={onEditorOpen} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active-scale-95 ${theme.glass}`} title="Open Zone Editor">
                        <MapIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsFirebaseViewerOpen(true)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active-scale-95 ${theme.glass}`} title="View Firebase Docs">
                        <Database className="w-4 h-4" />
                    </button>
                </>
            )}

            <button onClick={() => setIsSearchOpen(true)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active-scale-95 ${theme.glass}`} title="Search Exhibitions">
                <Search className="w-4 h-4" />
            </button>
            <div className={`w-px my-3 transition-colors duration-700 ${lightsOn ? 'bg-neutral-300' : 'bg-white/10'}`} />
            
            <button onClick={() => setIsDevToolsOpen(prev => !prev)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${theme.glass}`} title="Toggle Dev Tools">
                <Cpu className="w-4 h-4" />
            </button>
            <button onClick={() => setResetTrigger(t => t + 1)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${theme.glass}`} title="Reset View">
                <RefreshCw className="w-4 h-4" />
            </button>

            {isSmallScreen && !isEditorMode && (
                <>
                    {!isFirstItem && prevItem && (
                        <button onClick={onPrev} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${theme.glass}`} title="Previous Exhibition">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                    {!isLastItem && nextItem && (
                        <button onClick={onNext} className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${theme.glass}`} title="Next Exhibition">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </>
            )}
        </div>
    </div>
));

export default MainControls;