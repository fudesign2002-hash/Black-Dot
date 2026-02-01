
export type ArtType = 
  | 'canvas_portrait'
  | 'canvas_landscape'
  | 'canvas_square'
  | 'sculpture_base'
  | 'media'
  | 'motion'
  | 'text_3d';

export interface Artwork {
  id: string;
  type: ArtType;
  title: string;
  defaultScale: number;
}

export type SpotlightMode = 'auto' | 'manual' | 'off';

export interface SimplifiedLightingConfig {
  lightsOn: boolean;
  ambientIntensity: number;
  spotlightMode: SpotlightMode;
  manualSpotlightColor: string;
  colorTemperature: number;
  keyLightPosition: [number, number, number];
  fillLightPosition: [number, number, number];
  customCameraPosition?: [number, number, number]; // NEW: Add customCameraPosition
  customCameraTarget?: [number, number, number]; // NEW: Add customCameraTarget
  useExhibitionBackground?: boolean; // NEW: Add toggle for exhibition background
  floorColor?: string; // NEW: Add floorColor for custom background
  backgroundColor?: string; // NEW: Add backgroundColor for scene background
}

export interface ArtworkGeometry {
  type: 'boxGeometry' | 'sphereGeometry' | 'cylinderGeometry' | 'icosahedronGeometry' | 'torusGeometry' | 'torusKnotGeometry' | 'coneGeometry' | string;
  args?: number[];
}

export interface ArtworkMaterialConfig {
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  side?: 'front' | 'back' | 'double';
  transparent?: boolean;
  opacity?: number;
  transmission?: number;
  thickness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

export interface ArtworkData {
  text?: string; // NEW: 3D text content
  font?: string; // NEW: 3D text font path
  geometry?: ArtworkGeometry;
  material?: ArtworkMaterialConfig;
  material_per_zone?: Record<string, ArtworkMaterialConfig>; // NEW: Zone-specific materials
  position_offset?: [number, number, number];
  rotation_offset?: [number, number, number];
  scale_offset?: number; // NEW: Add scale_offset
  scale_offset_per_zone?: Record<string, number>; // NEW: Zone-specific scale offsets
}

export interface ExhibitionArtItem {
  id: string;
  artworkId: string;
  type: ArtType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  textureUrl?: string;
  aspectRatio?: number;
  artworkData?: ArtworkData;
  isMotionVideo?: boolean;
  isFaultyMotionVideo?: boolean;
  originalPosition?: [number, number, number];
  originalRotation?: [number, number, number];
  displayLikes?: number | null;
  artworkGravity?: number; // NEW: Add artworkGravity for zero gravity mode
  source_artwork_type?: FirebaseArtType | 'unknown';
}

export type ExhibitionStatus = 'now showing' | 'past' | 'permanent' | 'future';

export interface Exhibition {
  id: string;
  title: string;
  subtitle: string;
  artist: string;
  dates: string;
  overview: string;
  admission: string;
  status: ExhibitionStatus;
  tags: string[];
  posterColor: string;
  defaultLayout: ExhibitionArtItem[];
  exhibit_artworks: string[];
  isPublic: boolean;
  dateFrom?: string;
  dateTo?: string;
  hours?: string;
  admissionPrice?: string;
  admissionLink?: string;
  venue?: string;
  supportedBy?: string;
  exhibit_poster?: string;
  exhibit_background?: string; // NEW: Add exhibit_background property
  exhibit_viewed?: number; // NEW: Add exhibit_viewed
  exhibit_liked?: number; // NEW: Add exhibit_liked
  exhibit_capacity?: number; // NEW: Add exhibit_capacity
  exhibit_bg_music?: string; // NEW: Add exhibit_bg_music
  exhibit_linktype?: 'tickets' | 'learn_more' | 'instagram' | 'website'; // NEW: Add exhibit_linktype
  exhibit_dashboard_public?: boolean; // NEW: Add toggle for public dashboard access
  isShowcase?: boolean; // NEW: Add isShowcase
  ownerId?: string; // NEW: Add ownerId to track exhibition ownership
}

export interface ZoneArtworkItem {
  artworkId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  type?: ArtType; // NEW: Explicit type for non-artwork items (like text)
  artworkData?: ArtworkData; // NEW: Data for non-artwork items
}

export type FirebaseArtType = 
  | 'painting'
  | 'photography'
  | 'sculpture'
  | 'media'
  | 'motion';

export interface FirebaseArtwork {
  id: string;
  artworkID?: string;
  artwork_type: FirebaseArtType | 'unknown';
  title: string;
  artist?: string;
  file?: string;
  artwork_file?: string;
  digitalSize?: string;
  materials?: string;
  artwork_medium?: string;
  artwork_date?: string;
  artwork_dimensions?: string;
  size?: string;
  artwork_data?: ArtworkData;
  fileSizeMB?: number;
  artwork_liked?: number;
  artwork_shared?: number;
  artwork_gravity?: number; // NEW: Add artwork_gravity for zero gravity mode
  artwork_viewed?: number;
  artwork_poster?: string; // NEW: Add artwork_poster for artwork-specific posters
  ownerId?: string; // NEW: Add ownerId to track artwork ownership
}

export interface SimplifiedLightingPreset {
  name: string;
  ambientIntensity: number;
  colorTemperature: number;
  manualSpotlightColor: string;
}

export interface ZoneLightingDesign {
  description: string;
  defaultConfig: SimplifiedLightingConfig;
  recommendedPresets: SimplifiedLightingPreset[];
}

export interface ArtworkDimensions {
  artworkRenderWidth: number;
  artworkRenderHeight: number;
  artworkSurfaceZ: number;
  artworkCenterY: number;
}

export interface MaterialPreset {
  id: string;
  name: string;
  iconColor: string;
  config: ArtworkMaterialConfig | null;
}

export interface ExhibitionZone {
  id: string;
  name: string;
  lightingDesign: ZoneLightingDesign;
  exhibitionId: string;
  artwork_selected: ZoneArtworkItem[];
  zone_capacity: number;
  zone_theme?: string; // NEW: Add zone_theme to store the active effect name
  zone_gravity?: number; // NEW: Add zone_gravity for zero gravity mode
}

// NEW: Define the structure for the dynamically loaded EffectRegistry
export interface EffectRegistryType {
  [key: string]: {
    creator: (dependencies: {
      THREE: any; // Using 'any' for THREE to avoid complex type imports here
      scene: any; // NEW: Pass scene for effects that need to modify fog or other scene properties
      SCENE_WIDTH: number;
      SCENE_HEIGHT: number;
      SCENE_DEPTH: number;
      clock: any; // Using 'any' for clock
    }) => any; // The creator function returns a THREE.Group or similar
    icon: string; // NEW: Add icon property for effect themes
    env: { background: number; ambient: number; light?: 'on' | 'off'; }; // Environment settings, NEW: Add light property
  };
}
