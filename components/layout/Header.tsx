import React, { useMemo } from 'react';
import { Users } from 'lucide-react';

interface HeaderProps {
  uiConfig: any;
  version: string;
  isInfoOpen: boolean;
  isSmallScreen: boolean;
  isHeaderExpanded: boolean;
  setIsHeaderExpanded: (expanded: boolean) => void;
  onlineUsers: number;
  zoneCapacity: number;
}

const Header: React.FC<HeaderProps> = React.memo(({ uiConfig, version, isInfoOpen, isSmallScreen, isHeaderExpanded, setIsHeaderExpanded, onlineUsers, zoneCapacity }) => {
  const handleLogoClick = () => {
    if (isSmallScreen) { 
      setIsHeaderExpanded(!isHeaderExpanded);
    }
  };

  const capacityPercentage = (onlineUsers / zoneCapacity) * 100;

  const getCapacityDisplayClasses = () => {
    let numeratorClasses = ''; 
    let numeratorStyle: React.CSSProperties = {};
    
    const denominatorClasses = uiConfig.text;
    const slashBgClass = uiConfig.lightsOn ? 'bg-neutral-900' : 'bg-white';

    if (capacityPercentage < 100) { 
      numeratorClasses = uiConfig.text;
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

  const innerFlexContainerClasses = `flex items-center gap-6 ${uiConfig.text} transition-all duration-500 ease-out
    ${isSmallScreen ? (isHeaderExpanded ? 'justify-start' : 'justify-end') : 'justify-end'}
    `;

  const headerTextClasses = `flex flex-col items-end space-y-0.5
    transition-all duration-500 ease-out transform-gpu
    ${isSmallScreen ? (isHeaderExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none') : 'opacity-100'}
  `;
  
  const logoRotationStyle = isSmallScreen && isHeaderExpanded ? 'rotate(0deg)' : 'rotate(180deg)';

  const onlineUsersDisplayClasses = `
    absolute top-[68px] right-0 z-40 flex flex-col items-end gap-1
    transition-all duration-500 ease-out transform-gpu
    ${isSmallScreen ? (isHeaderExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none') : 'opacity-100'}
  `;

  return (
    <React.Fragment>
      <div className={`absolute top-10 right-10 z-40 select-none transition-opacity duration-500 ${isInfoOpen ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}>
        <div className={innerFlexContainerClasses}>
            <div className={headerTextClasses}>
              <div className="flex flex-col justify-center h-10 items-end">
                <h1 className="font-serif text-3xl font-medium tracking-[0.15em] uppercase">Black Dot</h1>
                <div className="flex items-center gap-1">
                  <span className={`h-px w-6 ${uiConfig.lightsOn ? 'bg-neutral-400' : 'bg-neutral-600'}`}></span>
                  <p className={`text-[8px] tracking-[0.3em] uppercase font-medium ${uiConfig.subtext}`}>museum of everything</p>
                </div>
              </div>
            </div>

            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none"
              className={`stroke-current transition-transform duration-500 ease-out shrink-0 ${isSmallScreen ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
              style={{ transform: logoRotationStyle }}
              onClick={handleLogoClick}
              aria-label="Toggle header details"
            >
              <g clipPath="url(#clip0_10_17)">
                <rect x="0.3" y="0.3" width="39.4" height="39.4" stroke="black" strokeWidth="0.6"/>
                <line x1="40" y1="25.3" y2="25.3" stroke="black" strokeWidth="0.6"/>
                <line x1="24.7" y1="40" x2="24.7" y2="1.31134e-08" stroke="black" strokeWidth="0.6"/>
                <line x1="14.9" y1="40" x2="14.9" y2="25" stroke="black" strokeWidth="0.2"/>
                <line x1="33.9" y1="25" x2="33.9" y2="15" stroke="black" strokeWidth="0.2"/>
                <line x1="15" y1="29.9" x2="25" y2="29.9" stroke="black" strokeWidth="0.2"/>
                <line x1="25" y1="14.9" x2="40" y2="14.9" stroke="black" strokeWidth="0.2"/>
                <circle cx="12.5" cy="12.5" r="12.4" stroke="black" strokeWidth="0.2"/>
                <circle cx="8" cy="33" r="3" fill="black"/>
              </g>
              <defs>
                <clipPath id="clip0_10_17">
                  <rect width="40" height="40" fill="white"/>
                </clipPath>
              </defs>
            </svg>
        </div>
        
        <div className={onlineUsersDisplayClasses}>
          <div className="relative flex items-center gap-4 leading-none">
            <Users className={`w-4 h-4 shrink-0 ${uiConfig.subtext}`} aria-hidden="true" />

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