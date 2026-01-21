
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../firebase';
import { Exhibition, ExhibitionZone, ExhibitionArtItem, SimplifiedLightingConfig, FirebaseArtwork } from '../types';
import { processFirebaseExhibitions, processFirebaseZones, createLayoutFromZone } from '../services/museumService';
// FIX: Import processFirebaseArtworks from services/museumService
import { processFirebaseArtworks } from '../services/museumService';

const INITIAL_CAMERA_POSITION: [number, number, number] = [-8, 4, 25]; // NEW: Define initial camera position

const DEFAULT_SIMPLIFIED_LIGHTING_CONFIG: SimplifiedLightingConfig = {
  lightsOn: true,
  ambientIntensity: 0.5,
  spotlightMode: 'off',
  manualSpotlightColor: '#ffffff',
  colorTemperature: 5500,
  customCameraPosition: INITIAL_CAMERA_POSITION, // NEW: Add initial customCameraPosition
  useExhibitionBackground: false, // NEW: Default to not using exhibition background
  floorColor: '#000000', // NEW: Default floor color
  keyLightPosition: [-2, 7, 10],
  fillLightPosition: [5, 2, 5],
};

const DEFAULT_FALLBACK_EXHIBITION: Exhibition = {
  id: 'fallback_id',
  title: 'Loading...',
  subtitle: 'Please wait',
  artist: 'N/A',
  dates: 'N/A',
  overview: '...',
  admission: 'N/A',
  status: 'future',
  tags: [],
  posterColor: 'bg-gray-700',
  defaultLayout: [],
  exhibit_artworks: [],
  isPublic: false,
  exhibit_background: undefined, // NEW: Add default for exhibit_background
};

const DEFAULT_FALLBACK_ZONE: ExhibitionZone = {
  id: 'fallback_zone_id',
  name: 'Loading Zone...',
  lightingDesign: {
    description: 'Default lighting.',
    defaultConfig: DEFAULT_SIMPLIFIED_LIGHTING_CONFIG,
    recommendedPresets: [],
  },
  exhibitionId: DEFAULT_FALLBACK_EXHIBITION.id,
  artwork_selected: [],
  zone_capacity: 100,
  zone_theme: undefined, // NEW: Default zone_theme
  zone_gravity: undefined, // NEW: Default zone_gravity
};

