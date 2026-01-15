


import React, { useMemo, useState, useEffect, Suspense, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { ArtworkDimensions, ArtType } from '../../../types';
import textureCache from '../../../services/textureCache';

// NEW: Pre-allocate unit geometries for reuse across all instances to reduce memory pressure
const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
const unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
const unitSphereGeo = new THREE.SphereGeometry(1, 8, 8);
const unitCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 12);

interface TexturedWallDisplayProps {
  textureUrl?: string;
  mapTexture: THREE.Texture | THREE.VideoTexture | null;
  maxDimension?: number;
  orientation?: 'portrait' | 'landscape' | 'square';
  aspectRatio?: number;
  isPainting?: boolean;
  onDimensionsCalculated?: (width: number, height: number, artworkSurfaceZ: number, artworkCenterY: number) => void;
  isFocused: boolean;
  lightsOn: boolean;
  artworkType?: ArtType;
  sourceArtworkType?: string;
  artworkData?: any;
}

const TexturedWallDisplay: React.FC<TexturedWallDisplayProps> = ({ textureUrl, mapTexture, maxDimension = 5.0, orientation, aspectRatio, isPainting, onDimensionsCalculated, isFocused, lightsOn, artworkType, sourceArtworkType, artworkData }) => {
  const [isInternalLoadingError, setIsInternalLoadingError] = useState(false);
  const [imageTexture, setImageTexture] = useState<THREE.Texture | null>(null);

  // Safe texture loading using TextureLoader with explicit error handling to avoid
  // throwing inside the render tree (which would crash the <Canvas> if uncaught).
  useEffect(() => {
    let mounted = true;
    // Release previous retained texture if any
    let prevUrl: string | null = null;
    let prevTexture = imageTexture;
    if (prevTexture) {
      // we don't dispose directly; rely on cache release
      prevUrl = (prevTexture as any).__cachedUrl || null;
      setImageTexture(null);
    }

    // NEW: Skip loading if it's a video URL (Vimeo/YouTube) to avoid CORS errors
    const isVideoUrl = textureUrl?.includes('vimeo.com') || textureUrl?.includes('youtube.com') || textureUrl?.includes('youtu.be');

    if (mapTexture || !textureUrl || isVideoUrl) {
      setIsInternalLoadingError(false);
      return () => { mounted = false; };
    }

    // Use global texture cache to load/retain textures so we can control eviction
    let cancelled = false;
      (async () => {
        try {
          const tex = await textureCache.retainTexture(textureUrl as string);
          if (!mounted || cancelled) {
            if (tex) textureCache.releaseTexture(textureUrl as string);
            return;
          }
          if (tex) {
            try { (tex as any).__cachedUrl = textureUrl; } catch (e) {}
            setImageTexture(tex);
            setIsInternalLoadingError(false);
          }
        } catch (err) {
          if (!mounted) return;
          setIsInternalLoadingError(true);
        }
      })();

    return () => {
      mounted = false;
      cancelled = true;
      if (textureUrl) {
        (async () => { try { textureCache.releaseTexture(textureUrl as string); } catch (e) {} })();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textureUrl, mapTexture]);
  
  const finalMapTexture = useMemo(() => {
    if (mapTexture) return mapTexture;
    if (imageTexture) return imageTexture;
    return null;
  }, [mapTexture, imageTexture]);

  const tmpColor = useRef(new THREE.Color());

  // Apply material overrides from artworkData when provided
  useEffect(() => {
    const matCfg = (artworkData && (artworkData as any).material) || ({} as any);
    // painting material
    if (paintingMaterialRef.current) {
      try {
        const m = paintingMaterialRef.current;
        if (matCfg.color) m.color.set(matCfg.color);
        if (typeof matCfg.roughness === 'number') m.roughness = matCfg.roughness;
        if (typeof matCfg.metalness === 'number') m.metalness = matCfg.metalness;
        if (matCfg.emissive) {
          if (!m.emissive) m.emissive = new THREE.Color();
          m.emissive.set(matCfg.emissive);
        }
        if (typeof matCfg.emissiveIntensity === 'number') m.emissiveIntensity = matCfg.emissiveIntensity;
        if (typeof matCfg.opacity === 'number') { m.opacity = matCfg.opacity; m.transparent = matCfg.opacity < 0.999; }
        if (typeof (m as any).needsUpdate !== 'undefined') (m as any).needsUpdate = true;
      } catch (e) {}
    }
    if (artworkMaterialRef.current) {
      try {
        const m = artworkMaterialRef.current;
        if (matCfg.color) m.color.set(matCfg.color);
        if (typeof matCfg.roughness === 'number') m.roughness = matCfg.roughness;
        if (typeof matCfg.metalness === 'number') m.metalness = matCfg.metalness;
        if (matCfg.emissive) {
          if (!m.emissive) m.emissive = new THREE.Color();
          m.emissive.set(matCfg.emissive);
        }
        if (typeof matCfg.emissiveIntensity === 'number') m.emissiveIntensity = matCfg.emissiveIntensity;
        if (typeof matCfg.opacity === 'number') { m.opacity = matCfg.opacity; m.transparent = matCfg.opacity < 0.999; }
        if (typeof (m as any).needsUpdate !== 'undefined') (m as any).needsUpdate = true;
      } catch (e) {}
    }
  }, [artworkData]);

  const artworkMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const paintingMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    setIsInternalLoadingError(false);
  }, [textureUrl, mapTexture]);
  
  const MAX_ART_DIMENSION = maxDimension;
  const WALL_BORDER_WIDTH = 2.0;
  const ARTWORK_MAT_WIDTH = 0.25;
  const FRAME_VISUAL_DEPTH = 0.1;
  const ARTWORK_RECESS_INTO_FRAME = 0.02;
  const MIN_WALL_HEIGHT = 2.0; 
  const MIN_WALL_WIDTH = 2.0;

  const artworkFrameDepth = isPainting ? 0 : FRAME_VISUAL_DEPTH;

  const [artWidth, artHeight, wallWidth, wallHeight, artGroupY, artSurfaceZ] = useMemo(() => {
    let calculatedAspect = 1;

    if (aspectRatio !== undefined && aspectRatio !== null) {
      calculatedAspect = aspectRatio;
    } 
    else if (finalMapTexture) {
      if (finalMapTexture instanceof THREE.VideoTexture && finalMapTexture.image) {
        const video = finalMapTexture.image;
        if (video instanceof HTMLVideoElement && video.videoWidth > 0 && video.videoHeight > 0) {
          calculatedAspect = video.videoWidth / video.videoHeight;
        }
      } else if (finalMapTexture instanceof THREE.Texture && finalMapTexture.image) {
        const image = finalMapTexture.image;
        if (image instanceof HTMLImageElement && image.width > 0 && image.height > 0) {
          calculatedAspect = image.width / image.height;
        } else if (
          typeof image === 'object' &&
          image !== null &&
          'width' in image &&
          typeof (image as any).width === 'number' &&
          (image as any).width > 0 &&
          'height' in image &&
          typeof (image as any).height === 'number' &&
          (image as any).height > 0
        ) {
          calculatedAspect = (image as { width: number; height: number }).width / (image as { height: number; width: number }).height;
        }
      }
    } 
    else if (orientation) {
      switch(orientation) {
          case 'portrait':
              calculatedAspect = 3 / 4;
              break;
          case 'landscape':
              calculatedAspect = 16 / 9;
              break;
          case 'square':
          default:
              calculatedAspect = 1;
              break;
      }
    }

    let artWidth, artHeight;
    if (calculatedAspect >= 1) {
      artWidth = MAX_ART_DIMENSION;
      artHeight = artWidth / calculatedAspect;
    } else {
      artHeight = MAX_ART_DIMENSION;
      artWidth = artHeight * calculatedAspect;
    }
    
    const desiredWallWidth = artWidth + (ARTWORK_MAT_WIDTH * 2) + (WALL_BORDER_WIDTH * 2);
    const desiredWallHeight = artHeight + (ARTWORK_MAT_WIDTH * 2) + (WALL_BORDER_WIDTH * 2);

    const finalWallWidth = Math.max(MIN_WALL_WIDTH, desiredWallWidth);
    const finalWallHeight = Math.max(MIN_WALL_HEIGHT, desiredWallHeight);

    const wallBackingDepth = 0.4;
    const artGroupY = finalWallHeight * 0.55;
    const artSurfaceZ = wallBackingDepth + artworkFrameDepth - ARTWORK_RECESS_INTO_FRAME;

    
    return [
        artWidth, artHeight,
        finalWallWidth, finalWallHeight,
        artGroupY, artSurfaceZ
    ];
  }, [aspectRatio, finalMapTexture, MAX_ART_DIMENSION, orientation, isPainting, artworkFrameDepth]);

  useEffect(() => {
    if (onDimensionsCalculated) {
      onDimensionsCalculated(artWidth, artHeight, artSurfaceZ, artGroupY);
    }
  }, [artWidth, artHeight, artSurfaceZ, artGroupY, onDimensionsCalculated, finalMapTexture]);

  const matWidth = artWidth + ARTWORK_MAT_WIDTH * 2;
  const matHeight = artHeight + ARTWORK_MAT_WIDTH * 2;
  const matDepth = artworkFrameDepth;

  const wallBackingDepth = 0.4;

  // Allow a thinner backing for photography so cables sit visibly behind a thinner wall
  const effectiveWallBackingDepth = sourceArtworkType === 'photography' ? 0.18 : wallBackingDepth;
  const effectiveArtSurfaceZ = effectiveWallBackingDepth + artworkFrameDepth - ARTWORK_RECESS_INTO_FRAME;
  const CABLE_Z_OFFSET = 0; // how far behind the artwork surface the cables sit for photography (reduced to move cables forward)

  const PAINTING_RED_PLANE_MARGIN = 0.5;
  const PAINTING_FRAME_THICKNESS = 0.05;
  const PAINTING_FRAME_COLOR = '#000000';
  const PAINTING_FRAME_MARGIN = 0.05;

  const [redPlaneWidth, redPlaneHeight, frameWidth, frameHeight] = useMemo(() => {
    const rpWidth = wallWidth - (2 * PAINTING_RED_PLANE_MARGIN);
    const rpHeight = wallHeight - (2 * PAINTING_RED_PLANE_MARGIN);
    const fWidth = rpWidth + (2 * PAINTING_FRAME_MARGIN);
    const fHeight = rpHeight + (2 * PAINTING_FRAME_MARGIN);
    return [rpWidth, rpHeight, fWidth, fHeight];
  }, [wallWidth, wallHeight]);

  // Hanging line visual parameters
  const HANG_LINE_HEIGHT = 24; // extended taller to make cables reach higher
  const HANG_LINE_THICKNESS = 0.006; // make cables thinner
  const HANG_LINE_COLOR = '#374151'; // dark gray
  const HANG_LINE_FADE_SEGMENTS = 8; // number of stacked segments for a smooth fade-out

  if (isInternalLoadingError || (!finalMapTexture && textureUrl)) {
    return (
      <group>
        {isPainting ? (
            <React.Fragment>
                {/* FIX: Use array for position and hex for color, and args prop for geometry */}
                {/* MODIFIED: Remove castShadow from frame to optimize shadow map performance */}
                <mesh position={[0, wallHeight / 2, wallBackingDepth + (PAINTING_FRAME_THICKNESS / 2) + 0.05]} receiveShadow>
                    <boxGeometry attach="geometry" args={[frameWidth, frameHeight, PAINTING_FRAME_THICKNESS]} />
                    <meshStandardMaterial attach="material" color={PAINTING_FRAME_COLOR} roughness={0.8} metalness={0} />
                </mesh>
                {/* FIX: Use array for position and hex for color, and args prop for geometry */}
                <mesh 
                  position={[0, wallHeight / 2, wallBackingDepth + PAINTING_FRAME_THICKNESS + 0.05]} 
                  receiveShadow
                >
                    <boxGeometry attach="geometry" args={[redPlaneWidth, redPlaneHeight, 0.02]} />
                    <meshStandardMaterial attach="material" color="#cccccc" roughness={1} metalness={0} />
                </mesh>
            </React.Fragment>
        ) : (
            <React.Fragment>
                {/* FIX: Use array for position and hex for color, and args prop for geometry */}
                <mesh 
                  receiveShadow position={[0, wallHeight / 2, effectiveWallBackingDepth / 2]}
                >
                    <boxGeometry attach="geometry" args={[wallWidth, wallHeight, effectiveWallBackingDepth]} />
                    <meshStandardMaterial attach="material" color="#ffffff" roughness={1.0} metalness={0} />
                </mesh>
                {/* FIX: Use array for position and args prop for geometry */}
                <group position={[0, artGroupY, effectiveWallBackingDepth + matDepth / 2]}>
                     {/* MODIFIED: Remove castShadow from mat to optimize shadow map performance */}
                     <mesh receiveShadow>
                        <boxGeometry attach="geometry" args={[matWidth, matHeight, matDepth]} />
                        <meshStandardMaterial attach="material" color="#333333" roughness={0.5} />
                    </mesh>
                    {/* FIX: Use array for position and hex for color, and args prop for geometry */}
                    <mesh 
                      position={[0, 0, matDepth / 2 - ARTWORK_RECESS_INTO_FRAME]}
                    >
                        <planeGeometry attach="geometry" args={[artWidth, artHeight]} />
                        <meshStandardMaterial attach="material" color="#cccccc" roughness={1} />
                    </mesh>
                </group>
            </React.Fragment>
        )}
      </group>
    );
  }
  
  return (
    <group>
        {/* FIX: Use scaled unit geometry for better performance */}
        <mesh 
          receiveShadow 
          position={[0, wallHeight / 2, effectiveWallBackingDepth / 2]} 
          scale={[wallWidth, wallHeight, effectiveWallBackingDepth]}
        >
            <primitive object={unitBoxGeo} attach="geometry" />
            <meshStandardMaterial 
              attach="material"
              color="#ffffff" 
              roughness={1.0} 
              metalness={0} 
            />
        </mesh>

        {isPainting && (
          <React.Fragment>
            {/* FIX: Use scaled unit geometry */}
            {/* MODIFIED: Re-enabled castShadow for the frame to provide floor shadows while keeping cables optimized */}
            <mesh 
              position={[0, wallHeight / 2, effectiveWallBackingDepth + (PAINTING_FRAME_THICKNESS / 2) + 0.05]} 
              scale={[frameWidth, frameHeight, PAINTING_FRAME_THICKNESS]}
              castShadow
              receiveShadow
            >
              <primitive object={unitBoxGeo} attach="geometry" />
              <meshStandardMaterial attach="material" color={PAINTING_FRAME_COLOR} roughness={0.8} metalness={0} />
            </mesh>

            {/* FIX: Use scaled unit geometry */}
            <mesh
              position={[0, wallHeight / 2, effectiveWallBackingDepth + PAINTING_FRAME_THICKNESS + 0.05]}
              scale={[redPlaneWidth, redPlaneHeight, 0.02]}
              receiveShadow
            >
              <primitive object={unitBoxGeo} attach="geometry" />
              <meshStandardMaterial
                ref={paintingMaterialRef as any}
                attach="material"
                map={finalMapTexture}
                roughness={1}
                metalness={0}
                envMapIntensity={0.2}
                transparent={false}
              />
            </mesh>
          </React.Fragment>
        )}

        {!isPainting && (
          // FIX: Use scaled unit geometry
          <group position={[0, artGroupY, effectiveWallBackingDepth + matDepth / 2]}>
              {/* MODIFIED: Re-enabled castShadow for the mat to provide floor shadows while keeping cables optimized */}
              <mesh castShadow receiveShadow scale={[matWidth, matHeight, matDepth]}>
                    <primitive object={unitBoxGeo} attach="geometry" />

          {/* Photography hanging lines: two thin vertical lines anchored above the artwork frame and extending upward */}
                    <meshStandardMaterial attach="material" color="#1a1a1a" roughness={0.5} />
              </mesh>
              {/* FIX: Use scaled unit geometry */}
              <mesh
                position={[0, 0, matDepth / 2 - ARTWORK_RECESS_INTO_FRAME]}
                scale={[artWidth, artHeight, 1]}
              >
                <primitive object={unitPlaneGeo} attach="geometry" />
                <meshStandardMaterial 
                  ref={artworkMaterialRef as any} 
                  attach="material" 
                  map={finalMapTexture} 
                  roughness={1} 
                  metalness={0} 
                  envMapIntensity={0.2}
                  transparent={false} 
                />
              </mesh>
          </group>
        )}

            {/* Photography hanging lines (two vertical cables above the frame) */}
            {sourceArtworkType === 'photography' && (
              (() => {
                // Determine top Y and X offsets depending on whether painting-style frame is used
                const lineInset = Math.min(0.6, Math.max(0.2, Math.abs(matWidth) * 0.06)); // move closer to center dynamically
                let topY = 0;
                let leftX = - (matWidth / 2 - lineInset);
                let rightX = (matWidth / 2 - lineInset);
                let zPos = effectiveArtSurfaceZ - CABLE_Z_OFFSET; // move cables further behind the artwork surface (subtract to decrease Z)

                if (isPainting) {
                  topY = (wallHeight / 2) + (frameHeight / 2);
                  leftX = - (frameWidth / 2 - lineInset);
                  rightX = (frameWidth / 2 - lineInset);
                  zPos = effectiveArtSurfaceZ - CABLE_Z_OFFSET; // keep painting branch consistent: slightly behind surface (subtract to decrease Z)
                } else {
                  topY = artGroupY + (matHeight / 2);
                }

                const centerY = topY + (HANG_LINE_HEIGHT / 2);

                return (
                  <group>
                    {/* Stacked short cylinders with decreasing opacity to simulate a vertical fade */}
                    {Array.from({ length: HANG_LINE_FADE_SEGMENTS }).map((_, i) => {
                      const segH = HANG_LINE_HEIGHT / HANG_LINE_FADE_SEGMENTS;
                      const segCenterY = topY + segH * (i + 0.5);
                      const t = i / Math.max(1, HANG_LINE_FADE_SEGMENTS - 1);
                      const opacity = 1.0 - t * 0.92; // fade to ~0.08 at the tip
                      return (
                        <React.Fragment key={`left-cable-seg-${i}`}>
                          {/* MODIFIED: Remove castShadow from cables to optimize shadow map performance and avoid aliasing artifacts */}
                          <mesh position={[leftX, segCenterY, zPos]} scale={[HANG_LINE_THICKNESS, segH, HANG_LINE_THICKNESS]} receiveShadow>
                            <primitive object={unitCylinderGeo} attach="geometry" />
                            <meshStandardMaterial attach="material" color={HANG_LINE_COLOR} metalness={0.2} roughness={0.6} transparent={true} opacity={opacity} />
                          </mesh>
                          <mesh position={[rightX, segCenterY, zPos]} scale={[HANG_LINE_THICKNESS, segH, HANG_LINE_THICKNESS]} receiveShadow>
                            <primitive object={unitCylinderGeo} attach="geometry" />
                            <meshStandardMaterial attach="material" color={HANG_LINE_COLOR} metalness={0.2} roughness={0.6} transparent={true} opacity={opacity} />
                          </mesh>
                        </React.Fragment>
                      );
                    })}
                    {/* Small dark anchors */}
                    {/* Small dark anchors at the top of the cables (slightly above the visible fade) */}
                    <mesh position={[leftX, topY + HANG_LINE_HEIGHT * 0.98, zPos]} scale={[HANG_LINE_THICKNESS * 0.9, HANG_LINE_THICKNESS * 0.9, HANG_LINE_THICKNESS * 0.9]}>
                      <primitive object={unitSphereGeo} attach="geometry" />
                      <meshStandardMaterial attach="material" color="#111827" metalness={0.1} roughness={0.8} />
                    </mesh>
                    <mesh position={[rightX, topY + HANG_LINE_HEIGHT * 0.98, zPos]} scale={[HANG_LINE_THICKNESS * 0.9, HANG_LINE_THICKNESS * 0.9, HANG_LINE_THICKNESS * 0.9]}>
                      <primitive object={unitSphereGeo} attach="geometry" />
                      <meshStandardMaterial attach="material" color="#111827" metalness={0.1} roughness={0.8} />
                    </mesh>
                  </group>
                );
              })()
            )}
            {/* Debug marker removed for production; was visible inside photography images */}
    </group>
  );
};

export default TexturedWallDisplay;