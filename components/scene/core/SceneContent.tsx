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
import SceneAxisHelper from './SceneAxisHelper'; // NEW: Import SceneAxisHelper

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
  activeEditorTab, // NEW: Destructure activeEditorTab
  focusedArtworkInstanceId, // NEW: Destructure focusedArtworkInstanceId
  setFps, // NEW: Destructure setFps
}) => {
  const { lightsOn } = lightingConfig;
  
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const floorMatRef = useRef<THREE.MeshStandardMaterial>(null); // Keep this for lerping base color
  const { scene, camera } = useThree();

  // FPS calculation refs
  const frameTimes = useRef<number[]>([]);
  const lastFpsUpdate = useRef(0);
  const FPS_UPDATE_INTERVAL = 1000; // Update FPS every 1 second

  // Adjusted colors to match the provided scene's values
  const lightBgColor = useMemo(() => new THREE.Color("#e4e4e4"), []);
  const darkBgColor = useMemo(() => new THREE.Color("#050505"), []);
  const lightFloorColor = useMemo(() => new THREE.Color("#eeeeee"), []);
  const darkFloorColor = useMemo(() => new THREE.Color("#0D0C0C"), []);

  useFrame((state, delta) => {
    const lerpSpeed = delta * 1.5;

    // Adjusted intensities to match the provided scene's values
    // UPDATED: Increased ambient intensity when lights are off
    const targetAmbientIntensity = lightsOn ? lightingConfig.ambientIntensity : 0.1; 
    
    const targetBgColor = lightsOn ? lightBgColor : darkBgColor;
    const targetFloorColor = lightsOn ? lightFloorColor : darkFloorColor;

    // FIX: Ensure scene.background is a THREE.Color before calling lerp.
    if (scene.background instanceof THREE.Color) scene.background.lerp(targetBgColor, lerpSpeed);
    // FIX: Ensure scene.fog is a THREE.Fog before calling lerp on its color.
    if (scene.fog instanceof THREE.Fog) scene.fog.color.lerp(targetBgColor, lerpSpeed);
    if (ambientRef.current) ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, targetAmbientIntensity, lerpSpeed);
    
    // Directional lights are now conditionally rendered, so their lerp is simpler
    // Their intensities are set directly in the JSX when mounted.
    if (floorMatRef.current) floorMatRef.current.color.lerp(targetFloorColor, lerpSpeed);

    // NEW: FPS calculation
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
  
  // Removed the useEffect that listened to resetTrigger here. CameraController will handle it.

  // Initial colors for direct assignment (before lerp starts)
  const initialBackgroundColor = lightsOn ? "#e4e4e4" : '#050505';
  const initialFloorColor = lightsOn ? "#eeeeee" : "#151515";

  const ambientLightColor = useMemo(() => new THREE.Color(kelvinToHex(lightingConfig.colorTemperature)), [lightingConfig.colorTemperature]);
  const directionalLightColor = useMemo(() => new THREE.Color(ambientLightColor), [ambientLightColor]);

  // NEW: Determine if SceneAxisHelper should be shown
  const showAxisHelper = isEditorMode && isEditorOpen && activeEditorTab === 'layout';
  const axisColor = lightsOn ? '#aaaaaa' : '#555555'; // Darker gray in dark mode
  
  return (
    <>
        <CameraController 
          isEditorOpen={isEditorOpen} 
          resetTrigger={resetTrigger} 
          focusedArtworkInstanceId={focusedArtworkInstanceId} // NEW: Pass focusedArtworkInstanceId
          artworks={artworks} // NEW: Pass artworks to CameraController
          isEditorMode={isEditorMode} // NEW: Pass isEditorMode
          activeEditorTab={activeEditorTab} // NEW: Pass activeEditorTab
        />
        {/* MODIFIED: ProximityHandler is now disabled if lightsOn is true (in non-editor mode) */}
        {!isEditorMode && !lightsOn && <ProximityHandler 
          artworks={artworks} // Pass full artworks array
          setFocusedIndex={onFocusChange} 
          currentFocusedIndex={focusedIndex}
        />}

        {/* FIX: Use lowercased JSX intrinsic elements for R3F components */}
        <color attach="background" args={[initialBackgroundColor]} />
        <fog attach="fog" args={[initialBackgroundColor, 20, 90]} />

        <ambientLight 
          ref={ambientRef}
          color={ambientLightColor} // Use Kelvin derived color for ambient
          intensity={lightsOn ? lightingConfig.ambientIntensity : 0.1} // Set initial intensity based on lightsOn
        />
        
        {lightsOn && ( // Conditional group for directional lights
           // FIX: Use lowercase intrinsic element 'group'
           <group>
             {/* FIX: Use lowercase intrinsic element 'directionalLight' */}
             <directionalLight 
               position={[-8, 15, 8]} 
               intensity={1.8} // Changed from 1.5 to 1.8 for brighter scene
               color={directionalLightColor}
               castShadow 
               shadow-mapSize={[1024, 1024]} // Reduced shadow map resolution from 2048 to 1024
               shadow-camera-left={-10}
               shadow-camera-right={10}
               shadow-camera-top={10}
               shadow-camera-bottom={-10}
               shadow-bias={-0.0001}
               shadow-normalBias={0.03} // Decreased for sharper shadows
             />
             {/* FIX: Use lowercase intrinsic element 'directionalLight' */}
             <directionalLight 
                position={[10, 5, -5]} 
                intensity={0.8} // Changed from 0.6 to 0.8 for brighter scene
                color="#dbeafe" 
            />
           </group>
        )}
        {/* ContactShadows are now always rendered, but their opacity depends on lightsOn */}
        <ContactShadows 
          position={[0, 0.01, 0]} 
          scale={100} 
          resolution={1024} 
          far={10} 
          blur={3} 
          // UPDATED: Increased opacity when lights are off for better visibility
          opacity={lightsOn ? 0.7 : 0.5} 
          color="#000000" 
          frames={1} 
        />

        {/* FIX: Use lowercase intrinsic element 'group' */}
        <group position={[0, -1.5, 0]}>
            {/* FIX: Use lowercase intrinsic element 'mesh' */}
            <mesh 
              rotation={[-Math.PI / 2, 0, 0]} 
              position={[0, -0.02, 0]} 
              receiveShadow={true} // Reverted to receive shadows
            >
              {/* FIX: Use lowercase intrinsic element 'planeGeometry' */}
              <planeGeometry args={[10000, 10000]} />
              {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
              <meshStandardMaterial
                ref={floorMatRef}
                color={initialFloorColor} // Base color
                roughness={0.55} // Reverted roughness
                metalness={0.1} // Reverted metalness
              />
            </mesh>
            
            {/* NEW: Removed the black rectangular plane */}

            {showAxisHelper && ( // NEW: Conditionally render SceneAxisHelper
              <SceneAxisHelper 
                sizeX={24} // Corresponds to LayoutTab's SCENE_BOUNDS_X
                sizeZ={12} // Corresponds to LayoutTab's SCENE_BOUNDS_Z
                color={axisColor}
                lineWidth={0.1}
                offsetY={0.02}
              />
            )}

            {artworks.map((art, index) => {
              const highlightColor = lightingConfig.manualSpotlightColor; // Simplified: Use manualSpotlightColor for both auto and manual modes
              const isFocused = isEditorMode ? art.id === selectedArtworkId : focusedIndex === index;

              return (
                // FIX: Use lowercase intrinsic element 'group'
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
                      artworkType={art.type} // Pass artwork type to SmartSpotlight
                    />
                   <ArtComponent 
                        type={art.type} 
                        zone={currentZoneTheme} 
                        isFocused={isFocused}
                        textureUrl={art.textureUrl}
                        artworkData={art.artworkData} // NEW: Pass artworkData
                        isMotionVideo={art.isMotionVideo} // NEW: Pass motion video flag
                        isFaultyMotionVideo={art.isFaultyMotionVideo} // NEW: Pass faulty video flag
                        lightsOn={lightsOn} // FIX: Pass lightsOn prop to ArtComponent
                    />
                </group>
              );
            })}
        </group>

        {/* Environment component always renders, with dynamic preset */}
        <Environment preset={lightsOn ? "city" : "night"} background={false} />
    </>
  );
};

export default SceneContent;