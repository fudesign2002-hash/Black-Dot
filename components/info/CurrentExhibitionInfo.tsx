

import React from 'react';
import { Loader2, Info } from 'lucide-react';
import { Exhibition } from '../../types';

interface CurrentExhibitionInfoProps {
  theme: any;
  isLoading: boolean;
  activeExhibition: Exhibition;
  isInfoOpen: boolean;
  onInfoOpen: () => void;
}

const CurrentExhibitionInfo: React.FC<CurrentExhibitionInfoProps> = React.memo(({ theme, isLoading, activeExhibition, isInfoOpen, onInfoOpen }) => {
    const getStatusColor = (status: string) => {
        switch(status) {
            case 'current': return 'bg-cyan-500 shadow-[0_0_8px_cyan]';
            case 'past': return 'bg-red-500';
            case 'permanent': return 'bg-black';
            case 'future': return 'bg-green-500';
            default: return 'bg-gray-400';
        }
    };

    return (
        <div className={`absolute left-10 z-40 transition-all duration-500 max-w-xl ${isInfoOpen ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'} bottom-28 md:bottom-10`}>
            {isLoading ? (
                <div className={`flex items-center gap-3 ${theme.text} animate-pulse`}>
                    <Loader2 className="w-6 h-6" />
                    <span className="text-xl font-serif">Loading Exhibition...</span>
                </div>
            ) : (
                <>
                    <div className={`flex items-center gap-2 mb-4 ${theme.subtext}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${getStatusColor(activeExhibition.status)}`}></span>
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                            {activeExhibition.status === 'current' ? 'Now Showing' : activeExhibition.status + ' Exhibition'}
                        </span>
                    </div>
                    <h2 className={`text-4xl md:text-5xl font-serif font-medium leading-tight uppercase ${theme.text} mb-2`}>
                        {activeExhibition.title}
                    </h2>
                    <div className="flex items-center gap-4 mb-2">
                        <button onClick={onInfoOpen} className={`flex-shrink-0 p-2 rounded-full transition-all duration-300 hover:scale-110 ${theme.glass}`} title="Exhibition Details">
                            <Info className="w-5 h-5" />
                        </button>
                        <p className={`text-sm md:text-base font-light tracking-widest ${theme.subtext} border-l-2 ${theme.lightsOn ? 'border-neutral-300' : 'border-neutral-700'} pl-4`}>
                            {activeExhibition.subtitle}
                        </p>
                    </div>
                    <div className={`text-[12px] font-mono opacity-60 mt-2 ${theme.text}`}>
                        <span>{activeExhibition.dates}</span>
                    </div>
                </>
            )}
        </div>
    );
});

export default CurrentExhibitionInfo;