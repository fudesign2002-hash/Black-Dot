

export type ArtType = 
  | 'canvas_portrait'
  | 'canvas_landscape'
  | 'canvas_square'
  | 'sculpture_base'
  | 'sphere_exhibit';

export interface Artwork {
  id: string;
  type: ArtType;
  title: string;
  defaultScale: number;
}

export interface ArtworkGeometry {
  args: number[];
  type: 'boxGeometry' | 'cylinderGeometry' | 'icosahedronGeometry' | 'torusGeometry' | 'torusKnotGeometry' | 'sphereGeometry' | 'cone';
}

export interface ArtworkMaterialConfig {
  color: string;
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
  geometry: ArtworkGeometry;
  material: ArtworkMaterialConfig | null;
  position_offset?: [number, number, number];
  rotation_offset?: [number, number, number];
}

export interface FirebaseArtwork {
  id: string;
  artworkID: string;
  artwork_type: string;
  title: string;
  artist?: string;
  file?: string;
  artwork_file?: string;
  digitalSize?: string;
  materials?: string;
  size?: string;
  artwork_data?: ArtworkData;
  fileSizeMB?: number;
}


export interface SimplifiedLightingConfig {
  lightsOn: boolean;
  ambientIntensity: number;
  spotlightMode: 'auto' | 'manual' | 'off';
  manualSpotlightColor: string;
  colorTemperature: number;
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

export interface Exhibition {
  id: string;
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
  isActive?: boolean;
}

export interface ZoneArtworkItem {
  artworkId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface ExhibitionZone {
  id: string;
  name: string;
  theme: 'geometry' | 'gallery' | 'vibrant' | 'glass' | 'empty';
  exhibitionId: string;
  artwork_selected?: ZoneArtworkItem[];
  lightingDesign: ZoneLightingDesign;
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
  isDirectVideoFile?: boolean; // NEW: Add isDirectVideoFile
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