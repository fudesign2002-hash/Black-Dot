
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Center } from '@react-three/drei';
import { ArtworkData } from '../../../types';

interface Text3DExhibitProps {
  artworkData?: ArtworkData;
  scale?: number;
  onDimensionsCalculated?: (width: number, height: number, depth: number, podiumHeight: number, finalGroupYPosition: number) => void;
}

// Using a more stable CDN for Noto Sans TC that correctly handles CORS requests
const FONT_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc@5.0.2/files/noto-sans-tc-chinese-traditional-400-normal.woff';

const Text3DExhibit: React.FC<Text3DExhibitProps> = ({ 
  artworkData, 
  scale = 1,
  onDimensionsCalculated 
}) => {
  const textContent = artworkData?.text || 'BLACK DOT';
  const materialConfig = artworkData?.material || { color: '#000000' };

  const materialColor = useMemo(() => 
    new THREE.Color(materialConfig.color || '#000000'), 
  [materialConfig.color]);

  // Provide basic dimensions to parent for selection ring logic
  React.useEffect(() => {
    if (onDimensionsCalculated) {
      // Estimated dimensions for selection UI
      onDimensionsCalculated(
        textContent.length * 0.8 * scale, 
        1.2 * scale, 
        0.1 * scale,
        0, 
        0
      );
    }
  }, [onDimensionsCalculated, textContent, scale]);

  return (
    <group>
      <Center top>
        {/* 
          Using Troika-based Text instead of Text3D for:
          1. Native Unicode/CJK support (Arabic, Chinese, Japanese, etc.)
          2. Massive performance improvement (SDF rendering vs heavy geometry)
          3. Better memory management
        */}
        <Text
          font={FONT_URL}
          fontSize={1.5 * scale}
          maxWidth={100}
          lineHeight={1}
          letterSpacing={0.02}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          depthOffset={0}
        >
          {textContent}
          <meshBasicMaterial color={materialColor} side={THREE.DoubleSide} />
        </Text>
      </Center>
    </group>
  );
};

export default Text3DExhibit;
