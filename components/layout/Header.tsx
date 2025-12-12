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

            <svg 
                width="40"
                height="40"
                viewBox="0 0 100 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg" 
                className={`stroke-current transition-transform duration-500 ease-out shrink-0 
                    ${isSmallScreen ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
                `}
                style={{ transform: logoRotationStyle }}
                onClick={handleLogoClick}
                aria-label="Toggle header details"
            >
                <rect x="1" y="1" width="98" height="98" strokeWidth="2" />
                <line x1="50" y1="0" x2="50" y2="100" strokeWidth="1" className="opacity-50" />
                <line x1="0" y1="50" x2="100" y2="50" strokeWidth="1" className="opacity-50" />
                <g className="opacity-40">
                    <line x1="50" y1="0" x2="100" y2="50" strokeWidth="1.5" />
                    <line x1="0" y1="50" x2="100" y2="50" strokeWidth="1.5" />
                    <line x1="100" y1="50" x2="50" y2="100" strokeWidth="1.5" />
                </g>
                <circle cx="25" cy="75" r="7" className="fill-current" stroke="none" />
            </svg>
        </div>
        
        <div className={onlineUsersDisplayClasses}>
            <div className="relative flex items-baseline leading-none">
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
    </React.Fragment>
  );
});

export default Header;