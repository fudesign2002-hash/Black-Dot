

import React, { useEffect, useState } from 'react';

interface EmbeddedMuseumSceneProps {
  // future props for embed configuration
}

// Minimal scaffold for embed development.
// This intentionally does not render any app chrome or call into the main app logic.
// It reads URL params and exposes a simple root container where the embed UI/Canvas
// can be mounted later.
const EmbeddedMuseumScene: React.FC<EmbeddedMuseumSceneProps> = () => {
  const [isEmbed, setIsEmbed] = useState(false);
  const [exhibitionId, setExhibitionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsEmbed(params.get('embed') === 'true');
    setExhibitionId(params.get('exhibitionId'));
  }, []);

  return (
    <div
      id="embedded-museum-root"
      data-embed={isEmbed}
      data-exhibition-id={exhibitionId ?? ''}
      style={{ width: '100%', height: '100%', minHeight: 200 }}
    />
  );
};

export default EmbeddedMuseumScene;