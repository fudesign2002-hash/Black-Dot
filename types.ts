export type ArtType = 
  | 'canvas_portrait'
  | 'canvas_landscape'
  | 'canvas_square'
  | 'sculpture_base'
  | 'media'
  | 'motion';

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
  geometry?: ArtworkGeometry;
  material?: ArtworkMaterialConfig;
  position_offset?: [number, number, number];
  rotation_offset?: [number, number, number];
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
}

export type ExhibitionStatus = 'current' | 'past' | 'permanent' | 'future';

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
  isActive: boolean;
  dateFrom?: string;
  dateTo?: string;
  hours?: string;
  admissionPrice?: string;
  admissionLink?: string;
  venue?: string;
  supportedBy?: string;
  exhibit_poster?: string;
}

export interface ZoneArtworkItem {
  artworkId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export type FirebaseArtType = 
  | 'painting'
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
  size?: string;
  artwork_data?: ArtworkData;
  fileSizeMB?: number;
  artwork_liked?: number;
  artwork_shared?: number;
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
}