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
import { ExhibitionArtItem, SimplifiedLightingConfig, ZoneArtworkItem, Exhibition, FirebaseArtwork, ArtworkData, ArtType } from './types';
import { VERSION } from './abuild';

interface SceneRipple {
  id: string;
  clientX: number;
  clientY: number;
  colorClass: string;
  effectClass: 'subtle' | 'prominent';
}

function MuseumApp() {
  const [resetTrigger, setResetTrigger] = useState(0);
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

  const [isRankingMode, setIsRankingMode] = useState(false);
  const [triggerRanking, setTriggerRanking] = useState(0);
  const rankingTimeoutRef = useRef<number | null>(null);
  const [artworksInRankingOrder, setArtworksInRankingOrder] = useState<ExhibitionArtItem[]>([]);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [editorLayout, setEditorLayout] = useState<ExhibitionArtItem[] | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<'lighting' | 'layout' | 'artworks' | 'admin'>('lighting');
  
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
  const [confirmationArtworkId, setConfirmationArtworkId] = useState<string | null>(null);
  const [confirmationArtworkTitle, setConfirmationArtworkTitle] = useState<string | null>(null);
  const [confirmationConfirmCallback, setConfirmationConfirmCallback] = useState<(() => Promise<void>) | null>(null);

  const [fps, setFps] = useState(0);

  const [isInitialDarkLoad, setIsInitialDarkLoad] = useState(false);
  const [hasInitialDarkLoadFinished, setHasInitialDarkLoadFinished] = useState(false);
  const [isFirstDarkToggleTransitioning, setIsFirstDarkToggleTransitioning] = useState(false);

  const lightingUpdateTimeoutRef = useRef<number | null>(null);
  const hasFirstManualDarkTransitionOccurred = useRef(false);

  const [onlineUsersPerZone, setOnlineUsersPerZone] = useState<Record<string, number>>({});
  const [zoneCapacity, setZoneCapacity] = useState(100);

  const cameraControlRef = useRef<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    moveCameraToPrevious: () => void;
    moveCameraToInitial: () => void;
  }>(null);

  const [heartEmitterTrigger, setHeartEmitterTrigger] = useState(0);
  const [heartEmitterArtworkId, setHeartEmitterArtworkId] = useState<string | null>(null);

  const [sceneRipples, setSceneRipples] = useState<SceneRipple[]>([]);
  const nextSceneRippleId = useRef(0);

  const [likedArtworksLocalCount, setLikedArtworksLocalCount] = useState<Record<string, number>>({});
  const likeDebounceTimeouts = useRef<Record<string, number>>({});
  const likedArtworksLocalCountRef = useRef<Record<string, number>>({});

  const [focusedArtworkFirebaseId, setFocusedArtworkFirebaseId] = useState<string | null>(null);


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
  } = useMuseumState();

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
  }, []);

  useEffect(() => {
    likedArtworksLocalCountRef.current = likedArtworksLocalCount;
  }, [likedArtworksLocalCount]);

  useEffect(() => {
    if (!hasInitialDarkLoadFinished) {
      if (isLoading && !lightingConfig.lightsOn) {
        setIsInitialDarkLoad(true);
      } else if (!isLoading && !lightingConfig.lightsOn && isInitialDarkLoad) {
        setIsInitialDarkLoad(false);
        setHasInitialDarkLoadFinished(true);
      } else if (!isLoading && lightingConfig.lightsOn) {
        setIsInitialDarkLoad(false);
        setHasInitialDarkLoadFinished(true);
      }
    }
  }, [isLoading, lightingConfig.lightsOn, isInitialDarkLoad, hasInitialDarkLoadFinished]);

  useEffect(() => {
    if (isEditorMode) {
      setEditorLayout(JSON.parse(JSON.stringify(currentLayout)));
      setSelectedArtworkId(null);
      setFocusedArtworkInstanceId(null);
      setIsArtworkFocusedForControls(false);
      setIsRankingMode(false);
    } else {
      setEditorLayout(null);
      setSelectedArtworkId(null);
      setFocusedArtworkInstanceId(null);
      setIsArtworkFocusedForControls(false);
    }
  }, [isEditorMode, currentLayout]);

  useEffect(() => {
    if (isEditorMode) {
      setEditorLayout(JSON.parse(JSON.stringify(currentLayout)));
    }
  }, [currentLayout, isEditorMode]);


  useEffect(() => {
    setIsEditorOpen(isEditorMode);
  }, [isEditorMode]);

  useEffect(() => {
    if (activeZone.id !== 'fallback_zone_id') {
      setIsEditorMode(false);
      setIsEditorOpen(false);
      setFocusedArtworkInstanceId(null);
      setIsArtworkFocusedForControls(false);
      setHeartEmitterArtworkId(null);
      setIsRankingMode(false);

      if (cameraControlRef.current) {
        cameraControlRef.current.moveCameraToInitial();
      }
    }
  }, [activeZone.id, cameraControlRef]);

  useEffect(() => {
    if (!lightingConfig.lightsOn) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [lightingConfig.lightsOn]);

  useEffect(() => {
    if (isSmallScreen) {
      setIsCurrentExhibitionInfoHidden(isArtworkFocusedForControls);
    } else {
      setIsCurrentExhibitionInfoHidden(false);
    }
  }, [isArtworkFocusedForControls, isSmallScreen]);


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
        console.error("Failed to update layout in Firebase:", error);
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

  const handleActiveEditorTabChange = useCallback((tab: 'lighting' | 'layout' | 'artworks' | 'admin') => {
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
    }
  }, [isEditorMode, currentLayout, setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId]);

  const handleLightToggle = useCallback(() => {
    const newLightsOnState = !lightsOn;
    const newConfig = { ...lightingConfig, lightsOn: newLightsOnState };
    
    if (!newLightsOnState && !hasFirstManualDarkTransitionOccurred.current) {
      setIsFirstDarkToggleTransitioning(true);
      hasFirstManualDarkTransitionOccurred.current = true;
      setTimeout(() => {
        setIsFirstDarkToggleTransitioning(false);
      }, 1200);
    }

    setLightingOverride(activeZone.id, newConfig);
  }, [lightsOn, lightingConfig, setLightingOverride, activeZone.id]);

  const loadExhibition = useCallback((index: number) => {
    setIsTransitioning(true);
    setIsSearchOpen(false);
    setIsRankingMode(false);

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

    if (lightingUpdateTimeoutRef.current) {
        clearTimeout(lightingUpdateTimeoutRef.current);
    }

    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') return;

    lightingUpdateTimeoutRef.current = window.setTimeout(async () => {
      try {
          const zoneDocRef = db.collection('zones').doc(activeZone.id);
          await zoneDocRef.update({ 'lightingDesign.defaultConfig': newConfig });
      } catch (error) {
          console.error("Failed to update lighting config in Firebase:", error);
      }
    }, 500);
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

  const handleUpdateArtworkData = useCallback(async (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => {
    try {
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      const doc = await artworkDocRef.get();
      const currentArtworkData = doc.data()?.artwork_data || {};
      const mergedArtworkData = { ...currentArtworkData, ...updatedArtworkData };
      await artworkDocRef.update({ artwork_data: mergedArtworkData });
    } catch (error) {
      console.error("Failed to update artwork_data in Firebase:", error);
      throw error;
    }
  }, []);

  const handleUpdateExhibition = useCallback(async (exhibitionId: string, updatedFields: Partial<Exhibition>) => {
    if (!exhibitionId || exhibitionId === 'fallback_id') {
      console.error("Cannot update exhibition: Invalid Exhibition ID.");
      throw new Error("Invalid Exhibition ID");
    }
    try {
      const exhibitionDocRef = db.collection('exhibitions').doc(exhibitionId);
      await exhibitionDocRef.update(updatedFields);
    } catch (error) {
      console.error("Failed to update exhibition in Firebase:", error);
      throw error;
    }
  }, []);

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
      console.error("Failed to remove artwork from layout in Firebase:", error);
      throw error;
    }
  }, [activeExhibition.id, activeZone.id]);

  const openConfirmationDialog = useCallback((artworkId: string, artworkTitle: string, onConfirm: () => Promise<void>) => {
    setConfirmationArtworkId(artworkId);
    setConfirmationArtworkTitle(artworkTitle);
    setConfirmationMessage(`Are you sure you want to remove "${artworkTitle}" from this exhibition and zone layout? This will NOT delete the artwork from the master artworks collection. This action will also reset any custom 3D display settings (like rotation or material) for this artwork.`);
    setConfirmationConfirmCallback(() => onConfirm);
    setShowConfirmation(true);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    setShowConfirmation(false);
    if (confirmationConfirmCallback) {
      try {
        await confirmationConfirmCallback();
      } catch (error) {
        console.error("Error during confirmed action:", error);

      }
    }
    setConfirmationArtworkId(null);
    setConfirmationArtworkTitle(null);
    setConfirmationConfirmCallback(null);
  }, [confirmationConfirmCallback]);

  const handleCancelAction = useCallback(() => {
    setShowConfirmation(false);
    setConfirmationArtworkId(null);
    setConfirmationArtworkTitle(null);
    setConfirmationConfirmCallback(null);
  }, []);

  const handleResetCamera = useCallback(() => {
    if (cameraControlRef.current) {
      cameraControlRef.current.moveCameraToInitial();
    }
    setFocusedArtworkInstanceId(null);
    setIsArtworkFocusedForControls(false);
    setFocusedArtworkFirebaseId(null);
    setIsRankingMode(false);
  }, [cameraControlRef, setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId]);

  const updateArtworkLikesInFirebase = useCallback(async (artworkId: string, incrementBy: number) => {
    try {
        const artworkDocRef = db.collection('artworks').doc(artworkId);
        await artworkDocRef.update({
            artwork_liked: firebase.firestore.FieldValue.increment(incrementBy)
        });
    } catch (error) {
        console.error(`Firebase update failed for ${artworkId}:`, error);
    }
  }, []);

  const onLikeTriggered = useCallback((artworkInstanceId: string) => {
    const artworkIdMatch = artworkInstanceId.match(/zone_art_([a-zA-Z0-9_-]+)_\d+/);
    const actualArtworkId = artworkIdMatch ? artworkIdMatch[1] : null;

    if (!actualArtworkId) {
        console.error("Could not extract actual artwork ID from instance ID for liking:", artworkInstanceId);
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


  const handleSceneClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>, isArtwork: boolean = false, artworkColorClass?: string) => {
    const { clientX, clientY } = e;

    let colorClass = '';
    let effectClass: 'subtle' | 'prominent';

    if (isArtwork) {
      colorClass = artworkColorClass || (uiConfig.lightsOn ? 'text-cyan-500' : 'text-cyan-400');
      effectClass = 'prominent';
    } else {
      colorClass = (uiConfig.lightsOn ? 'text-neutral-300' : 'text-neutral-700');
      effectClass = 'subtle';
    }

    const newRipple: SceneRipple = {
      id: `scene-ripple-${nextSceneRippleId.current++}`,
      clientX,
      clientY,
      colorClass,
      effectClass,
    };

    setSceneRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setSceneRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, effectClass === 'prominent' ? 900 : 800);
  }, [uiConfig.lightsOn, nextSceneRippleId, setSceneRipples]);


  const handleArtworkClicked = useCallback((e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => {
    e.stopPropagation();

    if (isRankingMode) {
      onLikeTriggered(artworkInstanceId);
      handleSceneClick(e as any, true, uiConfig.lightsOn ? 'text-cyan-500' : 'text-cyan-400');
    } else {
      handleSelectArtwork(artworkInstanceId);

      if (cameraControlRef.current && cameraControlRef.current.moveCameraToArtwork) {
        cameraControlRef.current.moveCameraToArtwork(artworkInstanceId, position, rotation, artworkType, isMotionVideo);
      }
      handleSceneClick(e as any, true, uiConfig.lightsOn ? 'text-cyan-500' : 'text-cyan-400');
    }
  }, [cameraControlRef, handleSceneClick, uiConfig.lightsOn, handleSelectArtwork, onLikeTriggered, isRankingMode]);

  const handleDismissArtworkControls = useCallback(() => {
    setIsArtworkFocusedForControls(false);
    if (focusedArtworkInstanceId && cameraControlRef.current) {
      cameraControlRef.current.moveCameraToPrevious();
      setFocusedArtworkInstanceId(null);
      setFocusedArtworkFirebaseId(null);
    }
  }, [focusedArtworkInstanceId, cameraControlRef, setIsArtworkFocusedForControls, setFocusedArtworkInstanceId, setFocusedArtworkFirebaseId]);

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
    setIsRankingMode(prev => !prev);
    setFocusedArtworkInstanceId(null);
    setIsArtworkFocusedForControls(false);
    setFocusedArtworkFirebaseId(null);
    if (cameraControlRef.current) {
      cameraControlRef.current.moveCameraToInitial();
    }
    setTriggerRanking(prev => prev + 1);

    if (rankingTimeoutRef.current) {
      clearTimeout(rankingTimeoutRef.current);
      rankingTimeoutRef.current = null;
    }
  }, [setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId, cameraControlRef]);

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
        const newZPosition = 10 - (index * 5); 
        
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

      if (rankingTimeoutRef.current) clearTimeout(rankingTimeoutRef.current);
      rankingTimeoutRef.current = null;
    } else {
      setArtworksInRankingOrder([]);
      if (rankingTimeoutRef.current) {
        clearTimeout(rankingTimeoutRef.current);
        rankingTimeoutRef.current = null;
      }
    }
  }, [isRankingMode, currentLayout, firebaseArtworks, triggerRanking]);

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

  const showGlobalOverlay = isTransitioning || isInitialDarkLoad || isFirstDarkToggleTransitioning;
  const overlayMessage = isTransitioning
    ? 'Loading Gallery...'
    : (isInitialDarkLoad
      ? 'Initializing Dark Gallery...'
      : (isFirstDarkToggleTransitioning
        ? 'Entering Dark Mode...'
        : 'Loading Gallery...'));

  const hasMotionArtwork = useMemo(() => currentLayout.some(art => art.isMotionVideo), [currentLayout]);

  const currentActiveZoneOnlineUsers = useMemo(() => {
    return activeZone && activeZone.id ? (onlineUsersPerZone[activeZone.id] ?? 0) : 0;
  }, [activeZone, onlineUsersPerZone]);

  const handleSetOnlineUsersForActiveZone = useCallback((newCount: number) => {
    if (activeZone && activeZone.id) {
      setOnlineUsersPerZone(prev => ({ ...prev, [activeZone.id]: newCount }));
    }
  }, [activeZone]);

  return (
    <React.Fragment>
      <TransitionOverlay isTransitioning={showGlobalOverlay} message={overlayMessage} />

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
          triggerHeartEmitter={heartEmitterTrigger}
          heartEmitterArtworkId={heartEmitterArtworkId}
          onCanvasClick={handleSceneClick}
          isRankingMode={isRankingMode}
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
        isFirstItem={currentIndex === 0}
        isLastItem={exhibitions.length === 0 || currentIndex === exhibitions.length - 1}
        onPrev={() => handleExhibitionChange('prev')}
        onNext={() => handleExhibitionChange('next')}
        prevItem={prevItem}
        nextItem={nextItem}
        isSmallScreen={isSmallScreen}
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
        isFirstItem={currentIndex === 0}
        isLastItem={exhibitions.length === 0 || currentIndex === exhibitions.length - 1}
        focusedArtworkInstanceId={focusedArtworkInstanceId}
        isArtworkFocusedForControls={isArtworkFocusedForControls}
        onDismissArtworkControls={handleDismissArtworkControls}
        onInfoOpen={handleOpenInfo}
        focusedArtworkTitle={focusedArtworkDisplayTitle}
        onLikeTriggered={onLikeTriggered}
        isRankingMode={isRankingMode}
        onRankingToggle={handleRankingToggle}
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
            onRemoveArtworkFromLayout={handleRemoveArtworkFromLayout}
            onOpenConfirmationDialog={openConfirmationDialog}
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
        zoneCapacity={zoneCapacity}
        isDebugMode={isDebugMode}
        setIsDebugMode={setIsDebugMode}
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