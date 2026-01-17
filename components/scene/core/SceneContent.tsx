

import React, { useRef, useEffect, useMemo, useState } from 'react'; // NEW: Import useState
import { useFrame, useThree, useLoader } from '@react-three/fiber'; // NEW: Import useLoader
import * as THREE from 'three';
import { Environment } from '@react-three/drei';

import { SceneProps } from '../Scene';
import NewCameraControl from './NewCameraControl';
import ProximityHandler from './ProximityHandler';
import ArtComponent from './ArtComponent';
import { kelvinToHex, gravityToHex } from '../../../services/utils/colorUtils';
import SceneAxisHelper from './SceneAxisHelper';
const ZeroGravityEffects = React.lazy(() => import('./ZeroGravityEffects'));
import ArtworkWrapper from './ArtworkWrapper';
import { getShadowMapSize } from '../../../utils/screenSettings'; // NEW: Import getShadowMapSize
// REMOVED: import { EffectRegistry } from '../../../effect_bundle'; // NEW: Import EffectRegistry
import { deepDispose } from '../../../utils/threeUtils'; // NEW: Import deepDispose
import textureCache from '../../../services/textureCache';


const SCENE_WIDTH = 100;
const SCENE_HEIGHT = 50;
const SCENE_DEPTH = 100;

// FIX: 定義一個介面，讓 TypeScript 知道 effect group 可能會有 update 方法
interface EffectGroup extends THREE.Group {
  update?: (deltaTime: number) => void;
}

