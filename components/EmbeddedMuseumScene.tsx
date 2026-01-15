

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Scene from './scene/Scene';
import TransitionOverlay from './ui/TransitionOverlay';
import SideNavigation from './layout/SideNavigation';
import Header from './layout/Header';
import MainControls from './controls/MainControls';
import InfoPanel from './info/InfoPanel';
const ZeroGravityLegend = React.lazy(() => import('./ui/ZeroGravityLegend'));
import { useMuseumState } from '../hooks/useMuseumState';
import { Exhibition } from '../types';

interface EmbeddedMuseumSceneProps {
  // future props for embed configuration
}

// Minimal scaffold for embed development.
// This intentionally does not render any app chrome or call into the main app logic.
// It reads URL params and exposes a simple root container where the embed UI/Canvas
// can be mounted later.
const EmbeddedMuseumScene: React.FC<EmbeddedMuseumSceneProps> = () => {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const exhibitionIdParam = params.get('exhibitionId');
  const initialRankingMode = params.get('rankingMode') === 'on';
  const hideRankingControl = params.get('rankingMode') === 'off';
  const initialZeroGravityMode = params.get('zeroGravity') === 'on';
  const hideZeroGravityControl = params.get('zeroGravity') === 'off';
  const hideUserCount = params.get('userCount') === 'off';
  const hideLightsControl = params.get('lights') === 'off';
  const hideLogo = params.get('logo') === 'off';

  const {
    isLoading,
    exhibitions,
    activeExhibition,
    activeZone,
    currentLayout,
    lightingConfig,
    handleNavigate,
    firebaseArtworks,
    currentIndex,
  } = useMuseumState(true, null, true);

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isRankingMode, setIsRankingMode] = useState(initialRankingMode);
  const [isZeroGravityMode, setIsZeroGravityMode] = useState(initialZeroGravityMode);
  const [focusedArtworkInstanceId, setFocusedArtworkInstanceId] = useState<string | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    setIsRankingMode(initialRankingMode);
  }, [initialRankingMode]);

  useEffect(() => {
    setIsZeroGravityMode(initialZeroGravityMode);
  }, [initialZeroGravityMode]);

  useEffect(() => {
    const onResize = () => setIsSmallScreen(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When exhibitions load, if an exhibitionId param is present, navigate to it.
  useEffect(() => {
    if (!exhibitionIdParam || isLoading || exhibitions.length === 0) return;
    const idx = exhibitions.findIndex((ex) => ex.id === exhibitionIdParam);
    if (idx !== -1) {
      handleNavigate(idx);
    }
  }, [exhibitionIdParam, isLoading, exhibitions, handleNavigate]);

  const lightsOn = lightingConfig?.lightsOn ?? true;
  const uiConfig = useMemo(
    () => ({
      lightsOn,
      bg: lightsOn ? 'bg-[#e4e4e4]' : 'bg-[#050505]',
      text: lightsOn ? 'text-neutral-900' : 'text-white',
      subtext: lightsOn ? 'text-neutral-500' : 'text-neutral-400',
      border: lightsOn ? 'border-neutral-900/10' : 'border-white/10',
      panelBg: lightsOn ? 'bg-white/95' : 'bg-neutral-900/95',
      glass: lightsOn ? 'bg-white/70 text-neutral-600 hover:bg-white/90 hover:text-neutral-900' : 'bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white',
      glassActive: lightsOn ? 'bg-neutral-900 text-white shadow-xl hover:bg-neutral-800' : 'bg-black text-white shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-neutral-800',
      arrowBg: lightsOn ? 'hover:bg-neutral-900/5' : 'hover:bg-white/5',
      input: lightsOn ? 'bg-neutral-100 focus:bg-white text-neutral-900' : 'bg-neutral-800 focus:bg-neutral-700 text-white',
    }),
    [lightsOn]
  );

  const handleSelectArtwork = useCallback((id: string | null) => setFocusedArtworkInstanceId(id), []);

  const nextItem = useMemo(() => (exhibitions.length ? exhibitions[(currentIndex + 1) % exhibitions.length] : null), [exhibitions, currentIndex]);
  const prevItem = useMemo(() => (exhibitions.length ? exhibitions[(currentIndex - 1 + exhibitions.length) % exhibitions.length] : null), [exhibitions, currentIndex]);

  const focusedArtworkTitle = useMemo(() => {
    if (!focusedArtworkInstanceId || !currentLayout) return null;
    const artItem = currentLayout.find(item => item.id === focusedArtworkInstanceId);
    if (!artItem) return null;
    const firebaseArt = firebaseArtworks.find(fbArt => fbArt.id === artItem.artworkId);
    return firebaseArt ? firebaseArt.title.toUpperCase() : null;
  }, [focusedArtworkInstanceId, currentLayout, firebaseArtworks]);

  const focusedArtworkArtist = useMemo(() => {
    if (!focusedArtworkInstanceId || !currentLayout) return null;
    const artItem = currentLayout.find(item => item.id === focusedArtworkInstanceId);
    if (!artItem) return null;
    const firebaseArt = firebaseArtworks.find(fbArt => fbArt.id === artItem.artworkId);
    return firebaseArt ? firebaseArt.artist : null;
  }, [focusedArtworkInstanceId, currentLayout, firebaseArtworks]);

  const zeroGravityViews = useMemo(() => {
    if (!currentLayout || currentLayout.length === 0) return { minViews: 0, maxViews: 0, extraTicks: 0 };
    const views = currentLayout.map(a => a.view_count || 0);
    const min = Math.min(...views);
    const max = Math.max(...views);
    return { minViews: min, maxViews: max, extraTicks: Math.max(0, max - min) > 0 ? 5 : 0 };
  }, [currentLayout]);

  return (
    <>
      <TransitionOverlay isTransitioning={isLoading} />

      <Header
        uiConfig={uiConfig}
        version="EMBED"
        isInfoOpen={isInfoOpen}
        isSmallScreen={isSmallScreen}
        isHeaderExpanded={false}
        setIsHeaderExpanded={() => {}}
        onlineUsers={0}
        hideUserCount={hideUserCount}
        hideLogo={hideLogo}
        zoneCapacity={100}
        isEmbed={true}
        activeExhibition={activeExhibition as Exhibition}
      />

      <Scene
        lightingConfig={lightingConfig}
        artworks={currentLayout || []}
        isEditorOpen={false}
        isEditorMode={false}
        selectedArtworkId={null}
        onSelectArtwork={handleSelectArtwork}
        focusedIndex={0}
        onFocusChange={() => {}}
        activeEditorTab={'lighting'}
        focusedArtworkInstanceId={focusedArtworkInstanceId}
        hasMotionArtwork={!!currentLayout?.some((a) => a.isMotionVideo)}
        uiConfig={uiConfig}
        setFocusedArtworkInstanceId={setFocusedArtworkInstanceId}
        activeExhibition={activeExhibition as Exhibition}
        onInfoOpen={() => setIsInfoOpen(true)}
        cameraControlRef={null}
        onArtworkClicked={() => {}}
        isDebugMode={false}
        triggerHeartEmitter={0}
        heartEmitterArtworkId={null}
        onCanvasClick={() => {}}
        isRankingMode={isRankingMode}
        isZeroGravityMode={isZeroGravityMode}
        isSmallScreen={isSmallScreen}
        onCameraPositionChange={() => {}}
        isCameraMovingToArtwork={false}
        isArtworkFocusedForControls={false}
        useExhibitionBackground={lightingConfig?.useExhibitionBackground}
        activeEffectName={null}
        effectRegistry={null}
        isEffectRegistryLoading={false}
        zoneGravity={activeZone?.zone_gravity}
        isEmbed={true}
      />

      {/* SideNavigation hidden for embed mode */}

      <MainControls
        uiConfig={uiConfig}
        isInfoOpen={isInfoOpen}
        lightsOn={lightsOn}
        onLightToggle={() => {}}
        hideLightsControl={hideLightsControl}
        isEditorMode={false}
        onEditorModeToggle={() => {}}
        onEditorOpen={() => {}}
        setIsSearchOpen={() => {}}
        onResetCamera={() => setFocusedArtworkInstanceId(null)}
        setIsDevToolsOpen={() => {}}
        isSmallScreen={isSmallScreen}
        isHeaderExpanded={false}
        onPrev={() => handleNavigate(Math.max(0, currentIndex - 1))}
        onNext={() => handleNavigate((currentIndex + 1) % Math.max(1, exhibitions.length))}
        prevItem={prevItem}
        nextItem={nextItem}
        isFirstItem={currentIndex === 0}
        isLastItem={exhibitions.length === 0 || currentIndex === exhibitions.length - 1}
        focusedArtworkInstanceId={focusedArtworkInstanceId}
        isArtworkFocusedForControls={false}
        onDismissArtworkControls={() => setFocusedArtworkInstanceId(null)}
        onInfoOpen={() => setIsInfoOpen(true)}
        focusedArtworkTitle={focusedArtworkTitle}
        focusedArtworkArtist={focusedArtworkArtist}
        onLikeTriggered={() => {}}
        isRankingMode={isRankingMode}
        onRankingToggle={() => setIsRankingMode(!isRankingMode)}
        hideRankingControl={hideRankingControl}
        isZeroGravityMode={isZeroGravityMode}
        onZeroGravityToggle={() => setIsZeroGravityMode(!isZeroGravityMode)}
        hideZeroGravityControl={hideZeroGravityControl}
        isSignedIn={false}
        isEmbed={true}
        isCameraAtDefaultPosition={true}
        isResetCameraEnable={true}
        setHeartEmitterArtworkId={() => {}}
        hasMotionArtwork={!!currentLayout?.some((a) => a.isMotionVideo)}
        customCameraPosition={lightingConfig?.customCameraPosition}
        showGlobalOverlay={isLoading}
      />

      <InfoPanel
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        uiConfig={uiConfig}
        activeExhibition={activeExhibition}
        isLoading={isLoading}
        focusedArtworkFirebaseId={null}
        allFirebaseArtworks={firebaseArtworks}
      />

      {isZeroGravityMode && (
        <React.Suspense fallback={null}>
          <ZeroGravityLegend
            minViews={zeroGravityViews.minViews}
            maxViews={zeroGravityViews.maxViews}
            extraTicks={zeroGravityViews.extraTicks}
            visible={isZeroGravityMode && !isLoading}
            isSmallScreen={isSmallScreen}
          />
        </React.Suspense>
      )}
    </>
  );
};

export default EmbeddedMuseumScene;