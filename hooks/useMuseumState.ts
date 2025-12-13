
import { useState, useEffect, useMemo, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../firebase';
import { Exhibition, ExhibitionZone, ExhibitionArtItem, SimplifiedLightingConfig, FirebaseArtwork } from '../types';
import { processFirebaseExhibitions, processFirebaseZones, createLayoutFromZone } from '../services/museumService';
// FIX: Import processFirebaseArtworks from services/museumService
import { processFirebaseArtworks } from '../services/museumService';

const INITIAL_CAMERA_POSITION: [number, number, number] = [-8, 4, 25]; // NEW: Define initial camera position

const DEFAULT_SIMPLIFIED_LIGHTING_CONFIG: SimplifiedLightingConfig = {
  lightsOn: true,
  ambientIntensity: 0.9,
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
  isActive: false,
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

export const useMuseumState = (enableSnapshots: boolean) => { // NEW: Accept enableSnapshots prop
  const [rawExhibitionDocs, setRawExhibitionDocs] = useState<firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]>([]);
  const [rawArtworkDocs, setRawArtworkDocs] = useState<firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]>([]);
  const [zones, setZones] = useState<ExhibitionZone[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightingOverrides, setLightingOverrides] = useState<Record<string, SimplifiedLightingConfig>>({});

  const [firebaseArtworks, setFirebaseArtworks] = useState<FirebaseArtwork[]>([]);

  useEffect(() => {
    setIsLoading(true);
    let loadedFlags = { exhibitions: false, zones: false, artworks: false };
    const checkAllLoaded = () => {
        if (loadedFlags.exhibitions && loadedFlags.zones && loadedFlags.artworks) {
            setIsLoading(false);
        }
    }

    const unsubscribes: (() => void)[] = []; // NEW: Array to hold unsubscribe functions

    if (enableSnapshots) { // NEW: Conditionally subscribe to snapshots
      const exhibitionsColRef = db.collection('exhibitions');
      const zonesColRef = db.collection('zones');
      const artworksColRef = db.collection('artworks');

      const unsubscribeExhibitions = exhibitionsColRef.onSnapshot((snapshot) => {
          setRawExhibitionDocs(snapshot.docs);
          loadedFlags.exhibitions = true;
          checkAllLoaded();
      }, (error) => {
          // 
          setIsLoading(false);
      });
      unsubscribes.push(unsubscribeExhibitions); // NEW: Store unsubscribe function

      const unsubscribeZones = zonesColRef.onSnapshot((snapshot) => {
          setZones(processFirebaseZones(snapshot.docs));
          loadedFlags.zones = true;
          checkAllLoaded();
      }, (error) => {
          // 
          setIsLoading(false);
      });
      unsubscribes.push(unsubscribeZones); // NEW: Store unsubscribe function

      const unsubscribeArtworks = artworksColRef.onSnapshot(async (snapshot) => {
          
          const processedArtworks = await processFirebaseArtworks(snapshot.docs);
          setFirebaseArtworks(processedArtworks);
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
    
    return () => {
        // Unsubscribe all listeners when component unmounts or `enableSnapshots` changes
        unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [enableSnapshots]); // NEW: Add enableSnapshots to dependency array

  // Manual refresh helper: fetch latest collections once and update state.
  const refreshNow = useCallback(async () => {
    try {
      const exhibitionsColRef = db.collection('exhibitions');
      const zonesColRef = db.collection('zones');
      const artworksColRef = db.collection('artworks');

      const [exSnap, zoneSnap, artSnap] = await Promise.all([
        exhibitionsColRef.get(),
        zonesColRef.get(),
        artworksColRef.get(),
      ]);

      setRawExhibitionDocs(exSnap.docs);
      setZones(processFirebaseZones(zoneSnap.docs));

      const processedArtworks = await processFirebaseArtworks(artSnap.docs);
      setFirebaseArtworks(processedArtworks);
      setRawArtworkDocs(artSnap.docs);
    } catch (e) {
      // swallow; snapshots should handle most updates
    }
  }, []);

  const exhibitions = useMemo(() => {
    if (rawExhibitionDocs.length === 0) return [];
    const processedAllExhibitions = processFirebaseExhibitions(rawExhibitionDocs, firebaseArtworks);
    return processedAllExhibitions.filter(ex => ex.isActive === true);
  }, [rawExhibitionDocs, firebaseArtworks]);

  useEffect(() => {
    if (exhibitions.length === 0) {
      if (currentIndex !== 0) {
        setCurrentIndex(0);
      }
    } else if (currentIndex >= exhibitions.length) {
      setCurrentIndex(0);
    }
  }, [exhibitions, currentIndex]);

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
    if (!finalConfig.customCameraPosition) {
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
  }, [activeZone, lightingOverrides]);
  
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
    };
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
  };
};

export type UseMuseumStateReturn = ReturnType<typeof useMuseumState> & { refreshNow?: () => Promise<void> };
