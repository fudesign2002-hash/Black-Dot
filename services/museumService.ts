



import firebase from 'firebase/compat/app';
import { Exhibition, ExhibitionZone, FirebaseArtwork, ExhibitionArtItem, ArtType, ZoneArtworkItem, ArtworkData } from '../types';
import { storage } from '../firebase'; // Import storage

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

  // If it's already an object (and not an array), return it directly
  if (typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
    return rawData as ArtworkData;
  }

  // If it's a string, attempt to parse it as JSON
  if (typeof rawData === 'string') {
    try {
      // Remove C-style single-line comments before parsing
      // This regex looks for '//' followed by any characters to the end of the line, globally.
      const cleanedString = rawData.replace(/\/\/.*$/gm, '');
      const parsed = JSON.parse(cleanedString);
      return parsed as ArtworkData;
    } catch (e) {
      console.error("Error parsing artwork_data string:", e, rawData);
      return undefined;
    }
  }

  // If it's neither an object nor a string (or null), return undefined
  return undefined;
};


export const processFirebaseArtworks = async (docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]): Promise<FirebaseArtwork[]> => {
    const artworksPromises = docs.map(async doc => {
        const data = doc.data();
        let fileSizeMB: number | undefined;

        // Fetch file size if artwork_file exists
        if (data.artwork_file) {
            try {
                const fileRef = storage.refFromURL(data.artwork_file);
                const metadata = await fileRef.getMetadata();
                fileSizeMB = metadata.size / (1024 * 1024); // Convert bytes to MB
            } catch (error) {
                console.warn(`Failed to get metadata for artwork file: ${data.artwork_file}`, error);
                fileSizeMB = undefined;
            }
        }

        return {
            id: doc.id,
            artworkID: data.artworkID || '',
            artwork_type: data.artwork_type || 'unknown',
            title: data.title || 'Untitled Artwork',
            artist: data.artist || undefined, // NEW: Extract artist field
            file: data.file,
            artwork_file: data.artwork_file, // NEW: Extract artwork_file field
            digitalSize: data.digitalSize,
            materials: data.materials,
            size: data.size,
            artwork_data: parseArtworkData(data.artwork_data), // UPDATED: Use parseArtworkData helper
            fileSizeMB: fileSizeMB, // NEW: Assign the calculated file size
        };
    });

    return Promise.all(artworksPromises);
};

