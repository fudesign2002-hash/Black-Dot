import React, { useMemo } from 'react';
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
  zoneCapacity: number;
  isEmbed?: boolean;
  useExhibitionBackground?: boolean;
  activeExhibition?: any;
}

const Header: React.FC<HeaderProps> = React.memo(({ uiConfig, version, isInfoOpen, isSmallScreen, isHeaderExpanded, setIsHeaderExpanded, onlineUsers, zoneCapacity, isEmbed = false, useExhibitionBackground = false, activeExhibition = null }) => {
  const treatAsCompact = isSmallScreen || isEmbed;
  const handleLogoClick = () => {
    if (treatAsCompact) {
      setIsHeaderExpanded(!isHeaderExpanded);
    }
  };

  const capacityPercentage = (onlineUsers / zoneCapacity) * 100;

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

  const { numeratorClasses, numeratorStyle, denominatorClasses, slashBgClass } = useMemo(() => getCapacityDisplayClasses(), [onlineUsers, zoneCapacity, uiConfig.lightsOn]);

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
  
  const logoRotationStyle = treatAsCompact && isHeaderExpanded ? 'rotate(0deg)' : 'rotate(180deg)';

  const onlineUsersDisplayClasses = `
    absolute top-[68px] right-0 z-40 flex flex-col items-end gap-1
    transition-all duration-500 ease-out transform-gpu
    ${isSmallScreen ? (isHeaderExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none') : 'opacity-100'}
  `;

  return (
    <React.Fragment>
      <div className={`absolute top-10 right-10 z-40 select-none transition-opacity duration-500 ${isInfoOpen ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}>
        <div className={innerFlexContainerClasses} style={headerColorStyle}>
            <div className={`relative ${treatAsCompact ? (isHeaderExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none') : 'opacity-100'}`}>
              <div className="overflow-hidden h-10">
                <div className={`flex flex-col justify-center h-10 items-end transform transition-all duration-500 ease-out ${treatAsCompact ? (isHeaderExpanded ? 'translate-x-0' : 'translate-x-full') : 'translate-x-0'}`}>
                    <h1 className="font-serif text-2xl font-medium tracking-[0.15em] uppercase">Black Dot</h1>
                    <div className="flex items-center gap-1">
                      <span className={`h-px w-3 ${smallUnderlineClass}`}></span>
                      <p className={`text-[8px] tracking-[0.3em] uppercase font-medium ${subtextClass}`}>museum technology</p>
                    </div>
                </div>
              </div>
            </div>

            <BlackDotLogo treatAsCompact={treatAsCompact} logoRotationStyle={logoRotationStyle} onClick={handleLogoClick} ariaLabel="Toggle header details" />
        </div>
        
        <div className={onlineUsersDisplayClasses} style={headerColorStyle}>
          <div className="relative flex items-center gap-4 leading-none">
            <Users className={`w-4 h-4 shrink-0 ${uiConfig.lightsOn ? 'text-current' : uiConfig.subtext}`} aria-hidden="true" />

            <div className="relative flex items-baseline">
              <span className={`relative text-base font-serif font-medium -top-[6px] -right-[-6px] ${numeratorClasses}`} style={numeratorStyle}>
                {onlineUsers}
              </span>
                    <div className={`relative w-px h-5 mx-0.5 transform -rotate-[-25deg] origin-center ${slashBgClass}`} />
              <span className={`relative text-xs font-serif font-normal top-[0px] left-[2px] ${denominatorClasses}`}>
                {zoneCapacity}
              </span>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
});

export default Header;