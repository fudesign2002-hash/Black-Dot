
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { db } from './firebase';
import firebase from 'firebase/compat/app';

import Scene from './components/scene/Scene';
import Header from './components/layout/Header';
import InfoPanel from './components/info/InfoPanel';
import SearchModal from './components/search/SearchModal';
import MainControls from './components/controls/MainControls';
import SideNavigation from './components/layout/SideNavigation';
import FloorPlanEditor from './components/editor/FloorPlanEditor';
import TransitionOverlay from './components/ui/TransitionOverlay';
import CurrentExhibitionInfo from './components/info/CurrentExhibitionInfo';
import ConfirmationDialog from './components/ui/ConfirmationDialog';
import DevToolsPanel from './components/ui/DevToolsPanel';
import EmbeddedMuseumScene from './components/EmbeddedMuseumScene';

import { useMuseumState } from './hooks/useMuseumState';
import { ExhibitionArtItem, SimplifiedLightingConfig, ZoneArtworkItem, Exhibition, FirebaseArtwork, ArtworkData, ArtType, EffectRegistryType } from './types';
import { VERSION } from './abuild';
import * as THREE from 'three'; // NEW: Import THREE for dynamic effect bundle
import { updateHotspotPoint, updateArtworkHotspotLikes } from './services/firebaseService'; // NEW

interface SceneRipple {
  id: string;
  clientX: number;
  clientY: number;
  colorClass: string;
  effectClass: 'subtle' | 'prominent';
}

// NEW: Define remote URL for effect bundle
const REMOTE_EFFECT_BUNDLE_URL = "https://firebasestorage.googleapis.com/v0/b/blackdot-1890a.firebasestorage.app/o/effect_bundles%2Feffect_bundle.js?alt=media";

