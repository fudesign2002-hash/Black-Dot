
import React, { useMemo, useRef, useEffect, useState, Suspense } from 'react';
import * as THREE from 'three';
import { useGLTF, primitive } from '@react-three/drei'; // NEW: Import primitive
import { useFrame } from '@react-three/fiber';
import { ArtworkData, ArtworkGeometry } from '../../../types';
import Podium from './Podium';

// Renamed and updated to map incoming data type string to R3F component type string
const getGeometryComponentTypeString = (type: ArtworkGeometry['type'] | string): string => {
  switch (type) {
    case 'boxGeometry': return 'boxGeometry';
    case 'cylinderGeometry': return 'cylinderGeometry';
    case 'icosahedronGeometry': return 'icosahedronGeometry';
    case 'torusGeometry': return 'torusGeometry';
    case 'torusKnotGeometry': return 'torusKnotGeometry';
    case 'sphereGeometry': return 'sphereGeometry';
    case 'cone': return 'coneGeometry'; // Map 'cone' from data to 'coneGeometry' for R3F
    default: return 'boxGeometry'; // Fallback
  }
};

// Helper to create a Three.js geometry instance from type and args
const createGeometryInstance = (type: string, args: number[]): THREE.BufferGeometry => {
  switch (type) {
    case 'boxGeometry': return new THREE.BoxGeometry(...(args as [number, number, number]));
    case 'cylinderGeometry': return new THREE.CylinderGeometry(...(args as [number, number, number, number, number, boolean, number, number]));
    case 'icosahedronGeometry': return new THREE.IcosahedronGeometry(...(args as [number, number]));
    case 'torusGeometry': return new THREE.TorusGeometry(...(args as [number, number, number, number, number]));
    case 'torusKnotGeometry': return new THREE.TorusKnotGeometry(...(args as [number, number, number, number, number, number]));
    case 'sphereGeometry': return new THREE.SphereGeometry(...(args as [number, number, number, number, number, number, number]));
    case 'coneGeometry': return new THREE.ConeGeometry(...(args as [number?, number?, number?, number?, boolean?, number?, number?])); // Corrected coneGeometry args type
    default: return new THREE.BoxGeometry(1, 1, 1); // Fallback to a 1x1x1 box
  }
};

const getSide = (sideString: string | undefined): THREE.Side => {
  switch (sideString) {
    case 'front': return THREE.FrontSide;
    case 'back': return THREE.BackSide;
    case 'double': return THREE.DoubleSide;
    default: return THREE.FrontSide; // Default to front side if not specified
  }
};

interface SculptureExhibitProps {
  artworkData?: ArtworkData;
  zone: string; // Keep zone for potential use with useZoneMaterial if artworkData is incomplete
  textureUrl?: string; // NEW: Add textureUrl prop for GLB models
}

// A slight offset applied to all sculptures to visually embed them slightly into the podium.
// A negative value will sink the artwork, a positive value will raise it.
const DEFAULT_SCULPTURE_GROUNDING_ADJUSTMENT = 0; 

const FADE_DURATION = 800; // milliseconds for GLB fade-in

