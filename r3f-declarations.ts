
import * as THREE from 'three';
import type React from 'react';
import { extend } from '@react-three/fiber'; // 將 extend 的 import 移至頂部

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
  SphereGeometry: THREE.SphereGeometry, // Added SphereGeometry
  PlaneGeometry: THREE.PlaneGeometry,   // Added PlaneGeometry
  ConeGeometry: THREE.ConeGeometry, // ADDED
  LineSegments: THREE.LineSegments,     // Added LineSegments
  LineBasicMaterial: THREE.LineBasicMaterial, // Added LineBasicMaterial
  MeshStandardMaterial: THREE.MeshStandardMaterial, // ADDED
  MeshBasicMaterial: THREE.MeshBasicMaterial,   // ADDED
  MeshPhysicalMaterial: THREE.MeshPhysicalMaterial, // ADDED
});