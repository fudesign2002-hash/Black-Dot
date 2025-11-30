import { useState, useEffect, useMemo, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../firebase';
import { Exhibition, ExhibitionZone, ExhibitionArtItem, SimplifiedLightingConfig, FirebaseArtwork, SimplifiedLightingPreset } from '../types';
import { processFirebaseExhibitions, processFirebaseZones, processFirebaseArtworks, createLayoutFromZone } from '../services/museumService';

const DEFAULT_SIMPLIFIED_LIGHTING_CONFIG: SimplifiedLightingConfig = {
  lightsOn: true,
  ambientIntensity: 0.9, // Increased from 0.8 to 0.9 for an even brighter environment
  spotlightMode: 'off',
  manualSpotlightColor: '#ffffff',
  colorTemperature: 5500,
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
};

const DEFAULT_FALLBACK_ZONE: ExhibitionZone = {
  id: 'fallback_zone_id',
  name: 'Loading Zone...',
  theme: 'empty',
  lightingDesign: {
    description: 'Default lighting.',
    defaultConfig: DEFAULT_SIMPLIFIED_LIGHTING_CONFIG,
    recommendedPresets: [],
  },
  exhibitionId: DEFAULT_FALLBACK_EXHIBITION.id,
};

export const useMuseumState = () => {
  // States for raw Firebase data snapshots
  const [rawExhibitionDocs, setRawExhibitionDocs] = useState<firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]>([]);
  const [rawArtworkDocs, setRawArtworkDocs] = useState<firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]>([]);
  const [zones, setZones] = useState<ExhibitionZone[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightingOverrides, setLightingOverrides] = useState<Record<string, SimplifiedLightingConfig>>({});

  useEffect(() => {
    setIsLoading(true);
    let loadedFlags = { exhibitions: false, zones: false, artworks: false };
    const checkAllLoaded = () => {
        if (loadedFlags.exhibitions && loadedFlags.zones && loadedFlags.artworks) {
            setIsLoading(false);
        }
    }

    const exhibitionsColRef = db.collection('exhibitions');
    const zonesColRef = db.collection('zones');
    const artworksColRef = db.collection('artworks');

    const unsubscribeExhibitions = exhibitionsColRef.onSnapshot((snapshot) => {
        setRawExhibitionDocs(snapshot.docs);
        loadedFlags.exhibitions = true;
        checkAllLoaded();
    }, (error) => {
        console.error("Error fetching real-time exhibitions:", error);
        setIsLoading(false);
    });

    const unsubscribeZones = zonesColRef.onSnapshot((snapshot) => {
        setZones(processFirebaseZones(snapshot.docs));
        loadedFlags.zones = true;
        checkAllLoaded();
    }, (error) => {
        console.error("Error fetching real-time zones:", error);
        setIsLoading(false);
    });

    const unsubscribeArtworks = artworksColRef.onSnapshot((snapshot) => {
        setRawArtworkDocs(snapshot.docs);
        loadedFlags.artworks = true;
        checkAllLoaded();
    }, (error) => {
        console.error("Error fetching real-time artworks:", error);
        setIsLoading(false);
    });
    
    return () => {
        unsubscribeExhibitions();
        unsubscribeZones();
        unsubscribeArtworks();
    };
  }, []);

  const firebaseArtworks = useMemo(() => processFirebaseArtworks(rawArtworkDocs), [rawArtworkDocs]);

  const exhibitions = useMemo(() => {
    if (rawExhibitionDocs.length === 0) return [];
    return processFirebaseExhibitions(rawExhibitionDocs, firebaseArtworks);
  }, [rawExhibitionDocs, firebaseArtworks]);

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
    return lightingOverrides[activeZone.id] || activeZone.lightingDesign.defaultConfig;
  }, [activeZone, lightingOverrides]);
  
  const currentLayout = useMemo((): ExhibitionArtItem[] => {
    // The canonical list of artwork IDs for the current exhibition. This is the source of truth.
    const canonicalArtworkIds = new Set(activeExhibition.exhibit_artworks || []);

    // Get the custom layout from the zone, if it exists.
    const zoneLayout = activeZone.artwork_selected
        ? createLayoutFromZone(activeZone.artwork_selected, firebaseArtworks)
        : [];

    // Get the default layout for fallback positions.
    const defaultLayout = activeExhibition.defaultLayout || [];

    // 1. Filter the custom zone layout to only include artworks that are still part of the exhibition.
    // This handles removals.
    const filteredZoneLayout = zoneLayout.filter(item => canonicalArtworkIds.has(item.artworkId));
    const artworksWithCustomLayout = new Set(filteredZoneLayout.map(item => item.artworkId));

    // 2. Find artworks from the default layout that are in the exhibition but don't have a custom layout.
    // This handles additions.
    const newArtworks = defaultLayout.filter(item =>
        canonicalArtworkIds.has(item.artworkId) && !artworksWithCustomLayout.has(item.artworkId)
    );

    // 3. Combine the artworks with custom positions and the newly added artworks with default positions.
    return [...filteredZoneLayout, ...newArtworks];
  }, [activeExhibition, activeZone, firebaseArtworks]);

  const handleNavigate = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const setLightingOverride = useCallback((zoneId: string, config: SimplifiedLightingConfig) => {
    setLightingOverrides(prev => ({
        ...prev,
        [zoneId]: config,
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
    handleNavigate, // NEW: Export handleNavigate
    setLightingOverride,
  };
};