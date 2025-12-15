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
              <g clip-path="url(#clip0_14_21)">
                <path d="M39.7002 0.299805V39.7002H0.299805V0.299805H39.7002Z" stroke="black" stroke-width="0.6"/>
                <path d="M24.7214 0V40" stroke="black" stroke-width="0.6"/>
                <path d="M0 24.7214H40" stroke="black" stroke-width="0.6"/>
                <path d="M15.2786 24.7214V40" stroke="black" stroke-width="0.2"/>
                <path d="M12.3604 0.0996094C19.1316 0.0996094 24.6209 5.58912 24.6211 12.3604C24.6211 19.1317 19.1317 24.6211 12.3604 24.6211C5.58912 24.6209 0.0996094 19.1316 0.0996094 12.3604C0.0997867 5.58923 5.58923 0.0997867 12.3604 0.0996094Z" stroke="black" stroke-width="0.2"/>
                <path d="M7.63933 35.2786C9.25088 35.2786 10.5573 33.9722 10.5573 32.3607C10.5573 30.7491 9.25088 29.4427 7.63933 29.4427C6.02779 29.4427 4.72137 30.7491 4.72137 32.3607C4.72137 33.9722 6.02779 35.2786 7.63933 35.2786Z" fill="black"/>
                <path d="M24.7214 15.2786H40" stroke="black" stroke-width="0.2"/>
              </g>
              <defs>
                <clipPath id="clip0_14_21">
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