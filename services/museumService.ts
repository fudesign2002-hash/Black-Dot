
import firebase from 'firebase/compat/app';
import { db } from '../firebase'; // MODIFIED: Import db
import { Exhibition, ExhibitionZone, FirebaseArtwork, ExhibitionArtItem, ArtType, ZoneArtworkItem, ArtworkData } from '../types';
import { storage } from '../firebase';

// Analytics tracking (Deprecated - moved to Umami)
export const trackVisit = async (exhibitionId: string) => {
  // Logic removed as analytics are now handled by Umami
};

// Record usage of a named feature (Deprecated - moved to Umami)
export const recordFeatureUsage = async (exhibitionId: string, featureName: string, count: number = 1) => {
    // Logic removed as analytics are now handled by Umami
};

// Record session duration (Deprecated - moved to Umami)
export const recordSessionDuration = async (exhibitionId: string, durationSec: number) => {
    // Logic removed as analytics are now handled by Umami
};

// Generic analytics recorder (Deprecated - moved to Umami)
export type AnalyticsEvent =
    | { type: 'visit' }
    | { type: 'feature'; name: string; count?: number }
    | { type: 'session'; durationSec: number }
    | { type: 'custom'; path: string; increment?: number };

export const recordAnalytics = async (exhibitionId: string, event: AnalyticsEvent) => {
    // Logic removed as analytics are now handled by Umami
};

// Cache parsed artwork_data per document id to avoid returning a new object
// reference when the semantic content hasn't changed. This reduces upstream
// prop churn (e.g. in React state) and prevents unnecessary effect re-runs.
const artworkDataCacheById: Map<string, ArtworkData | undefined> = new Map();

const shallowEqual = (a: any, b: any) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
        const k = aKeys[i];
        if (a[k] !== b[k]) return false;
    }
    return true;
};

const parseArtworkData = (rawData: any): ArtworkData | undefined => {
  if (!rawData) {
    return undefined;
  }

  if (typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
    return rawData as ArtworkData;
  }

  if (typeof rawData === 'string') {
    try {
      
      const cleanedString = rawData.replace(/\/\/.*$/gm, '');
      const parsed = JSON.parse(cleanedString);
      return parsed as ArtworkData;
    } catch (e) {
      // 
      return undefined;
    }
  }

  return undefined;
};
export const processFirebaseArtworks = async (docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]): Promise<FirebaseArtwork[]> => {
    const artworksPromises = docs.map(async doc => {
        const data = doc.data();
                const parsedArtworkData = parseArtworkData(data.artwork_data);
                // Reuse cached parsed object when semantically identical
                const prev = artworkDataCacheById.get(doc.id);
                let artworkDataToUse: ArtworkData | undefined = parsedArtworkData;
                if (prev && parsedArtworkData && shallowEqual(prev, parsedArtworkData)) {
                    artworkDataToUse = prev;
                } else {
                    // update cache even if undefined so we remember its last state
                    artworkDataCacheById.set(doc.id, parsedArtworkData);
                }

                return {
                        id: doc.id,
                        artworkID: data.artworkID || '',
                        artwork_type: data.artwork_type || 'unknown',
                        title: data.title || 'Untitled Artwork',
                        artist: data.artist || undefined,
                        file: data.file,
                        artwork_file: data.artwork_file,
                        digitalSize: data.digitalSize,
                        materials: data.materials,
                        artwork_medium: data.artwork_medium,
                        artwork_date: data.artwork_date,
                        artwork_dimensions: data.artwork_dimensions,
                        size: data.size,
                        artwork_data: artworkDataToUse,
                        fileSizeMB: typeof data.artwork_filesize === 'number' ? data.artwork_filesize / (1024 * 1024) : undefined,
                        artwork_liked: typeof data.artwork_liked === 'number' ? data.artwork_liked : 0,
                        artwork_viewed: typeof data.artwork_viewed === 'number' ? data.artwork_viewed : 0,
                        artwork_shared: typeof data.artwork_shared === 'number' ? data.artwork_shared : undefined,
                        artwork_gravity: typeof data.artwork_gravity === 'number' ? data.artwork_gravity : 0,
                };
    });

    const artworks = await Promise.all(artworksPromises);

    // Normalize `artwork_viewed` across the fetched artworks to a 0-100 gravity metric.
    // More views -> higher gravity value (closer to 100) which will make the artwork float lower.
    const maxViews = artworks.reduce((max, a) => Math.max(max, a.artwork_viewed ?? 0), 0);
    const normalized = artworks.map(a => {
        const views = a.artwork_viewed ?? 0;
        const gravity = maxViews > 0 ? Math.round((views / maxViews) * 100) : 0;
        return { ...a, artwork_gravity: gravity };
    });

    return normalized;
};

