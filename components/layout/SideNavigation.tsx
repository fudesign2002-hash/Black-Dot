import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Exhibition } from '../../types';

interface SideNavigationProps {
  uiConfig: any;
  isFirstItem: boolean;
  isLastItem: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevItem: Exhibition | null;
  nextItem: Exhibition | null;
  isSmallScreen: boolean;
}

const SideNavigation: React.FC<SideNavigationProps> = React.memo(({ uiConfig, isFirstItem, isLastItem, onPrev, onNext, prevItem, nextItem, isSmallScreen }) => (
    <React.Fragment>
        {!isSmallScreen && !isFirstItem && prevItem && (
            <div className={`absolute top-1/2 left-0 -translate-y-1/2 z-30 h-64 w-24 flex items-center justify-start pl-4 cursor-pointer transition-colors duration-300 group ${uiConfig.arrowBg}`} onClick={onPrev}>
                <div className="flex items-center gap-4">
                    <ChevronLeft className={`w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity ${uiConfig.text}`} />
                    <div className="flex flex-col items-start overflow-hidden w-48 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className={`text-[9px] font-bold tracking-widest uppercase opacity-50 ${uiConfig.text}`}>Previous</span>
                        <span className={`text-sm font-serif whitespace-nowrap ${uiConfig.text}`}>{prevItem.title}</span>
                    </div>
                </div>
            </div>
        )}
        {!isSmallScreen && !isLastItem && nextItem && (
            <div className={`absolute top-1/2 right-0 -translate-y-1/2 z-30 h-64 w-24 flex items-center justify-end pr-4 cursor-pointer transition-colors duration-300 group ${uiConfig.arrowBg}`} onClick={onNext}>
                <div className="flex flex-row-reverse items-center gap-4">
                    <ChevronRight className={`w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity ${uiConfig.text}`} />
                    <div className="flex flex-col items-end overflow-hidden w-48 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className={`text-[9px] font-bold tracking-widest uppercase opacity-50 ${uiConfig.text}`}>Next</span>
                        <span className={`text-sm font-serif whitespace-nowrap ${uiConfig.text}`}>{nextItem.title}</span>
                    </div>
                </div>
            </div>
        )}
    </React.Fragment>
));

export default SideNavigation;