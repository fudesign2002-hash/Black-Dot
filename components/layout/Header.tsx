
import React from 'react';

interface HeaderProps {
  theme: any;
  version: string;
  isInfoOpen: boolean;
}

const Header: React.FC<HeaderProps> = React.memo(({ theme, version, isInfoOpen }) => (
    <div className={`absolute top-10 right-10 z-40 pointer-events-none select-none transition-opacity duration-500 ${isInfoOpen ? 'opacity-0 md:opacity-100' : 'opacity-100'}`}>
        <div className={`flex flex-row gap-6 ${theme.text} items-center`}> {/* Changed gap to gap-6 */}
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-current">
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

            <div className="flex flex-col items-end space-y-0.5">
                <h1 className="font-serif text-4xl font-medium tracking-[0.15em] uppercase">Black Dot</h1>
                <div className="flex items-center gap-1">
                    <span className={`h-px w-8 ${theme.lightsOn ? 'bg-neutral-400' : 'bg-neutral-600'}`}></span>
                    <p className={`text-[10px] tracking-[0.3em] uppercase font-medium ${theme.subtext}`}>Museum of Geometry</p>
                </div>
                <div>
                    <span className={`text-[9px] font-mono tracking-widest opacity-50 ${theme.text}`}>VOL.{version}</span>
                </div>
            </div>
        </div>
    </div>
));

export default Header;