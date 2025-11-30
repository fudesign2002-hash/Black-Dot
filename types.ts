

export type ArtType = 
  | 'canvas_portrait'
  | 'canvas_landscape'
  | 'canvas_square'
  | 'sculpture_base'
  | 'sphere_exhibit';

// --- DATABASE TYPES ---

// FIX: Added the missing `Artwork` type, which is used for the static master collection data.
export interface Artwork {
  id: string; // A unique identifier for the artwork model, e.g., 'zen_stack'
  type: ArtType; // The visual representation type for the renderer
  title: string;
  defaultScale: number;
}

// New interfaces for artwork_data structure
export interface ArtworkGeometry {
  args: number[];
  type: 'boxGeometry' | 'cylinderGeometry' | 'icosahedronGeometry' | 'torusGeometry' | 'torusKnotGeometry' | 'sphereGeometry' | 'cone'; // Changed from 'coneGeometry' to 'cone'
}

export interface ArtworkMaterialConfig {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  side?: 'front' | 'back' | 'double'; // Maps to THREE.FrontSide, THREE.BackSide, THREE.DoubleSide
  transparent?: boolean;
  opacity?: number;
  transmission?: number;
  thickness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

export interface ArtworkData {
  geometry: ArtworkGeometry;
  material: ArtworkMaterialConfig | null; // Changed from materialConfig to material, now can be null for default
  position_offset?: [number, number, number]; // Changed from positionOffset to position_offset
  rotation_offset?: [number, number, number]; // NEW: Added rotation_offset for GLB rotation correction
}

// Represents a single artwork document from the Firebase 'artworks' collection.
export interface FirebaseArtwork {
  id: string; // Firestore document ID
  artworkID: string;
  artwork_type: string; // e.g., 'painting', 'sculpture', 'media'
  title: string;
  artist?: string; // NEW: Added artist field for individual artwork
  file?: string; // URL for paintings/media (original field, now for images)
  artwork_file?: string; // NEW: Specific field for motion/video files
  digitalSize?: string;
  materials?: string;
  size?: string;
  artwork_data?: ArtworkData; // NEW: Added artwork_data field for custom 3D models
  fileSizeMB?: number; // NEW: Added fileSizeMB to store the file size in MB
}


// Simplified Lighting Config for Zones (removes main light specifics)
export interface SimplifiedLightingConfig {
  lightsOn: boolean;
  ambientIntensity: number;
  spotlightMode: 'auto' | 'manual' | 'off';
  manualSpotlightColor: string;
  colorTemperature: number; // in Kelvin
}

// Simplified Lighting Preset for Zones
export interface SimplifiedLightingPreset {
  name: string;
  ambientIntensity: number;
  colorTemperature: number;
  manualSpotlightColor: string;
}

// Full lighting design for a zone
export interface ZoneLightingDesign {
  description: string;
  defaultConfig: SimplifiedLightingConfig;
  recommendedPresets: SimplifiedLightingPreset[];
}

// Represents a curated exhibition, defining its theme, content, and default presentation.
// This is the primary data model, populated from Firebase.
export interface Exhibition {
  id: string; // e.g., 'silent_geometry_2025'
  status: 'past' | 'current' | 'permanent' | 'future';
  tags: string[];
  posterColor: string;
  defaultLayout: ExhibitionArtItem[];
  title: string;
  subtitle: string;
  artist: string;
  dates: string; 
  overview: string;
  admission: string; 
  dateFrom?: string;
  dateTo?: string;
  hours?: string; 
  admissionPrice?: string; 
  admissionLink?: string; 
  venue?: string; 
  supportedBy?: string; 
  exhibit_artworks?: string[];
}

// Represents the layout data for a single artwork as stored in a Zone document.
export interface ZoneArtworkItem {
  artworkId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

// Represents a museum zone/room, its theme, and what exhibition it's currently hosting.
// FIX: Added the missing `ExhibitionZone` type, which is used for the static master collection data.
export interface ExhibitionZone { // Added 'export' keyword
  id: string; // e.g., 'zone_main_gallery'
  name: string;
  theme: 'geometry' | 'gallery' | 'vibrant' | 'glass' | 'empty';
  exhibitionId: string; // The ID of the exhibition currently displayed in this zone
  artwork_selected?: ZoneArtworkItem[]; // Optional: For overriding default exhibition layout
  lightingDesign: ZoneLightingDesign;
}

// --- LIVE CURATION / PRESENTATION TYPES ---

// Represents an instance of an Artwork placed within an exhibition layout.
// This is what is stored in layouts and passed to the renderer.
export interface ExhibitionArtItem {
  id: string; // A unique ID for this specific instance in the layout, e.g., 'p1' or 'canvas_12345'
  artworkId: string; // The ID of the Artwork from the master collection
  type: ArtType; // Duplicated from Artwork for easy rendering
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  textureUrl?: string;
  aspectRatio?: number; // Added for explicit aspect ratio for textures
  artworkData?: ArtworkData; // NEW: Added artworkData for custom 3D models
  isMotionVideo?: boolean; // NEW: Flag to indicate if the textureUrl is a video
  isFaultyMotionVideo?: boolean; // NEW: Flag for motion videos with .glb in URL
}

// NEW: Interface for artwork dimensions returned by TexturedWallDisplay
export interface ArtworkDimensions {
  artworkRenderWidth: number;
  artworkRenderHeight: number;
  artworkSurfaceZ: number;
  artworkCenterY: number;
}

// NEW: Interface for Material Presets
export interface MaterialPreset {
  id: string; // e.g., 'original', 'matte_black', 'stainless_steel', 'ceramic'
  name: string;
  iconColor: string; // For the circular icon swatch
  config: ArtworkMaterialConfig | null; // null for 'original' to unset material override
}