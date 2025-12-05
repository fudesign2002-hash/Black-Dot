import { useState, useEffect, useMemo, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import { db } from '../firebase';
import { Exhibition, ExhibitionZone, ExhibitionArtItem, SimplifiedLightingConfig, FirebaseArtwork } from '../types';
import { processFirebaseExhibitions, processFirebaseZones, createLayoutFromZone } from '../services/museumService';
// FIX: Import processFirebaseArtworks from services/museumService
import { processFirebaseArtworks } from '../services/museumService';

const DEFAULT_SIMPLIFIED_LIGHTING_CONFIG: SimplifiedLightingConfig = {
  lightsOn: true,
  ambientIntensity: 0.9,
  spotlightMode: 'off',
  manualSpotlightColor: '#ffffff',
  colorTemperature: 5500,
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
};

export const useMuseumState = () => {
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

    const unsubscribeArtworks = artworksColRef.onSnapshot(async (snapshot) => {
        
        const processedArtworks = await processFirebaseArtworks(snapshot.docs);
        setFirebaseArtworks(processedArtworks);
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
    return { ...baseConfig, ...lightingOverrides[activeZone.id] };
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
    handleNavigate,
    setLightingOverride,
  };
};