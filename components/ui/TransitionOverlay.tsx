

import React from 'react';
import { Loader2 } from 'lucide-react';

const TransitionOverlay = React.memo(({ isTransitioning }: { isTransitioning: boolean }) => (
    <div className={`absolute inset-0 z-[60] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center transition-opacity duration-700 pointer-events-none ${isTransitioning ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white text-xs font-mono tracking-widest uppercase opacity-70">Loading Gallery...</span>
        </div>
    </div>
));

export default TransitionOverlay;