const SceneContent: React.FC<SceneProps> = ({
  lightingConfig,
  artworks,
  isEditorOpen,
  isEditorMode,
  selectedArtworkId,
  onSelectArtwork,
  focusedIndex,
  onFocusChange,
  activeEditorTab,
  focusedArtworkInstanceId,
  hasMotionArtwork,
  uiConfig,
  setFocusedArtworkInstanceId,
  activeExhibition,
  onInfoOpen,
  cameraControlRef,
  onArtworkClicked,
  isDebugMode,
  triggerHeartEmitter,
  heartEmitterArtworkId,
  onCanvasClick,
  isRankingMode,
  isZeroGravityMode, // NEW: Destructure isZeroGravityMode
  isSmallScreen, // NEW: Destructure isSmallScreen
  onCameraPositionChange, // NEW: Destructure onCameraPositionChange
  // NEW: Notify parent when user begins interacting with camera
  onUserCameraInteractionStart,
  onUserCameraInteractionEnd,
  isCameraMovingToArtwork, // NEW: Destructure camera moving state
  isArtworkFocusedForControls, // NEW: whether artwork is focused for controls (zoomed-in)
  useExhibitionBackground, // NEW: Destructure useExhibitionBackground
  onSaveCustomCamera, // NEW: Destructure onSaveCustomCamera
  activeEffectName, // NEW: Destructure activeEffectName
  effectRegistry, // NEW: Destructure effectRegistry
  zoneGravity, // NEW: Destructure zoneGravity
  isEffectRegistryLoading, // NEW: Destructure isEffectRegistryLoading
  onLoadingStatusChange, // NEW: Destructure onLoadingStatusChange
  isEmbed, // NEW: Destructure isEmbed
  thresholdLevel, // NEW: Destructure thresholdLevel
  activeZoneId, // NEW: Destructure activeZoneId
}) => {
  const LOG_COLORS = false; // Toggle debug logs for color updates
  const { lightsOn } = lightingConfig;

  // NEW: Find the most central artwork for "Lights Off" fallback in editor mode
  const centralArtworkId = useMemo(() => {
    if (!artworks || artworks.length === 0) return null;
    let minDistanceSq = Infinity;
    let centralId = artworks[0].id;
    
    artworks.forEach(art => {
      const pos = art.originalPosition || art.position;
      // Calculate 2D distance on XZ plane to find the center artwork regardless of height
      const distanceSq = pos[0] * pos[0] + pos[2] * pos[2];
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        centralId = art.id;
      }
    });
    return centralId;
  }, [artworks]);

  const dirLight1Ref = useRef<THREE.DirectionalLight>(null);
  const dirLight2Ref = useRef<THREE.DirectionalLight>(null);
  const floorMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const { scene, camera } = useThree();

  const [isTexturesLoading, setIsTexturesLoading] = useState(true);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);

  // NEW: Track overall loading status (background + textures)
  useEffect(() => {
    const isOverallLoading = isBackgroundLoading || isTexturesLoading;
    if (onLoadingStatusChange) {
      onLoadingStatusChange(isOverallLoading);
    }
  }, [isBackgroundLoading, isTexturesLoading, onLoadingStatusChange]);

  // NEW: Subscribe to texture cache loading status
  useEffect(() => {
    textureCache.setLoadingStatusCallback((loading) => {
      setIsTexturesLoading(loading);
    });
    return () => textureCache.setLoadingStatusCallback(() => {});
  }, []);

  // Cache/pin behaviour: keep simple, fixed defaults
  const CACHE_PIN_THRESHOLD = 13; // if number of artworks <= this, keep all pinned
  const neighborPreloadsRef = useRef<string[]>([]);

  // Cache artworkData objects by artworkId and reuse identical objects to
  // preserve reference identity across renders. This helps avoid unnecessary
  // effect retriggers in children that depend on artworkData identity.
  const artworkDataCacheRef = useRef<Map<string, any>>(new Map());

  const shallowEqualArtworkData = (a: any, b: any) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      const k = aKeys[i];
      if (a[k] !== b[k]) return false;
    }
    return true;
  };

  // Pin all textures when gallery is small to avoid any reloads; otherwise unpin
  useEffect(() => {
    const urls = artworks
      .filter(a => !a.isMotionVideo) // NEW: Filter out motion videos as they use iframes, not textures
      .map(a => a.textureUrl)
      .filter(Boolean) as string[];
    if (urls.length <= CACHE_PIN_THRESHOLD) {
      urls.forEach(u => textureCache.pinTexture(u));
    } else {
      // unpin any previously pinned ones (best-effort)
      urls.forEach(u => textureCache.unpinTexture(u));
    }
    return () => {
      // unpin on cleanup
      urls.forEach(u => textureCache.unpinTexture(u));
    };
  }, [artworks.length]);

  // Auto-pin a small number of likely-visible artwork textures when the scene mounts
  // This reduces first-frame stalls caused by downloading large textures when the
  // user first enters the scene. We pin the first N artworks (or fewer) and unpin
  // them on cleanup. This is a lightweight, conservative approach that avoids
  // changing any higher-level data flow.
  useEffect(() => {
    const PIN_ON_ENTER_COUNT = 6;
    const urls = artworks
      .filter(a => !a.isMotionVideo) // NEW: Filter out motion videos
      .slice(0, PIN_ON_ENTER_COUNT)
      .map(a => a.textureUrl)
      .filter(Boolean) as string[];
    if (urls.length === 0) return undefined;
    urls.forEach(u => textureCache.pinTexture(u));
    return () => { urls.forEach(u => textureCache.unpinTexture(u)); };
  }, [artworks]);

  // Preload neighbor textures around focused artwork (previous/next radius)
  useEffect(() => {
    // clear previous preloads
    neighborPreloadsRef.current.forEach(u => textureCache.releaseTexture(u));
    neighborPreloadsRef.current = [];
    if (!focusedArtworkInstanceId) return;
    const idx = artworks.findIndex(a => a.id === focusedArtworkInstanceId);
    if (idx === -1) return;
    const neighbors: number[] = [];
    const radius = 2;
    for (let d = -radius; d <= radius; d++) {
      if (d === 0) continue;
      const ni = idx + d;
      if (ni >= 0 && ni < artworks.length) neighbors.push(ni);
    }
    try {
      neighbors.forEach(i => {
        const art = artworks[i];
        if (art.isMotionVideo) return; // NEW: Skip motion videos
        const u = art.textureUrl;
        if (u) {
          neighborPreloadsRef.current.push(u);
          textureCache.retainTexture(u).catch(() => {});
        }
      });
    } finally {
    }
    return () => {
      neighborPreloadsRef.current.forEach(u => textureCache.releaseTexture(u));
      neighborPreloadsRef.current = [];
    };
  }, [focusedArtworkInstanceId, artworks]);

  const lightBgColor = useMemo(() => new THREE.Color("#e4e4e4"), []);
  const darkBgColor = useMemo(() => new THREE.Color("#000000"), []);
  // overlay mesh will be used instead of changing scene.background to black
  const lightFloorColor = useMemo(() => new THREE.Color("#eeeeee"), []);
  const darkFloorColor = useMemo(() => new THREE.Color("#000000"), []);
  // NOTE: These four values are the canonical initial color settings
  // - lightBgColor / lightFloorColor: used as defaults when lights are ON
  // - darkBgColor / darkFloorColor: used as defaults when lights are OFF
  const floorTargetColor = useMemo(() => new THREE.Color(), []); // NEW: Define floorTargetColor outside useFrame
  // Reusable temporary colors and fog to avoid per-frame allocations
  const tmpTargetBgColor = useRef(new THREE.Color());
  const tmpTargetFloorColor = useRef(new THREE.Color());
  const tmpLerpColor = useRef(new THREE.Color()); // NEW: For lerping
  const reusableFog = useRef<THREE.Fog | null>(null);

  // Respect a `useCustomColors` boolean in lightingConfig; only consider it enabled
  // when it is explicitly `true`. Do NOT infer from presence of `floorColor` or
  // `backgroundColor` when the field is missing.
  const explicitUseCustom = (lightingConfig as any).useCustomColors === true;

  // Compute effective colors up-front and memoize to avoid reading lightingConfig mid-frame
  const effectiveFloorColor = useMemo(() => {
    // If user explicitly enabled custom colors, prefer their value and default to white when missing.
    if (explicitUseCustom) {
      return lightingConfig.floorColor ?? '#ffffff';
    }
    return undefined;
  }, [explicitUseCustom, lightingConfig.floorColor]);

  const effectiveBackgroundColor = useMemo(() => {
    if (explicitUseCustom) {
      return lightingConfig.backgroundColor ?? '#ffffff';
    }
    return undefined;
  }, [explicitUseCustom, lightingConfig.backgroundColor]);

  const [currentBackgroundTexture, setCurrentBackgroundTexture] = useState<THREE.CubeTexture | null>(null); // MODIFIED: Store as single Texture
  const prevBackgroundTextureRef = useRef<THREE.CubeTexture | null>(null); // NEW: Ref to store previous background texture for disposal

  // NEW: State and Ref for managing dynamic effects
  const clock = useMemo(() => new THREE.Clock(), []); // NEW: Clock for effects
  // FIX: 將 currentEffectGroup 的類型改為 EffectGroup，使其包含 update 方法
  const currentEffectGroup = useRef<EffectGroup | null>(null); // NEW: Ref to hold the active effect's 3D group
  const currentEffectName = useRef<string | null>(null); // NEW: Ref to track the name of the active effect
  const [showGroundMarkers, setShowGroundMarkers] = useState(false); // Delayed visibility for ground markers
  const overlayRef = useRef<THREE.Mesh | null>(null);
  const overlayTmpDir = useMemo(() => new THREE.Vector3(), []);

  // NEW: Track environment and light intensities for smooth transitions
  const envIntensityRef = useRef(lightsOn ? 1.0 : 0.05);
  const mainLightIntensityRef = useRef(lightsOn ? 3.5 : 0);


  // NEW: Load background texture when exhibit_background changes and useExhibitionBackground is true
  useEffect(() => {
    if (useExhibitionBackground && activeExhibition.exhibit_background) {
      const imagePath = activeExhibition.exhibit_background as string;
      
      // If we already have this texture loaded, just ensure it's applied and return
      if (prevBackgroundTextureRef.current && (prevBackgroundTextureRef.current as any)._sourceUrl === imagePath) {
        setCurrentBackgroundTexture(prevBackgroundTextureRef.current);
        setIsBackgroundLoading(false);
        return;
      }

      // If we are switching to a DIFFERENT background URL, clear the current one
      // immediately to avoid "residue" from the previous exhibition.
      if (prevBackgroundTextureRef.current && (prevBackgroundTextureRef.current as any)._sourceUrl !== imagePath) {
        setCurrentBackgroundTexture(null);
        try {
          scene.background = null;
          scene.environment = null;
        } catch (e) {}
      }

      setIsBackgroundLoading(true);
      const cubeTextureUrls = Array(6).fill(imagePath);

      new THREE.CubeTextureLoader().loadAsync(cubeTextureUrls)
        .then(cubeTexture => {
          (cubeTexture as any)._sourceUrl = imagePath; // Tag it for future comparison
          const old = prevBackgroundTextureRef.current;
          
          // Only apply if we are still supposed to be using this background and URL
          if (useExhibitionBackground && activeExhibition.exhibit_background === imagePath) {
            setCurrentBackgroundTexture(cubeTexture);
            prevBackgroundTextureRef.current = cubeTexture;
          } else {
            cubeTexture.dispose();
          }
          
          setIsBackgroundLoading(false);
          if (old && old !== cubeTexture) {
            try { old.dispose(); } catch (e) {}
          }
        })
        .catch((e) => {
          setCurrentBackgroundTexture(null);
          setIsBackgroundLoading(false);
        });
    } else {
      // If useExhibitionBackground is false or no URL, clear the background texture
      try {
        scene.background = null;
        scene.environment = null;
      } catch (e) {}
      if (prevBackgroundTextureRef.current) {
        prevBackgroundTextureRef.current.dispose();
      }
      setCurrentBackgroundTexture(null);
      prevBackgroundTextureRef.current = null;
      setIsBackgroundLoading(false);
    }

    return () => {
      // Cleanup is handled by the logic above or on unmount
    };
  }, [useExhibitionBackground, activeExhibition.exhibit_background, scene]);


  // NEW: Effect to manage active environment effects
  useEffect(() => {
    if (currentEffectGroup.current) {
      deepDispose(currentEffectGroup.current); // Dispose of old effect resources
      scene.remove(currentEffectGroup.current);
      currentEffectGroup.current = null;
    }

    // NEW: Use passed effectRegistry
    if (activeEffectName && effectRegistry && effectRegistry[activeEffectName]) {
      const effectConfig = effectRegistry[activeEffectName];
      // FIX: Access light property correctly from env object
      const lightSetting = effectConfig.env.light; // Get light setting here

      // Check if the effect should be active given the light state
      // If lightSetting is 'off' AND lightsOn is true, then the effect should NOT be active.
      const shouldEffectBeActive = !(lightSetting === 'off' && lightsOn);

      if (shouldEffectBeActive) {
        const newEffectGroup = effectConfig.creator({
          THREE,
          SCENE_WIDTH,
          SCENE_HEIGHT,
          SCENE_DEPTH,
          clock,
        });
        scene.add(newEffectGroup);
        currentEffectGroup.current = newEffectGroup;
        currentEffectName.current = activeEffectName;

        // CRITICAL CHANGE: DO NOT apply environment settings from the effect here.
        // The background, fog, and ambient light will continue to be driven by the main scene's lightingConfig.
      } else {
        // Effect should not be active, ensure currentEffectGroup is null
        currentEffectGroup.current = null;
        currentEffectName.current = null;
      }
    } else {
      currentEffectName.current = null;
    }

    // Cleanup function for this useEffect
    return () => {
      if (currentEffectGroup.current) {
        deepDispose(currentEffectGroup.current);
        scene.remove(currentEffectGroup.current);
        currentEffectGroup.current = null;
      }
      currentEffectName.current = null;
    };
  }, [activeEffectName, scene, clock, effectRegistry, lightsOn]); // NEW: Add effectRegistry and lightsOn to dependencies

  // Delayed visibility for ground markers: show 2s after zero-gravity activates
  useEffect(() => {
    let t: number | undefined;
    if (isZeroGravityMode) {
      t = window.setTimeout(() => setShowGroundMarkers(true), 300);
    } else {
      setShowGroundMarkers(false);
    }
    return () => { if (t) clearTimeout(t); };
  }, [isZeroGravityMode]);


  // MODIFIED: initialFloorColor calculation now respects lightingConfig.floorColor
  const initialFloorColor = useMemo(() => {
    if (effectiveFloorColor) {
      return effectiveFloorColor;
    }
    return lightsOn ? "#eeeeee" : "#000000";
  }, [effectiveFloorColor, lightsOn]);

  // Derive explicit light/dark floor hex values. The "light" floor color is
  // always either the user's custom floorColor (when enabled) or the canonical
  // `lightFloorColor`. The dark floor color is ALWAYS either the canonical
  // `darkFloorColor` or a darkened version of the user's chosen light color.
  const lightFloorHex = useMemo(() => {
    return effectiveFloorColor || "#eeeeee";
  }, [effectiveFloorColor]);

  const darkFloorHex = useMemo(() => {
    if (effectiveFloorColor) {
      const c = new THREE.Color(effectiveFloorColor);
      c.lerp(new THREE.Color(0x000000), 0.35);
      return `#${c.getHexString()}`;
    }
    return "#000000";
  }, [effectiveFloorColor]);

  useFrame((state, delta) => {
    const lerpSpeed = delta * 10;
    // Color debug logging removed

    // NEW: Update active effect if any
    // FIX: 這裡已經透過 EffectGroup 介面解決了 TypeScript 的類型檢查問題
    if (currentEffectGroup.current && currentEffectGroup.current.update) {
      currentEffectGroup.current.update(delta);
    }

    // Position and size the black overlay in front of the camera while loading
    if (overlayRef.current) {
      const dir = overlayTmpDir;
      camera.getWorldDirection(dir);
      overlayRef.current.position.copy(camera.position).add(dir.multiplyScalar(10));
      overlayRef.current.quaternion.copy(camera.quaternion);
      overlayRef.current.visible = !!isBackgroundLoading;
      // large scale to ensure it covers view regardless of camera fov
      overlayRef.current.scale.set(1000, 1000, 1);
    }

    // CRITICAL CHANGE: Always run the default background/fog/floor logic, regardless of active effect.
    // Effects are now purely visual overlays and do not alter the scene's core environment properties.
    if (useExhibitionBackground) {
      if (currentBackgroundTexture) {
        // Ensure background and environment are set if they are not already
        if (scene.background !== currentBackgroundTexture) {
          scene.background = currentBackgroundTexture;
        }
        if (scene.environment !== currentBackgroundTexture) {
          scene.environment = currentBackgroundTexture;
        }
        
        if (scene.fog) scene.fog = null;

        if (effectiveFloorColor) tmpTargetFloorColor.current.set(effectiveFloorColor);
        else tmpTargetFloorColor.current.set(initialFloorColor);
        if (floorMatRef.current) floorMatRef.current.color.copy(tmpTargetFloorColor.current);
      } else {
        // Fallback to solid color while loading or if no texture is available
        let targetBgColor: THREE.Color;
        if (!lightsOn) {
          tmpTargetBgColor.current.copy(darkBgColor);
        } else {
          if (effectiveBackgroundColor) tmpTargetBgColor.current.set(effectiveBackgroundColor);
          else tmpTargetBgColor.current.copy(lightBgColor);
        }
        targetBgColor = tmpTargetBgColor.current;

        if (!(scene.background instanceof THREE.Color) || !scene.background.equals(targetBgColor)) {
          if (scene.background instanceof THREE.Color) {
            scene.background.copy(targetBgColor);
          } else {
            // Use cached colors instead of cloning every frame
            scene.background = targetBgColor === darkBgColor ? darkBgColor : (targetBgColor === lightBgColor ? lightBgColor : targetBgColor.clone());
          }
        }
        
        // While loading, we also have the overlay mesh, but we set the background color
        // to match the target environment.
        if (isBackgroundLoading) {
          if (scene.environment !== null) scene.environment = null;
          if (floorMatRef.current) floorMatRef.current.color.copy(darkFloorColor);
        } else {
          // Not loading and no texture: treat as solid color mode
          if (scene.fog !== reusableFog.current) {
            if (!reusableFog.current) reusableFog.current = new THREE.Fog(targetBgColor, 20, 90);
            scene.fog = reusableFog.current;
          }
          if (reusableFog.current) {
            if (reusableFog.current.color.getHex() !== targetBgColor.getHex()) {
              reusableFog.current.color.copy(targetBgColor);
            }
          }
          
          if (effectiveFloorColor) {
            tmpTargetFloorColor.current.set(effectiveFloorColor);
          } else {
            tmpTargetFloorColor.current.copy(lightsOn ? lightFloorColor : darkFloorColor);
          }
          
          if (floorMatRef.current && !floorMatRef.current.color.equals(tmpTargetFloorColor.current)) {
            floorMatRef.current.color.copy(tmpTargetFloorColor.current);
          }
        }
      }
    } else {
      // Revert to solid color background if background texture is not used or loading
      let targetBgColor: THREE.Color;
      if (!lightsOn) {
        tmpTargetBgColor.current.copy(darkBgColor);
      } else {
        if (effectiveBackgroundColor) tmpTargetBgColor.current.set(effectiveBackgroundColor);
        else tmpTargetBgColor.current.copy(lightBgColor);
      }
      targetBgColor = tmpTargetBgColor.current;

      if (!lightsOn) {
        if (effectiveFloorColor) {
          if (explicitUseCustom) {
            tmpTargetFloorColor.current.set(effectiveFloorColor);
          } else {
            tmpTargetFloorColor.current.set(effectiveFloorColor).lerp(tmpLerpColor.current.set(0x000000), 0.35);
          }
        } else {
          tmpTargetFloorColor.current.copy(darkFloorColor);
        }
      } else {
        if (effectiveFloorColor) {
          tmpTargetFloorColor.current.set(effectiveFloorColor);
        } else {
          tmpTargetFloorColor.current.copy(lightFloorColor);
        }
      }

      // Apply solid background color only if it changed
      if (!(scene.background instanceof THREE.Color) || !scene.background.equals(targetBgColor)) {
        if (scene.background instanceof THREE.Color) {
          scene.background.copy(targetBgColor);
        } else {
          scene.background = targetBgColor.clone();
        }
      }

      // Enable or reuse fog
      if (!reusableFog.current) reusableFog.current = new THREE.Fog(targetBgColor, 20, 90);
      if (scene.fog !== reusableFog.current) scene.fog = reusableFog.current;
      if (reusableFog.current.color.getHex() !== targetBgColor.getHex()) {
        reusableFog.current.color.copy(targetBgColor);
      }

      // Apply floor color
      if (floorMatRef.current && !floorMatRef.current.color.equals(tmpTargetFloorColor.current)) {
        floorMatRef.current.color.copy(tmpTargetFloorColor.current);
      }
    }

    // NEW: Smoothly adjust intensities to avoid flickering and shader re-compilation
    // This now runs regardless of whether a custom background or solid color is used.
    const targetEnvIntensity = lightsOn ? 1.0 : 0.05;
    const targetMainLightIntensity = lightsOn ? 3.5 : 0;
    const targetBgIntensity = lightsOn ? 1.0 : 0.15; // Keep background slightly visible but dark

    const lerpFactor = Math.min(1, delta * 8); // Speed up transition (was 4)
    envIntensityRef.current = THREE.MathUtils.lerp(envIntensityRef.current, targetEnvIntensity, lerpFactor);
    mainLightIntensityRef.current = THREE.MathUtils.lerp(mainLightIntensityRef.current, targetMainLightIntensity, lerpFactor);

    if (scene.environmentIntensity !== undefined) {
      scene.environmentIntensity = envIntensityRef.current;
    }

    // Also dim the background itself if it's a texture (Three.js r163+)
    if ((scene as any).backgroundIntensity !== undefined) {
      (scene as any).backgroundIntensity = THREE.MathUtils.lerp((scene as any).backgroundIntensity || 1, targetBgIntensity, lerpFactor);
    }

    if (dirLight1Ref.current) {
      dirLight1Ref.current.intensity = mainLightIntensityRef.current;
      // Only disable shadows when intensity is very low to avoid sudden shadow disappearance
      dirLight1Ref.current.castShadow = mainLightIntensityRef.current > 0.1;
    }
    if (dirLight2Ref.current) {
      dirLight2Ref.current.intensity = THREE.MathUtils.lerp(dirLight2Ref.current.intensity, lightsOn ? 2.0 : 0, lerpFactor);
    }
  });

  // Determine initial colors based on lightsOn, but only if not using exhibition background
  const initialBackgroundColor = useExhibitionBackground ? undefined : (effectiveBackgroundColor ? effectiveBackgroundColor : (lightsOn ? "#e4e4e4" : '#000000'));
  // const initialFloorColor now comes from the useMemo above, which respects lightingConfig.floorColor

  const directionalLightColor = useMemo(() => new THREE.Color(kelvinToHex(lightingConfig.colorTemperature)), [lightingConfig.colorTemperature]);

  const showAxisHelper = isEditorMode && isEditorOpen && activeEditorTab === 'layout';
  const axisColor = lightsOn ? '#aaaaaa' : '#555555';

  const selectedArtwork = useMemo(() => artworks.find(art => art.id === selectedArtworkId), [artworks, selectedArtworkId]);

  const shadowMapSize = useMemo(() => getShadowMapSize(isSmallScreen), [isSmallScreen]); // NEW: Calculate shadow map size dynamically

  const keyLightPos = useMemo(() => new THREE.Vector3(...(lightingConfig.keyLightPosition || [-2, 8, 9])), [lightingConfig.keyLightPosition]);
  const fillLightPos = useMemo(() => new THREE.Vector3(...(lightingConfig.fillLightPosition || [5, 0, 5])), [lightingConfig.fillLightPosition]);
  const floorGroupPos = useMemo(() => new THREE.Vector3(0, -151.99/100, 0), []);
  const floorMeshPos = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const floorMeshRot = useMemo(() => new THREE.Euler(-Math.PI / 2, 0, 0), []);
  const fillLightColor = useMemo(() => new THREE.Color("#dbeafe"), []);
  const initialFloorColorObj = useMemo(() => new THREE.Color(initialFloorColor), []);

  return (
    <React.Fragment>
        <ambientLight 
          intensity={lightsOn ? (lightingConfig.ambientIntensity ?? 0.8) : 0.05} 
          color="#ffffff" 
        />
        {/* FIX: Use THREE.Vector3 for position */}
        <directionalLight
            ref={dirLight1Ref}
            position={keyLightPos}
            intensity={mainLightIntensityRef.current}
            color={directionalLightColor}
            castShadow={lightsOn}
            shadow-mapSize={[shadowMapSize, shadowMapSize]} // MODIFIED: Use dynamic shadowMapSize
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
            shadow-bias={-0.0001}
            shadow-normalBias={0.05}
        />
        {/* FIX: Use THREE.Vector3 for position and THREE.Color for color */}
        <directionalLight
            ref={dirLight2Ref}
            position={fillLightPos}
            intensity={lightsOn ? 2.0 : 0}
            color={fillLightColor}
        />

        {/* FIX: Use THREE.Vector3 for position */}
        <group position={floorGroupPos}>
            {/* FIX: Use THREE.Vector3 for position and args prop for geometry */}
            <mesh
  rotation={floorMeshRot}
  position={floorMeshPos}
  receiveShadow={true}
>
  {/* 降低細分程度以優化效能，64 已經足以呈現平整圓形 */}
  <circleGeometry attach="geometry" args={[200, 64]} /> 

  <meshStandardMaterial
    ref={floorMatRef}
    attach="material"
    color={initialFloorColorObj}
    roughness={0.55}
    metalness={0.1}
  />
</mesh>

            {showAxisHelper && (
              <SceneAxisHelper
                sizeX={24}
                sizeZ={12}
                color={axisColor}
                offsetY={0.02}
              />
            )}

            {/* FIX: Map over artworks to render ArtComponent */}
            {artworks.map((art, index) => {
              // Reuse previously cached artworkData when semantically identical
              const stableArtworkData = (() => {
                const key = art.artworkId || art.id;
                const prev = artworkDataCacheRef.current.get(key);
                if (prev && shallowEqualArtworkData(prev, art.artworkData)) {
                  return prev;
                }
                // store whatever value (possibly undefined) so we can compare next render
                artworkDataCacheRef.current.set(key, art.artworkData);
                return art.artworkData;
              })();
              // Determine externalOffsetX for slide-out when camera is zooming to a focused artwork
              const focusedArt = artworks.find(a => a.id === focusedArtworkInstanceId);
              let externalOffsetX = 0;
              if (focusedArtworkInstanceId && (isCameraMovingToArtwork || isArtworkFocusedForControls) && focusedArt && art.id !== focusedArtworkInstanceId) {
                const focusedX = (focusedArt.originalPosition || focusedArt.position)[0];
                const artX = (art.originalPosition || art.position)[0];
                const SIGN = artX < focusedX ? -1 : 1;
                externalOffsetX = SIGN * 40; // slide 40 units left/right off-screen
              }
              const highlightColor = lightingConfig.manualSpotlightColor;

              const isExplicitlyFocused = isEditorMode ? art.id === selectedArtworkId : focusedArtworkInstanceId === art.id;

              const isProximityFocusedInDark = !isEditorMode && !lightsOn && !focusedArtworkInstanceId && index === focusedIndex && !isRankingMode && !isZeroGravityMode; // NEW: Add !isZeroGravityMode to condition

              // NEW: In editor mode, if lights are off and nothing is selected, highlight the central artwork
              const isEditorFallbackInDark = isEditorMode && !lightsOn && !selectedArtworkId && art.id === centralArtworkId;

              const isSmartSpotlightActive = isExplicitlyFocused || isProximityFocusedInDark || isEditorFallbackInDark;

              // NEW: Apply a global Y offset for photography artworks to lower them in the scene
              const PHOTOGRAPHY_Y_OFFSET = -1.5;
              const isPhotography = art.source_artwork_type === 'photography';
              const photographyYOffset = isPhotography ? PHOTOGRAPHY_Y_OFFSET : 0;
              
              // NEW: Apply Y+0.5 offset when artwork is selected (replacing spotlight)
              const SELECTION_Y_OFFSET = 0.5;
              const selectionYOffset = isSmartSpotlightActive ? SELECTION_Y_OFFSET : 0;
              
              const totalYOffset = photographyYOffset + selectionYOffset;

              const adjustedOriginalPosition: [number, number, number] = [
                (art.originalPosition || art.position)[0],
                (art.originalPosition || art.position)[1] + totalYOffset,
                (art.originalPosition || art.position)[2]
              ];

              const adjustedTargetPosition: [number, number, number] = [
                art.position[0],
                art.position[1] + totalYOffset,
                art.position[2]
              ];

              return (
                <ArtworkWrapper
                  key={art.id}
                  id={art.id}
                  artworkType={art.type}
                  originalPosition={adjustedOriginalPosition}
                  originalRotation={art.originalRotation || art.rotation}
                  targetPosition={adjustedTargetPosition}
                  targetRotation={art.rotation}
                  isRankingMode={isRankingMode}
                  isZeroGravityMode={isZeroGravityMode} // NEW: Pass isZeroGravityMode
                  zoneGravity={zoneGravity} // NEW: Pass zoneGravity
                  artworkGravity={art.artworkGravity} // NEW: Pass artworkGravity
                  externalOffsetX={externalOffsetX}
                  onCanvasArtworkClick={(e) => {
                    e.stopPropagation();
                    if (!art.isMotionVideo) {
                      // REMOVED: onSelectArtwork(art.id);
                      onArtworkClicked(e, art.id, adjustedOriginalPosition, art.originalRotation || art.rotation, art.type, !!art.isMotionVideo);
                    } else {
                      // skipping click for motion video
                    }
                  }}
                >
                  <ArtComponent
                    id={art.id}
                    type={art.type}
                    artworkPosition={art.originalPosition || art.position}
                    artworkRotation={art.originalRotation || art.rotation}
                    artworkType={art.type}
                    aspectRatio={art.aspectRatio}
                    sourceArtworkType={art.source_artwork_type}
                    isFocused={isExplicitlyFocused}
                    textureUrl={art.textureUrl}
                    artworkData={stableArtworkData}
                    isMotionVideo={art.isMotionVideo}
                    isFaultyMotionVideo={art.isFaultyMotionVideo}
                    lightsOn={lightsOn}
                    uiConfig={uiConfig}
                    setFocusedArtworkInstanceId={setFocusedArtworkInstanceId}
                    activeExhibition={activeExhibition}
                    onInfoOpen={onInfoOpen}
                    isDebugMode={isDebugMode}
                    triggerHeartEmitter={triggerHeartEmitter}
                    heartEmitterArtworkId={heartEmitterArtworkId}
                    onArtworkClicked={onArtworkClicked}
                    isRankingMode={isRankingMode}
                    isCameraMovingToArtwork={isCameraMovingToArtwork}
                    displayLikes={art.displayLikes}
                    isSmallScreen={isSmallScreen}
                    thresholdLevel={thresholdLevel}
                    activeZoneId={activeZoneId}
                  />
                </ArtworkWrapper>
              );
            })}
        </group>

        {/* Zero gravity visual effects (lazy-loaded) */}
        {isZeroGravityMode && showGroundMarkers && (
          <React.Suspense fallback={null}>
            <ZeroGravityEffects artworks={artworks} />
          </React.Suspense>
        )}

        {/* Black overlay mesh that covers the camera view while a new background loads */}
        <mesh
          ref={overlayRef as any}
          frustumCulled={false}
          renderOrder={1000}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#000000" depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        <NewCameraControl
          ref={cameraControlRef as any}
          isEditorOpen={isEditorOpen}
          isZeroGravityMode={isZeroGravityMode}
          isRankingMode={isRankingMode}
          onCameraPositionChange={onCameraPositionChange}
          onCameraAnimationStateChange={undefined}
          onSaveCustomCamera={onSaveCustomCamera}
          onUserInteractionStart={onUserCameraInteractionStart}
          onUserInteractionEnd={onUserCameraInteractionEnd}
          lightingConfig={lightingConfig}
          isArtworkFocused={isArtworkFocusedForControls}
          isEmbed={isEmbed}
        />
        {!lightsOn && !focusedArtworkInstanceId && !isRankingMode && !isZeroGravityMode && (
          <ProximityHandler
            artworks={artworks}
            setFocusedIndex={onFocusChange}
            currentFocusedIndex={focusedIndex}
            focusedArtworkInstanceId={focusedArtworkInstanceId}
            cameraControlRef={cameraControlRef}
          />
        )}

        {/* NEW: Conditionally set background, otherwise it will be handled by useFrame's lerp */}
        {/* If an effect is active, its background is set directly in the useEffect, bypassing this */}
        {/* Background is now handled entirely imperatively in useFrame to avoid unmounting conflicts */}
        
        {/* NEW: Conditionally attach fog based on useExhibitionBackground */}
        {/* CRITICAL CHANGE: Fog is ALWAYS handled by useFrame, no initial attach here if an effect or background is active. */}
        {/* This logic moved inside useFrame to allow continuous lerping and handling `scene.fog = null` or `new THREE.Fog` */}


        

        {/* NEW: Conditionally render Environment based on useExhibitionBackground */}
        {/* CRITICAL CHANGE: Environment is now rendered based on useExhibitionBackground, independent of active effects */}
        {/* MODIFIED: Use a fixed preset to avoid shader re-compilation lag during light toggle */}
        {(!useExhibitionBackground || !currentBackgroundTexture) && ( 
          <Environment 
            preset="city" 
            background={false} 
          />
        )}
    </React.Fragment>
  );
};

export default SceneContent;
