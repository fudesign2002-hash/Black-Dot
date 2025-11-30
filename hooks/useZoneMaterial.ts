import { useMemo } from 'react';

const useZoneMaterial = (zone: string, defaultColor: string, defaultRoughness: number) => {
  return useMemo(() => {
    switch (zone) {
      case 'gallery':
        return {
            color: '#888888',
            roughness: 0.8,
            metalness: 0,
            emissive: '#000000',
            emissiveIntensity: 0
        };
      case 'vibrant':
        return {
          color: defaultColor === '#1a1a1a' ? '#06b6d4' : (defaultColor === '#888888' ? '#ec4899' : '#84cc16'),
          roughness: 0.1,
          metalness: 0.1,
          emissive: defaultColor === '#1a1a1a' ? '#06b6d4' : '#ec4899',
          emissiveIntensity: 0.2
        };
      case 'glass':
        return {
            color: '#a5f3fc',
            roughness: 0,
            metalness: 0.1,
            transmission: 1,
            thickness: 1.5,
            clearcoat: 1,
            clearcoatRoughness: 0
        };
      case 'geometry':
      case 'empty':
      default:
        return {
          color: defaultColor,
          roughness: defaultRoughness,
          metalness: 0,
          emissive: '#000000',
          emissiveIntensity: 0
        };
    }
  }, [zone, defaultColor, defaultRoughness]);
};

export { useZoneMaterial };