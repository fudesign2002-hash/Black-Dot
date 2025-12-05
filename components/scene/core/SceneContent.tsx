import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment, ContactShadows } from '@react-three/drei';

import { SceneProps } from '../Scene';
import CameraController from './CameraController';
import ProximityHandler from './ProximityHandler';
import ArtComponent from './ArtComponent';
import SmartSpotlight from '../lighting/SmartSpotlight';
import { kelvinToHex } from '../../../services/utils/colorUtils';
import SceneAxisHelper from './SceneAxisHelper';
import ArtworkWrapper from './ArtworkWrapper';


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
}) => {
  const { lightsOn } = lightingConfig;

  const dirLight1Ref = useRef<THREE.DirectionalLight>(null);
  const dirLight2Ref = useRef<THREE.DirectionalLight>(null);
  const floorMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const { scene, camera } = useThree();

  const frameTimes = useRef<number[]>([]);
  const lastFpsUpdate = useRef(0);
  const FPS_UPDATE_INTERVAL = 1000;

  const lightBgColor = useMemo(() => new THREE.Color("#e4e4e4"), []);
  const darkBgColor = useMemo(() => new THREE.Color("#000000"), []);
  const lightFloorColor = useMemo(() => new THREE.Color("#eeeeee"), []);
  const darkFloorColor = useMemo(() => new THREE.Color("#000000"), []);

  useFrame((state, delta) => {
    const lerpSpeed = delta * 3;


    const targetBgColor = lightsOn ? lightBgColor : darkBgColor;
    const targetFloorColor = lightsOn ? lightFloorColor : darkFloorColor;

    if (scene.background instanceof THREE.Color) scene.background.lerp(targetBgColor, lerpSpeed);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.lerp(targetBgColor, lerpSpeed);


    if (floorMatRef.current) floorMatRef.current.color.lerp(targetFloorColor, lerpSpeed);

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

  const initialBackgroundColor = lightsOn ? "#e4e4e4" : '#050505';
  const initialFloorColor = lightsOn ? "#eeeeee" : "#000000";

  const directionalLightColor = useMemo(() => new THREE.Color(kelvinToHex(lightingConfig.colorTemperature)), [lightingConfig.colorTemperature]);

  const showAxisHelper = isEditorMode && isEditorOpen && activeEditorTab === 'layout';
  const axisColor = lightsOn ? '#aaaaaa' : '#555555';

  const selectedArtwork = useMemo(() => artworks.find(art => art.id === selectedArtworkId), [artworks, selectedArtworkId]);

  return (
    <React.Fragment>
        <CameraController
          isEditorOpen={isEditorOpen}
          focusedArtworkInstanceId={focusedArtworkInstanceId}
          artworks={artworks}
          isEditorMode={isEditorMode}
          activeEditorTab={activeEditorTab}
          cameraControlRef={cameraControlRef}
        />
        {!isEditorMode && !lightsOn && !focusedArtworkInstanceId && !isRankingMode && (
          <ProximityHandler
            artworks={artworks}
            setFocusedIndex={onFocusChange}
            currentFocusedIndex={focusedIndex}
            focusedArtworkInstanceId={focusedArtworkInstanceId}
          />
        )}

        <color attach="background" args={[initialBackgroundColor]} />
        <fog attach="fog" args={[initialBackgroundColor, 20, 90]} />


        <directionalLight
            ref={dirLight1Ref}
            position={lightingConfig.keyLightPosition || [-2, 6, 9]}
            intensity={lightsOn ? 3.0 : 0}
            color={directionalLightColor}
            castShadow
            shadow-mapSize={[512, 512]}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
            shadow-bias={-0.0001}
            shadow-normalBias={0.05}
        />
        <directionalLight
            ref={dirLight2Ref}
            position={lightingConfig.fillLightPosition || [5, 0, 5]}
            intensity={lightsOn ? 0.9 : 0}
            color="#dbeafe"
        />

        <group position={[0, -1.5, 0]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.02, 0]}
              receiveShadow={true}
            >
              <planeGeometry args={[300, 300]} />
              <meshStandardMaterial
                ref={floorMatRef}
                color={initialFloorColor}
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

            {artworks.map((art, index) => {
              const highlightColor = lightingConfig.manualSpotlightColor;

              const isExplicitlyFocused = isEditorMode ? art.id === selectedArtworkId : focusedArtworkInstanceId === art.id;

              const isProximityFocusedInDark = !isEditorMode && !lightsOn && !focusedArtworkInstanceId && index === focusedIndex && !isRankingMode;

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
                  onArtworkClicked={(e) => {
                    e.stopPropagation();
                    if (!art.isMotionVideo) {
                      onSelectArtwork(art.id);
                      onArtworkClicked(e, art.id, art.originalPosition || art.position, art.originalRotation || art.rotation, art.type, !!art.isMotionVideo);
                    }
                  }}
                >
                  <SmartSpotlight
                    isActive={isSmartSpotlightActive}
                    lightsOn={lightsOn}
                    color={highlightColor}
                    spotlightMode={lightingConfig.spotlightMode}
                    isEditorMode={isEditorMode}
                    isMotionVideo={art.isMotionVideo}
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
                  />
                </ArtworkWrapper>
              );
            })}
        </group>

        <Environment preset={lightsOn ? "city" : "night"} background={false} />
    </React.Fragment>
  );
};

export default SceneContent;