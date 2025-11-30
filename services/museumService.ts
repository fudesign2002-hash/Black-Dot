import firebase from 'firebase/compat/app';
import { Exhibition, ExhibitionZone, FirebaseArtwork, ExhibitionArtItem, ArtType, ZoneArtworkItem, ArtworkData } from '../types';
import { storage } from '../firebase';

/**
 * Safely parses the artwork_data field from Firebase.
 * It handles cases where artwork_data might be stored as a string (e.g., JSON string)
 * or as a direct object (Map type in Firebase).
 * Also removes comments from JSON strings before parsing.
 */
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
      console.error("Error parsing artwork_data string:", e, rawData);
      return undefined;
    }
  }

  return undefined;
};


export const processFirebaseArtworks = async (docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]): Promise<FirebaseArtwork[]> => {
    const artworksPromises = docs.map(async doc => {
        const data = doc.data();
        let fileSizeMB: number | undefined;

        // Check if artwork_file is a Firebase Storage URL before trying to get metadata
        if (data.artwork_file && typeof data.artwork_file === 'string' && data.artwork_file.includes('firebasestorage.app')) {
            try {
                const fileRef = storage.refFromURL(data.artwork_file);
                const metadata = await fileRef.getMetadata();
                fileSizeMB = metadata.size / (1024 * 1024);
            } catch (error) {
                console.warn(`Failed to get metadata for artwork file: ${data.artwork_file}`, error);
                fileSizeMB = undefined;
            }
        } else if (data.artwork_file) {
            console.warn(`Artwork file is not a Firebase Storage URL, skipping metadata fetch: ${data.artwork_file}`);
            fileSizeMB = undefined;
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
            size: data.size,
            artwork_data: parseArtworkData(data.artwork_data),
            fileSizeMB: fileSizeMB,
        };
    });

    return Promise.all(artworksPromises);
};

export const createLayoutFromZone = (zoneArtworks: ZoneArtworkItem[], allFirebaseArtworks: FirebaseArtwork[]): ExhibitionArtItem[] => {
    if (!Array.isArray(zoneArtworks) || zoneArtworks.length === 0 || allFirebaseArtworks.length === 0) {
        return [];
    }
    
    return zoneArtworks.map((item, index): ExhibitionArtItem | null => {
        const firebaseArt = allFirebaseArtworks.find(art => art.id === item.artworkId);
        if (!firebaseArt) {
            console.warn(`Artwork with ID "${item.artworkId}" from zone layout not found in master artwork collection.`);
            return null;
        }

        let itemType: ArtType = 'sculpture_base';
        let textureUrl: string | undefined = undefined;
        let aspectRatio: number | undefined = undefined;
        let artworkData: ArtworkData | undefined = undefined;
        let isMotionVideo: boolean = false;
        let isFaultyMotionVideo: boolean = false;

        switch (firebaseArt.artwork_type) {
            case 'painting':
                itemType = 'canvas_square';
                textureUrl = firebaseArt.artwork_file || firebaseArt.file;
                // Removed the check for image extensions here. TexturedWallDisplay will handle loading errors.
                aspectRatio = 1;
                break;
            case 'sculpture':
                itemType = 'sculpture_base';
                if (firebaseArt.artwork_data) {
                    artworkData = firebaseArt.artwork_data;
                }

                if (firebaseArt.artwork_file && firebaseArt.artwork_file.toLowerCase().includes('.glb')) {
                    textureUrl = firebaseArt.artwork_file;
                }
                break;
            case 'media':
            case 'motion':
                itemType = 'canvas_landscape';
                textureUrl = firebaseArt.artwork_file || firebaseArt.file; 
                aspectRatio = 16 / 9;
                if (firebaseArt.artwork_type === 'motion') {
                    isMotionVideo = true;
                    // Check if it's a GLB file used for motion, which is faulty for video display
                    if (textureUrl && textureUrl.toLowerCase().includes('.glb')) {
                        isFaultyMotionVideo = true;
                    }
                }
                break;
            case 'other':
                itemType = 'sphere_exhibit';
                break;
            default:
                itemType = 'sculpture_base';
                console.warn(`[MuseumService] createLayoutFromZone - Unknown artwork_type: "${firebaseArt.artwork_type}" for artworkID: "${item.artworkId}". Using default display.`);
                break;
        }

        return {
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
        };
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

        switch (firebaseArt.artwork_type) {
            case 'painting':
                itemType = 'canvas_square';
                textureUrl = firebaseArt.artwork_file || firebaseArt.file;
                // Removed the check for image extensions here. TexturedWallDisplay will handle loading errors.
                aspectRatio = 1;
                break;
            case 'sculpture':
                itemType = 'sculpture_base';
                if (firebaseArt.artwork_data) {
                    artworkData = firebaseArt.artwork_data;
                }

                if (firebaseArt.artwork_file && firebaseArt.artwork_file.toLowerCase().includes('.glb')) {
                    textureUrl = firebaseArt.artwork_file;
                }
                break;
            case 'media':
            case 'motion':
                itemType = 'canvas_landscape';
                textureUrl = firebaseArt.artwork_file || firebaseArt.file;
                aspectRatio = 16 / 9;
                if (firebaseArt.artwork_type === 'motion') {
                    isMotionVideo = true;
                    if (textureUrl && textureUrl.toLowerCase().includes('.glb')) {
                        isFaultyMotionVideo = true;
                    }
                }
                break;
            case 'other':
                itemType = 'sphere_exhibit';
                break;
            default:
                console.warn(`[MuseumService] createFirebaseLayout - Unknown Firebase artwork_type: "${firebaseArt.artwork_type}" for artworkID: "${firebaseArt.artworkID}". Using default display.`);
                itemType = 'sculpture_base';
                break;
        }

        layoutItems.push({
            id: `firebase_art_${firebaseArt.id}_${index}`,
            artworkId: firebaseArt.id,
            type: itemType,
            position: [startX + index * spacing, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
            textureUrl: textureUrl,
            aspectRatio: aspectRatio,
            artworkData: artworkData,
            isMotionVideo: isMotionVideo,
            isFaultyMotionVideo: isFaultyMotionVideo,
        });
    });

    return layoutItems;
};

const normalizeStatus = (statusStr: string | undefined): 'current' | 'past' | 'permanent' | 'future' => {
    const normalized = (statusStr || '').trim().toLowerCase();
    switch (normalized) {
      case 'now showing':
      case 'current':
        return 'current';
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
            admission: data.admissionPrice || data.admission || 'N/A',
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
            exhibit_artworks: exhibitArtworksList, // Ensure this is always an array
            defaultLayout: createFirebaseLayout(exhibitArtworksList, allFirebaseArtworks), // Generate defaultLayout here
            isActive: typeof data.isActive === 'boolean' ? data.isActive : false, // NEW: Read isActive field
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
            theme: data.theme || 'empty',
            exhibitionId: data.exhibitionId || '',
            artwork_selected: data.artwork_selected || [],
            lightingDesign: data.lightingDesign || {
                description: 'Default lighting.',
                defaultConfig: {
                    lightsOn: true,
                    ambientIntensity: 0.9,
                    spotlightMode: 'off',
                    manualSpotlightColor: '#ffffff',
                    colorTemperature: 5500,
                },
                recommendedPresets: [],
            },
        };
        return zone;
    });
};