export const useMuseumState = (enableSnapshots: boolean, ownerUid?: string | null, authResolved: boolean = true) => { // NEW: Accept enableSnapshots, optional ownerUid, and authResolved
  const [rawExhibitionDocs, setRawExhibitionDocs] = useState<firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]>([]);
  const [rawArtworkDocs, setRawArtworkDocs] = useState<firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]>([]);
  const [zones, setZones] = useState<ExhibitionZone[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightingOverrides, setLightingOverrides] = useState<Record<string, SimplifiedLightingConfig>>({});

  const [firebaseArtworks, setFirebaseArtworks] = useState<FirebaseArtwork[]>([]);

  useEffect(() => {
    // CRITICAL: Ensure we have a stable identity before subscribing to avoid "Guest flash"
    // and redundant re-subscriptions during sign-in.
    if (!authResolved) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    let loadedFlags = { exhibitions: false, zones: false, artworks: false };
    const checkAllLoaded = () => {
        if (loadedFlags.exhibitions && loadedFlags.zones && loadedFlags.artworks) {
            setIsLoading(false);
        }
    }

    const unsubscribes: (() => void)[] = []; // NEW: Array to hold unsubscribe functions

    const isEmbed = (typeof window !== 'undefined' && (window.location.search.includes('embed=true') || window.self !== window.top));
    if (!isEmbed) {
      console.groupCollapsed('%c[useMuseumState] subscribe', 'color:#fff; background:#0ea5e9; padding:2px 6px; border-radius:3px');
      console.log('enableSnapshots:', enableSnapshots, 'ownerUid:', ownerUid || null, 'authResolved:', authResolved);
    }
    if (enableSnapshots) { // NEW: Conditionally subscribe to snapshots
      // For owner views we show exhibitions that belong to the owner and are public
      const exhibitionsColRef = ownerUid ? db.collection('exhibitions').where('ownerId', '==', ownerUid).where('isPublic', '==', true) : db.collection('exhibitions');
      const zonesColRef = db.collection('zones');
      const artworksColRef = db.collection('artworks');

            const unsubscribeExhibitions = exhibitionsColRef.onSnapshot((snapshot) => {
              // Debug: print ownerUid + incoming exhibition doc ids (dev-only)
                  try {
                // DEV-only instrumentation removed to reduce console noise
              } catch (e) {}
              setRawExhibitionDocs(snapshot.docs);
              loadedFlags.exhibitions = true;
              checkAllLoaded();
          }, (error) => {
              // 
              setIsLoading(false);
          });
      unsubscribes.push(unsubscribeExhibitions); // NEW: Store unsubscribe function

        const unsubscribeZones = zonesColRef.onSnapshot((snapshot) => {
          // [log removed] zones snapshot
          setZones(processFirebaseZones(snapshot.docs));
          loadedFlags.zones = true;
          checkAllLoaded();
      }, (error) => {
          // 
          setIsLoading(false);
      });
      unsubscribes.push(unsubscribeZones); // NEW: Store unsubscribe function

        const unsubscribeArtworks = artworksColRef.onSnapshot(async (snapshot) => {
            try {
              // DEV-only log removed to reduce console noise
            } catch (e) {}
          const processedArtworks = await processFirebaseArtworks(snapshot.docs);
          setFirebaseArtworks(processedArtworks);
          try {
            // DEV-only log removed to reduce console noise
          } catch (e) {}
          setRawArtworkDocs(snapshot.docs);
          loadedFlags.artworks = true;
          checkAllLoaded();
      }, (error) => {
          // 
          setIsLoading(false);
      });
      unsubscribes.push(unsubscribeArtworks); // NEW: Store unsubscribe function

    } else { // NEW: If snapshots are disabled, reset data and set loading to false
        setRawExhibitionDocs([]);
        setZones([DEFAULT_FALLBACK_ZONE]); // Reset to default fallback zone
        setFirebaseArtworks([]);
        setIsLoading(false);
        loadedFlags = { exhibitions: true, zones: true, artworks: true }; // Mark as loaded even if no data
    }
    if (!isEmbed) console.groupEnd();
    return () => {
        // Unsubscribe all listeners when component unmounts or `enableSnapshots`/`ownerUid` changes
        unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [enableSnapshots, ownerUid, authResolved]); // FIXED: Added authResolved to dependency array

  // Manual refresh helper: fetch latest collections once and update state.
  const refreshNow = useCallback(async () => {
    try {
      // Match the same server-side query used for snapshots: owners see their public exhibitions
      const exhibitionsColRef = ownerUid ? db.collection('exhibitions').where('ownerId', '==', ownerUid).where('isPublic', '==', true) : db.collection('exhibitions');
      const zonesColRef = db.collection('zones');
      const artworksColRef = db.collection('artworks');

      const [exSnap, zoneSnap, artSnap] = await Promise.all([
        exhibitionsColRef.get(),
        zonesColRef.get(),
        artworksColRef.get(),
      ]);

      // [log removed] refreshNow results

      setRawExhibitionDocs(exSnap.docs);
      setZones(processFirebaseZones(zoneSnap.docs));

      const processedArtworks = await processFirebaseArtworks(artSnap.docs);
      setFirebaseArtworks(processedArtworks);
      setRawArtworkDocs(artSnap.docs);

      try {
        // DEV-only instrumentation removed to reduce console noise
      } catch (e) {}
    } catch (e) {
      // swallow; snapshots should handle most updates
    }
  }, [ownerUid]);

  // Optimistic local update helper: merge updatedArtworkData into existing firebaseArtworks array
  const updateLocalArtworkData = useCallback((artworkId: string, updatedArtworkData: Partial<any>) => {
    setFirebaseArtworks(prev => {
      if (!prev || prev.length === 0) return prev;
      return prev.map(a => {
        if (a.id !== artworkId) return a;
        const newData = { ...(a.artwork_data || {}), ...updatedArtworkData };
        return { ...a, artwork_data: newData };
      });
    });
  }, []);

  const exhibitions = useMemo(() => {
    if (rawExhibitionDocs.length === 0) return [];
    const processedAllExhibitions = processFirebaseExhibitions(rawExhibitionDocs, firebaseArtworks);
    // If ownerUid is provided we assume a signed-in owner view (show their items);
    // otherwise (guest) only show exhibitions marked as showcase.
    if (ownerUid) {
      const filteredOwner = processedAllExhibitions.filter(ex => ex.isPublic === true);
      const statusRank: Record<string, number> = { 'now showing': 0, permanent: 1, past: 2 };
      filteredOwner.sort((a, b) => {
        const ra = statusRank[a.status] ?? 3;
        const rb = statusRank[b.status] ?? 3;
        if (ra !== rb) return ra - rb;
        const da = a.dateFrom ? Date.parse(String(a.dateFrom)) : 0;
        const db = b.dateFrom ? Date.parse(String(b.dateFrom)) : 0;
        return db - da; // newer dateFrom first
      });
      return filteredOwner;
    }
    // For guests filter to showcase and then sort by desired ordering below
    const filtered = processedAllExhibitions.filter(ex => ex.isShowcase === true);
    // Default ordering: status priority (past, current, permanent, others) then by dateFrom (newest first)
    const statusRank: Record<string, number> = { 'now showing': 0, permanent: 1, past: 2 };
    filtered.sort((a, b) => {
      const ra = statusRank[a.status] ?? 3;
      const rb = statusRank[b.status] ?? 3;
      if (ra !== rb) return ra - rb;
      const da = a.dateFrom ? Date.parse(String(a.dateFrom)) : 0;
      const db = b.dateFrom ? Date.parse(String(b.dateFrom)) : 0;
      return db - da; // newer dateFrom first
    });
    return filtered;
  }, [rawExhibitionDocs, firebaseArtworks, ownerUid]);

  useEffect(() => {
    if (exhibitions.length === 0) {
      if (currentIndex !== 0) {
        setCurrentIndex(0);
      }
    } else if (currentIndex >= exhibitions.length) {
      setCurrentIndex(0);
    }
  }, [exhibitions, currentIndex]);

  // Ensure first view on initial load focuses a 'now showing' exhibition if one exists.
  const initialIndexAppliedRef = useRef(false);
  // When the owner uid changes (user switched accounts), treat next load as initial.
  useEffect(() => {
    initialIndexAppliedRef.current = false;
  }, [ownerUid]);
  useEffect(() => {
    if (!isLoading && !initialIndexAppliedRef.current && exhibitions.length > 0) {
      // Always start at the first exhibition in the sorted list (index 0) after load/sign changes
      setCurrentIndex(0);
      initialIndexAppliedRef.current = true;
    }
  }, [isLoading, exhibitions]);

  const { activeExhibition, activeZone } = useMemo(() => {
    if (isLoading || exhibitions.length === 0) {
      return { 
        activeExhibition: DEFAULT_FALLBACK_EXHIBITION,
        activeZone: DEFAULT_FALLBACK_ZONE 
      };
    }
    const exhibition = exhibitions[currentIndex] || DEFAULT_FALLBACK_EXHIBITION;
    const zone = zones.find(z => z.exhibitionId === exhibition?.id) || DEFAULT_FALLBACK_ZONE;
    return { activeExhibition: exhibition, activeZone: zone };
  }, [isLoading, exhibitions, zones, currentIndex]);
  
  const lightingConfig = useMemo((): SimplifiedLightingConfig => {
    const baseConfig = { ...DEFAULT_SIMPLIFIED_LIGHTING_CONFIG, ...activeZone.lightingDesign.defaultConfig };
    // NEW: Apply customCameraPosition from baseConfig, then any overrides
    const finalConfig = { ...baseConfig, ...lightingOverrides[activeZone.id] };

    // Check if the current exhibition has any motion artworks
    const hasMotionArt = activeExhibition.exhibit_artworks?.some(artId => {
      const art = firebaseArtworks.find(a => a.id === artId);
      return art?.artwork_type === 'motion';
    });

    if (hasMotionArt) {
      // If motion, lock camera to a specific perspective for the best view
      finalConfig.customCameraPosition = [-8.37, 2.23, 17.97];
      finalConfig.customCameraTarget = [-4.81, -0.58, -1.93];
    } else if (!finalConfig.customCameraPosition) {
      finalConfig.customCameraPosition = INITIAL_CAMERA_POSITION;
    }

    // Ranking camera is a fixed internal constant and is not stored on lighting configs.
    if (finalConfig.useExhibitionBackground === undefined) { // NEW: Ensure useExhibitionBackground is always defined
      finalConfig.useExhibitionBackground = false;
    }
    if (finalConfig.floorColor === undefined) { // NEW: Ensure floorColor is always defined
      finalConfig.floorColor = DEFAULT_SIMPLIFIED_LIGHTING_CONFIG.floorColor;
    }
    return finalConfig;
  }, [activeZone, lightingOverrides, activeExhibition, firebaseArtworks]);

  const currentLayout = useMemo((): ExhibitionArtItem[] => {
    const canonicalArtworkIds = new Set(activeExhibition.exhibit_artworks || []);

    
    const zoneLayout = activeZone.artwork_selected
        ? createLayoutFromZone(activeZone.artwork_selected, firebaseArtworks)
        : [];

    
    const defaultLayout = activeExhibition.defaultLayout || [];

    
    const filteredZoneLayout = zoneLayout.filter(item => canonicalArtworkIds.has(item.artworkId));
    const artworksWithCustomLayout = new Set(filteredZoneLayout.map(item => item.artworkId));

    
    const newArtworks = defaultLayout.filter(item =>
        canonicalArtworkIds.has(item.artworkId) && !artworksWithCustomLayout.has(item.artworkId)
    );

    
    return [...filteredZoneLayout, ...newArtworks];
  }, [activeExhibition, activeZone, firebaseArtworks]);

  const handleNavigate = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const setLightingOverride = useCallback((zoneId: string, config: SimplifiedLightingConfig) => {
    // Clone the provided config to avoid keeping references to nested objects/arrays
    // (e.g. customCameraPosition). This prevents accidental shared-mutation between
    // the lighting config and other UI pieces like the 2D layout editor.
    const cloned: SimplifiedLightingConfig = {
      ...config,
      customCameraPosition: config.customCameraPosition ? [...config.customCameraPosition] as [number, number, number] : config.customCameraPosition,
      customCameraTarget: config.customCameraTarget ? [...config.customCameraTarget] as [number, number, number] : config.customCameraTarget,
    };
    const isEmbed = (typeof window !== 'undefined' && (window.location.search.includes('embed=true') || window.self !== window.top));
    if (!isEmbed) {
      console.groupCollapsed('%c[useMuseumState] setLightingOverride', 'color:#fff; background:#0ea5e9; padding:2px 6px; border-radius:3px');
      console.log('zoneId:', zoneId, 'customCameraPosition:', cloned.customCameraPosition);
      console.groupEnd();
    }
    setLightingOverrides(prev => ({
        ...prev,
        [zoneId]: cloned,
    }));
  }, []);

  return {
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
    refreshNow,
    updateLocalArtworkData,
  };
};

export type UseMuseumStateReturn = ReturnType<typeof useMuseumState> & { refreshNow?: () => Promise<void> };
