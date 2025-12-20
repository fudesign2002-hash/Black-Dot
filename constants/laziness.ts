export type LazinessLevel = 'low' | 'med' | 'high';

export interface LazinessSettings {
  level: LazinessLevel;
  maxCacheSize: number; // textures
  cachePinThreshold: number; // scene pin threshold
  neighborPreloadRadius: number; // how many neighbor items to preload on focus
  preloadLazyModules: boolean; // whether to aggressively preload React.lazy modules
}

const DEFAULT_LEVEL: LazinessLevel = 'high';

function detectLevelFromEnv(): LazinessLevel {
  try {
    if (typeof window !== 'undefined') {
      const win = window as any;
      const v = win.__LAZINESS_LEVEL__ || window.localStorage.getItem('laziness');
      if (v === 'low' || v === 'med' || v === 'high') return v;
    }
  } catch (e) {}
  return DEFAULT_LEVEL;
}

export function getLazinessLevel(): LazinessLevel {
  return detectLevelFromEnv();
}

export function getLazinessSettings(levelArg?: LazinessLevel): LazinessSettings {
  const level = levelArg || getLazinessLevel();
  if (level === 'low') {
    return { level, maxCacheSize: 12, cachePinThreshold: 6, neighborPreloadRadius: 1, preloadLazyModules: false };
  }
  if (level === 'high') {
    return { level, maxCacheSize: 64, cachePinThreshold: 999, neighborPreloadRadius: 4, preloadLazyModules: true };
  }
  // med
  return { level, maxCacheSize: 36, cachePinThreshold: 18, neighborPreloadRadius: 2, preloadLazyModules: true };
}

export function setLazinessLevel(level: LazinessLevel) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('laziness', level);
      (window as any).__LAZINESS_LEVEL__ = level;
    }
  } catch (e) {}
}

export default getLazinessSettings();
