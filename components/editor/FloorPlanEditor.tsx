

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Sun, Map, Brush, Settings, Camera, SquarePen } from 'lucide-react';
import { SimplifiedLightingConfig, ExhibitionArtItem, ZoneLightingDesign, FirebaseArtwork, ArtworkData, Exhibition, EffectRegistryType } from '../../types';
import LightingTab from './LightingTab';
import LayoutTab from './LayoutTab';
import ArtworkTab from './ArtworkTab';
import AdminTab from './AdminTab';
import SceneTab from './SceneTab'; // NEW: Import SceneTab

interface FloorPlanEditorProps {
  isOpen: boolean;
  onClose: () => void;
  isEditorMode: boolean;
  lightingConfig: SimplifiedLightingConfig;
  onUpdateLighting: (newConfig: SimplifiedLightingConfig) => void;
  currentLayout: ExhibitionArtItem[];
  onEditorLayoutChange: (updater: (prevLayout: ExhibitionArtItem[]) => ExhibitionArtItem[]) => void;
  selectedArtworkId: string | null;
  onSelectArtwork: (id: string | null) => void;
  selectedArtworkTitle: string;
  selectedArtworkArtist: string;
  fullZoneLightingDesign: ZoneLightingDesign;
  currentZoneNameForEditor: string;
  firebaseArtworks: FirebaseArtwork[];
  onUpdateArtworkFile: (artworkId: string, newFileUrl: string) => Promise<void>;
  onUpdateArtworkData: (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => Promise<void>;
  onUpdateExhibition: (exhibitionId: string, updatedFields: Partial<Exhibition>) => Promise<void>;
  activeExhibition: Exhibition;
  uiConfig: {
    lightsOn: boolean;
    bg: string;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  // FIX: Update onActiveTabChange prop type to include 'scene'
  onActiveTabChange: (tab: 'lighting' | 'scene' | 'layout' | 'artworks' | 'admin') => void;
  onFocusArtwork: (artworkInstanceId: string | null) => void;
  // FIX: Modified `onOpenConfirmationDialog` signature to match `App.tsx`
  onOpenConfirmationDialog: (itemType: 'artwork_removal', artworkId: string, artworkTitle: string) => void;
  onAddArtworkToLayout: (artwork: FirebaseArtwork) => Promise<boolean>;
  onRemoveArtworkFromLayout: (artworkId: string) => Promise<void>; // NEW: Add onRemoveArtworkFromLayout
  useExhibitionBackground: boolean; // NEW: Add useExhibitionBackground
  activeZoneTheme: string | null; // NEW: Add activeZoneTheme
  onUpdateZoneTheme: (themeName: string | null) => Promise<void>; // NEW: Add onUpdateZoneTheme
  activeExhibitionBackgroundUrl?: string; // NEW: Pass activeExhibitionBackgroundUrl to LightingTab and SceneTab
  effectRegistry: EffectRegistryType | null; // NEW: Add effectRegistry
  isEffectRegistryLoading: boolean; // NEW: Add isEffectRegistryLoading
  activeZoneGravity: number | undefined; // NEW: Add activeZoneGravity
  onUpdateZoneGravity: (gravity: number | undefined) => Promise<void>; // NEW: Add onUpdateZoneGravity
  isSignedIn: boolean; // NEW: Add isSignedIn prop
  activeZoneId: string; // NEW: Add activeZoneId for zone-specific artwork settings
}

const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  isOpen,
  onClose,
  isEditorMode,
  lightingConfig,
  onUpdateLighting,
  currentLayout,
  onEditorLayoutChange,
  selectedArtworkId,
  onSelectArtwork,
  selectedArtworkTitle,
  selectedArtworkArtist,
  fullZoneLightingDesign,
  currentZoneNameForEditor,
  firebaseArtworks,
  onUpdateArtworkFile,
  onUpdateArtworkData,
  onUpdateExhibition,
  activeExhibition,
  uiConfig,
  onActiveTabChange,
  onFocusArtwork,
  onOpenConfirmationDialog,
  onAddArtworkToLayout,
  onRemoveArtworkFromLayout, // NEW: Destructure onRemoveArtworkFromLayout
  useExhibitionBackground, // NEW: Destructure useExhibitionBackground
  activeZoneTheme, // NEW: Destructure activeZoneTheme
  onUpdateZoneTheme, // NEW: Destructure onUpdateZoneTheme
  activeExhibitionBackgroundUrl, // NEW: Destructure activeExhibitionBackgroundUrl
  effectRegistry, // NEW: Destructure effectRegistry
  isEffectRegistryLoading, // NEW: Destructure isEffectRegistryLoading
  activeZoneGravity, // NEW: Destructure activeZoneGravity
  onUpdateZoneGravity, // NEW: Destructure onUpdateZoneGravity
  isSignedIn, // NEW: Destructure isSignedIn
  activeZoneId, // NEW: Destructure activeZoneId
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef<boolean>(isOpen);
  // FIX: Update activeTab state type to include 'scene'
  const [activeTab, setActiveTab] = useState<'lighting' | 'scene' | 'layout' | 'artworks' | 'admin'>('lighting');
  
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [isAnyLayoutItemDragging, setIsAnyLayoutItemDragging] = useState(false); // NEW state
  
  // NEW: States for panel dragging (no restrictions)
  const [panelOffset, setPanelOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  const { lightsOn } = uiConfig;

  const triggerSaveNotification = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setShowSaved(true);
    saveTimeoutRef.current = window.setTimeout(() => setShowSaved(false), 2000);
  }, []);

