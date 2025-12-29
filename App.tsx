
import React, { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { db } from './firebase';
import firebase from 'firebase/compat/app';
import { auth } from './firebase';

import Scene from './components/scene/Scene';
import Header from './components/layout/Header';
import InfoPanel from './components/info/InfoPanel';
import SearchModal from './components/search/SearchModal';
import MainControls from './components/controls/MainControls';
import SideNavigation from './components/layout/SideNavigation';
import TransitionOverlay from './components/ui/TransitionOverlay';
import TopLeftLogout from './components/ui/TopLeftLogout';
import CurrentExhibitionInfo from './components/info/CurrentExhibitionInfo';
import ConfirmationDialog from './components/ui/ConfirmationDialog';
import DevToolsPanel from './components/ui/DevToolsPanel';
// ZeroGravityLegend is now conditionally imported inside MuseumApp based on feature flags
import EmbeddedMuseumScene from './components/EmbeddedMuseumScene';

import { useMuseumState } from './hooks/useMuseumState';
import { ExhibitionArtItem, SimplifiedLightingConfig, ZoneArtworkItem, Exhibition, FirebaseArtwork, ArtworkData, ArtType, EffectRegistryType } from './types';
import { VERSION } from './abuild';
import * as THREE from 'three'; // NEW: Import THREE for dynamic effect bundle
// Hotspot functions removed from services/firebaseService

interface SceneRipple {
  id: string;
  clientX: number;
  clientY: number;
  colorClass: string;
  effectClass: 'subtle' | 'prominent';
}

// NEW: Define remote URL for effect bundle
const REMOTE_EFFECT_BUNDLE_URL = "https://firebasestorage.googleapis.com/v0/b/blackdot-1890a.firebasestorage.app/o/effect_bundles%2Feffect_bundle.js?alt=media";

function MuseumApp({ embedMode, initialExhibitionId, embedFeatures }: { embedMode?: boolean; initialExhibitionId?: string | null; embedFeatures?: string[] } = {}) {
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
  const [isCameraMovingToArtwork, setIsCameraMovingToArtwork] = useState(false); // NEW: State for camera animation to artwork
  // Global flag: whether reset button should be enabled/visible. Toggled by user interactions.
  const [isResetCameraEnable, setIsResetCameraEnable] = useState(false);

  const [isRankingMode, setisRankingMode] = useState(false);
  const [artworksInRankingOrder, setArtworksInRankingOrder] = useState<ExhibitionArtItem[]>([]);

  // NEW: State for Zero Gravity mode
  const [isZeroGravityMode, setIsZeroGravityMode] = useState(false);

  const [user, setUser] = useState<firebase.User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [ownerOverrideUid, setOwnerOverrideUid] = useState<string | null>(null);
  const prevAuthUidRef = useRef<string | null | undefined>(undefined);
  const prevVisibleIdsRef = useRef<string | null>(null);

  const isSignedIn = Boolean(user && !user.isAnonymous && (user.providerData && user.providerData.length > 0));

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

  const lightingUpdateTimeoutRef = useRef<number | null>(null);

  const [onlineUsersPerZone, setOnlineUsersPerZone] = useState<Record<string, number>>({});
  const [zoneCapacity, setZoneCapacity] = useState(100);

  const cameraControlRef = useRef<{ 
    moveCameraToArtwork: (artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => void;
    moveCameraToPrevious: () => void;
    moveCameraToInitial: (customCameraPosition?: [number, number, number]) => void;
    moveCameraToRankingMode: (position: [number, number, number], target: [number, number, number]) => void; // NEW
  }>(null);

  // Track whether the last user camera interaction ended as a drag
  const lastUserInteractionWasDragRef = useRef<boolean>(false);

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
    // Reset camera moving state when camera finishes moving
    if (isAtDefault === false) {
      // Camera has moved away from default, animation may have started
    } else {
      // Camera returned to default position
      setIsCameraMovingToArtwork(false);
    }
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
    refreshNow,
    updateLocalArtworkData,
  } = useMuseumState(isSnapshotEnabledGlobally, ownerOverrideUid || user?.uid); // Pass override curator uid if present, else signed-in user's uid

  // If embed provides an initial exhibition id, navigate to it when data is ready
  useEffect(() => {
    if (!embedMode || !initialExhibitionId || isLoading || exhibitions.length === 0) return;
    const idx = exhibitions.findIndex(ex => ex.id === initialExhibitionId);
    if (idx !== -1) {
      handleNavigate(idx);
    }
  }, [embedMode, initialExhibitionId, isLoading, exhibitions, handleNavigate]);

  // Ref to request editorLayout reload after an external refresh (to avoid overwriting in-progress edits)
  const editorLayoutReloadRequested = useRef(false);

  // After initial data finishes loading, immediately apply the system initial camera
  // only when there is NO custom camera position configured. This avoids waiting
  // while still guaranteeing we don't override an explicit custom camera.
  useEffect(() => {
    if (!isLoading && cameraControlRef.current && isCameraAtDefaultPosition && !isCameraMovingToArtwork) {
      try {
        const custom = lightingConfig?.customCameraPosition;
        // If there's no custom camera saved, snap to the system initial position now.
        if (!custom) {
          cameraControlRef.current.moveCameraToInitial();
        }
      } catch (e) {
        // ignore
      }
    }
  }, [isLoading, lightingConfig?.customCameraPosition, isCameraAtDefaultPosition, isCameraMovingToArtwork]);

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

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthResolved(true);
    });
    return () => unsub();
  }, []);

  // Ensure we always have a non-null owner UID for signed-in users.
  // If an explicit `ownerOverrideUid` hasn't been set (e.g. via team code),
  // try to resolve the signed-in user's team and pick the team's curator UID.
  // Fall back to the user's own UID so `ownerUid` passed to `useMuseumState`
  // is never null while signed-in.
  useEffect(() => {
    let cancelled = false;
    if (!user || user.isAnonymous) return;
    // If there's already an explicit override (TopLeftLogout or other), don't clobber it
    if (ownerOverrideUid !== null) return;

    (async () => {
      try {
        const teamsSnap = await db.collection('teams').get();
        if (cancelled) return;
        let found = false;
        for (const doc of teamsSnap.docs) {
          const data: any = doc.data();
          const members = Array.isArray(data.team_members) ? data.team_members : [];
            if (members.some((m: any) => m && m.uid === user.uid)) {
            const curator = members.find((m: any) => m && m.role === 'curator');
            const resolved = curator ? (curator.uid || user.uid) : user.uid;
            setOwnerOverrideUid(resolved);
            // DEV-only instrumentation removed to reduce console noise
            found = true;
            break;
          }
        }
        if (!found) {
          // No team found; use the user's own uid as the owner fallback
          setOwnerOverrideUid(user.uid);
          // DEV-only instrumentation removed to reduce console noise
        }
      } catch (err) {
        // On error, still ensure we set something to avoid null ownerUid while signed-in
        try { setOwnerOverrideUid(user.uid); } catch (e) {}
        // DEV-only instrumentation removed to reduce console noise
      }
    })();

    return () => { cancelled = true; };
  }, [user, ownerOverrideUid]);

  // Diagnostics: log auth and museum state for debugging sign-in/loading issues
  useEffect(() => {
    try {
      // Prevent duplicate logs in development StrictMode: only log when auth uid changes
      const currentUid = user?.uid ?? null;
      if (prevAuthUidRef.current === currentUid) return;
      prevAuthUidRef.current = currentUid;

      const isGuest = !user || user.isAnonymous;
      const labelStyle = isGuest ? 'background:#16a34a;color:#fff;padding:2px 6px;border-radius:3px' : 'background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px';
      const label = isGuest ? '%cGuest' : `%cSigned: ${user?.displayName || user?.email || user?.uid}`;
      console.groupCollapsed(label, labelStyle);
      if (user && !user.isAnonymous) {
        console.log('uid:', user.uid);
        console.log('email:', user.email);
        console.log('displayName:', user.displayName);
        console.log('photoURL:', user.photoURL);
        try {
          console.log('providerData[0].photoURL:', (user.providerData || [])[0] && (user.providerData || [])[0].photoURL);
        } catch (err) {
          // ignore structure issues
        }
        console.log('provider:', (user.providerData || []).map(p => p.providerId).join(', ') || 'none');
      } else {
        console.log('guest session');
      }
      console.groupEnd();
    } catch (e) {
      // swallow
    }
  }, [user]);

  // Log visible exhibitions for the current session (guest or signed-in)
  useEffect(() => {
    (async () => {
      try {
        const isGuest = !user || user.isAnonymous;
        const headerStyle = isGuest ? 'background:#16a34a;color:#fff;padding:2px 6px;border-radius:3px' : 'background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px';
        const header = isGuest ? '%cVisible exhibitions (guest)' : `%cVisible exhibitions (${user?.uid})`;

        let queryRef: firebase.firestore.Query<firebase.firestore.DocumentData>;
        if (isGuest) {
          queryRef = db.collection('exhibitions').where('isShowcase', '==', true);
        } else {
          queryRef = db.collection('exhibitions').where('ownerId', '==', user!.uid).where('isActive', '==', true);
        }

        const snap = await queryRef.get();
        // Dedupe duplicate effect invocations (React StrictMode) by comparing doc ids
        const ids = snap.docs.map(d => d.id).join(',');
        if (prevVisibleIdsRef.current === ids) return;
        prevVisibleIdsRef.current = ids;

        console.groupCollapsed(header, headerStyle);
        if (snap.empty) {
          console.log('(no exhibitions visible)');
        } else {
          snap.docs.forEach(doc => {
            const data: any = doc.data();
            const title = data.title || data.name || `(id:${doc.id})`;
            console.log('-', title);
          });
        }
        console.groupEnd();
      } catch (e) {
        // swallow; diagnostics only
      }
    })();
  }, [user]);

  useEffect(() => {
    // [log removed] Diagnostics: useMuseumState / loading / activeExhibition
  }, [isLoading, exhibitions, activeExhibition, user]);

  const handleLogout = React.useCallback(async () => {
    try {
      await auth.signOut();
      setUser(null);
      setOwnerOverrideUid(null);
    } catch (e) {
      // [log removed] App logout failed
      throw e;
    }
  }, []);

  // Debug: grouped console logs for obvious mode changes (focus/editor/ranking/zerogravity/lights)
  useEffect(() => {
    try {
      const ts = new Date().toISOString();
      // Build colored header labels for each mode
      const active = (bg: string) => `background:${bg};color:#fff;padding:2px 6px;border-radius:3px`;
      const inactive = 'background:#374151;color:#d1d5db;padding:2px 6px;border-radius:3px';

      const labels: string[] = [];
      const styles: string[] = [];

      // Only show labels that are ON / have meaningful value
      if (focusedArtworkInstanceId) {
        labels.push(`%cFocused:${focusedArtworkInstanceId}`);
        styles.push(active('#2563eb'));
      }
      if (isArtworkFocusedForControls) {
        labels.push(`%cFocusedControls:ON`);
        styles.push(active('#16a34a'));
      }
      if (isEditorMode) {
        labels.push(`%cEditor:ON`);
        styles.push(active('#7c3aed'));
      }
      if (isRankingMode) {
        labels.push(`%cRanking:ON`);
        styles.push(active('#f97316'));
      }
      if (isZeroGravityMode) {
        labels.push(`%cZeroG:ON`);
        styles.push(active('#0ea5a2'));
      }
      if (lightingConfig?.lightsOn) {
        labels.push(`%cLights:ON`);
        styles.push(active('#f59e0b'));
      }

      // Timestamp style
      const tsStyle = 'background:#111;color:#fff;padding:2px 6px;border-radius:3px;margin-left:6px';

      const header = (labels.length > 0 ? labels.join(' ') + ` %c@ ${ts}` : `%cMode change @ ${ts}`);
      const headerStyles = labels.length > 0 ? [...styles, tsStyle] : [tsStyle];
      console.groupCollapsed(header, ...headerStyles);
      console.log('FocusedArtworkInstanceId:', focusedArtworkInstanceId);
      console.log('isArtworkFocusedForControls:', isArtworkFocusedForControls);
      console.log('isEditorMode:', isEditorMode);
      console.log('isRankingMode:', isRankingMode);
      console.log('isZeroGravityMode:', isZeroGravityMode);
      console.log('lightsOn:', !!lightingConfig?.lightsOn);
      console.groupEnd();
    } catch (e) {
      // swallow any console errors in weird environments
    }
  }, [focusedArtworkInstanceId, isArtworkFocusedForControls, isEditorMode, isRankingMode, isZeroGravityMode, lightingConfig?.lightsOn]);


  // NEW: Handle updating zone_theme in Firebase
  const handleUpdateZoneTheme = useCallback(async (themeName: string | null) => {
    if (embedMode) {
      console.warn('[embed] blocked handleUpdateZoneTheme');
      return;
    }
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
      return;
    }
    if (!effectRegistry && themeName !== null) { // Only show error if trying to set a theme when registry isn't loaded
      // Optionally, set an error message in UI
      return;
    }

    try {
      const zoneDocRef = db.collection('zones').doc(activeZone.id);
      await zoneDocRef.update({ zone_theme: themeName });
      // console.log(`Zone ${activeZone.id} theme updated to: ${themeName}`);
    } catch (error) {
      // error handling intentionally silent for production
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
    if (embedMode) {
      console.warn('[embed] blocked handleUpdateZoneGravity');
      return;
    }
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
      return;
    }

    try {
      const zoneDocRef = db.collection('zones').doc(activeZone.id);
      await zoneDocRef.update({ zone_gravity: gravityValue });
      // console.log(`Zone ${activeZone.id} gravity updated to: ${gravityValue}`);
    } catch (error) {
      // silent
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
  }, [isEditorMode]); // FIXED: Removed currentLayout and lightingConfig.customCameraPosition to prevent unnecessary triggers

  // If a refresh was requested (e.g. after external DB write), apply the updated currentLayout
  // into the editorLayout when editor is open. This avoids stale editorScene when edits are made
  // via other parts of the UI (settings) while the editor panel is open.
  useEffect(() => {
    if (!isEditorMode) return;
    if (editorLayoutReloadRequested.current) {
      setEditorLayout(JSON.parse(JSON.stringify(currentLayout)));
      editorLayoutReloadRequested.current = false;
    }
  }, [currentLayout, isEditorMode]);


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

  // Log editor open/close state with colored console output
  useEffect(() => {
    // editor open/close state changed (no console output in production)
  }, [isEditorOpen]);

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
    if (embedMode) {
        console.warn('[embed] blocked handleSaveLayout');
        return;
    }
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

  // Only create the editor lazy component when not in embed and when signed-in
  const FloorPlanEditor = useMemo<React.LazyExoticComponent<React.ComponentType<any>> | null>(() => {
    if (embedMode || !isSignedIn) return null;
    return React.lazy(() => import('./components/editor/FloorPlanEditor'));
  }, [embedMode, isSignedIn]);

  // Conditionally lazy-load ZeroGravityLegend based on embed feature flags
  const ZeroGravityLegendLazy = useMemo<React.LazyExoticComponent<React.ComponentType<any>> | null>(() => {
    const featureEnabled = !!(embedFeatures && embedFeatures.includes('zeroGravity'));
    if (embedMode && !featureEnabled) return null;
    
    // Always allow loading on main site or if feature is enabled in embed
    return React.lazy(() => import('./components/ui/ZeroGravityLegend'));
  }, [embedMode, embedFeatures]);

  // Preload important lazy modules at startup to reduce first-render lag.
  // This warms the module cache for React.lazy imports used elsewhere (ArtComponent, CanvasExhibit, SculptureExhibit, editor, UI bits).
  React.useEffect(() => {
    // Preload important lazy modules at startup to reduce first-render lag.
    // This warms the module cache for React.lazy imports used elsewhere.
    const preloads: Promise<any>[] = [];

    // Core scene exhibits (warm CanvasExhibit and SculptureExhibit)
    preloads.push(import('./components/scene/art/CanvasExhibit').catch(() => {}));
    preloads.push(import('./components/scene/art/SculptureExhibit').catch(() => {}));

    // If the FloorPlanEditor lazy component was created (signed-in & not embed), also preload its module
    if (FloorPlanEditor) {
      preloads.push(import('./components/editor/FloorPlanEditor').catch(() => {}));
    }

    // Preload zero-gravity legend when feature is enabled / lazy component exists
    if (ZeroGravityLegendLazy) {
      preloads.push(import('./components/ui/ZeroGravityLegend').catch(() => {}));
    }

    // Fire-and-forget: warm modules but don't block render
    Promise.allSettled(preloads).catch(() => {});
  }, [FloorPlanEditor, ZeroGravityLegendLazy]);

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
      // Do not automatically show artwork action controls here — only show them when a zoom-in occurs
      // setIsArtworkFocusedForControls(true);
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
        const newConfig: SimplifiedLightingConfig = { ...lightingConfig, lightsOn: newLightsOnState };
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
      const newConfig: SimplifiedLightingConfig = { ...lightingConfig, lightsOn: newLightsOnState };
      setLightingOverride(activeZone.id, newConfig);
    }
  }, [lightsOn, isFirstLightToggleOff, lightingConfig, setLightingOverride, activeZone.id, setHeartEmitterArtworkId, setisRankingMode, setIsZeroGravityMode]);

  // NEW: Handle update for lighting config including useExhibitionBackground
  const LOG_APP_LIGHTING = false;
  const handleLightingUpdate = useCallback(async (newConfig: SimplifiedLightingConfig) => {
    // Prevent writes when in embed mode — still apply in-memory override for UX parity
    if (embedMode) {
      try {
        setLightingOverride(activeZone.id, newConfig);
      } catch (e) {}
      console.warn('[embed] blocked handleLightingUpdate write');
      return;
    }

    // Detailed red console output for every lighting update (helps trace unexpected writes)
    try {
      console.groupCollapsed('%c[App] handleLightingUpdate', 'color: #fff; background: #b91c1c; padding:2px 6px; border-radius:3px');
      console.error('Timestamp:', new Date().toISOString());
      console.error('caller stack:');
      console.trace();
      console.error('activeZone.id:', activeZone?.id);
      console.error('isEditorMode:', isEditorMode);
      console.error('isEditorOpen:', isEditorOpen);
      console.error('newConfig:', newConfig);
      console.error('willWriteToDB:', ((newConfig as any).useCustomColors === false) ? 'writing cleaned (useCustomColors=false)' : 'writing full config');
      console.groupEnd();
    } catch (e) {
      // ignore logging errors
    }

    setLightingOverride(activeZone.id, newConfig);

    if (lightingUpdateTimeoutRef.current) {
        clearTimeout(lightingUpdateTimeoutRef.current);
    }

    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') return;

    lightingUpdateTimeoutRef.current = window.setTimeout(async () => {
        try {
            if (LOG_APP_LIGHTING) {
              // eslint-disable-next-line no-console
              
            }
          const zoneDocRef = db.collection('zones').doc(activeZone.id);
          // If the user opted to use default colors (useCustomColors === false), remove stored color fields
          if ((newConfig as any).useCustomColors === false) {
            // If we're switching to defaults, remove color keys from the object we store
              const cleaned = { ...newConfig } as any;
              delete cleaned.backgroundColor;
              delete cleaned.floorColor;
              // Save cleaned config (without color fields) and ensure useCustomColors is false
              cleaned.useCustomColors = false;
              await zoneDocRef.update({
                'lightingDesign.defaultConfig': cleaned,
              });
          } else {
            await zoneDocRef.update({ 'lightingDesign.defaultConfig': newConfig });
          }
      } catch (error) {
            // [log removed] Firebase update error
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
    if (embedMode) {
      console.warn('[embed] blocked handleUpdateArtworkFile');
      return;
    }
    try {
      if ((import.meta as any).env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[App] handleUpdateArtworkFile start', { artworkId, newFileUrl, userUid: user?.uid ?? null, ownerOverrideUid });
      }
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      await artworkDocRef.update({ artwork_file: newFileUrl });
      try { await refreshNow?.(); } catch (e) {}
      // If editor is open, request a reload of the editorLayout once the hook data updates
      editorLayoutReloadRequested.current = true;
    } catch (error) {
      // 
      throw error;
    }
  }, [refreshNow, user, ownerOverrideUid]);

  const handleUpdateArtworkData = useCallback(async (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => {
    if (embedMode) {
      console.warn('[embed] blocked handleUpdateArtworkData');
      return;
    }
    try {
      if ((import.meta as any).env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[App] handleUpdateArtworkData start', { artworkId, updatedArtworkData, userUid: user?.uid ?? null, ownerOverrideUid });
      }
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      const doc = await artworkDocRef.get();
      const currentArtworkData = doc.data()?.artwork_data || {};
      const mergedArtworkData = { ...currentArtworkData, ...updatedArtworkData };

      // Optimistically update local state so scene updates immediately
      try {
        if (typeof updateLocalArtworkData === 'function') {
          updateLocalArtworkData(artworkId, mergedArtworkData);
          try { console.warn('[App] optimistic local artworkData applied', { artworkId }); } catch (e) {}
        }
      } catch (e) {}

      await artworkDocRef.update({ artwork_data: mergedArtworkData });
      try {
        // Debug: log around refresh to trace timing
        try { console.warn('[App] handleUpdateArtworkData calling refreshNow', { artworkId, mergedArtworkData }); } catch (e) {}
        await refreshNow?.();
        try { console.warn('[App] handleUpdateArtworkData refreshNow complete', { artworkId }); } catch (e) {}
      } catch (e) {
        try { console.warn('[App] handleUpdateArtworkData refreshNow failed', { artworkId, err: e }); } catch (err) {}
      }
      editorLayoutReloadRequested.current = true;
    } catch (error) {
      // 
      throw error;
    }
  }, [refreshNow, user, ownerOverrideUid]);

  const handleUpdateExhibition = useCallback(async (exhibitionId: string, updatedFields: Partial<Exhibition>) => {
    if (embedMode) {
      console.warn('[embed] blocked handleUpdateExhibition');
      return;
    }
    if (!exhibitionId || exhibitionId === 'fallback_id') {
      // 
      throw new Error("Invalid Exhibition ID");
    }
    try {
      if ((import.meta as any).env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[App] handleUpdateExhibition start', { exhibitionId, updatedFields, userUid: user?.uid ?? null, ownerOverrideUid });
      }
      const exhibitionDocRef = db.collection('exhibitions').doc(exhibitionId);
      await exhibitionDocRef.update(updatedFields);
      try { await refreshNow?.(); } catch (e) {}
      editorLayoutReloadRequested.current = true;
    } catch (error) {
      // 
      throw error;
    }
  }, [refreshNow, user, ownerOverrideUid]);

  const onRemoveArtworkFromLayout = useCallback(async (artworkIdToRemove: string) => {
    if (embedMode) {
      console.warn('[embed] blocked onRemoveArtworkFromLayout');
      throw new Error('Embed mode: write blocked');
    }
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

      // Force local refresh so scene/editor see changes immediately
      try { await refreshNow?.(); } catch (e) {}

      const artworkDocRef = db.collection('artworks').doc(artworkIdToRemove);
      await artworkDocRef.update({
        artwork_data: null
      });

      try { await refreshNow?.(); } catch (e) {}
      editorLayoutReloadRequested.current = true;

    } catch (error) {
      // 
      throw error;
    }
  }, [activeExhibition.id, activeZone.id]);

  const onAddArtworkToLayout = useCallback(async (artworkToAdd: FirebaseArtwork) => {
    if (embedMode) {
      console.warn('[embed] blocked onAddArtworkToLayout');
      return false;
    }
    if (!activeExhibition?.id || activeExhibition.id === 'fallback_id') {
      throw new Error("Invalid Exhibition ID");
    }
    if (!activeZone?.id || activeZone.id === 'fallback_zone_id') {
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
      try { await refreshNow?.(); } catch (e) {}
      editorLayoutReloadRequested.current = true;
      return true; // Indicate success
    } catch (error) {
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
    // Disable reset button after user pressed it
    setIsResetCameraEnable(false);
  }, [cameraControlRef, setFocusedArtworkInstanceId, setIsArtworkFocusedForControls, setFocusedArtworkFirebaseId, setisRankingMode, setIsZeroGravityMode, setHeartEmitterArtworkId, lightingConfig.customCameraPosition]);

  const updateArtworkLikesInFirebase = useCallback(async (artworkId: string, incrementBy: number) => {
    if (embedMode) {
      // In embed mode we don't write likes to DB
      return;
    }
    try {
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      await artworkDocRef.update({
        artwork_liked: firebase.firestore.FieldValue.increment(incrementBy)
      });
    } catch (error) {
      // 
    }
  }, []);

  const viewedArtworkInstanceRef = useRef<string | null>(null);

  const updateArtworkViewsInFirebase = useCallback(async (artworkId: string) => {
    if (embedMode) return;
    try {
      const artworkDocRef = db.collection('artworks').doc(artworkId);
      await artworkDocRef.update({
        artwork_viewed: firebase.firestore.FieldValue.increment(1)
      });
    } catch (error) {
      // silent
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

    // hotspot tracking removed for scene clicks
  }, [uiConfig.lightsOn, nextSceneRippleId, setSceneRipples, activeZone?.id]);


  const handleArtworkClicked = useCallback((e: React.MouseEvent<HTMLDivElement>, artworkInstanceId: string, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType, isMotionVideo: boolean) => {
    
    e.stopPropagation();

    // Extract the actual artworkId from the instanceId
    const artworkIdMatch = artworkInstanceId.match(/zone_art_([a-zA-Z0-9_-]+)_\d+/);
    const actualArtworkId = artworkIdMatch ? artworkIdMatch[1] : null;

    if (!actualArtworkId) {
      return;
    }
    



    // Existing logic after handling the new updates
    if (isRankingMode) {
      // In ranking mode: trigger like (+2 points) and heart emitter
      
      setHeartEmitterArtworkId(artworkInstanceId);
      setHeartEmitterTrigger(prev => prev + 1);
    } else if (isZeroGravityMode) {
      // In zero gravity mode: just visual feedback, no like
      
    } else if (isEditorMode) {
      
      handleSelectArtwork(artworkInstanceId);
    } else {
      // Normal mode: select artwork and move camera, no like
      
      handleSelectArtwork(artworkInstanceId);
      // If the last user interaction was a drag, do not zoom in / move camera
      if (lastUserInteractionWasDragRef.current) {
        lastUserInteractionWasDragRef.current = false;
      } else {
        if (cameraControlRef.current && cameraControlRef.current.moveCameraToArtwork) {
          // Show artwork action controls because we're performing a zoom-in
          setIsArtworkFocusedForControls(true);
          setIsCameraMovingToArtwork(true); // Set camera moving state
          // Increment view count once per zoom-session per artwork instance
          if (viewedArtworkInstanceRef.current !== artworkInstanceId) {
            viewedArtworkInstanceRef.current = artworkInstanceId;
            if (actualArtworkId) {
              void updateArtworkViewsInFirebase(actualArtworkId);
            }
          }
          cameraControlRef.current.moveCameraToArtwork(artworkInstanceId, position, rotation, artworkType, isMotionVideo);
        }
      }
    }
  }, [cameraControlRef, handleSelectArtwork, isRankingMode, isEditorMode, isZeroGravityMode, activeZone?.id, setHeartEmitterArtworkId, setHeartEmitterTrigger]); // MODIFIED: Removed onLikeTriggered from deps, added setHeartEmitterTrigger

  const handleDismissArtworkControls = useCallback(() => {
    
    setIsArtworkFocusedForControls(false);
    setIsCameraMovingToArtwork(false); // Reset camera moving state
    if (focusedArtworkInstanceId && cameraControlRef.current) {
      cameraControlRef.current.moveCameraToPrevious();
      setFocusedArtworkInstanceId(null);
      setFocusedArtworkFirebaseId(null);
    }
    // Clear view tracking so next zoom-in will count again
    viewedArtworkInstanceRef.current = null;
    setHeartEmitterArtworkId(null);
  }, [focusedArtworkInstanceId, cameraControlRef, setIsArtworkFocusedForControls, setFocusedArtworkInstanceId, setFocusedArtworkFirebaseId, setHeartEmitterArtworkId]);

  const handleOpenInfo = useCallback(() => {
    // Removed noisy stack log
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
    // When entering/exiting ranking mode, hide/disable reset button
    setIsResetCameraEnable(false);
    
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
    // Ensure reset button is disabled when toggling zero-gravity
    setIsResetCameraEnable(false);
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

  // Compute min/max views and proportional tick positions for zero gravity legend
  const zeroGravityViews = useMemo(() => {
    const views = displayLayout.map(item => {
      const fb = firebaseArtworks.find(fa => fa.id === item.artworkId);
      return fb?.artwork_viewed ?? 0;
    });
    const min = views.length ? Math.min(...views) : 0;
    const max = views.length ? Math.max(...views) : 0;
    let extraTicks: number[] = [];
    if (views.length && max > min) {
      extraTicks = Array.from(new Set(views.map(v => (v - min) / (max - min)))).sort((a, b) => a - b);
    }
    return { minViews: min, maxViews: max, extraTicks };
  }, [displayLayout, firebaseArtworks]);

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

      {!embedMode && <TopLeftLogout user={user} onLogout={handleLogout} onSignIn={(curatorUid) => setOwnerOverrideUid(curatorUid || null)} onRequestCloseInfo={() => { try { setIsInfoOpen(false); } catch (e) {} }} />}

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
          onUserCameraInteractionStart={() => setIsResetCameraEnable(true)}
          onUserCameraInteractionEnd={(wasDrag: boolean) => {
            // Remember whether the last interaction was a drag. Clearing shortly after.
            lastUserInteractionWasDragRef.current = wasDrag;
            if (wasDrag) {
              // Keep the flag for a short window to let the subsequent click handler consult it
              window.setTimeout(() => { lastUserInteractionWasDragRef.current = false; }, 300);
            } else {
              // For click interactions we no longer disable the reset button here to avoid
              // hiding it on quick interactions; just clear the temporary drag flag.
              lastUserInteractionWasDragRef.current = false;
            }
          }}
          onSaveCustomCamera={(pos) => {
            // Persist custom camera position into the lighting config for this zone
            const newConfig = { ...lightingConfig, customCameraPosition: pos };
            handleLightingUpdate(newConfig);
          }}
          isCameraMovingToArtwork={isCameraMovingToArtwork} // NEW: Pass camera moving state
          useExhibitionBackground={lightingConfig.useExhibitionBackground || false} // NEW: Pass useExhibitionBackground
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
        isEmbed={!!embedMode}
        useExhibitionBackground={lightingConfig.useExhibitionBackground || false}
        activeExhibition={activeExhibition}
      />

      <CurrentExhibitionInfo
        uiConfig={uiConfig}
        isLoading={isLoading}
        activeExhibition={activeExhibition}
        isInfoOpen={isInfoOpen}
        isSmallScreen={isSmallScreen}
        isCurrentExhibitionInfoHidden={isCurrentExhibitionInfoHidden}
        onInfoOpen={handleOpenInfo}
        useExhibitionBackground={lightingConfig.useExhibitionBackground || false}
      />

      {!embedMode && (
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
      )}

      <MainControls
        uiConfig={uiConfig}
        isInfoOpen={isInfoOpen}
        lightsOn={lightsOn}
        onLightToggle={handleLightToggle}
        isEditorMode={isEditorMode}
        onEditorModeToggle={() => {
          setIsEditorMode(prev => !prev);
        }}
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
        isSignedIn={isSignedIn}
        isEmbed={!!embedMode}
        isCameraAtDefaultPosition={isCameraAtDefaultPosition} // NEW: Pass camera position status
        // NEW: global flag to control reset button visibility
        isResetCameraEnable={isResetCameraEnable}
        setHeartEmitterArtworkId={setHeartEmitterArtworkId}
        hasMotionArtwork={hasMotionArtwork} // NEW: Pass hasMotionArtwork
        // NEW: Pass customCameraPosition to MainControls
        customCameraPosition={lightingConfig.customCameraPosition}
      />

      {isEditorMode && FloorPlanEditor && (
        <Suspense fallback={null}>
          <FloorPlanEditor
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            isEditorMode={isEditorMode}
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
            useExhibitionBackground={lightingConfig.useExhibitionBackground || false} // NEW: Pass useExhibitionBackground
            activeZoneTheme={activeEffectName} // NEW: Pass activeZone.zone_theme as activeZoneTheme
            onUpdateZoneTheme={handleUpdateZoneTheme} // NEW: Pass handler for updating zone theme
            activeExhibitionBackgroundUrl={activeExhibition.exhibit_background} // NEW: Pass activeExhibition.exhibit_background
            effectRegistry={effectRegistry} // NEW: Pass dynamically loaded effect registry
            isEffectRegistryLoading={isEffectRegistryLoading} // NEW: Pass effect registry loading state
            activeZoneGravity={activeZoneGravity} // NEW: Pass activeZoneGravity
            onUpdateZoneGravity={handleUpdateZoneGravity} // NEW: Pass handler for updating zone gravity
          />
        </Suspense>
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

      {isZeroGravityMode && ZeroGravityLegendLazy && (
        <React.Suspense fallback={null}>
          <ZeroGravityLegendLazy
            minViews={zeroGravityViews.minViews}
            maxViews={zeroGravityViews.maxViews}
            extraTicks={zeroGravityViews.extraTicks}
            visible={isZeroGravityMode && !isLoading}
          />
        </React.Suspense>
      )}

    </React.Fragment>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const isEmbedMode = params.get('embed') === 'true';
  const embedExhibitionId = params.get('exhibitionId');
  const embedFeaturesParam = params.get('embedFeatures') || params.get('embed_features') || '';
  const embedFeatures = embedFeaturesParam ? embedFeaturesParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;

  return <MuseumApp embedMode={isEmbedMode} initialExhibitionId={embedExhibitionId} embedFeatures={embedFeatures} />;
}

export default App;
