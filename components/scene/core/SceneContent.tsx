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

const SceneContent: React.FC<SceneProps> = ({ 
  lightingConfig, 
  resetTrigger, 
  currentZoneTheme, 
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
}) => {
  const { lightsOn } = lightingConfig;
  
  const ambientRef = useRef<THREE.AmbientLight>(null);
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
    const lerpSpeed = delta * 1.5;

    const targetAmbientIntensity = lightsOn ? lightingConfig.ambientIntensity : 0.1;
    
    const targetBgColor = lightsOn ? lightBgColor : darkBgColor;
    const targetFloorColor = lightsOn ? lightFloorColor : darkFloorColor;

    if (scene.background instanceof THREE.Color) scene.background.lerp(targetBgColor, lerpSpeed);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.lerp(targetBgColor, lerpSpeed);
    if (ambientRef.current) ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, targetAmbientIntensity, lerpSpeed);
    
    
    if (floorMatRef.current) floorMatRef.current.color.lerp(targetFloorColor, lerpSpeed);

    const now = performance.now();
    frameTimes.current.push(now);
    while (frameTimes.current.length > 0 && frameTimes.current[0] < now - 1000) {
      frameTimes.current.shift();
    }
    if (now - lastFpsUpdate.current > FPS_UPDATE_INTERVAL) {
      setFps(frameTimes.current.length);
      lastFpsUpdate.current = now;
    }
  });
  
  const initialBackgroundColor = lightsOn ? "#e4e4e4" : '#050505';
  const initialFloorColor = lightsOn ? "#eeeeee" : "#000000";

  const ambientLightColor = useMemo(() => new THREE.Color(kelvinToHex(lightingConfig.colorTemperature)), [lightingConfig.colorTemperature]);
  const directionalLightColor = useMemo(() => new THREE.Color(ambientLightColor), [ambientLightColor]);

  const showAxisHelper = isEditorMode && isEditorOpen && activeEditorTab === 'layout';
  const axisColor = lightsOn ? '#aaaaaa' : '#555555';
  
  return (
    <>
        <CameraController 
          isEditorOpen={isEditorOpen} 
          resetTrigger={resetTrigger} 
          focusedArtworkInstanceId={focusedArtworkInstanceId}
          artworks={artworks}
          isEditorMode={isEditorMode}
          activeEditorTab={activeEditorTab}
        />
        {!isEditorMode && !lightsOn && <ProximityHandler 
          artworks={artworks}
          setFocusedIndex={onFocusChange} 
          currentFocusedIndex={focusedIndex}
        />}

        <color attach="background" args={[initialBackgroundColor]} />
        <fog attach="fog" args={[initialBackgroundColor, 20, 90]} />

        <ambientLight 
          ref={ambientRef}
          color={ambientLightColor}
          intensity={lightsOn ? lightingConfig.ambientIntensity : 0.0.05}
        />
        
        {lightsOn && (
           <group>
             <directionalLight 
               position={[-8, 15, 8]} 
               intensity={1.8}
               color={directionalLightColor}
               castShadow 
               shadow-mapSize={[1024, 1024]}
               shadow-camera-left={-10}
               shadow-camera-right={10}
               shadow-camera-top={10}
               shadow-camera-bottom={-10}
               shadow-bias={-0.0001}
               shadow-normalBias={0.03}
             />
             <directionalLight 
                position={[10, 5, -5]} 
                intensity={0.8}
                color="#dbeafe" 
            />
           </group>
        )}
        <ContactShadows 
          position={[0, 0.01, 0]} 
          scale={100} 
          resolution={1024} 
          far={10} 
          blur={3} 
          opacity={lightsOn ? 0.7 : 0.5} 
          color="#000000" 
          frames={1} 
        />

        <group position={[0, -1.5, 0]}>
            <mesh 
              rotation={[-Math.PI / 2, 0, 0]} 
              position={[0, -0.02, 0]} 
              receiveShadow={true}
            >
              <planeGeometry args={[10000, 10000]} />
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
                lineWidth={0.1}
                offsetY={0.02}
              />
            )}

            {artworks.map((art, index) => {
              const highlightColor = lightingConfig.manualSpotlightColor;
              const isFocused = isEditorMode ? art.id === selectedArtworkId : focusedIndex === index;

              return (
                <group 
                  key={art.id}
                  name={art.id}
                  position={art.position} 
                  rotation={art.rotation} 
                  scale={art.scale}
                >
                   <SmartSpotlight 
                      isActive={isFocused} 
                      lightsOn={lightsOn} 
                      color={highlightColor}
                      spotlightMode={lightingConfig.spotlightMode}
                      artworkType={art.type}
                    />
                   <ArtComponent 
                        type={art.type} 
                        zone={currentZoneTheme} 
                        isFocused={isFocused}
                        textureUrl={art.textureUrl}
                        artworkData={art.artworkData}
                        isMotionVideo={art.isMotionVideo}
                        isFaultyMotionVideo={art.isFaultyMotionVideo}
                        lightsOn={lightsOn}
                    />
                </group>
              );
            })}
        </group>

        <Environment preset={lightsOn ? "city" : "night"} background={false} />
    </>
  );
};

export default SceneContent;