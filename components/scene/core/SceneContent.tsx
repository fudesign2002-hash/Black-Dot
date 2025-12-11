

import React, { useRef, useEffect, useMemo, useState } from 'react'; // NEW: Import useState
import { useFrame, useThree, useLoader } from '@react-three/fiber'; // NEW: Import useLoader
import * as THREE from 'three';
import { Environment } from '@react-three/drei';

import { SceneProps } from '../Scene';
import CameraController from './CameraController';
import ProximityHandler from './ProximityHandler';
import ArtComponent from './ArtComponent';
import SmartSpotlight from '../lighting/SmartSpotlight';
import { kelvinToHex } from '../../../services/utils/colorUtils';
import SceneAxisHelper from './SceneAxisHelper';
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
  rankingCameraPosition, // NEW
  rankingCameraTarget,   // NEW
  useExhibitionBackground, // NEW: Destructure useExhibitionBackground
  activeEffectName, // NEW: Destructure activeEffectName
  effectRegistry, // NEW: Destructure effectRegistry
  zoneGravity, // NEW: Destructure zoneGravity
  isEffectRegistryLoading, // NEW: Destructure isEffectRegistryLoading
}) => {
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
  const lightFloorColor = useMemo(() => new THREE.Color("#eeeeee"), []);
  const darkFloorColor = useMemo(() => new THREE.Color("#000000"), []);
  const floorTargetColor = useMemo(() => new THREE.Color(), []); // NEW: Define floorTargetColor outside useFrame

  const [currentBackgroundTexture, setCurrentBackgroundTexture] = useState<THREE.CubeTexture | null>(null); // MODIFIED: Store as single Texture
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false); // NEW: State for background loading
  const prevBackgroundTextureRef = useRef<THREE.CubeTexture | null>(null); // NEW: Ref to store previous background texture for disposal

  // NEW: State and Ref for managing dynamic effects
  const clock = useMemo(() => new THREE.Clock(), []); // NEW: Clock for effects
  // FIX: 將 currentEffectGroup 的類型改為 EffectGroup，使其包含 update 方法
  const currentEffectGroup = useRef<EffectGroup | null>(null); // NEW: Ref to hold the active effect's 3D group
  const currentEffectName = useRef<string | null>(null); // NEW: Ref to track the name of the active effect


  // NEW: Load background texture when exhibit_background changes and useExhibitionBackground is true
  useEffect(() => {
    // console.log("[SceneContent] Background useEffect triggered.");
    // console.log(`[SceneContent] useExhibitionBackground: ${useExhibitionBackground}, exhibit_background: ${activeExhibition.exhibit_background}`);

    if (useExhibitionBackground && activeExhibition.exhibit_background) {
      setIsBackgroundLoading(true);
      // console.log(`[SceneContent] Attempting to load background from URL: ${activeExhibition.exhibition_background}`);

      const imagePath = activeExhibition.exhibit_background as string;
      // Define array of six identical image paths for CubeTextureLoader
      const cubeTextureUrls = Array(6).fill(imagePath);

      new THREE.CubeTextureLoader().loadAsync(cubeTextureUrls)
        .then(cubeTexture => {
          // console.log("[SceneContent] CubeTexture loaded successfully.");
          // Dispose of the previous texture if it exists
          if (prevBackgroundTextureRef.current) {
            prevBackgroundTextureRef.current.dispose();
            // console.log("[SceneContent] Disposed previous background cubeTexture.");
          }
          setCurrentBackgroundTexture(cubeTexture);
          prevBackgroundTextureRef.current = cubeTexture; // Store current texture for future disposal
          setIsBackgroundLoading(false);
        })
        .catch((e) => {
          // console.error("[SceneContent] CubeTexture loading failed. Background will be solid color.", e);
          // If cube texture also fails, reset to null and dispose previous
          if (prevBackgroundTextureRef.current) {
            prevBackgroundTextureRef.current.dispose();
            // console.log("[SceneContent] Disposed previous background cubeTexture on error.");
          }
          setCurrentBackgroundTexture(null);
          prevBackgroundTextureRef.current = null;
          setIsBackgroundLoading(false);
        });
    } else {
      // If useExhibitionBackground is false or no URL, clear the background texture
      // console.log("[SceneContent] Not using exhibition background or no URL provided. Clearing background texture.");
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


  // MODIFIED: initialFloorColor calculation now respects lightingConfig.floorColor
  const initialFloorColor = useMemo(() => {
    if (lightingConfig.floorColor) {
      return lightingConfig.floorColor;
    }
    return lightsOn ? "#eeeeee" : "#000000";
  }, [lightingConfig.floorColor, lightsOn]);

  useFrame((state, delta) => {
    const lerpSpeed = delta * 10;

    // NEW: Update active effect if any
    // FIX: 這裡已經透過 EffectGroup 介面解決了 TypeScript 的類型檢查問題
    if (currentEffectGroup.current && currentEffectGroup.current.update) {
      currentEffectGroup.current.update(delta);
    }

    // CRITICAL CHANGE: Always run the default background/fog/floor logic, regardless of active effect.
    // Effects are now purely visual overlays and do not alter the scene's core environment properties.
    if (useExhibitionBackground && currentBackgroundTexture && !isBackgroundLoading) {
      // Set background to the loaded texture
      scene.background = currentBackgroundTexture;
      scene.environment = currentBackgroundTexture; // Also set as environment map
      
      // When a background texture is used, floor color comes from lightingConfig.floorColor
      // Fog color should still blend with a neutral color that matches the overall lighting state.
      const targetFogColor = lightsOn ? lightBgColor : darkBgColor; // Fog still adapts to lights on/off
      if (scene.fog instanceof THREE.Fog) scene.fog.color.lerp(targetFogColor, lerpSpeed);
      
      // NEW: Lerp floor color to lightingConfig.floorColor
      if (lightingConfig.floorColor) {
        floorTargetColor.set(lightingConfig.floorColor); // Set the target color
      } else {
        floorTargetColor.set(initialFloorColor); // Fallback to initial if not specified
      }
      if (floorMatRef.current) floorMatRef.current.color.lerp(floorTargetColor, lerpSpeed);
      
      scene.fog = null; // NEW: Disable fog when using exhibition background
      // console.log(`[SceneContent-useFrame] Applying background texture. LightsOn: ${lightsOn}`);
    } else {
      // Revert to solid color background if background texture is not used or loading
      const targetBgColor = new THREE.Color(lightingConfig.backgroundColor || (lightsOn ? lightBgColor : darkBgColor));
      const targetFloorColorSolid = new THREE.Color(lightingConfig.floorColor || (lightsOn ? lightFloorColor : darkFloorColor));

      if (scene.background instanceof THREE.Color) scene.background.lerp(targetBgColor, lerpSpeed);
      // NEW: Enable fog if not using exhibition background
      if (!scene.fog) {
        scene.fog = new THREE.Fog(targetBgColor, 20, 90);
      } else if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.lerp(targetBgColor, lerpSpeed);
      }
      if (floorMatRef.current) floorMatRef.current.color.lerp(targetFloorColorSolid, lerpSpeed); // Use configured or default color
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
  const initialBackgroundColor = (useExhibitionBackground && currentBackgroundTexture) ? undefined : (lightingConfig.backgroundColor || (lightsOn ? "#e4e4e4" : '#050505'));
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
        <group position={new THREE.Vector3(0, -1.5, 0)}>
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
                  onCanvasArtworkClick={(e) => {
                    e.stopPropagation();
                    if (!art.isMotionVideo) {
                      // REMOVED: onSelectArtwork(art.id);
                      onArtworkClicked(e, art.id, art.originalPosition || art.position, art.originalRotation || art.rotation, art.type, !!art.isMotionVideo);
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
                    displayLikes={art.displayLikes}
                    isSmallScreen={isSmallScreen}
                  />
                </ArtworkWrapper>
              );
            })}
        </group>

        <CameraController
          isEditorOpen={isEditorOpen}
          focusedArtworkInstanceId={focusedArtworkInstanceId}
          artworks={artworks}
          isEditorMode={isEditorMode}
          activeEditorTab={activeEditorTab}
          cameraControlRef={cameraControlRef}
          onCameraPositionChange={onCameraPositionChange} // NEW: Pass the callback
          lightingConfig={lightingConfig}
          isRankingMode={isRankingMode} // NEW
          isZeroGravityMode={isZeroGravityMode} // NEW: Pass isZeroGravityMode
          rankingCameraPosition={rankingCameraPosition} // NEW
          rankingCameraTarget={rankingCameraTarget}   // NEW
        />
        {!isEditorMode && !lightsOn && !focusedArtworkInstanceId && !isRankingMode && !isZeroGravityMode && ( // NEW: Add !isZeroGravityMode to condition
          <ProximityHandler
            artworks={artworks}
            setFocusedIndex={onFocusChange}
            currentFocusedIndex={focusedIndex}
            focusedArtworkInstanceId={focusedArtworkInstanceId}
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
