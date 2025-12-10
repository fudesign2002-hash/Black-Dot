import * as THREE from 'three';

/**
 * 徹底釋放 Three.js 物件及其附帶的 GPU 資源 (VRAM)。
 * @param {THREE.Object3D | null} object - 待釋放的 Three.js 物件 (例如：GLTF 載入的模型、Scene、Mesh)。
 */
export function deepDispose(object: THREE.Object3D | null) {
  if (!object) return;

  // 1. 遞迴遍歷物件及其子物件
  object.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      // 2. 釋放幾何體 (Geometry)
      if (child.geometry) {
        child.geometry.dispose();
      }

      // 3. 釋放材質 (Material) 和其附帶的紋理 (Texture)
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];

        materials.forEach(material => {
          // 遍歷材質的所有屬性，尋找紋理並釋放
          for (const key in material) {
            const value = (material as any)[key]; // Use 'any' to access properties that might be textures
            if (value && (value instanceof THREE.Texture || (typeof value === 'object' && (value as any).isTexture))) { // Check for THREE.Texture instance or .isTexture flag
              value.dispose(); // 釋放 GPU 上的 Texture
            }
          }
          material.dispose(); // 釋放材質本身
        });
      }
    }
  });

  // NOTE: In React Three Fiber, scene graph management is typically handled by R3F itself.
  // Calling object.parent.remove(object) here could conflict with R3F's reconciliation.
  // The primary goal is GPU memory cleanup, which geometry/material/texture.dispose() addresses.
}
