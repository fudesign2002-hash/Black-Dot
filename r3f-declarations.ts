// r3f-declarations.ts
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import type React from 'react'; // FIX: Import React types for global JSX declarations

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        alt?: string;
        'auto-rotate'?: boolean;
        'camera-controls'?: boolean;
        class?: string;
        style?: string; 
        'shadow-intensity'?: string;
        'environment-image'?: string;
        ar?: boolean;
        'disable-zoom'?: boolean;
        'disable-pan'?: boolean;
        'disable-rotate'?: boolean;
        orientation?: string;
      };
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
      label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
      img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
      video: React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
      // FIX: Corrected HTMLIframeElement type to reference the global DOM type.
      iframe: React.DetailedHTMLProps<React.IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement>; 
      a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
      h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      pre: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>;
      code: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      svg: React.DetailedHTMLProps<React.SVGAttributes<SVGSVGElement>, SVGSVGElement>;
      rect: React.DetailedHTMLProps<React.SVGAttributes<SVGRectElement>, SVGRectElement>;
      // FIX: Corrected type for 'line' from SVGRectElement to SVGLineElement.
      line: React.DetailedHTMLProps<React.SVGAttributes<SVGLineElement>, SVGLineElement>; 
      g: React.DetailedHTMLProps<React.SVGAttributes<SVGGElement>, SVGGElement>;
      circle: React.DetailedHTMLProps<React.SVGAttributes<SVGCircleElement>, SVGCircleElement>;
      textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>; // NEW: Added textarea

      group: React.PropsWithChildren<Partial<import('three').Group>>;
      mesh: React.PropsWithChildren<Partial<import('three').Mesh>>;
      boxGeometry: React.PropsWithChildren<Partial<import('three').BoxGeometry>>;
      cylinderGeometry: React.PropsWithChildren<Partial<import('three').CylinderGeometry>>;
      icosahedronGeometry: React.PropsWithChildren<Partial<import('three').IcosahedronGeometry>>;
      torusGeometry: React.PropsWithChildren<Partial<import('three').TorusGeometry>>;
      torusKnotGeometry: React.PropsWithChildren<Partial<import('three').TorusKnotGeometry>>;
      sphereGeometry: React.PropsWithChildren<Partial<import('three').SphereGeometry>>;
      planeGeometry: React.PropsWithChildren<Partial<import('three').PlaneGeometry>>;
      coneGeometry: React.PropsWithChildren<Partial<import('three').ConeGeometry>>;
      ambientLight: React.PropsWithChildren<Partial<import('three').AmbientLight>>;
      directionalLight: React.PropsWithChildren<Partial<import('three').DirectionalLight>>;
      pointLight: React.PropsWithChildren<Partial<import('three').PointLight>>;
      spotLight: React.PropsWithChildren<Partial<import('three').SpotLight>>;
      lineSegments: React.PropsWithChildren<Partial<import('three').LineSegments>>;
      lineBasicMaterial: React.PropsWithChildren<Partial<import('three').LineBasicMaterial>>;
      meshStandardMaterial: React.PropsWithChildren<Partial<import('three').MeshStandardMaterial>>;
      meshPhysicalMaterial: React.PropsWithChildren<Partial<import('three').MeshPhysicalMaterial>>;
      meshBasicMaterial: React.PropsWithChildren<Partial<import('three').MeshBasicMaterial>>;
      color: React.PropsWithChildren<any>;
      fog: React.PropsWithChildren<any>;
    }
  }
}

// Explicitly extend core Three.js components for React Three Fiber JSX elements.
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
});

// NEW: Explicitly mark the file as a module to ensure global type augmentations are processed.
export {};