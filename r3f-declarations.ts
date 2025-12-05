
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import type React from 'react';

// 這些由 extend 處理並註冊供 R3F 使用。
// 這部分是正確且必要的。
extend({
  AmbientLight: THREE.AmbientLight,
  DirectionalLight: THREE.DirectionalLight,
  PointLight: THREE.PointLight,
  SpotLight: THREE.SpotLight,
  Mesh: THREE.Mesh,
  Group: THREE.Group,
  BoxGeometry: THREE.BoxGeometry,
  CylinderGeometry: THREE.CylinderGeometry,
  IcosahedronGeometry: THREE.IcosahedronGeometry,
  TorusKnotGeometry: THREE.TorusKnotGeometry,
  TorusGeometry: THREE.TorusGeometry,
  SphereGeometry: THREE.SphereGeometry,
  PlaneGeometry: THREE.PlaneGeometry,
  ConeGeometry: THREE.ConeGeometry,
  LineSegments: THREE.LineSegments,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  MeshPhysicalMaterial: THREE.MeshPhysicalMaterial,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  LineBasicMaterial: THREE.LineBasicMaterial,
});

// FIX: 直接擴充全域 JSX.IntrinsicElements 以包含 React 的內建元素，
// 並明確定義常見的 R3F 元素和 SVG 元素，以解決「屬性不存在」的錯誤。
declare global { // Augment global namespace for JSX
  namespace JSX {
    interface IntrinsicElements extends React.JSX.IntrinsicElements {
      // 明確添加常見的 R3F 元素類型，簡化為 `any` 以確保最大兼容性。
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      spotLight: any;
      mesh: any;
      group: any;
      boxGeometry: any;
      cylinderGeometry: any;
      icosahedronGeometry: any;
      torusKnotGeometry: any;
      torusGeometry: any;
      sphereGeometry: any;
      planeGeometry: any;
      coneGeometry: any;
      lineSegments: any;
      meshStandardMaterial: any;
      meshPhysicalMaterial: any;
      meshBasicMaterial: any;
      lineBasicMaterial: any;
      primitive: any; // 用於 `useGLTF` 和通用對象
      color: any;   // 用於 `<color attach="..." />`
      fog: any;     // 用於 `<fog attach="..." />`

      // 確保 SVG 元素也包含在內，以防出現錯誤。
      svg: React.SVGProps<SVGSVGElement>;
      rect: React.SVGProps<SVGRectElement>;
      line: React.SVGProps<SVGLineElement>;
      g: React.SVGProps<SVGGElement>;
      circle: React.SVGProps<SVGCircleElement>;

      // 回退，用於任何其他可能出現的自定義元素（例如，來自其他庫）。
      [elem: string]: any;
    }
  }
}

// `export {};` 保持此檔案為模組。
export {};
