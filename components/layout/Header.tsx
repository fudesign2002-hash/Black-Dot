import React, { useMemo, useState, useEffect, useRef } from 'react';
import BlackDotLogo from '../ui/BlackDotLogo';
import { Users } from 'lucide-react';
import { HEADER_COLOR_CSS_VAR } from '../../constants/ui';

interface HeaderProps {
  uiConfig: any;
  version: string;
  isInfoOpen: boolean;
  isSmallScreen: boolean;
  isHeaderExpanded: boolean;
  setIsHeaderExpanded: (expanded: boolean) => void;
  onlineUsers: number;
  hideUserCount?: boolean; // NEW: Add hideUserCount prop
  hideLogo?: boolean; // NEW: Add hideLogo prop
  zoneCapacity: number;
  isEmbed?: boolean;
  useExhibitionBackground?: boolean;
  activeExhibition?: any;
  showCelebration?: boolean; // NEW: Add showCelebration prop
}

const Header: React.FC<HeaderProps> = React.memo(({ uiConfig, version, isInfoOpen, isSmallScreen, isHeaderExpanded, setIsHeaderExpanded, onlineUsers, hideUserCount, hideLogo, zoneCapacity, isEmbed = false, useExhibitionBackground = false, activeExhibition = null, showCelebration = false }) => {
  const treatAsCompact = isSmallScreen || isEmbed;
  const handleLogoClick = () => {
    setIsHeaderExpanded(!isHeaderExpanded);
  };

  // Animated counters
  const [displayOnlineUsers, setDisplayOnlineUsers] = useState(onlineUsers);
  const [displayZoneCapacity, setDisplayZoneCapacity] = useState(zoneCapacity);
  const animationFrameRef = useRef<number | null>(null);

  // Animate online users count
  useEffect(() => {
    const startValue = displayOnlineUsers;
    const endValue = onlineUsers;
    const duration = 800; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.round(startValue + (endValue - startValue) * easeProgress);
      setDisplayOnlineUsers(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onlineUsers]);

  // Animate zone capacity count
  useEffect(() => {
    const startValue = displayZoneCapacity;
    const endValue = zoneCapacity;
    const duration = 800; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.round(startValue + (endValue - startValue) * easeProgress);
      setDisplayZoneCapacity(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [zoneCapacity]);

  const capacityPercentage = (displayOnlineUsers / displayZoneCapacity) * 100;

  // Get threshold level and color
  const getThresholdLevel = (percentage: number): number => {
    if (percentage >= 3000) return 6;
    if (percentage >= 1600) return 5;
    if (percentage >= 800) return 4;
    if (percentage >= 400) return 3;
    if (percentage >= 200) return 2;
    if (percentage >= 100) return 1;
    return 0;
  };

  const getThresholdColor = (level: number): string => {
    switch (level) {
      case 6: return '#FF7F00'; // Rainbow (orange)
      case 5: return '#DA70D6'; // Orchid purple
      case 4: return '#00BFFF'; // Deep sky blue
      case 3: return '#00FF7F'; // Spring green
      case 2: return '#FFA500'; // Orange
      case 1: return '#FF69B4'; // Hot pink
      default: return '';
    }
  };

  const currentThresholdLevel = getThresholdLevel(capacityPercentage);
  const currentThresholdColor = getThresholdColor(currentThresholdLevel);

  const getCapacityDisplayClasses = () => {
    let numeratorClasses = ''; 
    let numeratorStyle: React.CSSProperties = {};
    
    const denominatorClasses = uiConfig.lightsOn ? 'text-current' : uiConfig.text;
    const slashBgClass = uiConfig.lightsOn ? 'bg-current opacity-60' : 'bg-white';

    if (capacityPercentage < 100) { 
      numeratorClasses = uiConfig.lightsOn ? 'text-current' : uiConfig.text;
      numeratorStyle = { 
          animation: 'none',
      };
    } else {
      numeratorClasses = 'bg-clip-text text-transparent';
      numeratorStyle = {
          backgroundSize: '500% auto',
          animation: 'textShine 5s ease-in-out infinite alternate',
      };

      let gradientColorsCss;
      
      if (capacityPercentage > 3000) {
        gradientColorsCss = 'to right, #FF0000 10%, #FF7F00 30%, #FFFF00 50%, #00FF00 70%, #0000FF 90%';
      } else if (capacityPercentage > 1600) {
        gradientColorsCss = 'to right, #DA70D6 20%, #BA55D3 30%, #DA70D6 70%, #BA55D3 80%';
      } else if (capacityPercentage > 800) {
        gradientColorsCss = 'to right, #00BFFF 20%, #1E90FF 30%, #00BFFF 70%, #1E90FF 80%';
      } else if (capacityPercentage > 400) {
        gradientColorsCss = 'to right, #00FF7F 20%, #00CD66 30%, #00FF7F 70%, #00CD66 80%';
      } else if (capacityPercentage > 200) {
        gradientColorsCss = 'to right, #FFA500 20%, #FFD700 30%, #FFA500 70%, #FFD700 80%';
      } else {
        gradientColorsCss = 'to right, #FF69B4 20%, #FF1493 30%, #FF69B4 70%, #FF1493 80%';
      }
      numeratorStyle = {
          ...numeratorStyle,
          backgroundImage: `linear-gradient(${gradientColorsCss})`,
      };
    }

    return { numeratorClasses, numeratorStyle, denominatorClasses, slashBgClass };
  };

  const { numeratorClasses, numeratorStyle, denominatorClasses, slashBgClass } = useMemo(() => getCapacityDisplayClasses(), [displayOnlineUsers, displayZoneCapacity, uiConfig.lightsOn]);

  const hasBg = Boolean(useExhibitionBackground && activeExhibition && activeExhibition.exhibit_background);

  // Read color exclusively from uiConfig.headerColor; if exhibition background present use white
  const headerColorValue = hasBg ? '#ffffff' : (uiConfig.headerColor as string | undefined);
  const headerColorStyle: React.CSSProperties | undefined = uiConfig.lightsOn && headerColorValue
    ? ({ [HEADER_COLOR_CSS_VAR]: headerColorValue, color: `var(${HEADER_COLOR_CSS_VAR})` } as React.CSSProperties)
    : undefined;
  const subtextClass = uiConfig.lightsOn ? 'text-current opacity-70' : uiConfig.subtext;
  const smallUnderlineClass = uiConfig.lightsOn ? 'bg-current opacity-60' : 'bg-neutral-600';

  const innerFlexContainerClasses = `flex items-center gap-6 ${uiConfig.text} transition-all duration-500 ease-out
    ${treatAsCompact ? (isHeaderExpanded ? 'justify-start' : 'justify-end') : 'justify-end'}
    `;

  const headerTextClasses = `flex flex-col items-end space-y-0.5
    transition-all duration-500 ease-out transform-gpu
    ${treatAsCompact ? (isHeaderExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none') : 'opacity-100'}
  `;
  
  const logoRotationStyle = isHeaderExpanded ? 'rotate(0deg)' : 'rotate(180deg)';

  return (
    <React.Fragment>
      {!hideLogo && (
        <div className={`fixed ${treatAsCompact ? 'top-6 right-6' : 'top-10 right-10'} z-40 select-none transition-opacity duration-500 py-4 ${isInfoOpen ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}>
          <div className={innerFlexContainerClasses} style={headerColorStyle}>
              <div className={`relative ${isHeaderExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="overflow-hidden">
                  <div className={`flex flex-col justify-center items-end transform transition-all duration-500 ease-out ${isHeaderExpanded ? 'translate-x-0' : 'translate-x-full'}`}>
                      <p className="text-[0.5rem] tracking-[0.4em] uppercase font-bold mb-0.5" style={{ color: '#94a3b8' }}>
                        Powered By
                      </p>
                      <h1 className="text-[1.2rem] font-normal tracking-[-0.05em] leading-none m-0" style={{ color: headerColorValue || '#000000' }}>
                        kurodot<span style={{ color: '#9ca3af' }}>.io</span>
                      </h1>
                  </div>
                </div>
              </div>

              <BlackDotLogo treatAsCompact={treatAsCompact} logoRotationStyle={logoRotationStyle} onClick={handleLogoClick} ariaLabel="Toggle header details" />
          </div>

          {/* NEW: Online User Count moved to under logo for small screens (Always visible) */}
          {treatAsCompact && !hideUserCount && (
            <div className="mt-6 flex flex-col items-end gap-2 transition-opacity duration-500" style={headerColorStyle}>
              {/* Celebration gif above user count */}
              {showCelebration && (
                <div
                  style={{
                    position: 'fixed',
                    width: '75px',
                    height: '75px',
                    top: '90px',
                    right: '20px',
                    pointerEvents: 'none',
                    zIndex: 999,
                  }}
                >
                  <img
                    src="/9ca21edc-3316-4352-8634-01d19941c646.gif"
                    alt="celebration"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              )}
              <div className="relative flex items-center gap-2 leading-none">
                <Users 
                  className={`w-3 h-3 shrink-0 ${uiConfig.lightsOn ? 'text-current' : uiConfig.subtext}`} 
                  aria-hidden="true"
                  style={{
                    color: currentThresholdColor || undefined
                  }}
                />
                <div className="relative flex items-baseline">
                  <span className={`relative text-sm font-serif font-medium -top-[4px] ${numeratorClasses}`} style={numeratorStyle}>
                    {displayOnlineUsers}
                  </span>
                  <div className={`relative w-px h-4 mx-1.5 transform rotate-[30deg] origin-center ${slashBgClass}`} />
                  <span className={`relative text-[10px] font-serif font-normal top-[1px] ${denominatorClasses}`}>
                    {displayZoneCapacity}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
        
      {/* Online Users Display - Desktop: bottom right | Mobile: hidden */}
      {/* Celebration gif for Desktop: fixed above counter */}
      {showCelebration && !treatAsCompact && (
        <div
          style={{
            position: 'fixed',
            width: '75px',
            height: '75px',
            bottom: '50px',
            right: '40px',
            pointerEvents: 'none',
            zIndex: 999,
          }}
        >
          <img
            src="/9ca21edc-3316-4352-8634-01d19941c646.gif"
            alt="celebration"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
      {!hideUserCount && !treatAsCompact && (
        <div className="fixed bottom-10 right-10 z-40 select-none" style={headerColorStyle}>
          <div className="relative flex items-center gap-4 leading-none">
            <div className="relative">
              <Users 
                className={`w-4 h-4 shrink-0 ${uiConfig.lightsOn ? 'text-current' : uiConfig.subtext}`} 
                aria-hidden="true"
                style={{
                  color: currentThresholdColor || undefined
                }}
              />
            </div>

            <div className="relative flex items-baseline">
              <span className={`relative text-base font-serif font-medium -top-[6px] -right-[-6px] ${numeratorClasses}`} style={numeratorStyle}>
                {displayOnlineUsers}
              </span>
              <div className={`relative w-px h-5 mx-0.5 transform rotate-[30deg] origin-center ${slashBgClass}`} />
              <span className={`relative text-xs font-serif font-normal top-[0px] left-[2px] ${denominatorClasses}`}>
                {displayZoneCapacity}
              </span>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
});

export default Header;