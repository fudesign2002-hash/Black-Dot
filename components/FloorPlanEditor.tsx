import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Sun, Map, Brush, Settings } from 'lucide-react';
import { SimplifiedLightingConfig, ExhibitionArtItem, ZoneLightingDesign, FirebaseArtwork, ArtworkData, Exhibition } from '../../types';
import LightingTab from './LightingTab';
import LayoutTab from './LayoutTab';
import ArtworkTab from './ArtworkTab';
import AdminTab from './AdminTab';

interface FloorPlanEditorProps {
  isOpen: boolean;
  onClose: () => void;
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
  theme: {
    lightsOn: boolean;
    bg: string;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  onActiveTabChange: (tab: 'lighting' | 'layout' | 'artworks' | 'admin') => void; 
  onFocusArtwork: (artworkInstanceId: string | null) => void;
  onRemoveArtworkFromLayout: (artworkId: string) => Promise<void>;
  onOpenConfirmationDialog: (artworkId: string, artworkTitle: string, onConfirm: () => Promise<void>) => void;
}

const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  isOpen,
  onClose,
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
  theme,
  onActiveTabChange,
  onFocusArtwork,
  onRemoveArtworkFromLayout,
  onOpenConfirmationDialog,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'lighting' | 'layout' | 'artworks' | 'admin'>('lighting'); 
  
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const { lightsOn } = theme;

  const triggerSaveNotification = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setShowSaved(true);
    saveTimeoutRef.current = window.setTimeout(() => setShowSaved(false), 2000);
  }, []);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (activeTab !== 'lighting') return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      triggerSaveNotification();
    }
  }, [lightingConfig, triggerSaveNotification, activeTab]);
  
  useEffect(() => {
    onActiveTabChange(activeTab);
  }, [activeTab, onActiveTabChange]);

  useEffect(() => {
    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleTabClick = useCallback((tab: 'lighting' | 'layout' | 'artworks' | 'admin') => { 
    setActiveTab(tab);
    onActiveTabChange(tab);
  }, [onActiveTabChange]);

  return (
    <>
      {isOpen && (
        <div
          className="absolute inset-0 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div 
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 right-0 h-full w-full max-w-lg z-50 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] border-l ${lightsOn ? 'bg-white/70' : 'bg-neutral-900/70'} ${theme.border} ${theme.text} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className={`px-4 py-3 border-b flex justify-between items-center ${theme.border}`}>
          <div className="flex items-center gap-2">
              <h3 className="font-bold tracking-widest uppercase text-sm">Zone Editor</h3>
              <div className={`flex items-center gap-1.5 text-green-500 transition-opacity duration-300 ${showSaved ? 'opacity-100' : 'opacity-0'}`}>
                 <Check className="w-4 h-4" />
                 <span className="text-xs font-bold">Saved</span>
              </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-500/10 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        
        <div className={`p-2 border-b ${theme.border} ${lightsOn ? 'bg-white/70' : 'bg-neutral-900/70'}`}>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleTabClick('lighting')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'lighting' ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'}`}
                >
                    <Sun className="w-4 h-4" /> Lighting
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
                    <Settings className="w-4 h-4" /> Admin
                </button>
            </div>
        </div>

        {activeTab === 'lighting' ? (
          <LightingTab 
            theme={theme}
            lightingConfig={lightingConfig}
            onUpdateLighting={onUpdateLighting}
            fullZoneLightingDesign={fullZoneLightingDesign}
            currentZoneNameForEditor={currentZoneNameForEditor}
          />
        ) : activeTab === 'layout' ? (
          <LayoutTab 
            theme={theme}
            currentLayout={currentLayout}
            onEditorLayoutChange={onEditorLayoutChange}
            selectedArtworkId={selectedArtworkId}
            onSelectArtwork={onSelectArtwork}
            selectedArtworkTitle={selectedArtworkTitle}
            selectedArtworkArtist={selectedArtworkArtist}
          />
        ) : activeTab === 'artworks' ? (
          <ArtworkTab
            theme={theme}
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
            onRemoveArtworkFromLayout={onRemoveArtworkFromLayout}
            onOpenConfirmationDialog={onOpenConfirmationDialog}
          />
        ) : (
            <AdminTab
                theme={theme}
                activeExhibition={activeExhibition}
                onUpdateExhibition={async (exhibitionId, updatedFields) => {
                  await onUpdateExhibition(exhibitionId, updatedFields);
                  triggerSaveNotification();
                }}
            />
        )}
      </div>
    </>
  );
};

export default FloorPlanEditor;