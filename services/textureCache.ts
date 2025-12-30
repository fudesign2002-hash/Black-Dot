import * as THREE from 'three';

type CacheEntry = {
  texture: THREE.Texture;
  refCount: number;
  pinned: boolean;
  lastUsed: number;
};

const cache = new Map<string, CacheEntry>();

let maxCacheSize = 64; // default max cached textures (increase to reduce eviction thrashing)

const loader = new THREE.TextureLoader();
loader.crossOrigin = 'anonymous';

function now() { return Date.now(); }

// Track in-progress loads to dedupe concurrent requests for same URL
const inProgress = new Map<string, Promise<THREE.Texture>>();

// NEW: Callback for tracking loading progress
let onLoadingStatusChange: ((isLoading: boolean) => void) | null = null;

export function setLoadingStatusCallback(cb: (isLoading: boolean) => void) {
  onLoadingStatusChange = cb;
  cb(inProgress.size > 0);
}

function updateLoadingStatus() {
  if (onLoadingStatusChange) {
    onLoadingStatusChange(inProgress.size > 0);
  }
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  if (!url) throw new Error('No url');

  // NEW: Immediately reject video URLs to prevent them from being stuck in inProgress
  const isVideoUrl = url.includes('vimeo.com') || url.includes('youtube.com') || url.includes('youtu.be');
  if (isVideoUrl) {
    throw new Error('Cannot load video URL as texture');
  }

  const existing = cache.get(url);
  if (existing) {
    existing.lastUsed = now();
    return existing.texture;
  }

  // If a load is already in progress for this url, return the same promise
  const prog = inProgress.get(url);
  if (prog) return prog;

  // load async (store promise in inProgress to dedupe)
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(url, (t) => resolve(t), undefined, (e) => reject(e));
  }).then((tex) => {
    // after successful load, remove from inProgress and proceed
    inProgress.delete(url);
    updateLoadingStatus();
    return tex;
  }).catch((err) => { 
    inProgress.delete(url); 
    updateLoadingStatus();
    throw err; 
  });

  inProgress.set(url, promise);
  updateLoadingStatus();
  const tex = await promise;

  try {
    (tex as any).encoding = (THREE as any).sRGBEncoding || (THREE as any).sRGBEncoding;
  } catch (e) {}

  cache.set(url, { texture: tex, refCount: 0, pinned: false, lastUsed: now() });
  enforceLimit();
  return tex;
}

async function retainTexture(url?: string | null): Promise<THREE.Texture | null> {
  if (!url) return null;
  let entry = cache.get(url);
  if (!entry) {
    try {
      const tex = await loadTexture(url);
      entry = cache.get(url)!;
      // it's possible loadTexture populated cache; if not, set it now
      if (!entry) {
        cache.set(url, { texture: tex, refCount: 0, pinned: false, lastUsed: now() });
        entry = cache.get(url)!;
      }
    } catch (e) {
      return null;
    }
  }
  entry.refCount += 1;
  entry.lastUsed = now();
  return entry.texture;
}

function releaseTexture(url?: string | null) {
  if (!url) return;
  const entry = cache.get(url);
  if (!entry) return;
  entry.refCount = Math.max(0, entry.refCount - 1);
  entry.lastUsed = now();
  enforceLimit();
}

function pinTexture(url?: string | null) {
  if (!url) return;
  const entry = cache.get(url);
  if (entry) {
    entry.pinned = true;
    entry.lastUsed = now();
  } else {
    // start loading and pin when ready
    loadTexture(url).then(() => {
      const e = cache.get(url);
      if (e) e.pinned = true;
    }).catch(() => {});
  }
}

function unpinTexture(url?: string | null) {
  if (!url) return;
  const entry = cache.get(url);
  if (entry) {
    entry.pinned = false;
    entry.lastUsed = now();
    enforceLimit();
  }
}

function setMaxCacheSize(n: number) {
  maxCacheSize = Math.max(1, Math.floor(n));
  enforceLimit();
}


function enforceLimit() {
  if (cache.size <= maxCacheSize) return;
  // Build array of candidates that are not pinned and refCount == 0
  const candidates: Array<[string, CacheEntry]> = [];
  cache.forEach((v, k) => {
    if (!v.pinned && v.refCount === 0) candidates.push([k, v]);
  });
  if (candidates.length === 0) return;
  candidates.sort((a, b) => a[1].lastUsed - b[1].lastUsed); // LRU
  const toEvict = Math.min(candidates.length, cache.size - maxCacheSize);
  for (let i = 0; i < toEvict; i++) {
    const [k, v] = candidates[i];
    try { v.texture.dispose(); } catch (e) {}
    cache.delete(k);
  }
}

function clearCache() {
  cache.forEach((v) => { try { v.texture.dispose(); } catch (e) {} });
  cache.clear();
}

export default {
  retainTexture,
  releaseTexture,
  pinTexture,
  unpinTexture,
  setMaxCacheSize,
  clearCache,
  loadTexture,
  setLoadingStatusCallback,
};
