
import React, { useMemo, useRef, useEffect, useState, Suspense, useCallback } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { ArtworkData, ArtworkGeometry, ArtType, ArtworkMaterialConfig } from '../../../types';
import Podium from './Podium';
import { deepDispose } from '../../../utils/threeUtils'; // NEW: Import deepDispose
import { shallowEqual } from '../../../utils/objectUtils'; // NEW: Import shallowEqual

const getGeometryComponentTypeString = (type: ArtworkGeometry['type'] | string): string => {
  switch (type) {
    case 'box':
    case 'boxGeometry': return 'boxGeometry';
    case 'cylinder':
    case 'cylinderGeometry': return 'cylinderGeometry';
    case 'icosahedron':
    case 'icosahedronGeometry': return 'icosahedronGeometry';
    case 'torus':
    case 'torusGeometry': return 'torusGeometry';
    case 'torusKnot':
    case 'torusKnotGeometry': return 'torusKnotGeometry';
    case 'sphere':
    case 'sphereGeometry': return 'sphereGeometry';
    case 'cone':
    case 'coneGeometry': return 'coneGeometry';
    default: return 'boxGeometry';
  }
};

const createGeometryInstance = (type: string, args: number[]): THREE.BufferGeometry => {
  switch (type) {
    case 'boxGeometry': return new THREE.BoxGeometry(...(args as [number, number, number]));
    case 'cylinderGeometry': return new THREE.CylinderGeometry(...(args as [number, number, number, number, number, boolean, number, number]));
    case 'icosahedronGeometry': return new THREE.IcosahedronGeometry(...(args as [number, number]));
    case 'torusGeometry': return new THREE.TorusGeometry(...(args as [number, number, number, number, number]));
    case 'torusKnotGeometry': return new THREE.TorusKnotGeometry(...(args as [number, number, number, number, number, number]));
    case 'sphereGeometry': return new THREE.SphereGeometry(...(args as [number, number, number, number, number, number, number]));
    case 'coneGeometry': return new THREE.ConeGeometry(...(args as [number?, number?, number?, number?, boolean?, number?, number?]));
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
};

const getSide = (sideString: string | undefined): THREE.Side => {
  switch (sideString) {
    case 'front': return THREE.FrontSide;
    case 'back': return THREE.BackSide;
    case 'double': return THREE.DoubleSide;
    default: return THREE.FrontSide;
  }
};

interface SculptureExhibitProps {
  artworkData?: ArtworkData;
  textureUrl?: string;
  // REMOVED: isFocused: boolean;
  // REMOVED: lightsOn: boolean;
  onDimensionsCalculated?: (width: number, height: number, depth: number, podiumHeight: number, finalGroupYPosition: number) => void;
  artworkPosition: [number, number, number];
  artworkRotation: [number, number, number];
  artworkType: ArtType;
  activeZoneId?: string; // NEW: Add activeZoneId for zone-specific data
  // REMOVED: onArtworkClickedHtml?: (e: React.MouseEvent<HTMLDivElement>, position: [number, number, number], rotation: [number, number, number], artworkType: ArtType) => void;
}

const DEFAULT_SCULPTURE_GROUNDING_ADJUSTMENT = 0; 

// REMOVED: const FADE_DURATION = 800;

const SculptureExhibit: React.FC<SculptureExhibitProps> = ({ artworkData, textureUrl, onDimensionsCalculated,
  artworkPosition, artworkRotation, artworkType, activeZoneId
}) => {
  const isGLB = useMemo(() => textureUrl && textureUrl.toLowerCase().includes('.glb'), [textureUrl]);

  const gltf = isGLB && textureUrl ? useGLTF(textureUrl) : null;

  const defaultMaterialPropsForGlb = useMemo(() => ({
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

  // NEW: Ref to hold the GLB scene with materials applied, to avoid re-cloning on every render
  const glbWithAppliedMaterialsRef = useRef<THREE.Group | null>(null);
  // NEW: Ref to track the previous material config for efficient comparison
  const prevMaterialConfigRef = useRef<ArtworkMaterialConfig | undefined>(undefined);
  // NEW: Ref to track the previous GLTF scene object to detect changes
  const prevGlbSceneRef = useRef<THREE.Group | null>(null);

  const cleanedGlbScene = useMemo(() => {
    if (!isGLB || !gltf?.scene) return null;
    const sceneClone = gltf.scene.clone();
    
    sceneClone.traverse((child) => {
      
      if (child instanceof THREE.Light || child instanceof THREE.Camera) {
        if (child.parent) {
          child.parent.remove(child);
        }
      }
    });
    return sceneClone;
  }, [isGLB, gltf?.scene]);

  // NEW: Read zone-specific material if available, otherwise use global material
  const currentMaterialConfig = useMemo(() => {
    if (activeZoneId && artworkData?.material_per_zone?.[activeZoneId] !== undefined) {
      return artworkData.material_per_zone[activeZoneId];
    }
    return artworkData?.material;
  }, [artworkData, activeZoneId]);

  // NEW: Effect to manage the lifecycle and material application of the cloned GLB scene.
  // This useEffect now runs only when cleanedGlbScene or material properties actually change.
  useEffect(() => {
    // Debugging: log material and scene change detection to help diagnose first-click missing apply
    // material apply debug logging removed to reduce console noise
    // If the GLB scene object itself has changed or material config is different
    const materialConfigChanged = !shallowEqual(prevMaterialConfigRef.current, currentMaterialConfig);
    const glbSceneChanged = cleanedGlbScene !== prevGlbSceneRef.current;

    // change detection logging removed

    if (!isGLB || !cleanedGlbScene || glbSceneChanged || materialConfigChanged) {
      // Dispose of the existing model in the ref before potentially replacing it
      if (glbWithAppliedMaterialsRef.current) {
        deepDispose(glbWithAppliedMaterialsRef.current);
        glbWithAppliedMaterialsRef.current = null;
      }

      if (isGLB && cleanedGlbScene) {
        const newScene = cleanedGlbScene.clone();
        newScene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // NEW: Smooth out the polygonal look by computing vertex normals
            if (child.geometry) {
              child.geometry.computeVertexNormals();
            }

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(originalMaterial => {
              const config = currentMaterialConfig;

              let newMaterial: THREE.Material;
              const needsPhysicalMaterial = config && (
                                             (config.transmission !== undefined && config.transmission > 0) ||
                                             (config.clearcoat !== undefined && config.clearcoat > 0) ||
                                             (config.thickness !== undefined && config.thickness > 0)
                                            );

              if (needsPhysicalMaterial) {
                  newMaterial = new THREE.MeshPhysicalMaterial();
              } else if (originalMaterial instanceof THREE.MeshPhysicalMaterial) {
                  newMaterial = originalMaterial.clone();
              } else if (originalMaterial instanceof THREE.MeshStandardMaterial) {
                  newMaterial = originalMaterial.clone();
              } else {
                  newMaterial = new THREE.MeshStandardMaterial();
              }

              // Optimization: If it's a Tripo material or has many textures, strip less critical ones
              // to avoid MAX_TEXTURE_IMAGE_UNITS(16) error on some hardware.
              if (newMaterial instanceof THREE.MeshStandardMaterial || newMaterial instanceof THREE.MeshPhysicalMaterial) {
                const matName = (newMaterial.name || '').toLowerCase();
                if (matName.includes('tripo') || matName.includes('material')) {
                    // Remove ALL possible texture slots for this material type
                    const textureProps = [
                      'map', 'aoMap', 'displacementMap', 'bumpMap', 'lightMap', 'metalnessMap', 'roughnessMap', 'alphaMap', 'envMap',
                      'clearcoatMap', 'clearcoatRoughnessMap', 'thicknessMap', 'transmissionMap', 'specularMap', 'gradientMap',
                      'sheenColorMap', 'sheenRoughnessMap', 'iridescenceMap', 'iridescenceThicknessMap', 'normalMap', 'emissiveMap',
                      'envMapIntensity', 'reflectivity', 'refractionRatio', 'wireframe', 'combine', 'flatShading', 'vertexColors', 'fog',
                    ];
                    textureProps.forEach(prop => {
                      if (prop in newMaterial) {
                        (newMaterial as any)[prop] = (prop === 'flatShading') ? false : null;
                      }
                    });
                    newMaterial.needsUpdate = true;
                }
              }

              if (config && (newMaterial instanceof THREE.MeshStandardMaterial || newMaterial instanceof THREE.MeshPhysicalMaterial)) {
                newMaterial.map = null;
                // FIX: Convert color and emissive hex strings to THREE.Color instances
                newMaterial.color.set(new THREE.Color(config?.color ?? defaultMaterialPropsForGlb.color));
                newMaterial.emissive.set(new THREE.Color(config?.emissive ?? defaultMaterialPropsForGlb.emissive));
                newMaterial.emissiveIntensity = config?.emissiveIntensity ?? defaultMaterialPropsForGlb.emissiveIntensity;
                newMaterial.metalness = config?.metalness ?? defaultMaterialPropsForGlb.metalness;
                newMaterial.roughness = config?.roughness ?? defaultMaterialPropsForGlb.roughness;
                newMaterial.side = getSide(config?.side);
                
                if (newMaterial instanceof THREE.MeshPhysicalMaterial) {
                    newMaterial.transmission = config?.transmission ?? defaultMaterialPropsForGlb.transmission;
                    newMaterial.thickness = config?.thickness ?? defaultMaterialPropsForGlb.thickness;
                    newMaterial.clearcoat = config?.clearcoat ?? defaultMaterialPropsForGlb.clearcoat;
                    newMaterial.clearcoatRoughness = config?.clearcoatRoughness ?? defaultMaterialPropsForGlb.clearcoatRoughness;
                } else {
                    
                    if ('transmission' in newMaterial) (newMaterial as any).transmission = 0;
                    if ('thickness' in newMaterial) (newMaterial as any).thickness = 0;
                    if ('clearcoat' in newMaterial) (newMaterial as any).clearcoat = 0;
                    if ('clearcoatRoughness' in newMaterial) (newMaterial as any).clearcoatRoughness = 0;
                }
                
                newMaterial.transparent = config?.transparent ?? false;
                newMaterial.opacity = config?.opacity ?? 1;


                child.material = newMaterial;
                (child.material as any).flatShading = false; // NEW: Ensure smooth shading for models
                child.material.needsUpdate = true;
                try {
                  // eslint-disable-next-line no-console
                  console.debug('[SculptureExhibit] applied material to mesh', { meshName: child.name || null, meshUuid: child.uuid, newMaterial: {
                    color: (newMaterial as any).color?.getHexString ? (newMaterial as any).color.getHexString() : undefined,
                    roughness: (newMaterial as any).roughness,
                    metalness: (newMaterial as any).metalness,
                    opacity: (newMaterial as any).opacity,
                    transparent: (newMaterial as any).transparent,
                  }});
                } catch (e) {}
              }
            });
          }
        });
        glbWithAppliedMaterialsRef.current = newScene;
      }
    }

    // Update refs for the next comparison
    prevMaterialConfigRef.current = currentMaterialConfig;
    prevGlbSceneRef.current = cleanedGlbScene;
    

    // Return a cleanup function to dispose the model when the component unmounts or dependencies change
    return () => {
      if (glbWithAppliedMaterialsRef.current) {
        deepDispose(glbWithAppliedMaterialsRef.current);
        glbWithAppliedMaterialsRef.current = null;
      }
      prevMaterialConfigRef.current = undefined;
      prevGlbSceneRef.current = null;
    };
  }, [isGLB, cleanedGlbScene, currentMaterialConfig, defaultMaterialPropsForGlb]);


  const defaultMaterialProps = useMemo(() => {
    return {
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
    };
  }, []);

  const geometryComponent = useMemo(() => {
    if (!artworkData?.geometry) {
      
      return { type: 'boxGeometry', args: [1, 1, 1] };
    }
    return {
      type: getGeometryComponentTypeString(artworkData.geometry.type),
      args: artworkData.geometry.args || [1, 1, 1],
    };
  }, [artworkData]);

  const [geometryMinX, geometryMaxX, geometryMinY, geometryMaxY, geometryMinZ, geometryMaxZ] = useMemo(() => {
    if (!artworkData?.geometry) {
      return [0, 0, 0, 0, 0, 0];
    }
    const geometry = createGeometryInstance(geometryComponent.type, geometryComponent.args);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    geometry.dispose(); // NEW: Dispose transient geometry used for bounding box calculation
    return [box.min.x, box.max.x, box.min.y, box.max.y, box.min.z, box.max.z];
  }, [artworkData?.geometry, geometryComponent.type, geometryComponent.args]);


  const positionOffset = artworkData?.position_offset || [0, 0, 0]; 
  const rotationOffset = artworkData?.rotation_offset || [0, 0, 0]; 
  
  // NEW: Read zone-specific scale_offset if available, otherwise use global scale_offset
  const scaleOffset = useMemo(() => {
    if (activeZoneId && artworkData?.scale_offset_per_zone?.[activeZoneId] !== undefined) {
      return artworkData.scale_offset_per_zone[activeZoneId];
    }
    return artworkData?.scale_offset ?? 1.0;
  }, [artworkData, activeZoneId]);

  const glbRotationEuler = useMemo(() => {
    
    const finalRotation = [
      rotationOffset[1],
      rotationOffset[2],
      rotationOffset[0],
    ] as [number, number, number];
    return new THREE.Euler(...finalRotation, 'XYZ');
  }, [rotationOffset]);

  const glbRenderProps = useMemo(() => {
    // This memo computes the base scaling factor for the GLB model
    // and its intrinsic dimensions (height, footprint) when unscaled by `scaleOffset`.
    // It should *not* depend on `scaleOffset` itself, as `scaleOffset` is applied separately.
    if (!isGLB || !cleanedGlbScene) {
      return { scale: 1, yOffset: 0, horizontalFootprint: 0, height: 0, xCenterOffset: 0, zCenterOffset: 0 };
    }

    // Direct calculation without cloning
    const localBoxUnscaled = new THREE.Box3().setFromObject(cleanedGlbScene);
    const localSizeUnscaled = localBoxUnscaled.getSize(new THREE.Vector3());

    const targetDisplaySize = 3; 
    const currentMaxHorizontalLocal = Math.max(localSizeUnscaled.x, localSizeUnscaled.z);

    let scaleFactor = 1;
    if (currentMaxHorizontalLocal > targetDisplaySize) {
      scaleFactor = targetDisplaySize / currentMaxHorizontalLocal;
    } else if (currentMaxHorizontalLocal < targetDisplaySize / 2) {
      scaleFactor = targetDisplaySize / (currentMaxHorizontalLocal * 2); 
    }
    
    const maxOverallDimensionLocal = Math.max(currentMaxHorizontalLocal, localSizeUnscaled.y);
    if (maxOverallDimensionLocal * scaleFactor > 6) {
        scaleFactor = (6 / maxOverallDimensionLocal);
    }
    
    // Calculate rotated/scaled bounds
    const box = new THREE.Box3().setFromObject(cleanedGlbScene);
    
    // Apply scale to the box dimensions
    box.min.multiplyScalar(scaleFactor);
    box.max.multiplyScalar(scaleFactor);
    
    // For rotation, we should ideally apply the rotation to the object and then compute the box,
    // or use a more complex math. But since we want to avoid side effects on the original object:
    // We'll use a temporary group WITHOUT cloning to get the rotated bounds.
    const tempGroup = new THREE.Group();
    tempGroup.scale.setScalar(scaleFactor);
    tempGroup.rotation.copy(glbRotationEuler);
    tempGroup.add(cleanedGlbScene);
    tempGroup.updateMatrixWorld(true);
    
    const worldBox = new THREE.Box3().setFromObject(tempGroup);
    
    // CRITICAL: Remove from tempGroup to avoid leaving it in a detached state
    tempGroup.remove(cleanedGlbScene);

    const worldSize = worldBox.getSize(new THREE.Vector3());
    const worldCenter = worldBox.getCenter(new THREE.Vector3());

    const lowestPointY = worldBox.min.y;
    const yOffset = -lowestPointY; 

    const horizontalFootprint = Math.max(worldSize.x, worldSize.z);
    const height = worldSize.y;
    
    const xCenterOffset = worldCenter.x;
    const zCenterOffset = worldCenter.z;

    return { scale: scaleFactor, yOffset, horizontalFootprint, height, xCenterOffset, zCenterOffset };
  }, [isGLB, cleanedGlbScene, glbRotationEuler]); // Removed scaleOffset from dependencies here

  // NEW: Calculate dynamic GLB dimensions by applying scaleOffset here
  const scaledGlbRenderProps = useMemo(() => {
    if (!isGLB || !cleanedGlbScene) {
      return { horizontalFootprint: 0, height: 0 };
    }
    // Apply scaleOffset to the dimensions calculated in glbRenderProps
    return {
      horizontalFootprint: glbRenderProps.horizontalFootprint * scaleOffset,
      height: glbRenderProps.height * scaleOffset,
    };
  }, [isGLB, cleanedGlbScene, glbRenderProps, scaleOffset]);


  const sculptureVisualHeight = isGLB ? scaledGlbRenderProps.height : (geometryMaxY - geometryMinY) * scaleOffset; // MODIFIED: Apply scaleOffset
  const sculptureVisualWidth = isGLB ? scaledGlbRenderProps.horizontalFootprint : (geometryMaxX - geometryMinX) * scaleOffset; // MODIFIED: Apply scaleOffset
  const sculptureVisualDepth = isGLB ? scaledGlbRenderProps.horizontalFootprint : (geometryMaxZ - geometryMinZ) * scaleOffset; // MODIFIED: Apply scaleOffset
  const parametricHorizontalFootprint = Math.max(sculptureVisualWidth, sculptureVisualDepth);

  const finalSculptureHorizontalFootprint = isGLB ? scaledGlbRenderProps.horizontalFootprint : parametricHorizontalFootprint;


  const MIN_SCULPTURE_HEIGHT_FOR_PODIUM = 0.1;
  const MAX_SCULPTURE_HEIGHT_FOR_PODIUM = 6.0;
  const MIN_DYNAMIC_PODIUM_HEIGHT = 0.5;
  const MAX_DYNAMIC_PODIUM_HEIGHT = 3.0;

  const dynamicPodiumHeight = useMemo(() => {
    const clampedSculptureHeight = Math.max(
      MIN_SCULPTURE_HEIGHT_FOR_PODIUM,
      Math.min(sculptureVisualHeight, MAX_SCULPTURE_HEIGHT_FOR_PODIUM)
    );

    const normalizedSculptureHeight = (clampedSculptureHeight - MIN_SCULPTURE_HEIGHT_FOR_PODIUM) / 
                                      (MAX_SCULPTURE_HEIGHT_FOR_PODIUM - MIN_SCULPTURE_HEIGHT_FOR_PODIUM);

    const calculatedPodiumHeight = MAX_DYNAMIC_PODIUM_HEIGHT - 
                                   (normalizedSculptureHeight * (MAX_DYNAMIC_PODIUM_HEIGHT - MIN_DYNAMIC_PODIUM_HEIGHT));
    
    return Math.max(MIN_DYNAMIC_PODIUM_HEIGHT, Math.min(MAX_DYNAMIC_PODIUM_HEIGHT, calculatedPodiumHeight));
  }, [sculptureVisualHeight]);


  const MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM = 0.1;
  const MAX_SCULPTURE_HORIZONTAL_FOR_PODIUM = 6.0;
  const MIN_DYNAMIC_PODIUM_WIDTH = 1.0;
  const MAX_DYNAMIC_PODIUM_WIDTH = 5.0;
  const PODIUM_WIDTH_BUFFER = 0.5;

  const dynamicPodiumWidth = useMemo(() => {
    const clampedFootprint = Math.max(
      MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM,
      Math.min(finalSculptureHorizontalFootprint, MAX_SCULPTURE_HORIZONTAL_FOR_PODIUM)
    );

    const normalizedFootprint = (clampedFootprint - MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM) / 
                                (MAX_SCULPTURE_HORIZONTAL_FOR_PODIUM - MIN_SCULPTURE_HORIZONTAL_FOR_PODIUM);

    let calculatedPodiumWidth = MIN_DYNAMIC_PODIUM_WIDTH + 
                                (normalizedFootprint * (MAX_DYNAMIC_PODIUM_WIDTH - MIN_DYNAMIC_PODIUM_WIDTH));

    calculatedPodiumWidth = Math.max(calculatedPodiumWidth, finalSculptureHorizontalFootprint + PODIUM_WIDTH_BUFFER);
    
    return Math.max(MIN_DYNAMIC_PODIUM_WIDTH, Math.min(MAX_DYNAMIC_PODIUM_WIDTH, calculatedPodiumWidth));
  }, [finalSculptureHorizontalFootprint]);


  const actualPodiumHeight = dynamicPodiumHeight;
  const actualPodiumWidth = dynamicPodiumWidth; 

  // NEW: Determine if podium should be rendered
  const shouldRenderPodium = scaleOffset <= 3.0; // 3.0 represents 300%

  const materialProps = useMemo(() => {
    const config = artworkData?.material; 
    return {
      // FIX: Convert color and emissive hex strings to THREE.Color instances
      color: new THREE.Color(config?.color ?? defaultMaterialProps.color),
      emissive: new THREE.Color(config?.emissive ?? defaultMaterialProps.emissive),
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
      flatShading: false, // NEW: Ensure flat shading is disabled for smoother look
    };
  }, [artworkData, defaultMaterialProps]);

  const materialKey = useMemo(() => {
    try {
      return JSON.stringify(artworkData?.material || {});
    } catch (e) {
      return String(Date.now());
    }
  }, [artworkData?.material]);

  const finalGroupYPosition = useMemo(() => {
    // If podium is not rendered, the base Y position should be 0 (ground level) instead of actualPodiumHeight.
    const baseHeight = shouldRenderPodium ? actualPodiumHeight : 0;

    if (isGLB) {
      // For GLB, glbRenderProps.yOffset already accounts for the lowest point of the *base-scaled* model.
      // We need to multiply this offset by `scaleOffset` to get its correct position for the overall scaling.
      const baseGlbY = glbRenderProps.yOffset * scaleOffset;
      return baseHeight + baseGlbY + DEFAULT_SCULPTURE_GROUNDING_ADJUSTMENT;
    }
    // For primitives, apply scale to autoGroundingY and additionalUserOffset
    const autoGroundingY = -geometryMinY * scaleOffset; // MODIFIED: Apply scaleOffset
    const additionalUserOffset = (positionOffset[1] || 0); // Position offset is in world units, already scaled by parent group if needed.
    return baseHeight + autoGroundingY + additionalUserOffset + DEFAULT_SCULPTURE_GROUNDING_ADJUSTMENT;
  }, [isGLB, glbRenderProps.yOffset, actualPodiumHeight, geometryMinY, positionOffset, scaleOffset, shouldRenderPodium]); // MODIFIED: Add shouldRenderPodium to dependencies

  useEffect(() => {
    if (onDimensionsCalculated) {
      onDimensionsCalculated(
        finalSculptureHorizontalFootprint,
        sculptureVisualHeight,
        finalSculptureHorizontalFootprint,
        actualPodiumHeight,
        finalGroupYPosition
      );
    }
  }, [onDimensionsCalculated, finalSculptureHorizontalFootprint, sculptureVisualHeight, actualPodiumHeight, finalGroupYPosition]);


  if (!artworkData && !isGLB) {
    // MODIFIED: Return null when artworkData is missing and it's not a GLB
    return null;
  }
  
  return (
    <group>
      {shouldRenderPodium && <Podium height={actualPodiumHeight} shape="box" width={actualPodiumWidth} />}
      
      {isGLB && glbWithAppliedMaterialsRef.current ? (
        <Suspense fallback={null}>
          <group
            position={[
              positionOffset[0] - (glbRenderProps.xCenterOffset * scaleOffset), 
              finalGroupYPosition,
              positionOffset[2] - (glbRenderProps.zCenterOffset * scaleOffset)
            ]}
            scale={glbRenderProps.scale * scaleOffset} 
            rotation={glbRotationEuler}
          >
            <primitive key={materialKey} object={glbWithAppliedMaterialsRef.current} castShadow receiveShadow />
          </group>
        </Suspense>
      ) : (
        <group position={[positionOffset[0], finalGroupYPosition, positionOffset[2]]}>
          <mesh key={materialKey} castShadow receiveShadow scale={scaleOffset}> 
            {geometryComponent.type === 'boxGeometry' && <boxGeometry attach="geometry" args={geometryComponent.args as [number?, number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'cylinderGeometry' && <cylinderGeometry attach="geometry" args={geometryComponent.args as [number?, number?, number?, number?, number?, boolean?, number?, number?]} />}
            {geometryComponent.type === 'icosahedronGeometry' && <icosahedronGeometry attach="geometry" args={geometryComponent.args as [number?, number?]} />}
            {geometryComponent.type === 'torusGeometry' && <torusGeometry attach="geometry" args={geometryComponent.args as [number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'torusKnotGeometry' && <torusKnotGeometry attach="geometry" args={geometryComponent.args as [number?, number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'sphereGeometry' && <sphereGeometry attach="geometry" args={geometryComponent.args as [number?, number?, number?, number?, number?, number?, number?]} />}
            {geometryComponent.type === 'coneGeometry' && <coneGeometry attach="geometry" args={geometryComponent.args as [number?, number?, number?, number?, boolean?, number?, number?]} />}
            {/* NEW: Explicitly define MeshPhysicalMaterial instance and dispose of it if it's dynamic */}
            {/* FIX: Use attach="material" for meshPhysicalMaterial */}
            <meshPhysicalMaterial attach="material" {...materialProps} transparent={materialProps.transparent} opacity={materialProps.opacity} />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default SculptureExhibit;