  const isInitialMount = useRef(true);
  useEffect(() => {
    // Only trigger save notification for lighting and scene tabs when their configs change
    if (activeTab !== 'lighting' && activeTab !== 'scene') return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      triggerSaveNotification();
    }
  }, [lightingConfig, triggerSaveNotification, activeTab]);
  
  useEffect(() => {
    onActiveTabChange(activeTab);
  }, [activeTab, onActiveTabChange]);

  // When the editor is being closed, ensure any focused element inside the panel is blurred
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      try {
        const active = document.activeElement as HTMLElement | null;
        if (active && panelRef.current && panelRef.current.contains(active)) {
          active.blur();
        }
      } catch (e) {
        // ignore
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // DEBUG: Log isEditorMode value
  useEffect(() => {
    // Debug logging removed
  }, [isEditorMode, isOpen, activeTab]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // FIX: Update handleTabClick signature to include 'scene'
  const handleTabClick = useCallback((tab: 'lighting' | 'scene' | 'layout' | 'artworks' | 'admin') => {
    setActiveTab(tab);
    onActiveTabChange(tab);
  }, [onActiveTabChange]);

  // NEW: Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: panelOffset.x,
      offsetY: panelOffset.y,
    };
  }, [panelOffset]);

  // NEW: Handle drag move and end
  useEffect(() => {
    if (!isDragging || !dragStateRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current) return;
      const deltaX = e.clientX - dragStateRef.current.startX;
      const deltaY = e.clientY - dragStateRef.current.startY;

      setPanelOffset({
        x: dragStateRef.current.offsetX + deltaX,
        y: dragStateRef.current.offsetY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // If the panel is closed, don't render it at all to avoid layout/stacking leaks
  if (!isOpen) return null;

  return (
    <React.Fragment>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleOverlayClick} // MODIFIED: Use new handleOverlayClick
          aria-hidden="true"
        />
      )}
      <div 
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-[10px] right-[10px] h-full w-full max-w-lg z-50 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden rounded-xl border ${lightsOn ? 'bg-white/90 shadow-2xl border-white/20' : 'bg-neutral-900/90 shadow-2xl border-white/10'} ${uiConfig.text}`}
        style={{
          transform: `translate(${panelOffset.x}px, ${panelOffset.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.19,1,0.22,1)',
        }}
      >
        <div 
          onMouseDown={handleDragStart}
          className={`px-6 py-4 border-b flex justify-between items-center gap-4 ${uiConfig.border} cursor-move select-none hover:opacity-80 transition-opacity`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
              <h3 className="font-bold tracking-widest uppercase text-sm truncate">Exhibit Editor</h3>
              <div className={`flex items-center gap-1.5 text-green-500 transition-opacity duration-300 ml-auto ${showSaved ? 'opacity-100' : 'opacity-0'}`}>
                 <Check className="w-4 h-4" />
                 <span className="text-xs font-bold">Saved</span>
              </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-500/20 rounded-lg transition-colors cursor-pointer flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>
        
        <div className={`p-3 border-b ${uiConfig.border} ${lightsOn ? 'bg-white/50' : 'bg-neutral-800/50'}`}>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleTabClick('lighting')}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'lighting' ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-black shadow-md') : (lightsOn ? 'text-neutral-600 hover:bg-black/5' : 'text-neutral-400 hover:bg-white/5')}`}
                >
                    <Sun className="w-4 h-4" /> Lighting
                </button>
                <button
                    onClick={() => handleTabClick('layout')}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'layout' ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-black shadow-md') : (lightsOn ? 'text-neutral-600 hover:bg-black/5' : 'text-neutral-400 hover:bg-white/5')}`}
                >
                    <Map className="w-4 h-4" /> Layout
                </button>
                {/* NEW: Scene Tab Button */}
                <button
                    onClick={() => handleTabClick('scene')}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'scene' ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-black shadow-md') : (lightsOn ? 'text-neutral-600 hover:bg-black/5' : 'text-neutral-400 hover:bg-white/5')}`}
                >
                    <Camera className="w-4 h-4" /> Scene
                </button>
                <button
                    onClick={() => handleTabClick('artworks')}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'artworks' ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-black shadow-md') : (lightsOn ? 'text-neutral-600 hover:bg-black/5' : 'text-neutral-400 hover:bg-white/5')}`}
                >
                    <Brush className="w-4 h-4" /> Artworks
                </button>
                <button
                    onClick={() => handleTabClick('admin')}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'admin' ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-black shadow-md') : (lightsOn ? 'text-neutral-600 hover:bg-black/5' : 'text-neutral-400 hover:bg-white/5')}`}
                >
                    <SquarePen className="w-4 h-4" />
                </button>
            </div>
        </div>

        {activeTab === 'lighting' ? (
          <LightingTab 
            uiConfig={uiConfig}
            lightingConfig={lightingConfig}
            onUpdateLighting={onUpdateLighting}
            fullZoneLightingDesign={fullZoneLightingDesign}
            currentZoneNameForEditor={currentZoneNameForEditor}
            exhibitionTitle={activeExhibition?.title} // NEW: Pass exhibition title
          />
        ) : activeTab === 'layout' ? (
          <LayoutTab 
            uiConfig={uiConfig}
            currentLayout={currentLayout}
            onEditorLayoutChange={onEditorLayoutChange}
            selectedArtworkId={selectedArtworkId}
            onSelectArtwork={onSelectArtwork}
            selectedArtworkTitle={selectedArtworkTitle}
            selectedArtworkArtist={selectedArtworkArtist}
            lightingConfig={lightingConfig}
            onUpdateLighting={onUpdateLighting}
            setIsAnyLayoutItemDragging={setIsAnyLayoutItemDragging}
            firebaseArtworks={firebaseArtworks}
            activeZoneId={activeZoneId}
            onUpdateArtworkFile={async (artworkId: string, newFileUrl: string) => {
              await onUpdateArtworkFile(artworkId, newFileUrl);
              triggerSaveNotification();
            }}
            onUpdateArtworkData={async (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => {
              await onUpdateArtworkData(artworkId, updatedArtworkData);
              triggerSaveNotification();
            }}
            onRemoveArtworkFromLayout={onRemoveArtworkFromLayout}
            onOpenConfirmationDialog={onOpenConfirmationDialog} // NEW: Pass onOpenConfirmationDialog
            isSignedIn={isSignedIn} // NEW: Pass isSignedIn
          />
        ) : activeTab === 'scene' ? ( // NEW: Render SceneTab
          <SceneTab
            uiConfig={uiConfig}
            lightingConfig={lightingConfig}
            onUpdateLighting={onUpdateLighting}
            fullZoneLightingDesign={fullZoneLightingDesign}
            currentZoneNameForEditor={currentZoneNameForEditor}
            activeExhibitionBackgroundUrl={activeExhibitionBackgroundUrl}
            useExhibitionBackground={useExhibitionBackground}
            activeZoneTheme={activeZoneTheme}
            onUpdateZoneTheme={onUpdateZoneTheme}
            effectRegistry={effectRegistry} // NEW: Pass effect registry
            isEffectRegistryLoading={isEffectRegistryLoading} // NEW: Pass loading state
            activeZoneGravity={activeZoneGravity} // NEW: Pass activeZoneGravity
            onUpdateZoneGravity={onUpdateZoneGravity} // NEW: Pass onUpdateZoneGravity
          />
        ) : activeTab === 'artworks' ? (
          <ArtworkTab
            uiConfig={uiConfig}
            firebaseArtworks={firebaseArtworks}
            currentLayout={currentLayout}
            activeZoneId={activeZoneId}
            onUpdateArtworkFile={async (artworkId: string, newFileUrl: string) => {
              await onUpdateArtworkFile(artworkId, newFileUrl);
              triggerSaveNotification();
            }}
            onUpdateArtworkData={async (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => {
              await onUpdateArtworkData(artworkId, updatedArtworkData);
              triggerSaveNotification();
            }}
            onFocusArtwork={onFocusArtwork}
            onOpenConfirmationDialog={onOpenConfirmationDialog}
            onSelectArtwork={onSelectArtwork}
            onAddArtworkToLayout={async (artwork: FirebaseArtwork) => {
              const success = await onAddArtworkToLayout(artwork);
              if (success) {
                triggerSaveNotification();
              }
              return success;
            }}
            isSignedIn={isSignedIn}
          />
        ) : (
            <AdminTab
                uiConfig={uiConfig}
                activeExhibition={activeExhibition}
                onUpdateExhibition={async (exhibitionId, updatedFields) => {
                  await onUpdateExhibition(exhibitionId, updatedFields);
                  triggerSaveNotification();
                }}
                currentLayout={currentLayout}
                firebaseArtworks={firebaseArtworks}
            />
        )}
      </div>
    </React.Fragment>
  );
};

export default FloorPlanEditor;