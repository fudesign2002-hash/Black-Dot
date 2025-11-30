import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { db } from './firebase';
import firebase from 'firebase/compat/app'; // NEW: Import firebase for FieldValue.arrayRemove

import Scene from './components/scene/Scene';
import Header from './components/layout/Header';
import InfoPanel from './components/info/InfoPanel';
import SearchModal from './components/search/SearchModal';
import MainControls from './components/controls/MainControls';
import SideNavigation from './components/layout/SideNavigation';
import FirebaseViewer from './components/FirebaseViewer';
import FloorPlanEditor from './components/editor/FloorPlanEditor';
import TransitionOverlay from './components/ui/TransitionOverlay';
import CurrentExhibitionInfo from './components/info/CurrentExhibitionInfo';
import ConfirmationDialog from './components/ui/ConfirmationDialog'; // NEW: Import ConfirmationDialog
import DevToolsPanel from './components/ui/DevToolsPanel'; // NEW: Import DevToolsPanel
import EmbeddedMuseumScene from './components/EmbeddedMuseumScene'; // NEW: Import EmbeddedMuseumScene

import { useMuseumState } from './hooks/useMuseumState';
import { ExhibitionArtItem, SimplifiedLightingConfig, ZoneArtworkItem, Exhibition, SimplifiedLightingPreset, FirebaseArtwork, ArtworkData } from './types';