// --- NEW ---
// This function takes a saved layout from a zone and enriches it with the necessary
// renderable data (like 'type' and 'textureUrl') from the master artwork list.
export const createLayoutFromZone = (zoneArtworks: ZoneArtworkItem[], allFirebaseArtworks: FirebaseArtwork[]): ExhibitionArtItem[] => {
    if (!Array.isArray(zoneArtworks) || zoneArtworks.length === 0 || allFirebaseArtworks.length === 0) {
        return [];
    }
    
    // FIX: Add explicit return type to map callback to prevent incorrect type narrowing.
    // This ensures the type predicate `item is ExhibitionArtItem` in the filter is valid.
    return zoneArtworks.map((item, index): ExhibitionArtItem | null => {
        const firebaseArt = allFirebaseArtworks.find(art => art.id === item.artworkId);
        if (!firebaseArt) {
            console.warn(`Artwork with ID "${item.artworkId}" from zone layout not found in master artwork collection.`);
            return null;
        }

        let itemType: ArtType = 'sculpture_base'; // Default fallback
        let textureUrl: string | undefined = undefined;
        let aspectRatio: number | undefined = undefined; // Added aspectRatio
        let artworkData: ArtworkData | undefined = undefined; // NEW: Artwork data for 3D models
        let isMotionVideo: boolean = false; // NEW: Initialize video flag
        let isFaultyMotionVideo: boolean = false; // NEW: Initialize faulty video flag

        switch (firebaseArt.artwork_type) {
            case 'painting':
                itemType = 'canvas_square'; // Default to square if no specific orientation info
                textureUrl = firebaseArt.artwork_file || firebaseArt.file; // UPDATED: Use artwork_file for painting
                aspectRatio = 1; // Default to 1:1 for square canvas
                break;
            case 'sculpture':
                itemType = 'sculpture_base'; // Map to sculpture_base for custom 3D rendering
                // Always try to get artworkData if it exists
                if (firebaseArt.artwork_data) {
                    artworkData = firebaseArt.artwork_data; // Pass artwork_data
                }

                // Check for GLB file, this sets textureUrl
                if (firebaseArt.artwork_file && firebaseArt.artwork_file.toLowerCase().includes('.glb')) {
                    textureUrl = firebaseArt.artwork_file;
                }
                break;
            case 'media':
            case 'motion': // Handle 'motion' type for video playback
                itemType = 'canvas_landscape'; // Default to landscape for media/motion
                // FIX: Use artwork_file for video URLs
                textureUrl = firebaseArt.artwork_file || firebaseArt.file; 
                aspectRatio = 16 / 9; // Common for video/media
                if (firebaseArt.artwork_type === 'motion') {
                    isMotionVideo = true; // Set flag for motion video
                    // NEW: Check if motion video URL contains '.glb'
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
            aspectRatio: aspectRatio, // Assign aspectRatio
            artworkData: artworkData, // NEW: Assign artworkData
            isMotionVideo: isMotionVideo, // NEW: Assign motion video flag
            isFaultyMotionVideo: isFaultyMotionVideo, // NEW: Assign faulty video flag
        };
    }).filter((item): item is ExhibitionArtItem => item !== null);
};


const createFirebaseLayout = (artworkIds: string[], allFirebaseArtworks: FirebaseArtwork[]): ExhibitionArtItem[] => {
    if (!Array.isArray(artworkIds) || artworkIds.length === 0 || allFirebaseArtworks.length === 0) {
        return [];
    }

    const layoutItems: ExhibitionArtItem[] = [];
    // FIX: The `exhibit_artworks` array in Firestore likely contains document IDs, not custom artworkID fields.
    // Changed the lookup from `art.artworkID` to `art.id` to correctly find the artwork documents.
    const foundArtworks = artworkIds.map(id => allFirebaseArtworks.find(art => art.id === id)).filter(Boolean) as FirebaseArtwork[];

    const totalArtworks = foundArtworks.length;
    const spacing = 10;
    const startX = -((totalArtworks - 1) * spacing) / 2;

    foundArtworks.forEach((firebaseArt, index) => {
        let itemType: ArtType = 'canvas_square';
        let textureUrl: string | undefined = undefined;
        let aspectRatio: number | undefined = undefined; // Added aspectRatio
        let artworkData: ArtworkData | undefined = undefined; // NEW: Artwork data for 3D models
        let isMotionVideo: boolean = false; // NEW: Initialize video flag
        let isFaultyMotionVideo: boolean = false; // NEW: Initialize faulty video flag

        switch (firebaseArt.artwork_type) {
            case 'painting':
                itemType = 'canvas_square'; // Default to square for paintings
                textureUrl = firebaseArt.artwork_file || firebaseArt.file; // UPDATED: Use artwork_file for painting
                aspectRatio = 1; // Default to 1:1 for square canvas
                break;
            case 'sculpture':
                itemType = 'sculpture_base'; // Map to sculpture_base for custom 3D rendering
                // Always try to get artworkData if it exists
                if (firebaseArt.artwork_data) {
                    artworkData = firebaseArt.artwork_data; // Pass artwork_data
                }

                // Check for GLB file, this sets textureUrl
                if (firebaseArt.artwork_file && firebaseArt.artwork_file.toLowerCase().includes('.glb')) {
                    textureUrl = firebaseArt.artwork_file;
                }
                break;
            case 'media':
            case 'motion': // Handle 'motion' type for video playback
                itemType = 'canvas_landscape';
                // FIX: Use artwork_file for video URLs
                textureUrl = firebaseArt.artwork_file || firebaseArt.file;
                aspectRatio = 16 / 9; // Common for video/media
                if (firebaseArt.artwork_type === 'motion') {
                    isMotionVideo = true; // Set flag for motion video
                    // NEW: Check if motion video URL contains '.glb'
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
                itemType = 'sculpture_base'; // Fallback to a visible object instead of a wall
                break;
        }

        layoutItems.push({
            id: `firebase_art_${firebaseArt.id}_${index}`, // Use doc ID for unique key
            artworkId: firebaseArt.id, // FIX: Always use the unique Firestore document ID for consistency.
            type: itemType,
            position: [startX + index * spacing, 0, 0],
            rotation: [0, 0, 0],
            scale: 1,
            textureUrl: textureUrl,
            aspectRatio: aspectRatio, // Assign aspectRatio
            artworkData: artworkData, // NEW: Assign artworkData
            isMotionVideo: isMotionVideo, // NEW: Assign motion video flag
            isFaultyMotionVideo: isFaultyMotionVideo, // NEW: Assign faulty video flag
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
            exhibit_artworks: exhibitArtworksList,
            defaultLayout: createFirebaseLayout(exhibitArtworksList, allFirebaseArtworks),
        };
        return exhibition;
    });
};

export const processFirebaseZones = (docs: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[]): ExhibitionZone[] => {
    return docs.map(doc => {
        const data = doc.data();
        const zone: ExhibitionZone = {
            id: doc.id,
            name: data.name || 'Unnamed Zone',
            theme: data.theme || 'empty',
            exhibitionId: data.exhibitionId || '',
            artwork_selected: Array.isArray(data.artwork_selected) ? data.artwork_selected : undefined,
            lightingDesign: {
                description: data.lightingDesign?.description || 'Standard lighting.',
                defaultConfig: {
                    lightsOn: data.lightingDesign?.defaultConfig?.lightsOn ?? true,
                    ambientIntensity: data.lightingDesign?.defaultConfig?.ambientIntensity ?? 0.5,
                    spotlightMode: data.lightingDesign?.defaultConfig?.spotlightMode ?? 'off',
                    manualSpotlightColor: data.lightingDesign?.defaultConfig?.manualSpotlightColor ?? '#ffffff',
                    colorTemperature: data.lightingDesign?.defaultConfig?.colorTemperature ?? 5500,
                },
                recommendedPresets: Array.isArray(data.lightingDesign?.recommendedPresets) 
                    ? data.lightingDesign.recommendedPresets 
                    : [],
            },
        };
        return zone;
    });
};