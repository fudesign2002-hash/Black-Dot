

import React, { useRef, useEffect, useMemo, useState } from 'react'; // NEW: Import useState
import { useFrame, useThree, useLoader } from '@react-three/fiber'; // NEW: Import useLoader
import * as THREE from 'three';
import { Environment } from '@react-three/drei';

import { SceneProps } from '../Scene';
import NewCameraControl from './NewCameraControl';
import ProximityHandler from './ProximityHandler';
import ArtComponent from './ArtComponent';
import SmartSpotlight from '../lighting/SmartSpotlight';
import { kelvinToHex, gravityToHex } from '../../../services/utils/colorUtils';
import SceneAxisHelper from './SceneAxisHelper';
const ZeroGravityEffects = React.lazy(() => import('./ZeroGravityEffects'));
import ArtworkWrapper from './ArtworkWrapper';
import { getShadowMapSize } from '../../../utils/screenSettings'; // NEW: Import getShadowMapSize
// REMOVED: import { EffectRegistry } from '../../../effect_bundle'; // NEW: Import EffectRegistry
import { deepDispose } from '../../../utils/threeUtils'; // NEW: Import deepDispose


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
  setFps,
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
}) => {
  const LOG_COLORS = false; // Toggle debug logs for color updates
  const { lightsOn } = lightingConfig;

  const dirLight1Ref = useRef<THREE.DirectionalLight>(null);
  const dirLight2Ref = useRef<THREE.DirectionalLight>(null);
  const floorMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const { scene, camera } = useThree();

  // FIX: Initialize useRef with their default initial values
  const frameTimes = useRef<number[]>([]);
  const lastFpsUpdate = useRef(0);
  const FPS_UPDATE_INTERVAL = 1000;

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
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false); // NEW: State for background loading
  const prevBackgroundTextureRef = useRef<THREE.CubeTexture | null>(null); // NEW: Ref to store previous background texture for disposal

  // NEW: State and Ref for managing dynamic effects
  const clock = useMemo(() => new THREE.Clock(), []); // NEW: Clock for effects
  // FIX: 將 currentEffectGroup 的類型改為 EffectGroup，使其包含 update 方法
  const currentEffectGroup = useRef<EffectGroup | null>(null); // NEW: Ref to hold the active effect's 3D group
  const currentEffectName = useRef<string | null>(null); // NEW: Ref to track the name of the active effect
  const [showGroundMarkers, setShowGroundMarkers] = useState(false); // Delayed visibility for ground markers
  const overlayRef = useRef<THREE.Mesh | null>(null);
  const overlayTmpDir = useMemo(() => new THREE.Vector3(), []);


  // NEW: Load background texture when exhibit_background changes and useExhibitionBackground is true
  useEffect(() => {
    // console.log("[SceneContent] Background useEffect triggered.");
    // console.log(`[SceneContent] useExhibitionBackground: ${useExhibitionBackground}, exhibit_background: ${activeExhibition.exhibit_background}`);

    if (useExhibitionBackground && activeExhibition.exhibit_background) {
      // Start loading new texture; show a camera-facing black overlay
      // (handled in the render tree) while loading instead of changing
      // the scene background directly.
      // Start loading the new cube texture but DO NOT clear the currently
      // applied texture immediately. Keep the previous texture visible until
      // the new one is ready to be swapped in to avoid a flashed/cleared
      // background when toggling lights or switching scenes.
      setIsBackgroundLoading(true);
      // console.log(`[SceneContent] Attempting to load background from URL: ${activeExhibition.exhibition_background}`);

      const imagePath = activeExhibition.exhibit_background as string;
      // Define array of six identical image paths for CubeTextureLoader
      const cubeTextureUrls = Array(6).fill(imagePath);

      new THREE.CubeTextureLoader().loadAsync(cubeTextureUrls)
        .then(cubeTexture => {
          // When the new texture is ready, swap it in immediately and only
          // then dispose the old texture so there's no moment with no
          // background texture visible.
          const old = prevBackgroundTextureRef.current;
          try {
            scene.background = cubeTexture;
            scene.environment = cubeTexture;
          } catch (e) {}
          setCurrentBackgroundTexture(cubeTexture);
          prevBackgroundTextureRef.current = cubeTexture; // now store new texture
          setIsBackgroundLoading(false);
          if (old && old !== cubeTexture) {
            try { old.dispose(); } catch (e) {}
          }
        })
        .catch((e) => {
          // Loading failed. Keep any previously-applied texture (do not
          // clear it), and fall back to solid background only if nothing
          // existed before.
          setCurrentBackgroundTexture(null);
          setIsBackgroundLoading(false);
        });
    } else {
      // If useExhibitionBackground is false or no URL, clear the background texture
      // and immediately remove any references from the scene so an old image
      // doesn't remain visible while other state updates happen.
      try {
        scene.background = null;
        scene.environment = null;
      } catch (e) {}
      if (prevBackgroundTextureRef.current) {
        prevBackgroundTextureRef.current.dispose();
        // console.log("[SceneContent] Disposed background cubeTexture due to toggle/no URL.");
      }
      setCurrentBackgroundTexture(null);
      prevBackgroundTextureRef.current = null;
      setIsBackgroundLoading(false); // Ensure loading state is reset
    }

    // Cleanup function: dispose of the last loaded texture when component unmounts
    return () => {
      try {
        scene.background = null;
        scene.environment = null;
      } catch (e) {}
      if (prevBackgroundTextureRef.current) {
        prevBackgroundTextureRef.current.dispose();
        // console.log("[SceneContent] Disposed background cubeTexture on unmount.");
      }
    };
  }, [useExhibitionBackground, activeExhibition.exhibit_background]);


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
      // If a texture is ready, use it. If loading is in progress, keep the
      // black background we set earlier. If nothing is loading and no
      // texture exists, fall back to solid color logic below.
      if (currentBackgroundTexture) {
        const texToUse = currentBackgroundTexture;
        scene.background = texToUse;
        scene.environment = texToUse; // Also set as environment map

        const targetFogColor = lightsOn ? lightBgColor : darkBgColor;
        if (!reusableFog.current) reusableFog.current = new THREE.Fog(targetFogColor, 20, 90);
        if (scene.fog !== reusableFog.current) scene.fog = reusableFog.current;
        reusableFog.current.color.copy(targetFogColor);

        if (effectiveFloorColor) tmpTargetFloorColor.current.set(effectiveFloorColor);
        else tmpTargetFloorColor.current.set(initialFloorColor);
        if (floorMatRef.current) floorMatRef.current.color.copy(tmpTargetFloorColor.current);

        if (scene.fog) scene.fog = null;
      } else if (isBackgroundLoading) {
        // While loading, we render a camera-facing black overlay mesh instead
        // of changing the scene.background. Keep environment null and darken
        // the floor so the overlay visually matches.
        try { scene.environment = null; } catch (e) {}
        if (floorMatRef.current) floorMatRef.current.color.copy(darkFloorColor);
        if (scene.fog) scene.fog = null;
      }
    } else {
      // Revert to solid color background if background texture is not used or loading
      // Determine target background color:
      // - When lights are OFF, always use the initial dark background (ignore user backgroundColor)
      // - When lights are ON, prefer user-selected lightingConfig.backgroundColor, otherwise use initial light background
      let targetBgColor: THREE.Color;
      if (!lightsOn) {
        tmpTargetBgColor.current.copy(darkBgColor);
      } else {
        if (effectiveBackgroundColor) tmpTargetBgColor.current.set(effectiveBackgroundColor);
        else tmpTargetBgColor.current.copy(lightBgColor);
      }
      targetBgColor = tmpTargetBgColor.current;
      // Determine target floor color:
      // - When lights are OFF and user provided a floorColor, use a darkened version of the user's color
      // - Otherwise fall back to initial defaults or the user-provided color when lights are ON
      let targetFloorColorSolid: THREE.Color;
      if (!lightsOn) {
        if (effectiveFloorColor) {
          // If the user explicitly enabled custom colors, use their color as-is (defaulted to white when missing).
          // Otherwise darken the user's color for dark mode.
          if (explicitUseCustom) {
            targetFloorColorSolid = new THREE.Color(effectiveFloorColor);
          } else {
            targetFloorColorSolid = new THREE.Color(effectiveFloorColor).lerp(new THREE.Color(0x000000), 0.35);
          }
        } else {
          targetFloorColorSolid = darkFloorColor.clone();
        }
      } else {
        targetFloorColorSolid = effectiveFloorColor ? new THREE.Color(effectiveFloorColor) : lightFloorColor.clone();
      }
      // Color debug logging removed

      // Immediately apply the solid background color (replace any existing color)
      scene.background = targetBgColor.clone();
      // Enable or reuse fog if not using exhibition background and immediately set its color
      if (!reusableFog.current) reusableFog.current = new THREE.Fog(targetBgColor, 20, 90);
      if (scene.fog !== reusableFog.current) scene.fog = reusableFog.current;
      reusableFog.current.color.copy(targetBgColor);
      // Ensure tmpTargetFloorColor reflects the chosen solid floor color and apply it immediately
      tmpTargetFloorColor.current.copy(targetFloorColorSolid);
      if (floorMatRef.current) floorMatRef.current.color.copy(tmpTargetFloorColor.current);
      // scene.environment = null; // Clear environment map if not using custom background, now handled by Environment component
      // console.log(`[SceneContent-useFrame] Applying solid background color: ${targetBgColor.getHexString()}. LightsOn: ${lightsOn}`);
    }

    if (isDebugMode) {
      const now = performance.now();
      frameTimes.current.push(now);
      while (frameTimes.current.length > 0 && frameTimes.current[0] < now - 1000) {
        frameTimes.current.shift();
      }
      if (now - lastFpsUpdate.current > FPS_UPDATE_INTERVAL) {
        setFps(frameTimes.current.length);
        lastFpsUpdate.current = now;
      }
    } else if (frameTimes.current.length > 0) {
      frameTimes.current = [];
      lastFpsUpdate.current = 0;
      setFps(0);
    }
  });

  // Determine initial colors based on lightsOn, but only if not using exhibition background
  const initialBackgroundColor = (useExhibitionBackground && currentBackgroundTexture) ? undefined : (effectiveBackgroundColor ? effectiveBackgroundColor : (lightsOn ? "#e4e4e4" : '#000000'));
  // const initialFloorColor now comes from the useMemo above, which respects lightingConfig.floorColor

  const directionalLightColor = useMemo(() => new THREE.Color(kelvinToHex(lightingConfig.colorTemperature)), [lightingConfig.colorTemperature]);

  const showAxisHelper = isEditorMode && isEditorOpen && activeEditorTab === 'layout';
  const axisColor = lightsOn ? '#aaaaaa' : '#555555';

  const selectedArtwork = useMemo(() => artworks.find(art => art.id === selectedArtworkId), [artworks, selectedArtworkId]);

  const shadowMapSize = useMemo(() => getShadowMapSize(isSmallScreen), [isSmallScreen]); // NEW: Calculate shadow map size dynamically

  return (
    <React.Fragment>
        {/* FIX: Use THREE.Vector3 for position */}
        <directionalLight
            ref={dirLight1Ref}
            position={new THREE.Vector3(...(lightingConfig.keyLightPosition || [-2, 6, 9]))}
            intensity={lightsOn ? 3.5 : 0}
            color={directionalLightColor}
            castShadow
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
            position={new THREE.Vector3(...(lightingConfig.fillLightPosition || [5, 0, 5]))}
            intensity={lightsOn ? 2.0 : 0}
            color={new THREE.Color("#dbeafe")}
        />

        {/* FIX: Use THREE.Vector3 for position */}
        <group position={new THREE.Vector3(0, -151.99/100, 0)}>
            {/* FIX: Use THREE.Vector3 for position and args prop for geometry */}
            <mesh
  rotation={new THREE.Euler(-Math.PI / 2, 0, 0)}
  position={new THREE.Vector3(0, 0, 0)}
  receiveShadow={true}
>
  {/* 將 planeGeometry 替換為 circleGeometry */}
  <circleGeometry attach="geometry" args={[200, 320]} /> 

  <meshStandardMaterial
    ref={floorMatRef}
    attach="material"
    color={new THREE.Color(initialFloorColor)}
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

              const isSmartSpotlightActive = isExplicitlyFocused || isProximityFocusedInDark;

              return (
                <ArtworkWrapper
                  key={art.id}
                  id={art.id}
                  artworkType={art.type}
                  originalPosition={art.originalPosition || art.position}
                  originalRotation={art.originalRotation || art.rotation}
                  targetPosition={art.position}
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
                      onArtworkClicked(e, art.id, art.originalPosition || art.position, art.originalRotation || art.rotation, art.type, !!art.isMotionVideo);
                    } else {
                      // skipping click for motion video
                    }
                  }}
                >
                  <SmartSpotlight
                    isActive={isSmartSpotlightActive}
                    lightsOn={lightsOn}
                    color={highlightColor}
                    isEditorMode={isEditorMode}
                    artworkRotation={art.rotation}
                    artworkType={art.type}
                  />
                  <ArtComponent
                    id={art.id}
                    type={art.type}
                    artworkPosition={art.originalPosition || art.position}
                    artworkRotation={art.originalRotation || art.rotation}
                    artworkType={art.type}
                    isFocused={isExplicitlyFocused}
                    textureUrl={art.textureUrl}
                    artworkData={art.artworkData}
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
        {!initialBackgroundColor && useExhibitionBackground && currentBackgroundTexture ? null : initialBackgroundColor && <color attach="background" args={[initialBackgroundColor]} />}
        {/* NEW: Conditionally attach fog based on useExhibitionBackground */}
        {/* CRITICAL CHANGE: Fog is ALWAYS handled by useFrame, no initial attach here if an effect or background is active. */}
        {/* This logic moved inside useFrame to allow continuous lerping and handling `scene.fog = null` or `new THREE.Fog` */}


        

        {/* NEW: Conditionally render Environment based on useExhibitionBackground */}
        {/* CRITICAL CHANGE: Environment is now rendered based on useExhibitionBackground, independent of active effects */}
        {(!useExhibitionBackground || !currentBackgroundTexture) && ( 
          <Environment preset={lightsOn ? "city" : "night"} background={false} />
        )}
    </React.Fragment>
  );
};

export default SceneContent;