// New component for the full museum application experience
function MuseumApp() {
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFirebaseViewerOpen, setIsFirebaseViewerOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false); // NEW: State for DevToolsPanel
  const [isSmallScreen, setIsSmallScreen] = useState(false); // NEW: State for small screen detection

  // --- Editor and Focus State ---
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [editorLayout, setEditorLayout] = useState<ExhibitionArtItem[] | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<'lighting' | 'layout' | 'artworks' | 'admin'>('lighting'); // NEW: State for active editor tab, added 'admin'
  const [focusedArtworkInstanceId, setFocusedArtworkInstanceId] = useState<string | null>(null); // NEW: State for camera focus

  // --- Confirmation Dialog State --- NEW
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationArtworkId, setConfirmationArtworkId] = useState<string | null>(null);
  const [confirmationArtworkTitle, setConfirmationArtworkTitle] = useState<string | null>(null);
  const [confirmationConfirmCallback, setConfirmationConfirmCallback] = useState<(() => Promise<void>) | null>(null);

  // --- FPS State --- NEW
  const [fps, setFps] = useState(0);

  const {
    isLoading,
    exhibitions,
    zones,
    firebaseArtworks,
    activeExhibition,
    activeZone,
    currentLayout,
    lightingConfig,
    currentIndex,
    handleNavigate,
    setLightingOverride,
  } = useMuseumState();

  // NEW: Effect for small screen detection
  useEffect(() => {
    const checkScreenSize = () => {
      // Tailwind's 'md' breakpoint is 768px, so less than 768px is considered small
      setIsSmallScreen(window.innerWidth < 768); 
    };

    checkScreenSize(); // Check on mount
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Sync editor layout when editor mode is toggled or the base layout changes
  useEffect(() => {
    if (isEditorMode) {
      setEditorLayout(JSON.parse(JSON.stringify(currentLayout))); // Deep copy
      // FIX: When entering editor mode, do NOT pre-select any artwork based on focusedIndex.
      // The user wants no default selection in the 2D map.
      setSelectedArtworkId(null);
      setFocusedArtworkInstanceId(null); 
    } else {
      setEditorLayout(null);
      setSelectedArtworkId(null);
      setFocusedArtworkInstanceId(null); // NEW: Clear camera focus when exiting editor mode
    }
  }, [isEditorMode, currentLayout, focusedIndex]);

  // NEW: Callback for selecting artwork and potentially focusing camera
  const handleSelectArtwork = useCallback((id: string | null) => {
    setSelectedArtworkId(id);
    // Clear camera focus when a layout artwork is selected (or deselected)
    setFocusedArtworkInstanceId(null); 
  }, []);

  const handleFocusArtworkInstance = useCallback((instanceId: string | null) => {
    setFocusedArtworkInstanceId(instanceId);
  }, []);

  // NEW: Effect to clear camera focus when not in artworks tab or editor mode
  useEffect(() => {
    if (!isEditorMode || (activeEditorTab !== 'artworks' && activeEditorTab !== 'admin')) { // Also clear for admin tab
        setFocusedArtworkInstanceId(null);
    }
  }, [isEditorMode, activeEditorTab]);

  const handleSaveLayout = useCallback(async (layoutToSave: ExhibitionArtItem[]) => {
    if (!layoutToSave || !activeZone?.id || activeZone.id === 'fallback_zone_id') return;
    const artworkSelectedData: ZoneArtworkItem[] = layoutToSave.map(item => ({
        artworkId: item.artworkId,
        position: item.position,
        rotation: item.rotation,
        scale: item.scale
    }));
    try {
        const zoneDocRef = db.collection('zones').doc(activeZone.id);
        await zoneDocRef.update({ 'artwork_selected': artworkSelectedData });
    } catch (error) {
        console.error("Failed to update layout in Firebase:", error);
    }
  }, [activeZone.id]);

  // NEW: Debounced auto-save effect for layout changes
  useEffect(() => {
    if (!editorLayout || !isEditorMode) return;
    const handler = setTimeout(() => {
        handleSaveLayout(editorLayout);
    }, 1000); // Debounce for 1 second
    return () => clearTimeout(handler);
  }, [editorLayout, isEditorMode, handleSaveLayout]);
  
  const handleEditorLayoutChange = useCallback((updater: (prevLayout: ExhibitionArtItem[]) => ExhibitionArtItem[]) => {
      setEditorLayout(prevPrevLayout => {
          if (prevPrevLayout) {
              return updater(prevPrevLayout);
          }
          return prevPrevLayout;
      });
  }, []);

  // FIX: This callback is meant to update the App's activeEditorTab state, not call internal FloorPlanEditor functions.
  const handleActiveEditorTabChange = useCallback((tab: 'lighting' | 'layout' | 'artworks' | 'admin') => {
    setActiveEditorTab(tab); 
  }, []);

  const version = "3.3.9"; // Updated version number
  const { lightsOn } = lightingConfig;

  const handleLightToggle = useCallback(() => {
    const newLightsOnState = !lightsOn;
    const newConfig = { ...lightingConfig, lightsOn: newLightsOnState };
    setLightingOverride(activeZone.id, newConfig);
  }, [lightsOn, lightingConfig, setLightingOverride, activeZone.id]);

  const loadExhibition = useCallback((index: number) => {
    setIsTransitioning(true);
    setIsSearchOpen(false);
    
    setTimeout(() => {
      handleNavigate(index);
      setResetTrigger(t => t + 1);
      setTimeout(() => setIsTransitioning(false), 150);
    }, 150);
  }, [handleNavigate]);

  const handleExhibitionChange = useCallback((direction: 'next' | 'prev') => {
    const totalItems = exhibitions.length;
    if (totalItems === 0) return;
    const nextIndex = direction === 'next'
        ? (currentIndex + 1) % totalItems
        : (currentIndex - 1 + totalItems) % totalItems;
    loadExhibition(nextIndex);
  }, [exhibitions.length, currentIndex, loadExhibition]);

  const handleLightingUpdate = useCallback(async (newConfig: SimplifiedLightingConfig) => {
    setLightingOverride(activeZone.id, newConfig);
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') return;
    try {
        const zoneDocRef = db.collection('zones').doc(activeZone.id);
        await zoneDocRef.update({ 'lightingDesign.defaultConfig': newConfig });
    } catch (error) {
        console.error("Failed to update lighting config in Firebase:", error);
    }
  }, [activeZone.id, setLightingOverride]);

  const handleUpdateArtworkFile = useCallback(async (artworkId: string, newFileUrl: string) => {
    try {
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      await artworkDocRef.update({ artwork_file: newFileUrl });
    } catch (error) {
      console.error("Failed to update artwork file in Firebase:", error);
      throw error;
    }
  }, []);

  // NEW: Callback to update artwork_data for a specific artwork
  const handleUpdateArtworkData = useCallback(async (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => {
    try {
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      // Retrieve current artwork_data, merge with updated, then save
      const doc = await artworkDocRef.get();
      const currentArtworkData = doc.data()?.artwork_data || {};
      const mergedArtworkData = { ...currentArtworkData, ...updatedArtworkData };
      await artworkDocRef.update({ artwork_data: mergedArtworkData });
    } catch (error) {
      console.error("Failed to update artwork_data in Firebase:", error);
      throw error;
    }
  }, []);

  // NEW: Callback to update exhibition details
  const handleUpdateExhibition = useCallback(async (exhibitionId: string, updatedFields: Partial<Exhibition>) => {
    if (!exhibitionId || exhibitionId === 'fallback_id') {
      console.error("Cannot update exhibition: Invalid Exhibition ID.");
      throw new Error("Invalid Exhibition ID");
    }
    try {
      const exhibitionDocRef = db.collection('exhibitions').doc(exhibitionId);
      await exhibitionDocRef.update(updatedFields);
      console.log(`Updated exhibition ${exhibitionId} with fields:`, updatedFields);
    } catch (error) {
      console.error("Failed to update exhibition in Firebase:", error);
      throw error;
    }
  }, []);

  // NEW: Callback to remove artwork from exhibition and zone layout (this function is called AFTER confirmation)
  const handleRemoveArtworkFromLayout = useCallback(async (artworkIdToRemove: string) => {
    if (!activeExhibition?.id || activeExhibition.id === 'fallback_id') {
      console.error("Cannot remove artwork: Active exhibition ID is invalid.");
      throw new Error("Invalid Exhibition ID");
    }
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
      console.error("Cannot remove artwork: Active zone ID is invalid.");
      throw new Error("Invalid Zone ID");
    }

    try {
      // 1. Update the 'exhibitions' document
      const exhibitionDocRef = db.collection('exhibitions').doc(activeExhibition.id);
      await exhibitionDocRef.update({
        exhibit_artworks: firebase.firestore.FieldValue.arrayRemove(artworkIdToRemove)
      });
      console.log(`Removed artwork ${artworkIdToRemove} from exhibition ${activeExhibition.id}.`);

      // 2. Update the 'zones' document
      const zoneDocRef = db.collection('zones').doc(activeZone.id);
      const zoneDoc = await zoneDocRef.get();
      const currentArtworkSelected = zoneDoc.data()?.artwork_selected as ZoneArtworkItem[] || [];

      // Filter out all entries for the artworkIdToRemove
      const newArtworkSelected = currentArtworkSelected.filter(item => item.artworkId !== artworkIdToRemove);

      await zoneDocRef.update({
        artwork_selected: newArtworkSelected
      });
      console.log(`Removed artwork ${artworkIdToRemove} from zone layout ${activeZone.id}.`);

      // After successful Firebase updates, the `useMuseumState` hook will automatically
      // re-evaluate `currentLayout` and trigger `editorLayout`'s useEffect to update.
      // So no explicit local state update for `editorLayout` is needed here.
    } catch (error) {
      console.error("Failed to remove artwork from layout in Firebase:", error);
      throw error; // Re-throw to be caught by the ArtworkTab's error handling
    }
  }, [activeExhibition.id, activeZone.id]);

  // NEW: Callback to open the custom confirmation dialog
  const openConfirmationDialog = useCallback((artworkId: string, artworkTitle: string, onConfirm: () => Promise<void>) => {
    setConfirmationArtworkId(artworkId);
    setConfirmationArtworkTitle(artworkTitle);
    setConfirmationMessage(`Are you sure you want to remove "${artworkTitle}" from this exhibition and zone layout? This will NOT delete the artwork from the master artworks collection.`);
    setConfirmationConfirmCallback(() => onConfirm); // Store the callback to be executed on confirmation
    setShowConfirmation(true);
  }, []);

  // NEW: Handler for when the user confirms the action in the custom dialog
  const handleConfirmAction = useCallback(async () => {
    setShowConfirmation(false);
    if (confirmationConfirmCallback) {
      try {
        await confirmationConfirmCallback();
      } catch (error) {
        console.error("Error during confirmed action:", error);
        // Handle error, e.g., show a toast notification
      }
    }
    // Clear confirmation state
    setConfirmationArtworkId(null);
    setConfirmationArtworkTitle(null);
    setConfirmationMessage('');
    setConfirmationConfirmCallback(null);
  }, [confirmationConfirmCallback]);

  // NEW: Handler for when the user cancels the action in the custom dialog
  const handleCancelAction = useCallback(() => {
    setShowConfirmation(false);
    // Clear confirmation state
    setConfirmationArtworkId(null);
    setConfirmationArtworkTitle(null);
    setConfirmationMessage('');
    setConfirmationConfirmCallback(null);
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

  const nextItem = useMemo(() => {
    if (exhibitions.length === 0) return null;
    return exhibitions[(currentIndex + 1) % exhibitions.length];
  }, [exhibitions, currentIndex]);

  const prevItem = useMemo(() => {
    if (exhibitions.length === 0) return null;
    return exhibitions[(currentIndex - 1 + exhibitions.length) % exhibitions.length];
  }, [exhibitions, currentIndex]);

  const displayLayout = isEditorMode && editorLayout ? editorLayout : currentLayout;

  const selectedArtworkTitle = useMemo(() => {
    if (!selectedArtworkId || !editorLayout || !firebaseArtworks) return 'NONE';
    const artItem = editorLayout.find(item => item.id === selectedArtworkId);
    if (!artItem) return 'NONE';
    const firebaseArt = firebaseArtworks.find(fbArt => fbArt.id === artItem.artworkId);
    return firebaseArt ? firebaseArt.title.toUpperCase() : 'UNKNOWN';
  }, [selectedArtworkId, editorLayout, firebaseArtworks]);

  const selectedArtworkArtist = useMemo(() => {
    if (!selectedArtworkId || !editorLayout || !firebaseArtworks) return null;
    const artItem = editorLayout.find(item => item.id === selectedArtworkId);
    if (!artItem) return null;
    const firebaseArt = firebaseArtworks.find(fbArt => fbArt.id === artItem.artworkId);
    return firebaseArt?.artist || 'Unknown Artist'; // NEW: Retrieve artist from individual artwork
  }, [selectedArtworkId, editorLayout, firebaseArtworks]);

  const focusedArtwork = useMemo(() => {
    if (focusedIndex === -1 || focusedIndex >= currentLayout.length) return null;
    const focusedArtItem = currentLayout[focusedIndex];
    const firebaseArt = firebaseArtworks.find(fbArt => fbArt.id === focusedArtItem.artworkId);
    return firebaseArt || null;
  }, [focusedIndex, currentLayout, firebaseArtworks]);

  return (
    <div className={`w-full h-full relative transition-colors duration-1000 ${theme.bg} overflow-hidden font-sans`}>
      <TransitionOverlay isTransitioning={isTransitioning} />

      <div className="absolute inset-0 z-0">
        <Scene 
          lightingConfig={lightingConfig}
          resetTrigger={resetTrigger}
          currentZoneTheme={activeZone.theme}
          artworks={displayLayout}
          isEditorOpen={isEditorOpen}
          isEditorMode={isEditorMode}
          selectedArtworkId={selectedArtworkId}
          onSelectArtwork={handleSelectArtwork}
          focusedIndex={focusedIndex}
          onFocusChange={setFocusedIndex}
          activeEditorTab={activeEditorTab} // NEW: Pass activeEditorTab to Scene
          focusedArtworkInstanceId={focusedArtworkInstanceId} // NEW: Pass focused artwork instance ID
          setFps={setFps} // NEW: Pass setFps to Scene
        />
      </div>

      <Header theme={theme} version={version} isInfoOpen={isInfoOpen} />

      <CurrentExhibitionInfo 
        theme={theme} 
        isLoading={isLoading} 
        activeExhibition={activeExhibition} 
        isInfoOpen={isInfoOpen} 
        onInfoOpen={() => setIsInfoOpen(true)} 
      />
      
      <SideNavigation 
        theme={theme} 
        isFirstItem={currentIndex === 0} 
        isLastItem={currentIndex === exhibitions.length - 1} 
        onPrev={() => handleExhibitionChange('prev')} 
        onNext={() => handleExhibitionChange('next')} 
        prevItem={prevItem} 
        nextItem={nextItem} 
        isSmallScreen={isSmallScreen}
      />
      
      <MainControls 
        theme={theme} 
        isInfoOpen={isInfoOpen} 
        lightsOn={lightsOn} 
        onLightToggle={handleLightToggle} 
        isEditorMode={isEditorMode} 
        onEditorModeToggle={() => setIsEditorMode(prev => !prev)}
        onEditorOpen={() => setIsEditorOpen(true)}
        setIsFirebaseViewerOpen={setIsFirebaseViewerOpen} 
        setIsSearchOpen={setIsSearchOpen} 
        setResetTrigger={setResetTrigger} 
        setIsDevToolsOpen={setIsDevToolsOpen} // NEW: Pass setIsDevToolsOpen
        isSmallScreen={isSmallScreen} // NEW: Pass isSmallScreen
        onPrev={() => handleExhibitionChange('prev')} // NEW: Pass navigation handlers
        onNext={() => handleExhibitionChange('next')}
        prevItem={prevItem}
        nextItem={nextItem}
        isFirstItem={currentIndex === 0}
        isLastItem={currentIndex === exhibitions.length - 1}
      />

      {isEditorMode && (
          <FloorPlanEditor 
            isOpen={isEditorOpen} 
            onClose={() => setIsEditorOpen(false)} 
            lightingConfig={lightingConfig}
            onUpdateLighting={handleLightingUpdate}
            currentLayout={displayLayout}
            onEditorLayoutChange={handleEditorLayoutChange}
            selectedArtworkId={selectedArtworkId}
            onSelectArtwork={handleSelectArtwork}
            selectedArtworkTitle={selectedArtworkTitle}
            selectedArtworkArtist={selectedArtworkArtist}
            fullZoneLightingDesign={activeZone.lightingDesign}
            currentZoneNameForEditor={activeZone.name}
            firebaseArtworks={firebaseArtworks}
            onUpdateArtworkFile={handleUpdateArtworkFile}
            onUpdateArtworkData={handleUpdateArtworkData} // NEW: Pass down the new callback
            onUpdateExhibition={handleUpdateExhibition} // NEW: Pass update exhibition callback
            activeExhibition={activeExhibition} // NEW: Pass active exhibition
            theme={theme}
            onActiveTabChange={handleActiveEditorTabChange} // NEW: Pass tab change handler
            onFocusArtwork={handleFocusArtworkInstance} // NEW: Pass focus artwork callback
            onRemoveArtworkFromLayout={handleRemoveArtworkFromLayout} 
            onOpenConfirmationDialog={openConfirmationDialog} // NEW: Pass the confirmation dialog opener
          />
      )}

      <FirebaseViewer
        isOpen={isFirebaseViewerOpen}
        onClose={() => setIsFirebaseViewerOpen(false)}
        theme={theme}
        exhibitions={exhibitions}
        zones={zones}
        isLoading={isLoading}
        lightsOn={lightsOn}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        theme={theme}
        exhibitions={exhibitions}
        onExhibitionSelect={(index) => loadExhibition(index)}
      />

      <InfoPanel
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        theme={theme}
        activeExhibition={activeExhibition}
        isLoading={isLoading}
      />

      {/* NEW: Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Confirm Removal"
        message={confirmationMessage}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        theme={theme}
      />

      {/* NEW: DevTools Panel */}
      <DevToolsPanel
        isOpen={isDevToolsOpen}
        onClose={() => setIsDevToolsOpen(false)}
        theme={theme}
        isLoading={isLoading}
        activeExhibitionTitle={activeExhibition.title}
        activeZoneName={activeZone.name}
        focusedArtwork={focusedArtwork}
        isEditorMode={isEditorMode}
        activeEditorTab={activeEditorTab as 'lighting' | 'layout' | 'artworks' | 'admin'} // FIX: Cast activeEditorTab to include 'admin'
        selectedArtworkTitle={selectedArtworkTitle}
        fps={fps}
      />
    </div>
  );
}

function App() {
  const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === 'true';

  if (isEmbedMode) {
    return <EmbeddedMuseumScene showLightToggle showResetCamera />; // Render the embedded scene
  } else {
    return <MuseumApp />; // Render the full application
  }
}

export default App;