export const createLayoutFromZone = (zoneArtworks: ZoneArtworkItem[], allFirebaseArtworks: FirebaseArtwork[]): ExhibitionArtItem[] => {
    if (!Array.isArray(zoneArtworks) || zoneArtworks.length === 0 || allFirebaseArtworks.length === 0) {
        return [];
    }
    
    return zoneArtworks.map((item, index): ExhibitionArtItem | null => {
        const firebaseArt = allFirebaseArtworks.find(art => art.id === item.artworkId);
        if (!firebaseArt) {
            return null;
        }

        let itemType: ArtType = 'sculpture_base';
        let textureUrl: string | undefined = undefined;
        let aspectRatio: number | undefined = undefined;
        let artworkData: ArtworkData | undefined = undefined;
        let isMotionVideo: boolean = false;
        let isFaultyMotionVideo: boolean = false;

        // FIX: Define fileUrl, isVideoFile, isImageFile, isGlbFile
        const fileUrl = firebaseArt.artwork_file || firebaseArt.file;
        const lastSegment = (fileUrl || '').split('?')[0].split('/').pop() || '';
        const isVideoFile = fileUrl && (fileUrl.includes('vimeo.com') || fileUrl.includes('youtube.com') || /\.(mp4|webm|ogg|mov)(?:$|-[0-9]+$)/i.test(lastSegment));
        const isImageFile = fileUrl && /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(?:$|-[0-9]+$)/i.test(lastSegment);
        const isGlbFile = fileUrl && /\.glb(?:$|-[0-9]+$)/i.test(lastSegment);

        switch (firebaseArt.artwork_type) {
            case 'painting':
            case 'photography':
                itemType = 'canvas_square';
                if (isImageFile) {
                    textureUrl = fileUrl;
                } else if (isVideoFile) {
                    itemType = 'canvas_landscape';
                    textureUrl = fileUrl;
                    isMotionVideo = true;
                } else {
                    textureUrl = fileUrl;
                }
                aspectRatio = isMotionVideo ? (16 / 9) : undefined;
                break;
            case 'sculpture':
                itemType = 'sculpture_base';
                if (firebaseArt.artwork_data) {
                    artworkData = firebaseArt.artwork_data;
                }

                if (isGlbFile) {
                    textureUrl = fileUrl;
                }
                break;
            case 'media':
            case 'motion':
                itemType = 'canvas_landscape';
                if (isVideoFile) {
                    textureUrl = fileUrl;
                    isMotionVideo = true;
                } else if (isGlbFile) {
                    textureUrl = fileUrl;
                    isFaultyMotionVideo = true;
                } else {
                    textureUrl = fileUrl;
                    isFaultyMotionVideo = true;
                }
                aspectRatio = 16 / 9;
                break;
            default:
                itemType = 'sculpture_base';
                break;
        }

        const createdItem: ExhibitionArtItem = {
            id: `zone_art_${item.artworkId}_${index}`,
            artworkId: item.artworkId,
            type: itemType,
            position: item.position,
            rotation: item.rotation,
            scale: item.scale,
            textureUrl: textureUrl,
            aspectRatio: aspectRatio,
            artworkData: artworkData,
            isMotionVideo: isMotionVideo,
            isFaultyMotionVideo: isFaultyMotionVideo,
            artworkGravity: firebaseArt.artwork_gravity, // NEW: Copy artwork_gravity
            source_artwork_type: firebaseArt.artwork_type,
        };

        // Photography height logic: compute vertical placement from aspect ratio
        // Goal: taller photos sit at y = 3; shorter photos float higher so they're vertically centered
        if (firebaseArt.artwork_type === 'photography') {
            const ar = typeof createdItem.aspectRatio === 'number' && createdItem.aspectRatio > 0 ? createdItem.aspectRatio : 1;
            const baseDisplayHeight = 2.5; // reference display height for a "normal" photo
            const displayHeight = baseDisplayHeight * (1 / ar); // taller (portrait) => ar<1 => displayHeight > base
            const positionY = displayHeight >= baseDisplayHeight ? 3 : 3 + ((baseDisplayHeight - displayHeight) / 2);
            const pos = createdItem.position || [0, 0, 0];
            createdItem.position = [pos[0], positionY, pos[2]];
        }

        return createdItem;
    }).filter((item): item is ExhibitionArtItem => item !== null);
};


