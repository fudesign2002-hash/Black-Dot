

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
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef<boolean>(isOpen);
  // FIX: Update activeTab state type to include 'scene'
  const [activeTab, setActiveTab] = useState<'lighting' | 'scene' | 'layout' | 'artworks' | 'admin'>('lighting');
  
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [isAnyLayoutItemDragging, setIsAnyLayoutItemDragging] = useState(false); // NEW state

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
        className={`fixed top-0 right-0 h-full w-full max-w-lg z-50 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] border-l ${lightsOn ? 'bg-white/70' : 'bg-neutral-900/70'} ${uiConfig.border} ${uiConfig.text} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className={`px-4 py-3 border-b flex justify-between items-center ${uiConfig.border}`}>
          <div className="flex items-center gap-2">
              <h3 className="font-bold tracking-widest uppercase text-sm">Zone Editor</h3>
              <div className={`flex items-center gap-1.5 text-green-500 transition-opacity duration-300 ${showSaved ? 'opacity-100' : 'opacity-0'}`}>
                 <Check className="w-4 h-4" />
                 <span className="text-xs font-bold">Saved</span>
              </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-500/10 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        
        <div className={`p-2 border-b ${uiConfig.border} ${lightsOn ? 'bg-white/70' : 'bg-neutral-900/70'}`}>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => handleTabClick('lighting')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'lighting' ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'}`}
                >
                    <Sun className="w-4 h-4" /> Lighting
                </button>
                {/* NEW: Scene Tab Button */}
                <button
                    onClick={() => handleTabClick('scene')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'scene' ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'}`}
                >
                    <Camera className="w-4 h-4" /> Scene
                </button>
                <button
                    onClick={() => handleTabClick('layout')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'layout' ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'}`}
                >
                    <Map className="w-4 h-4" /> Layout
                </button>
                <button
                    onClick={() => handleTabClick('artworks')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'artworks' ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'}`}
                >
                    <Brush className="w-4 h-4" /> Artworks
                </button>
                <button
                    onClick={() => handleTabClick('admin')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'admin' ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'}`}
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
        ) : activeTab === 'artworks' ? (
          <ArtworkTab
            uiConfig={uiConfig}
            firebaseArtworks={firebaseArtworks}
            currentLayout={currentLayout}
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