import React from 'react';
import { HEADER_COLOR_CSS_VAR } from '../../constants/ui';
import { Loader2, Info, Music } from 'lucide-react';
import { Exhibition } from '../../types';
import { trackUmamiEvent } from '../../services/umamiService';
import { cleanMusicFileName } from '../../utils/audioUtils';

interface CurrentExhibitionInfoProps {
  uiConfig: any;
  isLoading: boolean;
  activeExhibition: Exhibition;
  isInfoOpen: boolean;
  isSmallScreen: boolean;
  isCurrentExhibitionInfoHidden: boolean;
  onInfoOpen: (type?: 'exhibition' | 'artwork') => void;
  useExhibitionBackground?: boolean;
  isMusicMuted?: boolean; // NEW
  onToggleMusic?: (e: React.MouseEvent) => void; // NEW
}

const CurrentExhibitionInfo: React.FC<CurrentExhibitionInfoProps> = React.memo(({ uiConfig, isLoading, activeExhibition, isInfoOpen, isSmallScreen, isCurrentExhibitionInfoHidden, onInfoOpen, useExhibitionBackground = false, isMusicMuted = false, onToggleMusic }) => {
    const handleInfoClick = () => {
        trackUmamiEvent('Exhibit-Info');
        onInfoOpen('exhibition');
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'now showing': return 'bg-cyan-500 shadow-[0_0_8px_cyan]';
            case 'past': return 'bg-red-500';
            case 'permanent': return 'bg-black';
            case 'future': return 'bg-green-500';
            default: return 'bg-gray-400';
        }
    };

    const slideOutClass = isSmallScreen && isCurrentExhibitionInfoHidden ? '-translate-x-[150%] opacity-0' : 'translate-x-0 opacity-100';

    const hasBg = Boolean(useExhibitionBackground && activeExhibition && activeExhibition.exhibit_background);
    // Read color exclusively from uiConfig.headerColor; if exhibition background present use white
    const headerColorValue = hasBg ? '#ffffff' : (uiConfig.headerColor as string | undefined);
    const headerColorStyle: React.CSSProperties | undefined = uiConfig.lightsOn && headerColorValue
        ? ({ [HEADER_COLOR_CSS_VAR]: headerColorValue, color: `var(${HEADER_COLOR_CSS_VAR})` } as React.CSSProperties)
        : undefined;
    const textClass = uiConfig.lightsOn ? 'text-current' : uiConfig.text;
    const subtextClass = uiConfig.lightsOn ? 'text-current opacity-70' : uiConfig.subtext;


    return (
        <React.Fragment>
        <div className={`absolute ${isSmallScreen ? 'left-6' : 'left-10'} z-[80] transition-all duration-500 max-w-xl ${isInfoOpen ? '-translate-x-full opacity-0' : slideOutClass} ${isSmallScreen ? 'bottom-36' : 'bottom-28'} md:bottom-10`} style={headerColorStyle}>
            {isLoading ? (
                <div className={`flex items-center gap-3 ${textClass} animate-pulse`}>
                    <Loader2 className="w-6 h-6 text-current" />
                    <span className="text-xl font-serif text-current">Loading Exhibition...</span>
                </div>
            ) : (
                <React.Fragment>
                    <div className={`flex items-center gap-2 ${isSmallScreen ? 'mb-2.5' : 'mb-4'} ${subtextClass}`}>
                        <span className={`w-1 h-1 rounded-full animate-pulse ${getStatusColor(activeExhibition.status)}`}></span>
                        <span className={`${isSmallScreen ? 'text-[7.5px]' : 'text-[8px]'} font-normal tracking-[0.2em] uppercase text-current opacity-80`}>
                            {activeExhibition.status === 'now showing' ? 'Now Showing' : activeExhibition.status + ' Exhibition'}
                        </span>
                    </div>
                    {isSmallScreen ? (
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className={`text-[1.375rem] md:text-5xl font-serif font-medium leading-tight uppercase ${textClass}`}>
                                {activeExhibition.title}
                            </h2>
                            <button onClick={handleInfoClick} className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-300 hover:scale-110 ${uiConfig.lightsOn ? 'bg-white/20 border border-white/20' : 'bg-white/10 border border-white/10'} backdrop-blur-md`} title="Exhibition Details">
                                <Info className="w-4 h-4 text-current" />
                            </button>
                        </div>
                    ) : (
                        <h2 className={`text-3xl md:text-4xl font-serif font-medium leading-tight uppercase ${textClass} mb-2`}>
                            {activeExhibition.title}
                        </h2>
                    )}
                    {isSmallScreen ? (
                        <div className={`border-l ${uiConfig.lightsOn ? 'border-current border-opacity-30' : 'border-neutral-700'} pl-3`}>
                            <p className={`text-[11px] md:text-base font-light tracking-widest ${subtextClass} mb-2`}>
                                {activeExhibition.subtitle}
                            </p>
                            <div className={`flex items-center gap-2 text-[7.5px] font-normal tracking-wider uppercase opacity-50 ${textClass}`}>
                                <span className="text-current">{activeExhibition.dates}</span>
                                {activeExhibition.exhibit_bg_music && (
                                    <button 
                                        onClick={onToggleMusic}
                                        className="flex items-center gap-1.5 ml-1 hover:opacity-100 active:opacity-60 transition-all p-3 -m-3 relative z-10 pointer-events-auto touch-manipulation"
                                        title={isMusicMuted ? "Unmute Music" : "Mute Music"}
                                    >
                                        <Music className={`w-3.5 h-3.5 text-current ${isMusicMuted ? 'opacity-30' : 'animate-music-pulse'}`} />
                                        <span className={`truncate max-w-[110px] ${isMusicMuted ? 'line-through opacity-30' : ''}`}>
                                            {cleanMusicFileName(activeExhibition.exhibit_bg_music)}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 mb-2">
                                <button onClick={handleInfoClick} className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-300 hover:scale-110 ${uiConfig.lightsOn ? 'bg-white/20 border border-white/20' : 'bg-white/10 border border-white/10'} backdrop-blur-md`} title="Exhibition Details">
                                    <Info className="w-4 h-4 text-current" />
                                </button>
                                <p className={`text-xs md:text-sm font-light tracking-widest ${subtextClass} border-l-2 ${uiConfig.lightsOn ? 'border-current border-opacity-30' : 'border-neutral-700'} pl-4`}>
                                    {activeExhibition.subtitle}
                                </p>
                            </div>
                            <div className={`flex items-center gap-2 text-[8px] font-normal tracking-wider uppercase opacity-50 mt-2 ${textClass}`}>
                                <span className="text-current">{activeExhibition.dates}</span>
                                {activeExhibition.exhibit_bg_music && (
                                    <button 
                                        onClick={onToggleMusic}
                                        className="flex items-center gap-1.5 ml-2 hover:opacity-100 active:opacity-60 transition-all p-3 -m-3 relative z-10 pointer-events-auto touch-manipulation"
                                        title={isMusicMuted ? "Unmute Music" : "Mute Music"}
                                    >
                                        <Music className={`w-3.5 h-3.5 text-current ${isMusicMuted ? 'opacity-30' : 'animate-music-pulse'}`} />
                                        <span className={`truncate max-w-[150px] ${isMusicMuted ? 'line-through opacity-30' : ''}`}>
                                            {cleanMusicFileName(activeExhibition.exhibit_bg_music)}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </React.Fragment>
            )}
        </div>
        </React.Fragment>
    );
});

export default CurrentExhibitionInfo;