export const createFirebaseLayout = (artworkIds: string[], allFirebaseArtworks: FirebaseArtwork[]): ExhibitionArtItem[] => {
    if (!Array.isArray(artworkIds) || artworkIds.length === 0 || allFirebaseArtworks.length === 0) {
        return [];
    }

    const layoutItems: ExhibitionArtItem[] = [];
    const foundArtworks = artworkIds.map(id => allFirebaseArtworks.find(art => art.id === id)).filter(Boolean) as FirebaseArtwork[];

    const totalArtworks = foundArtworks.length;
    const spacing = 10;
    const startX = -((totalArtworks - 1) * spacing) / 2;

    foundArtworks.forEach((firebaseArt, index) => {
        let itemType: ArtType = 'canvas_square';
        let textureUrl: string | undefined = undefined;
        let aspectRatio: number | undefined = undefined;
        let artworkData: ArtworkData | undefined = undefined;
        let isMotionVideo: boolean = false;
        let isFaultyMotionVideo: boolean = false;

        // FIX: Define fileUrl, isVideoFile, isImageFile, isGlbFile
        const fileUrl = firebaseArt.artwork_file || firebaseArt.file;
        const lastSegment = (fileUrl || '').split('?')[0].split('/').pop() || '';
        const isVideoFile = fileUrl && (fileUrl.includes('vimeo.com') || fileUrl.includes('youtube.com') || /\.(mp4|webm|ogg|mov)(?:$|-[0-9]+$)/i.test(lastSegment));
        const isImageFile = fileUrl && /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(?:$|-[0-9]+$)/i.test(lastSegment);
        const isGlbFile = fileUrl && /\.glb(?:$|-[0-9]+$)/i.test(lastSegment);

        switch (firebaseArt.artwork_type) {
            case 'painting':
            case 'photography':
                itemType = 'canvas_square';
                if (isImageFile) {
                    textureUrl = fileUrl;
                } else if (isVideoFile) {
                    itemType = 'canvas_landscape';
                    textureUrl = fileUrl;
                    isMotionVideo = true;
                } else {
                    textureUrl = fileUrl;
                }
                aspectRatio = isMotionVideo ? (16 / 9) : undefined;
                break;
            case 'sculpture':
                itemType = 'sculpture_base';
                if (firebaseArt.artwork_data) {
                    artworkData = firebaseArt.artwork_data;
                }

                if (isGlbFile) {
                    textureUrl = fileUrl;
                }
                break;
            case 'media':
            case 'motion':
                itemType = 'canvas_landscape';
                if (isVideoFile) {
                    textureUrl = fileUrl;
                    isMotionVideo = true;
                } else if (isGlbFile) { 
                    textureUrl = fileUrl;
                    isFaultyMotionVideo = true;
                } else {
                    textureUrl = fileUrl;
                    isFaultyMotionVideo = true;
                }
                aspectRatio = 16 / 9;
                break;
            default:
                itemType = 'sculpture_base';
                break;
        }

        // Compute Y position for photography based on aspect ratio
        let positionY = 0;
        if (firebaseArt.artwork_type === 'photography') {
            const ar = typeof aspectRatio === 'number' && aspectRatio > 0 ? aspectRatio : 1;
            const baseDisplayHeight = 2.5;
            const displayHeight = baseDisplayHeight * (1 / ar);
            positionY = displayHeight >= baseDisplayHeight ? 3 : 3 + ((baseDisplayHeight - displayHeight) / 2);
        }
        layoutItems.push({
            id: `firebase_art_${firebaseArt.id}_${index}`,
            artworkId: firebaseArt.id,
            type: itemType,
            position: [startX + index * spacing, positionY, 0],
            rotation: [0, 0, 0],
            scale: 1,
            textureUrl: textureUrl,
            aspectRatio: aspectRatio,
            artworkData: artworkData,
            isMotionVideo: isMotionVideo,
            isFaultyMotionVideo: isFaultyMotionVideo,
            artworkGravity: firebaseArt.artwork_gravity, // NEW: Copy artwork_gravity
            source_artwork_type: firebaseArt.artwork_type,
        });
    });

    return layoutItems;
};