function MuseumApp() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isCurrentExhibitionInfoHidden, setIsCurrentExhibitionInfoHidden] = useState(false);
  const [isCameraAtDefaultPosition, setIsCameraAtDefaultPosition] = useState(true); // NEW: State for camera position

  const [isRankingMode, setisRankingMode] = useState(false);
  const [artworksInRankingOrder, setArtworksInRankingOrder] = useState<ExhibitionArtItem[]>([]);

  // NEW: State for Zero Gravity mode
  const [isZeroGravityMode, setIsZeroGravityMode] = useState(false);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [editorLayout, setEditorLayout] = useState<ExhibitionArtItem[] | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  // FIX: Update activeEditorTab state type to include 'scene'
  const [activeEditorTab, setActiveEditorTab] = useState<'lighting' | 'scene' | 'layout' | 'artworks' | 'admin'>('lighting');
  
  const [focusedArtworkInstanceId, _setFocusedArtworkInstanceId] = useState<string | null>(null);
  const setFocusedArtworkInstanceId = useCallback((value: string | null) => {
    _setFocusedArtworkInstanceId(value);
  }, []);

  const [isArtworkFocusedForControls, _setIsArtworkFocusedForControls] = useState(false);
  const setIsArtworkFocusedForControls = useCallback((value: boolean) => {
    _setIsArtworkFocusedForControls(value);
  }, []);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationItemType, setConfirmationItemType] = useState<'artwork_removal' | null>(null);
  const [confirmationArtworkId, setConfirmationArtworkId] = useState<string | null>(null);
  const [confirmationArtworkTitle, setConfirmationArtworkTitle] = useState<string | null>(null);

  const [fps, setFps] = useState(0);

  const lightingUpdateTimeoutRef = useRef<number | null>(null);

  const [onlineUsersPerZone, setOnlineUsersPerZone] = useState<Record<string, number>>({});
  const [zoneCapacity, setZoneCapacity] = useState(100);

  const cameraControlRef = useRef<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    moveCameraToPrevious: () => void;
    moveCameraToInitial: (customCameraPosition?: [number, number, number]) => void;
    moveCameraToRankingMode: (position: [number, number, number], target: [number, number, number]) => void; // NEW
  }>(null);

  const [heartEmitterTrigger, setHeartEmitterTrigger] = useState(0);
  const [heartEmitterArtworkId, setHeartEmitterArtworkId] = useState<string | null>(null);

  const [sceneRipples, setSceneRipples] = useState<SceneRipple[]>([]);
  const nextSceneRippleId = useRef(0);

  const [likedArtworksLocalCount, setLikedArtworksLocalCount] = useState<Record<string, number>>({});
  const likeDebounceTimeouts = useRef<Record<string, number>>({});
  // FIX: Initialize useRef with an empty object to match `Record<string, number>` type
  const likedArtworksLocalCountRef = useRef<Record<string, number>>({});

  const [focusedArtworkFirebaseId, setFocusedArtworkFirebaseId] = useState<string | null>(null);

  const [isSnapshotEnabledGlobally, setIsSnapshotEnabledGlobally] = useState(true); // NEW: State for Firebase onSnapshot toggle
  const [useExhibitionBackground, setUseExhibitionBackground] = useState(false); // NEW: State for exhibition background

  // NEW: State for dynamically loaded EffectRegistry
  const [effectRegistry, setEffectRegistry] = useState<EffectRegistryType | null>(null);
  const [isEffectRegistryLoading, setIsEffectRegistryLoading] = useState(true);
  const [effectRegistryError, setEffectRegistryError] = useState<string | null>(null);

  // NEW: State for tracking if it's the first time lights are toggled off
  const [isFirstLightToggleOff, setIsFirstLightToggleOff] = useState(true);
  const [transitionMessage, setTransitionMessage] = useState('Loading Gallery...'); // NEW: State for transition message

  // NEW: Callback to update camera position status
  const handleCameraPositionChange = useCallback((isAtDefault: boolean) => {
    setIsCameraAtDefaultPosition(isAtDefault);
  }, []);

  const {
    isLoading,
    exhibitions,
    zones,
    firebaseArtworks,
    activeExhibition,
    activeZone,
    currentLayout,
    lightingConfig,
    handleNavigate,
    setLightingOverride,
    currentIndex,
  } = useMuseumState(isSnapshotEnabledGlobally); // NEW: Pass isSnapshotEnabledGlobally to useMuseumState

  // NEW: activeEffectName now comes directly from activeZone.zone_theme
  const activeEffectName = activeZone?.zone_theme || null;
  // NEW: activeZoneGravity now comes directly from activeZone.zone_gravity
  const activeZoneGravity = activeZone?.zone_gravity;


  // NEW: Function to dynamically load the remote effect bundle
  const loadRemoteEffectBundle = useCallback(async () => {
    setIsEffectRegistryLoading(true);
    setEffectRegistryError(null);
    try {
      const response = await fetch(REMOTE_EFFECT_BUNDLE_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch effect bundle: ${response.statusText}`);
      }
      const jsCode = await response.text();

      const blob = new Blob([jsCode], { type: 'application/javascript' });
      const objectUrl = URL.createObjectURL(blob);

      // Dynamically import the module
      const module = await import(/* @vite-ignore */ objectUrl);
      setEffectRegistry(module.EffectRegistry);
      // console.log("EffectRegistry loaded dynamically:", module.EffectRegistry);

      URL.revokeObjectURL(objectUrl); // Clean up the object URL
    } catch (error: any) {
      console.error("Error loading remote effect bundle:", error);
      setEffectRegistry(null);
      setEffectRegistryError(error.message || "Unknown error loading effect bundle.");
    } finally {
      setIsEffectRegistryLoading(false);
    }
  }, []);

  // NEW: Trigger loading of remote effect bundle on component mount
  useEffect(() => {
    loadRemoteEffectBundle();
  }, [loadRemoteEffectBundle]);


  // NEW: Handle updating zone_theme in Firebase
  const handleUpdateZoneTheme = useCallback(async (themeName: string | null) => {
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
      console.error("Cannot update zone theme: Invalid active zone ID.");
      return;
    }
    if (!effectRegistry && themeName !== null) { // Only show error if trying to set a theme when registry isn't loaded
      console.error("Cannot update zone theme: EffectRegistry not loaded.");
      // Optionally, set an error message in UI
      return;
    }

    try {
      const zoneDocRef = db.collection('zones').doc(activeZone.id);
      await zoneDocRef.update({ zone_theme: themeName });
      // console.log(`Zone ${activeZone.id} theme updated to: ${themeName}`);
    } catch (error) {
      console.error("Error updating zone theme:", error);
    }
    // Also reset camera to initial for a clear view of the effect
    if (cameraControlRef.current) {
      cameraControlRef.current.moveCameraToInitial(lightingConfig.customCameraPosition);
    }
    setFocusedArtworkInstanceId(null);
    setIsArtworkFocusedForControls(false);
    setFocusedArtworkFirebaseId(null);
    setisRankingMode(false);
    setIsZeroGravityMode(false); // NEW: Deactivate zero gravity if theme changes
    setHeartEmitterArtworkId(null); // Clear heart emitter when switching effects
  }, [activeZone?.id, cameraControlRef, lightingConfig.customCameraPosition, setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId, setisRankingMode, setIsZeroGravityMode, setHeartEmitterArtworkId, effectRegistry]);

  // NEW: Handle updating zone_gravity in Firebase
  const handleUpdateZoneGravity = useCallback(async (gravityValue: number | undefined) => {
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
      console.error("Cannot update zone gravity: Invalid active zone ID.");
      return;
    }

    try {
      const zoneDocRef = db.collection('zones').doc(activeZone.id);
      await zoneDocRef.update({ zone_gravity: gravityValue });
      // console.log(`Zone ${activeZone.id} gravity updated to: ${gravityValue}`);
    } catch (error) {
      console.error("Error updating zone gravity:", error);
    }
    // No camera reset needed here, as the ArtworkWrapper will animate the Y position
  }, [activeZone?.id]);


  useEffect(() => {
    const checkScreenSize = () => {

      setIsSmallScreen(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    if (activeZone && activeZone.id) {
      setZoneCapacity(activeZone.zone_capacity || 100);

      setOnlineUsersPerZone(prev => {
        if (prev[activeZone.id] === undefined) {
          return { ...prev, [activeZone.id]: Math.floor(Math.random() * 80) + 10 };
        }
        return prev;
      });
    }
  }, [activeZone]);


  useEffect(() => {
    return () => {
      if (lightingUpdateTimeoutRef.current !== null) {
        clearTimeout(lightingUpdateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of Object.values(likeDebounceTimeouts.current)) {
        if (typeof timeoutId === 'number') {
          clearTimeout(timeoutId);
        }
      }
    };
  }, []); // Removed likedArtworksLocalCount from dependency array as it's a ref.

  useEffect(() => {
    // 將最新的 likedArtworksLocalCount 狀態同步到 ref.current，
    // 這確保了 setTimeout 函數可以透過 ref 繞過閉包的限制，隨時讀取到狀態的最新累積值。
    likedArtworksLocalCountRef.current = likedArtworksLocalCount;
  }, [likedArtworksLocalCount]);

  useEffect(() => {
    if (isEditorMode) {
      setEditorLayout(JSON.parse(JSON.stringify(currentLayout)));
      setSelectedArtworkId(null);
      setFocusedArtworkInstanceId(null);
      setIsArtworkFocusedForControls(false);
      setisRankingMode(false);
      setIsZeroGravityMode(false); // NEW: Deactivate zero gravity if editor mode is entered
    } else {
      setEditorLayout(null);
      setSelectedArtworkId(null);
      setFocusedArtworkInstanceId(null);
      setIsArtworkFocusedForControls(false);
    }
  }, [isEditorMode, currentLayout, lightingConfig.customCameraPosition]); // ADDED cameraControlRef and lightingConfig.customCameraPosition to dependencies


  useEffect(() => {
    // FIX: Only set isEditorOpen to true when editor mode is entered for the first time or explicitly opened.
    // When exiting editor mode, it should be explicitly closed.
    // setIsEditorOpen(isEditorMode); 
    // This line is removed, FloorPlanEditor will now only open if the button is pressed.
  }, [isEditorMode]);

  // MODIFIED: This useEffect focuses purely on resetting UI state when activeZone.id changes.
  // It no longer directly triggers camera movement but sets isEditorMode(false),
  // which then triggers the separate isEditorMode useEffect for camera reset.
  useEffect(() => {
    if (activeZone.id !== 'fallback_zone_id') {
      // FIX: Corrected typo 'setisEditorMode' to 'setIsEditorMode'
      setIsEditorMode(false); // This will trigger the next useEffect with isEditorMode=false
      setIsEditorOpen(false);
      setFocusedArtworkInstanceId(null);
      setIsArtworkFocusedForControls(false);
      setHeartEmitterArtworkId(null);
      setisRankingMode(false);
      setIsZeroGravityMode(false); // NEW: Deactivate zero gravity when zone changes
      // NEW: When zone changes, reset first light toggle state
      setIsFirstLightToggleOff(true); 
    }
  }, [activeZone.id]);

  // NEW: Update useExhibitionBackground state from lightingConfig
  useEffect(() => {
    setUseExhibitionBackground(lightingConfig.useExhibitionBackground || false);
  }, [lightingConfig.useExhibitionBackground]);

  useEffect(() => {
    if (lightingConfig.lightsOn) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [lightingConfig.lightsOn]);

  useEffect(() => {
    if (isSmallScreen) {
      // Hide exhibition info if artwork is focused OR in ranking mode OR in zero gravity mode on small screens
      setIsCurrentExhibitionInfoHidden(isArtworkFocusedForControls || isRankingMode || isZeroGravityMode);
    } else {
      setIsCurrentExhibitionInfoHidden(false);
    }
  }, [isArtworkFocusedForControls, isSmallScreen, isRankingMode, isZeroGravityMode]);


  const handleFocusArtworkInstance = useCallback((instanceId: string | null) => {
    setFocusedArtworkInstanceId(instanceId);
  }, [setFocusedArtworkInstanceId]);

  useEffect(() => {
    if (isEditorMode && (activeEditorTab !== 'artworks' && activeEditorTab !== 'admin')) {
        setFocusedArtworkInstanceId(null);
    }
  }, [isEditorMode, activeEditorTab, setFocusedArtworkInstanceId]);

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
        // 
    }
  }, [activeZone.id]);

  useEffect(() => {
    if (!editorLayout || !isEditorMode) return;
    const handler = setTimeout(() => {
        handleSaveLayout(editorLayout);
    }, 1000);
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

  // FIX: 更正 'setActiveTab' 為 'setActiveEditorTab'
  // FIX: Update onActiveTabChange signature to include 'scene'
  const handleActiveEditorTabChange = useCallback((tab: 'lighting' | 'scene' | 'layout' | 'artworks' | 'admin') => {
    setActiveEditorTab(tab);
  }, []);

  const { lightsOn } = lightingConfig;

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

  const handleSelectArtwork = useCallback((id: string | null) => {
    if (isEditorMode) {
      setSelectedArtworkId(id);
      setFocusedArtworkInstanceId(null);
      setIsArtworkFocusedForControls(false);
      setFocusedArtworkFirebaseId(null);
      setHeartEmitterArtworkId(null);
    } else {
      setFocusedArtworkInstanceId(id);
      setSelectedArtworkId(null);
      setIsArtworkFocusedForControls(true);
      const artworkInLayout = currentLayout.find(item => item.id === id);
      if (artworkInLayout) {
        setFocusedArtworkFirebaseId(artworkInLayout.artworkId);
      } else {
        setFocusedArtworkFirebaseId(null);
      }
      setHeartEmitterArtworkId(null); 
    }
  }, [isEditorMode, currentLayout, setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId, setHeartEmitterArtworkId]);

  const handleLightToggle = useCallback(() => {
    const newLightsOnState = !lightsOn;

    // Only trigger transition if it's the first time turning lights OFF
    if (isFirstLightToggleOff && lightsOn) {
      setTransitionMessage('Adjusting lights...');
      setIsTransitioning(true);
      setHeartEmitterArtworkId(null);
      setisRankingMode(false); // NEW: Deactivate ranking mode on light toggle
      setIsZeroGravityMode(false); // NEW: Deactivate zero gravity on light toggle

      setTimeout(() => {
        const newConfig: SimplifiedLightingConfig = { ...lightingConfig, lightsOn: newLightsOnState, useExhibitionBackground: useExhibitionBackground };
        setLightingOverride(activeZone.id, newConfig);
        setIsTransitioning(false);
        setTransitionMessage('Loading Gallery...'); // Reset to default message
        setIsFirstLightToggleOff(false); // Mark that the first light off has occurred
      }, 500); // 500ms delay for the transition
    } else {
      // Normal toggle, no special transition
      setHeartEmitterArtworkId(null);
      setisRankingMode(false); // NEW: Deactivate ranking mode on light toggle
      setIsZeroGravityMode(false); // NEW: Deactivate zero gravity on light toggle
      const newConfig: SimplifiedLightingConfig = { ...lightingConfig, lightsOn: newLightsOnState, useExhibitionBackground: useExhibitionBackground };
      setLightingOverride(activeZone.id, newConfig);
    }
  }, [lightsOn, isFirstLightToggleOff, lightingConfig, setLightingOverride, activeZone.id, useExhibitionBackground, setHeartEmitterArtworkId, setisRankingMode, setIsZeroGravityMode]);

  // NEW: Handle update for lighting config including useExhibitionBackground
  const LOG_APP_LIGHTING = false;
  const handleLightingUpdate = useCallback(async (newConfig: SimplifiedLightingConfig) => {
    if (LOG_APP_LIGHTING) {
      // eslint-disable-next-line no-console
      console.log('[App] handleLightingUpdate', newConfig);
    }
    setLightingOverride(activeZone.id, newConfig);
    setUseExhibitionBackground(newConfig.useExhibitionBackground || false); // Update local state for consistency

    if (lightingUpdateTimeoutRef.current) {
        clearTimeout(lightingUpdateTimeoutRef.current);
    }

    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') return;

    lightingUpdateTimeoutRef.current = window.setTimeout(async () => {
        try {
            if (LOG_APP_LIGHTING) {
              // eslint-disable-next-line no-console
              console.log('[App] Firebase update lightingDesign.defaultConfig', activeZone.id, newConfig);
            }
          const zoneDocRef = db.collection('zones').doc(activeZone.id);
          await zoneDocRef.update({ 'lightingDesign.defaultConfig': newConfig });
      } catch (error) {
            if (LOG_APP_LIGHTING) {
              // eslint-disable-next-line no-console
              console.error('[App] Firebase update error', error);
            }
      }
    }, 500);
  }, [activeZone.id, setLightingOverride]);

  const loadExhibition = useCallback((index: number) => {
    setTransitionMessage('Loading Gallery...'); // Reset to default message
    setIsTransitioning(true);
    setIsSearchOpen(false);
    setisRankingMode(false);
    setIsZeroGravityMode(false); // NEW: Deactivate zero gravity on exhibition load
    setHeartEmitterArtworkId(null);

    setTimeout(() => {
      handleNavigate(index);
      setTimeout(() => setIsTransitioning(false), 150);
    }, 150);
  }, [handleNavigate, setHeartEmitterArtworkId, setisRankingMode, setIsZeroGravityMode]);

  const handleExhibitionChange = useCallback((direction: 'next' | 'prev') => {
    const totalItems = exhibitions.length;
    if (totalItems === 0) return;
    const nextIndex = direction === 'next'
        ? (currentIndex + 1) % totalItems
        : (currentIndex - 1 + totalItems) % totalItems;
    loadExhibition(nextIndex);
  }, [exhibitions.length, currentIndex, loadExhibition]);

  const handleUpdateArtworkFile = useCallback(async (artworkId: string, newFileUrl: string) => {
    try {
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      await artworkDocRef.update({ artwork_file: newFileUrl });
    } catch (error) {
      // 
      throw error;
    }
  }, []);

  const handleUpdateArtworkData = useCallback(async (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => {
    try {
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      const doc = await artworkDocRef.get();
      const currentArtworkData = doc.data()?.artwork_data || {};
      const mergedArtworkData = { ...currentArtworkData, ...updatedArtworkData };
      await artworkDocRef.update({ artwork_data: mergedArtworkData });
    } catch (error) {
      // 
      throw error;
    }
  }, []);

  const handleUpdateExhibition = useCallback(async (exhibitionId: string, updatedFields: Partial<Exhibition>) => {
    if (!exhibitionId || exhibitionId === 'fallback_id') {
      // 
      throw new Error("Invalid Exhibition ID");
    }
    try {
      const exhibitionDocRef = db.collection('exhibitions').doc(exhibitionId);
      await exhibitionDocRef.update(updatedFields);
    } catch (error) {
      // 
      throw error;
    }
  }, []);

  const onRemoveArtworkFromLayout = useCallback(async (artworkIdToRemove: string) => {
    if (!activeExhibition?.id || activeExhibition.id === 'fallback_id') {
      // 
      throw new Error("Invalid Exhibition ID");
    }
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
      // 
      throw new Error("Invalid Zone ID");
    }

    try {
      const exhibitionDocRef = db.collection('exhibitions').doc(activeExhibition.id);
      await exhibitionDocRef.update({
        exhibit_artworks: firebase.firestore.FieldValue.arrayRemove(artworkIdToRemove)
      });

      const zoneDocRef = db.collection('zones').doc(activeZone.id);
      const zoneDoc = await zoneDocRef.get();
      const currentArtworkSelected = zoneDoc.data()?.artwork_selected as ZoneArtworkItem[] || [];

      const newArtworkSelected = currentArtworkSelected.filter(item => item.artworkId !== artworkIdToRemove);

      await zoneDocRef.update({
        artwork_selected: newArtworkSelected
      });

      const artworkDocRef = db.collection('artworks').doc(artworkIdToRemove);
      await artworkDocRef.update({
        artwork_data: null
      });

    } catch (error) {
      // 
      throw error;
    }
  }, [activeExhibition.id, activeZone.id]);

  const onAddArtworkToLayout = useCallback(async (artworkToAdd: FirebaseArtwork) => {
    if (!activeExhibition?.id || activeExhibition.id === 'fallback_id') {
      console.error("onAddArtworkToLayout: Invalid Exhibition ID", activeExhibition?.id);
      throw new Error("Invalid Exhibition ID");
    }
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
      console.error("onAddArtworkToLayout: Invalid Zone ID", activeZone?.id);
      throw new Error("Invalid Zone ID");
    }
  
    try {
      // console.log("onAddArtworkToLayout: Attempting to add artwork", artworkToAdd.id, "to exhibition", activeExhibition.id, "and zone", activeZone.id);
      // 1. Update exhibition's exhibit_artworks
      const exhibitionDocRef = db.collection('exhibitions').doc(activeExhibition.id);
      // console.log("onAddArtworkToLayout: Updating exhibition 'exhibit_artworks'...");
      await exhibitionDocRef.update({
        exhibit_artworks: firebase.firestore.FieldValue.arrayUnion(artworkToAdd.id)
      });
      // console.log("onAddArtworkToLayout: Exhibition 'exhibit_artworks' updated successfully.");
  
      // 2. Update zone's artwork_selected
      const zoneDocRef = db.collection('zones').doc(activeZone.id);
      const zoneDoc = await zoneDocRef.get();
      const currentArtworkSelected = zoneDoc.data()?.artwork_selected as ZoneArtworkItem[] || [];
  
      // Create a default ExhibitionArtItem for the new artwork
      const newZoneArtworkItem: ZoneArtworkItem = {
        artworkId: artworkToAdd.id,
        position: [0, 0, 0], // Default position
        rotation: [0, 0, 0], // Default rotation
        scale: 1,           // Default scale
      };
  
      const newArtworkSelected = [...currentArtworkSelected, newZoneArtworkItem];
      // console.log("onAddArtworkToLayout: Updating zone 'artwork_selected'...", newArtworkSelected);
      await zoneDocRef.update({
        artwork_selected: newArtworkSelected
      });
      // console.log("onAddArtworkToLayout: Zone 'artwork_selected' updated successfully.");
  
      // No need to update artwork_data for the added artwork, as it might already have one
      // and we don't want to reset it on addition.
  
      // console.log("onAddArtworkToLayout: Artwork added to layout successfully.");
      return true; // Indicate success
    } catch (error) {
      console.error("Error adding artwork to layout:", error);
      throw error; // Re-throw to be caught by caller for status update
    }
  }, [activeExhibition.id, activeZone.id]);

  // FIX: Updated `openConfirmationDialog` signature to match `FloorPlanEditorProps`
  const openConfirmationDialog = useCallback((itemType: 'artwork_removal', artworkId: string, artworkTitle: string) => {
    setConfirmationItemType(itemType);
    setConfirmationArtworkId(artworkId);
    setConfirmationArtworkTitle(artworkTitle);
    setConfirmationMessage(`Are you sure you want to remove "${artworkTitle}" from this exhibition and zone layout? This will NOT delete the artwork from the master artworks collection. This action will also reset any custom 3D display settings (like rotation or material) for this artwork.`);
    setShowConfirmation(true);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    setShowConfirmation(false);
    if (confirmationItemType === 'artwork_removal' && confirmationArtworkId) {
      try {
        await onRemoveArtworkFromLayout(confirmationArtworkId);
      } catch (error) {
        // 

      }
    }
    setConfirmationItemType(null);
    setConfirmationArtworkId(null);
    setConfirmationArtworkTitle(null);
  }, [confirmationItemType, confirmationArtworkId, onRemoveArtworkFromLayout]);

  const handleCancelAction = useCallback(() => {
    setShowConfirmation(false);
    setConfirmationItemType(null);
    setConfirmationArtworkId(null);
    setConfirmationArtworkTitle(null);
  }, []);

  const handleResetCamera = useCallback(() => {
    if (cameraControlRef.current) {
      // NEW: Pass customCameraPosition from lightingConfig
      cameraControlRef.current.moveCameraToInitial(lightingConfig.customCameraPosition);
    }
    setFocusedArtworkInstanceId(null);
    setIsArtworkFocusedForControls(false);
    setFocusedArtworkFirebaseId(null);
    setisRankingMode(false);
    setIsZeroGravityMode(false); // NEW: Deactivate zero gravity on camera reset
    setHeartEmitterArtworkId(null);
    // NEW: Reset first light toggle state when camera is manually reset
    setIsFirstLightToggleOff(true);
  }, [cameraControlRef, setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId, setisRankingMode, setIsZeroGravityMode, setHeartEmitterArtworkId, lightingConfig.customCameraPosition]);

  const updateArtworkLikesInFirebase = useCallback(async (artworkId: string, incrementBy: number) => {
    try {
        const artworkDocRef = db.collection('artworks').doc(artworkId);
        await artworkDocRef.update({
            artwork_liked: firebase.firestore.FieldValue.increment(incrementBy)
        });
    } catch (error) {
        // 
    }
  }, []);

  const onLikeTriggered = useCallback((artworkInstanceId: string) => {
    const artworkIdMatch = artworkInstanceId.match(/zone_art_([a-zA-Z0-9_-]+)_\d+/);
    const actualArtworkId = artworkIdMatch ? artworkIdMatch[1] : null;

    if (!actualArtworkId) {
        // 
        return;
    }

    setLikedArtworksLocalCount(prev => {
        const newCount = (prev[actualArtworkId] || 0) + 1;
        return {
            ...prev,
            [actualArtworkId]: newCount,
        };
    });

    if (likeDebounceTimeouts.current[actualArtworkId]) {
        clearTimeout(likeDebounceTimeouts.current[actualArtworkId]);
    }

    likeDebounceTimeouts.current[actualArtworkId] = window.setTimeout(async () => {
        // 使用 likedArtworksLocalCountRef.current 確保取得最新的點讚數，避免閉包問題
        let totalIncrement = likedArtworksLocalCountRef.current[actualArtworkId] || 0;
        setLikedArtworksLocalCount(prev => {
            const newPrev = { ...prev };
            delete newPrev[actualArtworkId];
            return newPrev;
        });

        if (totalIncrement > 0) {
            await updateArtworkLikesInFirebase(actualArtworkId, totalIncrement);
        } else {
        }
        delete likeDebounceTimeouts.current[actualArtworkId];
    }, 1000);

    setHeartEmitterArtworkId(artworkInstanceId);
    setHeartEmitterTrigger(prev => prev + 1);
  }, [updateArtworkLikesInFirebase]);


  const handleSceneClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { clientX, clientY } = e;

    const colorClass = (uiConfig.lightsOn ? 'text-neutral-300' : 'text-neutral-700');
    const effectClass: 'subtle' | 'prominent' = 'subtle';

    const newRipple: SceneRipple = {
      id: `scene-ripple-${nextSceneRippleId.current++}`,
      clientX,
      clientY,
      colorClass,
      effectClass,
    };

    setSceneRipples(prev => [...prev, newRipple]);

    // FIX: Hardcode duration to 800ms for 'subtle' effect, as effectClass is always 'subtle' in this context.
    setTimeout(() => {
      setSceneRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 800);

    // NEW: Hotspot map update for ground clicks
    if (e.point && activeZone?.id) { // e.point is the intersection point in world coordinates
      updateHotspotPoint(activeZone.id, e.point.x, e.point.z, 1);
    }
  }, [uiConfig.lightsOn, nextSceneRippleId, setSceneRipples, activeZone?.id]);


  const handleArtworkClicked = useCallback((e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => {
    e.stopPropagation();

    // Extract the actual artworkId from the instanceId
    const artworkIdMatch = artworkInstanceId.match(/zone_art_([a-zA-Z0-9_-]+)_\d+/);
    const actualArtworkId = artworkIdMatch ? artworkIdMatch[1] : null;

    if (!actualArtworkId) {
        return;
    }

    // NEW: Hotspot map update for artwork clicks
    if (activeZone?.id && position) {
      updateHotspotPoint(activeZone.id, position[0], position[2], 1);
    }

    // NEW: Artwork liked update for artwork clicks (additional 2 points)
    updateArtworkHotspotLikes(actualArtworkId, 2);

    // Existing logic after handling the new updates
    if (isRankingMode) {
      // onLikeTriggered(artworkInstanceId); // Removed to avoid double counting for Firebase artwork_liked
    } else if (isZeroGravityMode) {
      // onLikeTriggered(artworkInstanceId); // Removed to avoid double counting for Firebase artwork_liked
    } else if (isEditorMode) {
      handleSelectArtwork(artworkInstanceId);
    } else {
      handleSelectArtwork(artworkInstanceId);
      if (cameraControlRef.current && cameraControlRef.current.moveCameraToArtwork) {
        cameraControlRef.current.moveCameraToArtwork(artworkInstanceId, position, rotation, artworkType, isMotionVideo);
      }
    }
    // Always trigger heart emitter for visual feedback on artwork click
    setHeartEmitterArtworkId(artworkInstanceId);
    setHeartEmitterTrigger(prev => prev + 1);
  }, [cameraControlRef, handleSelectArtwork, isRankingMode, isEditorMode, isZeroGravityMode, activeZone?.id, setHeartEmitterArtworkId, setHeartEmitterTrigger]); // MODIFIED: Removed onLikeTriggered from deps, added setHeartEmitterTrigger

  const handleDismissArtworkControls = useCallback(() => {
    setIsArtworkFocusedForControls(false);
    if (focusedArtworkInstanceId && cameraControlRef.current) {
      cameraControlRef.current.moveCameraToPrevious();
      setFocusedArtworkInstanceId(null);
      setFocusedArtworkFirebaseId(null);
    }
    setHeartEmitterArtworkId(null);
  }, [focusedArtworkInstanceId, cameraControlRef, setIsArtworkFocusedForControls, setFocusedArtworkInstanceId, setFocusedArtworkFirebaseId, setHeartEmitterArtworkId]);

  const handleOpenInfo = useCallback(() => {
    if (focusedArtworkInstanceId) {
      const artworkInLayout = currentLayout.find(item => item.id === focusedArtworkInstanceId);
      if (artworkInLayout) {
        setFocusedArtworkFirebaseId(artworkInLayout.artworkId);
      } else {
        setFocusedArtworkFirebaseId(null);
      }
    } else {
      setFocusedArtworkFirebaseId(null);
    }
    setIsInfoOpen(true);
  }, [focusedArtworkInstanceId, currentLayout, setFocusedArtworkFirebaseId]);

  const handleCloseInfo = useCallback(() => {
    setIsInfoOpen(false);
    setFocusedArtworkFirebaseId(null);
  }, [setFocusedArtworkFirebaseId]);

  const handleOpenExhibitionInfoFromArtwork = useCallback(() => {
    setFocusedArtworkFirebaseId(null);
    setIsInfoOpen(true);
  }, [setFocusedArtworkFirebaseId]);

  const nextItem = useMemo(() => {
    if (exhibitions.length === 0) return null;
    return exhibitions[(currentIndex + 1) % exhibitions.length];
  }, [exhibitions, currentIndex]);

  const prevItem = useMemo(() => {
    if (exhibitions.length === 0) return null;
    return exhibitions[(currentIndex - 1 + exhibitions.length) % exhibitions.length];
  }, [exhibitions, currentIndex]);

  const handleRankingToggle = useCallback(() => {
    setisRankingMode(prev => !prev);
    setIsZeroGravityMode(false); // NEW: Deactivate zero gravity if ranking mode is toggled
    setFocusedArtworkInstanceId(null);
    setIsArtworkFocusedForControls(false);
    setFocusedArtworkFirebaseId(null);
    // REMOVED: Camera movement is now handled by CameraController's useEffect based on isRankingMode state
    setHeartEmitterArtworkId(null);
  }, [setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId, setHeartEmitterArtworkId, setIsZeroGravityMode]); // Removed cameraControlRef and lightingConfig.customCameraPosition from dependencies

  // NEW: handleZeroGravityToggle function
  const handleZeroGravityToggle = useCallback(() => {
    setIsZeroGravityMode(prev => !prev);
    setisRankingMode(false); // Deactivate ranking mode if zero gravity is toggled
    setFocusedArtworkInstanceId(null);
    setIsArtworkFocusedForControls(false);
    setFocusedArtworkFirebaseId(null);
    setHeartEmitterArtworkId(null);
    if (cameraControlRef.current) {
      cameraControlRef.current.moveCameraToInitial(lightingConfig.customCameraPosition);
    }
  }, [setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId, setHeartEmitterArtworkId, setisRankingMode, cameraControlRef, lightingConfig.customCameraPosition]);


  useEffect(() => {
    if (isRankingMode) {
      const sorted = [...currentLayout].sort((a, b) => {
        const firebaseA = firebaseArtworks.find(fa => fa.id === a.artworkId);
        const firebaseB = firebaseArtworks.find(fa => fa.id === b.artworkId);

        const likesA = firebaseA?.artwork_liked ?? -1;
        const likesB = firebaseB?.artwork_liked ?? -1;

        if (likesA === -1 && likesB === -1) return 0;
        if (likesA === -1) return 1;
        if (likesB === -1) return -1;

        return likesB - likesA;
      }).map((artwork, index) => {
        const newZPosition = 5 - (index * 3); // MODIFIED: Changed from 10 - (index * 5) to 5 - (index * 3)
        
        const firebaseArt = firebaseArtworks.find(fa => fa.id === artwork.artworkId);
        const displayLikes = firebaseArt?.artwork_liked !== undefined ? firebaseArt.artwork_liked : null;

        return {
          ...artwork,
          originalPosition: artwork.position,
          originalRotation: artwork.rotation,
          position: [0, artwork.position[1], newZPosition] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          displayLikes: displayLikes,
        };
      });
      setArtworksInRankingOrder(sorted);

    } else {
      setArtworksInRankingOrder([]);
    }
  }, [isRankingMode, currentLayout, firebaseArtworks]);

  const displayLayout = useMemo(() => {
    if (isEditorMode && editorLayout) {
      return editorLayout;
    }
    if (isRankingMode) {
      return artworksInRankingOrder;
    }
    return currentLayout;
  }, [isEditorMode, editorLayout, isRankingMode, artworksInRankingOrder, currentLayout]);

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
    return firebaseArt?.artist || 'Unknown Artist';
  }, [selectedArtworkId, editorLayout, firebaseArtworks]);

  const focusedArtwork = useMemo(() => {
    if (focusedIndex === -1 || focusedIndex >= currentLayout.length) return null;
    const focusedArtItem = currentLayout[focusedIndex];
    const firebaseArt = firebaseArtworks.find(fbArt => fbArt.id === focusedArtItem.artworkId);
    return firebaseArt || null;
  }, [focusedIndex, currentLayout, firebaseArtworks]);

  const focusedArtworkDisplayTitle = useMemo(() => {
    if (!focusedArtworkInstanceId || !currentLayout || !firebaseArtworks) return null;
    const artItem = currentLayout.find(item => item.id === focusedArtworkInstanceId);
    if (!artItem) return null;
    const firebaseArt = firebaseArtworks.find(fbArt => fbArt.id === artItem.artworkId);
    return firebaseArt ? firebaseArt.title.toUpperCase() : null;
  }, [focusedArtworkInstanceId, currentLayout, firebaseArtworks]);

  const showGlobalOverlay = isTransitioning || isEffectRegistryLoading; // NEW: Include effect registry loading status
  // MODIFIED: Use transitionMessage state for overlay message
  // const overlayMessage = isEffectRegistryLoading ? 'Loading Effects...' : (isTransitioning ? 'Loading Gallery...' : 'Loading Gallery...'); // NEW: Update overlay message

  const hasMotionArtwork = useMemo(() => currentLayout.some(art => art.isMotionVideo), [currentLayout]);

  const currentActiveZoneOnlineUsers = useMemo(() => {
    return activeZone && activeZone.id ? (onlineUsersPerZone[activeZone.id] ?? 0) : 0;
  }, [activeZone, onlineUsersPerZone]);

  const handleSetOnlineUsersForActiveZone = useCallback((newCount: number) => {
    if (activeZone && activeZone.id) {
      setOnlineUsersPerZone(prev => ({ ...prev, [activeZone.id]: newCount }));
    }
  }, [activeZone]);

  const handleToggleSnapshot = useCallback((enabled: boolean) => { // NEW: Callback for toggling snapshots
    setIsSnapshotEnabledGlobally(enabled);
  }, []);

  // Define isFirstItem here
  const isFirstItem = currentIndex === 0;

  return (
    <React.Fragment>
      <TransitionOverlay isTransitioning={showGlobalOverlay} message={transitionMessage} />

      <React.Fragment>
        <Scene
          lightingConfig={lightingConfig}
          artworks={displayLayout}
          isEditorOpen={isEditorOpen}
          isEditorMode={isEditorMode}
          selectedArtworkId={selectedArtworkId}
          onSelectArtwork={handleSelectArtwork}
          focusedIndex={focusedIndex}
          onFocusChange={setFocusedIndex}
          activeEditorTab={activeEditorTab}
          focusedArtworkInstanceId={focusedArtworkInstanceId}
          setFps={setFps}
          hasMotionArtwork={hasMotionArtwork}
          uiConfig={uiConfig}
          setFocusedArtworkInstanceId={setFocusedArtworkInstanceId}
          activeExhibition={activeExhibition}
          onInfoOpen={handleOpenInfo}
          cameraControlRef={cameraControlRef}
          onArtworkClicked={handleArtworkClicked}
          isDebugMode={isDebugMode}
          // FIX: Corrected prop name from `triggerHeartEmitter` to `heartEmitterTrigger`
          triggerHeartEmitter={heartEmitterTrigger}
          heartEmitterArtworkId={heartEmitterArtworkId}
          onCanvasClick={handleSceneClick}
          isRankingMode={isRankingMode}
          isZeroGravityMode={isZeroGravityMode} // NEW: Pass isZeroGravityMode
          isSmallScreen={isSmallScreen} // NEW: Pass isSmallScreen
          onCameraPositionChange={handleCameraPositionChange} // NEW: Pass the callback
          rankingCameraPosition={lightingConfig.rankingCameraPosition} // NEW
          rankingCameraTarget={lightingConfig.rankingCameraTarget}   // NEW
          useExhibitionBackground={useExhibitionBackground} // NEW: Pass useExhibitionBackground
          activeEffectName={activeEffectName} // NEW: Pass active effect name
          effectRegistry={effectRegistry} // NEW: Pass dynamically loaded effect registry
          isEffectRegistryLoading={isEffectRegistryLoading} // NEW: Pass effect registry loading state
          zoneGravity={activeZoneGravity} // NEW: Pass activeZoneGravity
        />
      </React.Fragment>

      <Header
        uiConfig={uiConfig}
        version={VERSION}
        isInfoOpen={isInfoOpen}
        isSmallScreen={isSmallScreen}
        isHeaderExpanded={isHeaderExpanded}
        setIsHeaderExpanded={setIsHeaderExpanded}
        onlineUsers={currentActiveZoneOnlineUsers}
        zoneCapacity={zoneCapacity}
      />

      <CurrentExhibitionInfo
        uiConfig={uiConfig}
        isLoading={isLoading}
        activeExhibition={activeExhibition}
        isInfoOpen={isInfoOpen}
        isSmallScreen={isSmallScreen}
        isCurrentExhibitionInfoHidden={isCurrentExhibitionInfoHidden}
        onInfoOpen={handleOpenInfo}
      />

      <SideNavigation
        uiConfig={uiConfig}
        isFirstItem={isFirstItem}
        isLastItem={exhibitions.length === 0 || currentIndex === exhibitions.length - 1}
        onPrev={() => handleExhibitionChange('prev')}
        onNext={() => handleExhibitionChange('next')}
        prevItem={prevItem}
        nextItem={nextItem}
        isSmallScreen={isSmallScreen}
        focusedArtworkInstanceId={focusedArtworkInstanceId}
        isRankingMode={isRankingMode}
        isZeroGravityMode={isZeroGravityMode} // NEW: Pass isZeroGravityMode
      />

      <MainControls
        uiConfig={uiConfig}
        isInfoOpen={isInfoOpen}
        lightsOn={lightsOn}
        onLightToggle={handleLightToggle}
        isEditorMode={isEditorMode}
        onEditorModeToggle={() => setIsEditorMode(prev => !prev)}
        onEditorOpen={() => setIsEditorOpen(true)}
        setIsSearchOpen={setIsSearchOpen}
        onResetCamera={handleResetCamera}
        setIsDevToolsOpen={setIsDevToolsOpen}
        isSmallScreen={isSmallScreen}
        isHeaderExpanded={isHeaderExpanded}
        onPrev={() => handleExhibitionChange('prev')}
        onNext={() => handleExhibitionChange('next')}
        prevItem={prevItem}
        nextItem={nextItem}
        isFirstItem={isFirstItem}
        isLastItem={exhibitions.length === 0 || currentIndex === exhibitions.length - 1}
        focusedArtworkInstanceId={focusedArtworkInstanceId}
        isArtworkFocusedForControls={isArtworkFocusedForControls}
        onDismissArtworkControls={handleDismissArtworkControls}
        onInfoOpen={handleOpenInfo}
        focusedArtworkTitle={focusedArtworkDisplayTitle}
        onLikeTriggered={onLikeTriggered}
        isRankingMode={isRankingMode}
        onRankingToggle={handleRankingToggle}
        isZeroGravityMode={isZeroGravityMode} // NEW: Pass isZeroGravityMode
        onZeroGravityToggle={handleZeroGravityToggle} // NEW: Pass onZeroGravityToggle
        isCameraAtDefaultPosition={isCameraAtDefaultPosition} // NEW: Pass camera position status
        setHeartEmitterArtworkId={setHeartEmitterArtworkId}
        hasMotionArtwork={hasMotionArtwork} // NEW: Pass hasMotionArtwork
        // NEW: Pass customCameraPosition to MainControls
        customCameraPosition={lightingConfig.customCameraPosition}
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
            onUpdateArtworkData={handleUpdateArtworkData}
            onUpdateExhibition={handleUpdateExhibition}
            activeExhibition={activeExhibition}
            uiConfig={uiConfig}
            onActiveTabChange={handleActiveEditorTabChange}
            onFocusArtwork={handleFocusArtworkInstance}
            onOpenConfirmationDialog={openConfirmationDialog}
            onAddArtworkToLayout={onAddArtworkToLayout}
            onRemoveArtworkFromLayout={onRemoveArtworkFromLayout}
            useExhibitionBackground={useExhibitionBackground} // NEW: Pass useExhibitionBackground
            activeZoneTheme={activeEffectName} // NEW: Pass activeZone.zone_theme as activeZoneTheme
            onUpdateZoneTheme={handleUpdateZoneTheme} // NEW: Pass handler for updating zone theme
            activeExhibitionBackgroundUrl={activeExhibition.exhibit_background} // NEW: Pass activeExhibition.exhibit_background
            effectRegistry={effectRegistry} // NEW: Pass dynamically loaded effect registry
            isEffectRegistryLoading={isEffectRegistryLoading} // NEW: Pass effect registry loading state
            activeZoneGravity={activeZoneGravity} // NEW: Pass activeZoneGravity
            onUpdateZoneGravity={handleUpdateZoneGravity} // NEW: Pass handler for updating zone gravity
          />
      )}

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        uiConfig={uiConfig}
        exhibitions={exhibitions}
        onExhibitionSelect={(index) => loadExhibition(index)}
      />

      <InfoPanel
        isOpen={isInfoOpen}
        onClose={handleCloseInfo}
        uiConfig={uiConfig}
        activeExhibition={activeExhibition}
        isLoading={isLoading}
        focusedArtworkFirebaseId={focusedArtworkFirebaseId}
        allFirebaseArtworks={firebaseArtworks}
        onOpenExhibitionInfoFromArtwork={handleOpenExhibitionInfoFromArtwork}
      />

      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Confirm Removal"
        message={confirmationMessage}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        uiConfig={uiConfig}
      />

      <DevToolsPanel
        isOpen={isDevToolsOpen}
        onClose={() => setIsDevToolsOpen(false)}
        uiConfig={uiConfig}
        isLoading={isLoading}
        activeExhibitionTitle={activeExhibition.title}
        activeZoneName={activeZone.name}
        focusedArtwork={focusedArtwork}
        isEditorMode={isEditorMode}
        activeEditorTab={activeEditorTab}
        selectedArtworkTitle={selectedArtworkTitle}
        fps={fps}
        onlineUsers={currentActiveZoneOnlineUsers}
        setOnlineUsers={handleSetOnlineUsersForActiveZone}
        isDebugMode={isDebugMode}
        setIsDebugMode={setIsDebugMode}
        isSnapshotEnabled={isSnapshotEnabledGlobally} // NEW: Pass isSnapshotEnabledGlobally
        onToggleSnapshot={handleToggleSnapshot} // NEW: Pass handleToggleSnapshot
        zoneCapacity={zoneCapacity}
        effectRegistryError={effectRegistryError} // NEW: Pass effect registry error
      />
      
      {sceneRipples.map(ripple => (
        <div
          key={ripple.id}
          className={`ripple-effect ${ripple.effectClass} ${ripple.colorClass}`}
          style={{
            left: `${ripple.clientX}px`,
            top: `${ripple.clientY}px`,
          }}
        />
      ))}

    </React.Fragment>
  );
}

function App() {
  const isEmbedMode = new URLSearchParams(window.location.search).get('embed') === 'true';

  if (isEmbedMode) {
    return <EmbeddedMuseumScene />;
  } else {
    return <MuseumApp />;
  }
}

export default App;
