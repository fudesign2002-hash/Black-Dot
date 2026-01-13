import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, MapPin, Ticket, Clock, Loader2, Image, Brush, Layers, Ruler, Weight, Heart, Share2, Info, Eye } from 'lucide-react';
import { Exhibition, FirebaseArtwork } from '../../types';

interface InfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  uiConfig: any;
  activeExhibition: Exhibition;
  isLoading: boolean;
  focusedArtworkFirebaseId?: string | null;
  allFirebaseArtworks: FirebaseArtwork[];
  onOpenExhibitionInfoFromArtwork?: () => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ isOpen, onClose, uiConfig, activeExhibition, isLoading, focusedArtworkFirebaseId, allFirebaseArtworks, onOpenExhibitionInfoFromArtwork }) => {
  const { lightsOn } = uiConfig;
  const [posterLoadError, setPosterLoadError] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const prevIsOpenRef = React.useRef<boolean>(isOpen);

  React.useEffect(() => {
    try {
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      // eslint-disable-next-line no-console
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
        // only debug in dev
        // eslint-disable-next-line no-console
        console.debug('[InfoPanel] isOpen changed', { isOpen, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, transform: style.transform, overflow: style.overflow, display: style.display });
      }
    } catch (e) {}
  }, [isOpen]);

  // Blur focused element inside the panel when it is closed to avoid aria-hidden warnings
  React.useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      try {
        const active = document.activeElement as HTMLElement | null;
        if (active && panelRef.current && panelRef.current.contains(active)) {
          active.blur();
        }
      } catch (e) {
        // ignore
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  const artworkDataForPanel = useMemo(() => {
    if (focusedArtworkFirebaseId && allFirebaseArtworks) {
      return allFirebaseArtworks.find(art => art.id === focusedArtworkFirebaseId);
    }
    return null;
  }, [focusedArtworkFirebaseId, allFirebaseArtworks]);

  const showArtworkData = !!artworkDataForPanel;

  const formatArtworkType = (type: string | undefined) => {
    if (!type) return 'N/A';
    return type.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };

  // NOTE: keep hooks above this early return so their order is stable across renders

  const exhibitionDateLines = React.useMemo(() => {
    if (activeExhibition.dateFrom || activeExhibition.dateTo) {
      return [activeExhibition.dateFrom || '', activeExhibition.dateTo || ''];
    }
    if (activeExhibition.dates && activeExhibition.dates.includes('–')) {
      const parts = activeExhibition.dates.split('–').map(s => s.trim());
      if (parts.length >= 2) return [parts[0], parts.slice(1).join(' – ')];
      return [activeExhibition.dates];
    }
    return activeExhibition.dates ? [activeExhibition.dates] : [];
  }, [activeExhibition.dateFrom, activeExhibition.dateTo, activeExhibition.dates]);

  const exhibitionHoursParts = React.useMemo(() => {
    const h = activeExhibition.hours || '';
    if (!h) return [];
    const idx = h.indexOf(':');
    if (idx !== -1) {
      const top = h.slice(0, idx).trim();
      const bottom = h.slice(idx + 1).trim();
      return [top, bottom];
    }
    return [h];
  }, [activeExhibition.hours]);

  // If the panel is closed, don't render it at all to avoid layout/stacking leaks
  if (!isOpen) return null;

  const panelContent = (
    <React.Fragment>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div 
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-full md:w-[600px] z-50 backdrop-blur-xl shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden flex flex-col border-l ${uiConfig.border} ${uiConfig.panelBg} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-10 flex justify-between items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className={`text-[10px] font-bold tracking-[0.3em] uppercase ${showArtworkData ? 'text-cyan-500' : 'text-cyan-500'}`}>
                {showArtworkData ? 'Artwork Details' : 'Exhibition Details'}
              </span>
            </div>
            
            <div className="space-y-1">
              <h3 className={`text-4xl font-serif tracking-tight ${uiConfig.text}`}>
                {showArtworkData ? artworkDataForPanel?.title : activeExhibition.title}
              </h3>
              <p className={`text-sm opacity-50 ${uiConfig.text}`}>
                {showArtworkData ? `by ${artworkDataForPanel?.artist || 'Unknown Artist'}` : `Curated by ${activeExhibition.artist}`}
              </p>
            </div>

            {showArtworkData && (
              <div className="flex items-center gap-6 pt-2">
                 <div className="flex items-center gap-2 group">
                    <Heart className={`w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-rose-500 transition-all ${uiConfig.text}`} strokeWidth={1.5} />
                    <span className={`text-xs font-bold tracking-widest ${uiConfig.text}`}>{artworkDataForPanel?.artwork_liked ?? '0'}</span>
                 </div>
                  <div className="flex items-center gap-2 group">
                    <Eye className={`w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-cyan-500 transition-all ${uiConfig.text}`} strokeWidth={1.5} />
                    <span className={`text-xs font-bold tracking-widest ${uiConfig.text}`}>{artworkDataForPanel?.artwork_viewed ?? '0'}</span>
                  </div>
              </div>
            )}
          </div>
          <button onClick={onClose} className={`p-3 rounded-full hover:bg-neutral-500/10 transition-all ${uiConfig.text} border ${uiConfig.border}`}>
            <X className="w-6 h-6" strokeWidth={1} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-10 pb-20 scrollbar-hide`}>
           {showArtworkData ? (
             <React.Fragment>
                {isLoading ? (
                  <div className="text-center py-20">
                    <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 opacity-20 ${uiConfig.text}`} />
                    <p className={`text-xs font-bold tracking-widest opacity-40 ${uiConfig.text}`}>Loading Details</p>
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 gap-x-12 gap-y-12 mb-16 p-10 bg-neutral-500/5 border ${uiConfig.border} rounded-xl relative overflow-hidden`}>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 opacity-40">
                             <Image size={14} strokeWidth={1.5} className={uiConfig.text} />
                             <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${uiConfig.text}`}>Focus</span>
                        </div>
                        <p className={`text-xl font-medium tracking-tight ${uiConfig.text}`}>{formatArtworkType(artworkDataForPanel?.artwork_type)}</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 opacity-40">
                             <Brush size={14} strokeWidth={1.5} className={uiConfig.text} />
                             <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${uiConfig.text}`}>Artist</span>
                        </div>
                        <p className={`text-xl font-medium tracking-tight ${uiConfig.text}`}>{artworkDataForPanel?.artist || 'N/A'}</p>
                    </div>

                    <div className="col-span-2 pt-10 border-t border-neutral-500/10 space-y-4">
                        <div className="flex items-center gap-3 opacity-40">
                             <Ruler size={14} strokeWidth={1.5} className={uiConfig.text} />
                             <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${uiConfig.text}`}>Composition</span>
                        </div>
                        <div className="space-y-1">
                            <p className={`text-lg font-medium leading-relaxed ${uiConfig.text}`}>{artworkDataForPanel?.materials || 'Mixed Media'}</p>
                            <p className={`text-sm opacity-50 ${uiConfig.text}`}>{artworkDataForPanel?.size || 'Variable Dimensions'}</p>
                        </div>
                    </div>

                    {artworkDataForPanel?.fileSizeMB !== undefined && (
                      <div className="col-span-2 pt-10 border-t border-neutral-500/10 space-y-4">
                          <div className="flex items-center gap-3 opacity-40">
                               <Weight size={14} strokeWidth={1.5} className={uiConfig.text} />
                               <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${uiConfig.text}`}>Digital Footprint</span>
                          </div>
                          <p className={`text-xl font-medium tracking-tight ${uiConfig.text}`}>{artworkDataForPanel.fileSizeMB.toFixed(2)} MB</p>
                      </div>
                    )}
                  </div>
                )}
             </React.Fragment>
           ) : (
            <React.Fragment>
               {activeExhibition.exhibit_poster && activeExhibition.exhibit_poster.trim() !== '' && !posterLoadError && (
                 <div className={`w-full aspect-[16/9] mb-16 relative overflow-hidden rounded-xl border ${uiConfig.border} shadow-2xl`}>
                    <img
                      src={activeExhibition.exhibit_poster}
                      alt={`${activeExhibition.title} poster`}
                      className="object-cover w-full h-full scale-105 hover:scale-100 transition-transform duration-1000"
                      onError={() => setPosterLoadError(true)}
                    />
                 </div>
               )}

               {isLoading ? (
                 <div className="text-center py-20">
                   <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 opacity-20 ${uiConfig.text}`} />
                   <p className={`text-xs font-bold tracking-widest opacity-40 ${uiConfig.text}`}>Synchronizing</p>
                 </div>
               ) : (
                <React.Fragment>
                   {(exhibitionDateLines.length > 0 || 
                     exhibitionHoursParts.length > 0 || 
                     (activeExhibition.venue && activeExhibition.venue.trim() !== '')) && (
                     <div className={`grid grid-cols-2 gap-x-12 gap-y-12 mb-16 p-10 bg-neutral-500/5 border ${uiConfig.border} rounded-xl relative overflow-hidden`}>
                         {exhibitionDateLines.length > 0 && (
                           <div className="space-y-4">
                             <div className="flex items-center gap-3 opacity-40">
                               <Calendar size={14} strokeWidth={1.5} className={uiConfig.text} />
                               <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${uiConfig.text}`}>Dates</span>
                             </div>
                             <div className={`text-xl font-medium tracking-tight ${uiConfig.text}`}>
                               {exhibitionDateLines.map((line, idx) => (
                                 <p key={`date-line-${idx}`}>{line}</p>
                               ))}
                             </div>
                           </div>
                         )}
                         {exhibitionHoursParts.length > 0 && (
                           <div className="space-y-4">
                             <div className="flex items-center gap-3 opacity-40">
                               <Clock size={14} strokeWidth={1.5} className={uiConfig.text} />
                               <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${uiConfig.text}`}>Hours</span>
                             </div>
                             <div className={`text-xl font-medium tracking-tight ${uiConfig.text}`}>
                                {exhibitionHoursParts.map((part, i) => (
                                  <p key={i}>{part}</p>
                                ))}
                             </div>
                           </div>
                         )}
                         {activeExhibition.venue && activeExhibition.venue.trim() !== '' && (
                           <div className={`col-span-2 pt-10 border-t border-neutral-500/10 space-y-4`}>
                              <div className="flex items-center gap-3 opacity-40">
                                 <MapPin size={14} strokeWidth={1.5} className={uiConfig.text} />
                                 <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${uiConfig.text}`}>Venue</span>
                              </div>
                              <p className={`text-xl font-medium tracking-tight ${uiConfig.text}`}>{activeExhibition.venue}</p>
                           </div>
                         )}
                         
                         {/* Action Divider Line */}
                         <div className="absolute top-1/2 left-0 right-0 h-px bg-neutral-100 dark:bg-neutral-800/20 -translate-y-1/2 hidden md:block opacity-30" />
                     </div>
                   )}

                   <div className="space-y-12">
                      {activeExhibition.overview && activeExhibition.overview.trim() !== '' && (
                        <div className="space-y-8">
                          <div className={`space-y-4`}>
                             <h3 className={`text-[10px] font-bold uppercase tracking-[0.4em] ${uiConfig.text}`}>Overview</h3>
                             <div className={`h-px w-full bg-neutral-500/10`} />
                          </div>
                          <p className={`text-lg leading-[1.8] font-medium opacity-70 ${uiConfig.subtext} first-letter:text-4xl first-letter:font-serif first-letter:mr-1`}>
                            {activeExhibition.overview}
                          </p>
                        </div>
                      )}
                      
                      {activeExhibition.supportedBy && activeExhibition.supportedBy.trim() !== '' && ( 
                        <div className={`pt-12 border-t ${uiConfig.border} flex flex-col gap-4 opacity-40`}>
                            <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${uiConfig.text}`}>Supporters & Patrons</p>
                            <p className={`text-base font-serif ${uiConfig.text}`}>{activeExhibition.supportedBy}</p>
                        </div>
                      )}
                   </div>
                </React.Fragment>
               )}
            </React.Fragment>
           )}
        </div>

        <div className={`p-10 border-t ${uiConfig.border} ${uiConfig.panelBg}`}>
           {showArtworkData ? (
             <div className="flex gap-4">
               <button
                  onClick={onOpenExhibitionInfoFromArtwork}
                  className={`flex-1 h-16 flex items-center justify-center gap-4 font-bold tracking-[0.3em] uppercase transition-all duration-500 rounded-lg border ${uiConfig.border} ${uiConfig.text} hover:bg-neutral-500/5 group`}
               >
                  <Info size={16} strokeWidth={1.5} className="group-hover:rotate-12 transition-transform opacity-60" />
                  <span className="text-[10px]">Exhibition</span>
               </button>
               {activeExhibition.admissionLink ? ( 
                 <a 
                   href={activeExhibition.admissionLink} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className={`flex-1 h-16 flex items-center justify-center gap-4 font-bold tracking-[0.3em] uppercase transition-all duration-500 rounded-lg ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-neutral-900 hover:bg-neutral-100'} group shadow-xl shadow-black/5`}
                 >
                    <Ticket size={16} strokeWidth={1.5} className="group-hover:-rotate-12 transition-transform" />
                    <span className="text-[10px]">Tickets</span>
                 </a>
               ) : (
                  <button className={`flex-1 h-16 flex items-center justify-center gap-4 font-bold tracking-[0.3em] uppercase transition-all duration-500 rounded-lg opacity-50 cursor-not-allowed ${lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900'}`} disabled>
                      <Ticket size={16} strokeWidth={1.5} />
                      <span className="text-[10px]">N/A</span>
                  </button>
               )}
             </div>
           ) : (
               activeExhibition.status === 'future' ? (
                   <button className={`w-full h-16 flex items-center justify-center gap-4 font-bold tracking-[0.3em] uppercase transition-all duration-500 bg-cyan-600 text-white hover:bg-cyan-700 rounded-lg shadow-xl shadow-cyan-500/20 group`}>
                      <Calendar size={16} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[10px]">Remind Me</span>
                   </button>
               ) : activeExhibition.admissionLink ? ( 
                   <a 
                     href={activeExhibition.admissionLink} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className={`w-full h-16 flex items-center justify-center gap-4 font-bold tracking-[0.3em] uppercase transition-all duration-500 rounded-lg ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-neutral-900 hover:bg-neutral-100'} shadow-xl shadow-black/10 group`}
                   >
                      <Ticket size={16} strokeWidth={1.5} className="group-hover:-rotate-12 transition-transform" />
                      <span className="text-[10px]">{activeExhibition.status === 'past' ? 'View Archive' : 'Tickets'}</span>
                   </a>
               ) : (
                  <button className={`w-full h-16 flex items-center justify-center gap-4 font-bold tracking-[0.3em] uppercase transition-all duration-500 rounded-lg opacity-50 cursor-not-allowed ${lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900'}`} disabled>
                      <Ticket size={16} strokeWidth={1.5} />
                      <span className="text-[10px]">{activeExhibition.status === 'past' ? 'View Archive' : 'N/A'}</span>
                  </button>
               )
           )}
        </div>
      </div>
    </React.Fragment>
  );

  if (typeof document !== 'undefined') {
    return createPortal(panelContent, document.body);
  }
  return panelContent;
};

export default InfoPanel;