const normalizeStatus = (statusStr: string | undefined): 'now showing' | 'past' | 'permanent' | 'future' => {
        const normalized = (statusStr || '').trim().toLowerCase();
        switch (normalized) {
            case 'now showing':
            case 'current':
                return 'now showing';
      case 'past':
        return 'past';
      case 'permanent':
        return 'permanent';
      case 'future':
        return 'future';
      default:
        return 'future';
    }
}

export const processFirebaseExhibitions = (docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[], allFirebaseArtworks: FirebaseArtwork[]): Exhibition[] => {
    return docs.map(doc => {
        const data = doc.data();
        const exhibitArtworksList = Array.isArray(data.exhibit_artworks) ? data.exhibit_artworks : [];
        const exhibition: Exhibition = {
            id: doc.id,
            title: data.title || 'Untitled Exhibition',
            subtitle: data.subtitle || '',
            artist: data.artist || 'Unknown Artist',
            dates: (data.dateFrom && data.dateTo) ? `${data.dateFrom} – ${data.dateTo}` : (data.dates || 'N/A'),
            overview: data.overview || 'No overview available.',
            admission: data.admission || data.admissionPrice || 'N/A', // MODIFIED: Prioritize admission field
            status: normalizeStatus(data.status),
            tags: Array.isArray(data.tags) ? data.tags : [],
            posterColor: data.posterColor || 'bg-gray-700',
            dateFrom: data.dateFrom,
            dateTo: data.dateTo,
            hours: data.hours,
            admissionPrice: data.admissionPrice,
            admissionLink: data.admissionLink,
            venue: data.venue,
            supportedBy: data.supportedBy,
            exhibit_artworks: exhibitArtworksList,
            defaultLayout: createFirebaseLayout(exhibitArtworksList, allFirebaseArtworks),
            isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : false,
            isShowcase: typeof data.isShowcase === 'boolean' ? data.isShowcase : false,
            exhibit_poster: data.exhibit_poster || undefined,
            exhibit_background: data.exhibit_background || undefined, // NEW: Add exhibit_background from Firestore
            exhibit_liked: typeof data.exhibit_liked === 'number' ? data.exhibit_liked : 0, // NEW: Add exhibit_liked
            exhibit_viewed: typeof data.exhibit_viewed === 'number' ? data.exhibit_viewed : 0, // NEW: Add exhibit_viewed
            exhibit_capacity: typeof data.exhibit_capacity === 'number' ? data.exhibit_capacity : 100, // NEW: Add exhibit_capacity with default 100
            exhibit_linktype: data.exhibit_linktype || 'tickets', // NEW: Add exhibit_linktype with default 'tickets'
        };
        return exhibition;
    });
};

export const processFirebaseZones = (docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]): ExhibitionZone[] => {
    return docs.map(doc => {
        const data = doc.data();
        const zone: ExhibitionZone = {
            id: doc.id,
            name: data.name || 'Untitled Zone',
            exhibitionId: data.exhibitionId || '',
            artwork_selected: data.artwork_selected || [],
            lightingDesign: data.lightingDesign || {
                description: 'Default lighting.',
                defaultConfig: {
                    lightsOn: true,
                    ambientIntensity: 0.5,
                    spotlightMode: 'off',
                    manualSpotlightColor: '#ffffff',
                    colorTemperature: 5500,
                    keyLightPosition: [-2, 7, 10],
                    fillLightPosition: [5, 2, 5],
                    useExhibitionBackground: false, // NEW: Default for new zones
                    floorColor: '#000000', // NEW: Default floor color for new zones
                },
                recommendedPresets: [],
            },
            zone_capacity: data.zone_capacity || 100,
            zone_theme: data.zone_theme || undefined, // NEW: Read zone_theme from Firestore
            zone_gravity: typeof data.zone_gravity === 'number' ? data.zone_gravity : undefined, // NEW: Read zone_gravity from Firestore
        };
        return zone;
    });
};