const SculptureExhibit: React.FC<SculptureExhibitProps> = ({ artworkData, zone, textureUrl }) => { // NEW: Add textureUrl
  // Check if it's a GLB model
  const isGLB = useMemo(() => textureUrl && textureUrl.toLowerCase().includes('.glb'), [textureUrl]);

  // Load GLB model if textureUrl is a GLB
  const gltf = isGLB && textureUrl ? useGLTF(textureUrl) : null;

  // Initial material properties (default values for parameters if artworkData.material is missing)
  const defaultMaterialPropsForGlb = useMemo(() => ({
    color: '#ffffff',
    emissive: '#000000',
    emissiveIntensity: 0,
    metalness: 0,
    roughness: 0.5,
    side: THREE.FrontSide,
    transparent: true, // Always transparent for fading
    opacity: 1,
    transmission: 0,
    thickness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0,
  }), []);

  // NEW: Process GLB scene to remove lights and cameras, and materials
  // This must be declared before useEffect that depends on it.
  const cleanedGlbScene = useMemo(() => {
    if (!isGLB || !gltf?.scene) return null;
    const sceneClone = gltf.scene.clone(); // Clone the scene to avoid modifying the cached original
    
    sceneClone.traverse((child) => {
      // Remove GLB-embedded lights and cameras to prevent interference
      // FIX: Use instanceof checks for Three.js types
      if (child instanceof THREE.Light || child instanceof THREE.Camera) {
        if (child.parent) {
          child.parent.remove(child);
        }
      }
    });
    return sceneClone;
  }, [isGLB, gltf?.scene]);

  // State for the GLB scene with materials applied, ready for rendering
  const [clonedGlbWithMaterial, setClonedGlbWithMaterial] = useState<THREE.Group | null>(null);

  // Effect to apply custom materials to the GLB model
  useEffect(() => {
    if (!isGLB || !cleanedGlbScene) {
      setClonedGlbWithMaterial(null);
      return;
    }

    const newScene = cleanedGlbScene.clone(); // Clone again for material application
    newScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(originalMaterial => {
          let newMaterial;
          // Clone existing material to preserve maps/textures if it's a PBR material
          if (originalMaterial instanceof THREE.MeshStandardMaterial || originalMaterial instanceof THREE.MeshPhysicalMaterial) {
              newMaterial = originalMaterial.clone();
          } else {
              newMaterial = new THREE.MeshStandardMaterial(); // Fallback to a basic PBR material
          }

          const config = artworkData?.material;

          // Apply custom material properties if defined, otherwise use defaults
          newMaterial.color.set(config?.color ?? defaultMaterialPropsForGlb.color);
          newMaterial.emissive.set(config?.emissive ?? defaultMaterialPropsForGlb.emissive);
          newMaterial.emissiveIntensity = config?.emissiveIntensity ?? defaultMaterialPropsForGlb.emissiveIntensity;
          newMaterial.metalness = config?.metalness ?? defaultMaterialPropsForGlb.metalness;
          newMaterial.roughness = config?.roughness ?? defaultMaterialPropsForGlb.roughness;
          newMaterial.side = getSide(config?.side);
          newMaterial.transparent = config?.transparent ?? defaultMaterialPropsForGlb.transparent;
          newMaterial.transmission = config?.transmission ?? defaultMaterialPropsForGlb.transmission;
          newMaterial.thickness = config?.thickness ?? defaultMaterialPropsForGlb.thickness;
          newMaterial.clearcoat = config?.clearcoat ?? defaultMaterialPropsForGlb.clearcoat;
          newMaterial.clearcoatRoughness = config?.clearcoatRoughness ?? defaultMaterialPropsForGlb.clearcoatRoughness;
          
          newMaterial.transparent = true; // Crucial: ensure transparent is true for fade effect
          newMaterial.opacity = 0; // Initial opacity for fade-in

          child.material = newMaterial;
          child.material.needsUpdate = true; // Mark as updated
        });
      }
    });
    setClonedGlbWithMaterial(newScene);
  }, [isGLB, cleanedGlbScene, artworkData?.material, defaultMaterialPropsForGlb]);


  // NEW: State for fade progress and ref for GLB group
  const [fadeProgress, setFadeProgress] = useState(0);
  const glbGroupRef = useRef<THREE.Group>(null);
  const fadeStartTime = useRef<number | null>(null); // Ref to track fade animation start time

  // Effect to start fade animation when GLB is ready
  useEffect(() => {
    if (isGLB && clonedGlbWithMaterial) { // Trigger fade when the cloned scene with material is ready
      fadeStartTime.current = performance.now();
      setFadeProgress(0); // Reset to 0 to start fade
    } else if (!isGLB) {
      setFadeProgress(1); // Non-GLB is always visible
      fadeStartTime.current = null;
    }
  }, [isGLB, clonedGlbWithMaterial]); // Depend on clonedGlbWithMaterial

  useFrame((state) => {
    if (isGLB && clonedGlbWithMaterial && fadeStartTime.current !== null) {
      const elapsedTime = performance.now() - fadeStartTime.current;
      const newProgress = Math.min(1, elapsedTime / FADE_DURATION);
      
      setFadeProgress(newProgress); // Update state directly

      // Apply opacity to materials of clonedGlbWithMaterial
      clonedGlbWithMaterial.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => {
            if (material instanceof THREE.Material) {
                material.opacity = newProgress;
                material.needsUpdate = true;
            }
          });
        }
      });
      if (newProgress === 1) {
          fadeStartTime.current = null; // Animation complete, stop processing
      }
    }
  });


  // Default material values if not provided in artworkData
  const defaultMaterialProps = useMemo(() => ({
    color: '#ffffff',
    emissive: '#000000',
    emissiveIntensity: 0,
    metalness: 0,
    roughness: 0.5,
    side: THREE.FrontSide,
    transparent: false,
    opacity: 1,
    transmission: 0,
    thickness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0,
  }), []);

  // Use artworkData for geometry and material, with fallbacks
  const geometryComponent = useMemo(() => {
    if (!artworkData?.geometry) {
      // console.warn("ArtworkData missing geometry, falling back to default box.");
      return { type: 'boxGeometry', args: [1, 1, 1] };
    }
    return {
      type: getGeometryComponentTypeString(artworkData.geometry.type), // Use the new mapping function
      args: artworkData.geometry.args || [1, 1, 1], // Default args if missing
    };
  }, [artworkData]);

  const positionOffset = artworkData?.position_offset || [0, 0, 0]; 
  // Get rotation_offset (radians) from artworkData for editor-defined rotation
  const rotationOffset = artworkData?.rotation_offset || [0, 0, 0]; 

  // NEW: Calculate the effective GLB rotation Euler object, applying the remapping
  const glbRotationEuler = useMemo(() => {
    // Mapping from editor's conceptual X,Y,Z (stored in rotationOffset) to Three.js Euler X,Y,Z.
    // Assuming `rotationOffset` array is `[Editor_X_Roll, Editor_Y_Pitch, Editor_Z_Yaw]`
    // and Three.js Euler order is 'XYZ'.
    const finalRotation = [
      rotationOffset[1], // Three.js X (Pitch) gets Editor Y (Pitch)
      rotationOffset[2], // Three.js Y (Yaw) gets Editor Z (Yaw)
      rotationOffset[0], // Three.js Z (Roll) gets Editor X (Roll)
    ] as [number, number, number];
    return new THREE.Euler(...finalRotation, 'XYZ');
  }, [rotationOffset]);

  // NEW: Recompute glbRenderProps to factor in rotation for yOffset and rotated dimensions
  const glbRenderProps = useMemo(() => {
    if (!isGLB || !cleanedGlbScene) {
      return { scale: 1, yOffset: 0, horizontalFootprint: 0, height: 0, xCenterOffset: 0, zCenterOffset: 0 };
    }

    // --- 1. Determine base scaling without rotation ---
    // Create a temporary object to get the *unscaled, un-rotated* local bounding box
    const tempScaleObject = new THREE.Group();
    tempScaleObject.add(cleanedGlbScene.clone());
    const localBoxUnscaled = new THREE.Box3().setFromObject(tempScaleObject);
    const localSizeUnscaled = localBoxUnscaled.getSize(new THREE.Vector3());

    const targetDisplaySize = 3; // Max target width/depth for the GLB model to fit
    const currentMaxHorizontalLocal = Math.max(localSizeUnscaled.x, localSizeUnscaled.z);

    let scaleFactor = 1;
    if (currentMaxHorizontalLocal > targetDisplaySize) {
      scaleFactor = targetDisplaySize / currentMaxHorizontalLocal;
    } else if (currentMaxHorizontalLocal < targetDisplaySize / 2) { // Optionally scale up smaller models
      scaleFactor = targetDisplaySize / (currentMaxHorizontalLocal * 2); 
    }
    
    // Cap maximum scaled height relative to the *unscaled* object's original height
    const maxOverallDimensionLocal = Math.max(currentMaxHorizontalLocal, localSizeUnscaled.y);
    if (maxOverallDimensionLocal * scaleFactor > 6) { // Max allowed height for the scaled model
        scaleFactor = (6 / maxOverallDimensionLocal);
    }
    
    // --- 2. Create a second temporary object, apply scale and rotation for *transformed* bounds calculation ---
    const tempBoundsObject = new THREE.Group();
    
    // Apply the determined scale and rotation to this temporary parent group
    tempBoundsObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
    tempBoundsObject.rotation.copy(glbRotationEuler);
    
    // Add an *untransformed* clone of the cleaned GLB scene as a child
    tempBoundsObject.add(cleanedGlbScene.clone()); 
    
    // Compute bounding box AFTER the parent group's transformations have been applied
    const worldBox = new THREE.Box3().setFromObject(tempBoundsObject);
    const worldSize = worldBox.getSize(new THREE.Vector3());
    const worldCenter = worldBox.getCenter(new THREE.Vector3()); // Get center of the transformed bounding box

    const lowestPointY = worldBox.min.y;
    // yOffset ensures the lowest point of the *transformed* GLB is at Y=0 relative to its parent group
    const yOffset = -lowestPointY; 

    const horizontalFootprint = Math.max(worldSize.x, worldSize.z);
    const height = worldSize.y;
    
    // CRITICAL: xCenterOffset and zCenterOffset represent how much the GLB's visual center
    // is offset from its parent group's local origin (0,0,0) after scaling and rotation.
    // We will subtract these offsets from the GLB's *position* to visually center it.
    const xCenterOffset = worldCenter.x;
    let zCenterOffset = worldCenter.z;


    return { scale: scaleFactor, yOffset, horizontalFootprint, height, xCenterOffset, zCenterOffset };
  }, [isGLB, cleanedGlbScene, glbRotationEuler]); // Depend on cleanedGlbScene and glbRotationEuler


  // Parametric geometry bounds (unaffected by GLB logic)
  const { geometryMinY, geometryMaxY, geometryMinX, geometryMaxX, geometryMinZ, geometryMaxZ } = useMemo(() => {
    if (isGLB) return { geometryMinY: 0, geometryMaxY: 0, geometryMinX: 0, geometryMaxX: 0, geometryMinZ: 0, geometryMaxZ: 0 };

    if (!artworkData?.geometry || !geometryComponent.type || !geometryComponent.args) return { geometryMinY: 0, geometryMaxY: 0, geometryMinX: 0, geometryMaxX: 0, geometryMinZ: 0, geometryMaxZ: 0 };
    try {
      const geomInstance = createGeometryInstance(geometryComponent.type, geometryComponent.args);
      geomInstance.computeBoundingBox();
      return {
        geometryMinY: geomInstance.boundingBox?.min.y || 0,
        geometryMaxY: geomInstance.boundingBox?.max.y || 0,
        geometryMinX: geomInstance.boundingBox?.min.x || 0,
        geometryMaxX: geomInstance.boundingBox?.max.x || 0,
        geometryMinZ: geomInstance.boundingBox?.min.z || 0,
        geometryMaxZ: geomInstance.boundingBox?.max.z || 0,
      };
    } catch (error) {
      console.error("Error computing bounding box for geometry:", geometryComponent, error);
      return { geometryMinY: 0, geometryMaxY: 0, geometryMinX: 0, geometryMaxX: 0, geometryMinZ: 0, geometryMaxZ: 0 };
    }
  }, [artworkData, geometryComponent, isGLB]);

  // NEW: These now correctly use glbRenderProps if it's a GLB, otherwise parametric bounds
  const sculptureVisualHeight = isGLB ? glbRenderProps.height : (geometryMaxY - geometryMinY);
  const sculptureVisualWidth = geometryMaxX - geometryMinX; 
  const sculptureVisualDepth = geometryMaxZ - geometryMinZ; 
  // For parametric, use the greater of width/depth for its footprint
  const parametricHorizontalFootprint = Math.max(sculptureVisualWidth, sculptureVisualDepth);

  // Overall horizontal footprint for dynamic podium width calculation, considering GLB rotation
  const finalSculptureHorizontalFootprint = isGLB ? glbRenderProps.horizontalFootprint : parametricHorizontalFootprint;


  // Constants for podium height calculation based on sculpture height
  const MIN_SCULPTURE_HEIGHT_FOR_PODIUM = 0.1; // Smallest sculpture height that affects podium sizing
  const MAX_SCULPTURE_HEIGHT_FOR_PODIUM = 6.0;  // Tallest sculpture height that affects podium sizing
  const MIN_DYNAMIC_PODIUM_HEIGHT = 0.5;      // Absolute minimum podium height
  const MAX_DYNAMIC_PODIUM_HEIGHT = 3.0;      // Absolute maximum podium height

  const dynamicPodiumHeight = useMemo(() => {
    // Clamp sculpture height within the defined range for calculation
    const clampedSculptureHeight = Math.max(
      MIN_SCULPTURE_HEIGHT_FOR_PODIUM,
      Math.min(sculptureVisualHeight, MAX_SCULPTURE_HEIGHT_FOR_PODIUM)
    );

    // Normalize sculpture height to a 0-1 range based on the clamped values
    const normalizedSculptureHeight = (clampedSculptureHeight - MIN_SCULPTURE_HEIGHT_FOR_PODIUM) / 
                                      (MAX_SCULPTURE_HEIGHT_FOR_PODIUM - MIN_SCULPTURE_HEIGHT_FOR_PODIUM);

    // Inversely map normalized height to the podium height range
    // Taller sculpture (normalizedHeight closer to 1) -> shorter podium (closer to MIN_DYNAMIC_PODIUM_HEIGHT)
    // Shorter sculpture (normalizedHeight closer to 0) -> taller podium (closer to MAX_DYNAMIC_PODIUM_HEIGHT)
    const calculatedPodiumHeight = MAX_DYNAMIC_PODIUM_HEIGHT - 
                                   (normalizedSculptureHeight * (MAX_DYNAMIC_PODIUM_HEIGHT - MIN_DYNAMIC_PODIUM_HEIGHT));
    
    // Ensure the final podium height is within its own defined min/max bounds
    return Math.max(MIN_DYNAMIC_PODIUM_HEIGHT, Math.min(MAX_DYNAMIC_PODIUM_HEIGHT, calculatedPodiumHeight));
  }, [sculptureVisualHeight]);


  // Constants for podium width calculation based on sculpture's horizontal footprint
  const MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM = 0.1; // Smallest sculpture footprint that affects podium sizing
  const MAX_SCULPTURE_HORIZONTAL_FOR_PODIUM = 6.0;  // Largest sculpture footprint that affects podium sizing
  const MIN_DYNAMIC_PODIUM_WIDTH = 1.0;          // Absolute minimum podium width
  const MAX_DYNAMIC_PODIUM_WIDTH = 5.0;          // Absolute maximum podium width
  const PODIUM_WIDTH_BUFFER = 0.5;               // Minimum extra space around the artwork (e.g., 0.25 on each side)

  const dynamicPodiumWidth = useMemo(() => {
    // Clamp sculpture footprint within the defined range for calculation
    const clampedFootprint = Math.max(
      MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM,
      Math.min(finalSculptureHorizontalFootprint, MAX_SCULPTURE_HORIZONTAL_FOR_PODIUM)
    );

    // Normalize sculpture footprint to a 0-1 range based on the clamped values
    const normalizedFootprint = (clampedFootprint - MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM) / 
                                (MAX_SCULPTURE_HORIZONTAL_FOR_PODIUM - MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM);

    // Map normalized footprint to the podium width range (positive correlation)
    // Larger footprint -> wider podium
    let calculatedPodiumWidth = MIN_DYNAMIC_PODIUM_WIDTH + 
                                (normalizedFootprint * (MAX_DYNAMIC_PODIUM_WIDTH - MIN_DYNAMIC_PODIUM_WIDTH));

    // CRITICAL: Ensure the podium is always wider than the artwork's footprint plus a buffer
    calculatedPodiumWidth = Math.max(calculatedPodiumWidth, finalSculptureHorizontalFootprint + PODIUM_WIDTH_BUFFER);
    
    // Ensure the final podium width is within its own defined min/max bounds
    return Math.max(MIN_DYNAMIC_PODIUM_WIDTH, Math.min(MAX_DYNAMIC_PODIUM_WIDTH, calculatedPodiumWidth));
  }, [finalSculptureHorizontalFootprint]);


  // podiumHeight parameter for Podium component, now dynamic
  const actualPodiumHeight = dynamicPodiumHeight;
  const actualPodiumWidth = dynamicPodiumWidth; 

  const materialProps = useMemo(() => {
    const config = artworkData?.material; 
    return {
      // FIX: Use optional chaining and nullish coalescing for all material properties
      color: config?.color ?? defaultMaterialProps.color,
      emissive: config?.emissive ?? defaultMaterialProps.emissive,
      emissiveIntensity: config?.emissiveIntensity ?? defaultMaterialProps.emissiveIntensity,
      metalness: config?.metalness ?? defaultMaterialProps.metalness,
      roughness: config?.roughness ?? defaultMaterialProps.roughness,
      side: getSide(config?.side),
      transparent: config?.transparent ?? defaultMaterialProps.transparent,
      opacity: config?.opacity ?? defaultMaterialProps.opacity,
      transmission: config?.transmission ?? defaultMaterialProps.transmission,
      thickness: config?.thickness ?? defaultMaterialProps.thickness,
      clearcoat: config?.clearcoat ?? defaultMaterialProps.clearcoat,
      clearcoatRoughness: config?.clearcoatRoughness ?? defaultMaterialProps.clearcoatRoughness,
    };
  }, [artworkData, defaultMaterialProps]);

  // Calculate final Y position for the mesh group.
  const finalGroupYPosition = useMemo(() => {
    if (isGLB) {
      // glbRenderProps.yOffset already ensures the lowest point of the *transformed* GLB is at local Y=0
      return actualPodiumHeight + glbRenderProps.yOffset + DEFAULT_SCULPTURE_GROUNDING_ADJUSTMENT;
    }
    // For parametric, autoGroundingY brings its base to its local y=0.
    const autoGroundingY = -geometryMinY; 
    const additionalUserOffset = positionOffset[1] || 0;
    return actualPodiumHeight + autoGroundingY + additionalUserOffset + DEFAULT_SCULPTURE_GROUNDING_ADJUSTMENT;
  }, [isGLB, glbRenderProps.yOffset, actualPodiumHeight, geometryMinY, positionOffset]);


  // If no artworkData and not a GLB, render a simple generic box on a podium as a fallback
  if (!artworkData && !isGLB) { // Updated fallback condition
    return (
      // FIX: Use lowercase intrinsic element 'group'
      <group position={[0, 0, 0]}>
        <Podium height={MAX_DYNAMIC_PODIUM_HEIGHT} shape="box" width={2.5} /> {/* Fallback podium height */}
        {/* FIX: Use lowercase intrinsic element 'mesh' */}
        <mesh position={[0, MAX_DYNAMIC_PODIUM_HEIGHT + 0.5 + DEFAULT_SCULPTURE_GROUNDING_ADJUSTMENT, 0]} castShadow receiveShadow> {/* Fallback artwork position */}
          {/* FIX: Use lowercase intrinsic element 'boxGeometry' */}
          <boxGeometry args={[1, 1, 1]} />
          {/* FIX: Use lowercase intrinsic element 'meshStandardMaterial' */}
          <meshStandardMaterial color="#888888" roughness={0.9} metalness={0} />
        </mesh>
      </group>
    );
  }
  
  // Dynamically render geometry or GLB model
  return (
    // FIX: Use lowercase intrinsic element 'group'
    <group position={[0, 0, 0]}>
      <Podium height={actualPodiumHeight} shape="box" width={actualPodiumWidth} /> {/* UPDATED: Use dynamic width */}
      
      {isGLB && clonedGlbWithMaterial ? (
        // Render GLB model using primitive for R3F integration
        <Suspense fallback={null}> {/* Show nothing or a loader while GLB is loading */}
          {/* FIX: Use lowercase intrinsic element 'group' */}
          <group
            ref={glbGroupRef} // Attach ref here for useFrame to access materials
            position={[
              positionOffset[0] - glbRenderProps.xCenterOffset, // Apply x-center offset
              finalGroupYPosition, // Use the dynamically calculated Y position
              positionOffset[2] - glbRenderProps.zCenterOffset // Apply z-center offset
            ]}
            scale={glbRenderProps.scale} // Apply the calculated scale
            rotation={glbRotationEuler} // Apply the calculated Euler rotation
          >
            {/* Use primitive to render the pre-processed clonedGlbWithMaterial */}
            <primitive object={clonedGlbWithMaterial} castShadow receiveShadow />
          </group>
        </Suspense>
      ) : (
        // Render parametric geometry if no GLB is available or preferred
        // FIX: Use lowercase intrinsic element 'group'
        <group position={[positionOffset[0], finalGroupYPosition, positionOffset[2]]}>
          {/* FIX: Use lowercase intrinsic element 'mesh' */}
          <mesh castShadow receiveShadow>
            {geometryComponent.type === 'boxGeometry' && <boxGeometry args={geometryComponent.args as [number?, number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'cylinderGeometry' && <cylinderGeometry args={geometryComponent.args as [number?, number?, number?, number?, number?, boolean?, number?, number?]} />}
            {geometryComponent.type === 'icosahedronGeometry' && <icosahedronGeometry args={geometryComponent.args as [number?, number?]} />}
            {geometryComponent.type === 'torusGeometry' && <torusGeometry args={geometryComponent.args as [number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'torusKnotGeometry' && <torusKnotGeometry args={geometryComponent.args as [number?, number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'sphereGeometry' && <sphereGeometry args={geometryComponent.args as [number?, number?, number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'coneGeometry' && <coneGeometry args={geometryComponent.args as [number?, number?, number?, number?, boolean?, number?, number?]} />} {/* Use coneGeometry */}
            {/* FIX: Use lowercase intrinsic element 'meshPhysicalMaterial' */}
            <meshPhysicalMaterial {...materialProps} transparent={materialProps.transparent || fadeProgress < 1} opacity={materialProps.opacity * fadeProgress} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default SculptureExhibit;