import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, MapPin, Ticket, Clock, Loader2, Image, Brush, Layers, Ruler, Weight, Heart, Share2, Info, Eye, BookOpen, Instagram, Globe } from 'lucide-react';
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

  // Helper function to get button config based on link type
  const getButtonConfig = (linkType?: string, status?: string) => {
    if (status === 'past') {
      return {
        icon: Ticket,
        text: 'View Archive'
      };
    }
    
    switch (linkType) {
      case 'learn_more':
        return {
          icon: BookOpen,
          text: 'Learn More'
        };
      case 'instagram':
        return {
          icon: Instagram,
          text: 'Instagram'
        };
      case 'website':
        return {
          icon: Globe,
          text: 'Website'
        };
      case 'tickets':
      default:
        return {
          icon: Ticket,
          text: 'Tickets'
        };
    }
  };

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

  // NEW: Calculate aggregated likes and views for the exhibition view if showArtworkData is false
  const exhibitionStats = useMemo(() => {
    if (showArtworkData || !activeExhibition || !allFirebaseArtworks) return { liked: 0, viewed: 0 };
    
    // MODIFIED: Aggregate from both exhibit_artworks AND the default/current layout
    const artworkIds = new Set([
      ...(activeExhibition.exhibit_artworks || []),
      ...(activeExhibition.defaultLayout?.map(item => item.artworkId) || [])
    ]);

    const artworksInExhibit = allFirebaseArtworks.filter(art => artworkIds.has(art.id));
    
    const liked = artworksInExhibit.reduce((sum, art) => sum + (art.artwork_liked || 0), 0);
    const viewed = artworksInExhibit.reduce((sum, art) => sum + (art.artwork_viewed || 0), 0);
    
    return { liked, viewed };
  }, [showArtworkData, activeExhibition, allFirebaseArtworks]);

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
        <div className="p-8 pb-4 flex justify-between items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold tracking-[0.3em] uppercase ${showArtworkData ? 'text-cyan-500' : 'text-cyan-500'}`}>
                {showArtworkData ? 'Artwork Details' : 'Exhibition Details'}
              </span>
            </div>
            
            <div className="space-y-1">
              <h3 className={`text-5xl font-serif font-medium tracking-tight uppercase ${uiConfig.text}`}>
                {showArtworkData ? artworkDataForPanel?.title : activeExhibition.title}
              </h3>
              {(showArtworkData || (activeExhibition.artist && activeExhibition.artist.toUpperCase() !== 'OOTB')) && (
                <p className={`text-base font-serif opacity-70 ${uiConfig.text}`}>
                  {showArtworkData ? `by ${artworkDataForPanel?.artist || 'Unknown Artist'}` : `Artist : ${activeExhibition.artist}`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-6 pt-2">
               <div className="flex items-center gap-2 group">
                  <Heart className={`w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-rose-500 transition-all ${uiConfig.text}`} strokeWidth={1.5} />
                  <span className={`text-xs font-bold tracking-widest ${uiConfig.text}`}>
                    {showArtworkData 
                      ? (artworkDataForPanel?.artwork_liked ?? '0') 
                      : (activeExhibition.exhibit_liked || exhibitionStats.liked || '0')}
                  </span>
               </div>
                <div className="flex items-center gap-2 group">
                  <Eye className={`w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-cyan-500 transition-all ${uiConfig.text}`} strokeWidth={1.5} />
                  <span className={`text-xs font-bold tracking-widest ${uiConfig.text}`}>
                    {showArtworkData 
                      ? (artworkDataForPanel?.artwork_viewed ?? '0') 
                      : (activeExhibition.exhibit_viewed || exhibitionStats.viewed || '0')}
                  </span>
                </div>
            </div>
          </div>
          <button onClick={onClose} className={`p-3 transition-all ${uiConfig.text} opacity-50 hover:opacity-100`}>
            <X className="w-8 h-8" strokeWidth={1} />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-8 pb-10 scrollbar-hide`}>
           {showArtworkData ? (
             <React.Fragment>
                        {isLoading ? (
                  <div className="text-center py-10">
                    <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 opacity-20 ${uiConfig.text}`} />
                    <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${uiConfig.text}`}>Loading Details</p>
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 gap-6 mb-8 p-6 bg-neutral-500/5 border ${uiConfig.border} rounded-sm`}>
                    {artworkDataForPanel?.artwork_type && artworkDataForPanel.artwork_type !== 'unknown' && (
                      <div className="flex items-start gap-4">
                          <Image size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                          <div>
                               <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Artwork Type</p>
                               <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{formatArtworkType(artworkDataForPanel?.artwork_type)}</p>
                          </div>
                      </div>
                    )}
                    
                    {artworkDataForPanel?.artist && (
                      <div className="flex items-start gap-4">
                          <Brush size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                          <div>
                               <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Artist</p>
                               <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{artworkDataForPanel?.artist}</p>
                          </div>
                      </div>
                    )}

                    {artworkDataForPanel?.artwork_date && (
                      <div className="flex items-start gap-4">
                          <Calendar size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                          <div>
                               <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Date</p>
                               <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{artworkDataForPanel.artwork_date}</p>
                          </div>
                      </div>
                    )}

                    {(artworkDataForPanel?.artwork_medium || artworkDataForPanel?.materials) && (
                      <div className={`col-span-2 pt-4 border-t border-neutral-500/10 flex items-start gap-4`}>
                          <Layers size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                          <div>
                              <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Medium</p>
                              <div className="space-y-1">
                                  <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{artworkDataForPanel.artwork_medium || artworkDataForPanel.materials}</p>
                                  {(artworkDataForPanel.artwork_dimensions || artworkDataForPanel.size) && (
                                    <p className={`text-xs opacity-50 ${uiConfig.text}`}>{artworkDataForPanel.artwork_dimensions || artworkDataForPanel.size}</p>
                                  )}
                              </div>
                          </div>
                      </div>
                    )}
                  </div>
                )}
             </React.Fragment>
           ) : (
            <React.Fragment>
               {activeExhibition.exhibit_poster && activeExhibition.exhibit_poster.trim() !== '' && !posterLoadError && (
                 <div className={`w-full aspect-[16/9] mb-8 relative overflow-hidden border ${uiConfig.border}`}>
                    <img
                      src={activeExhibition.exhibit_poster}
                      alt={`${activeExhibition.title} poster`}
                      className="object-cover w-full h-full scale-105 hover:scale-100 transition-transform duration-1000"
                      onError={() => setPosterLoadError(true)}
                    />
                 </div>
               )}

               {isLoading ? (
                 <div className="text-center py-10">
                   <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 opacity-20 ${uiConfig.text}`} />
                   <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${uiConfig.text}`}>Synchronizing</p>
                 </div>
               ) : (
                <React.Fragment>
                   {(exhibitionDateLines.length > 0 || 
                     exhibitionHoursParts.length > 0 || 
                     (activeExhibition.venue && activeExhibition.venue.trim() !== '') || 
                     (activeExhibition.admission && activeExhibition.admission.trim() !== '')) && (
                     <div className={`grid grid-cols-2 gap-6 mb-8 p-6 bg-neutral-500/5 border ${uiConfig.border} rounded-sm`}>
                         {exhibitionDateLines.length > 0 && (
                           <div className="flex items-start gap-4">
                             <Calendar size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                             <div>
                               <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Dates</p>
                               {exhibitionDateLines.map((line, idx) => (
                                 <p key={`date-line-${idx}`} className={`text-sm font-mono tracking-tight ${uiConfig.text} ${idx === 0 ? '' : 'mt-1'}`}>{line}</p>
                               ))}
                             </div>
                           </div>
                         )}
                         {exhibitionHoursParts.length > 0 && (
                           <div className="flex items-start gap-4">
                             <Clock size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                             <div>
                                <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Hours</p>
                                {exhibitionHoursParts.length === 1 ? (
                                  <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{exhibitionHoursParts[0]}</p>
                                ) : (
                                  <>
                                    <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{exhibitionHoursParts[0]}</p>
                                    <p className={`text-sm font-mono tracking-tight ${uiConfig.text} mt-1`}>{exhibitionHoursParts[1]}</p>
                                  </>
                                )}
                             </div>
                           </div>
                         )}
                         {activeExhibition.venue && activeExhibition.venue.trim() !== '' && (
                           <div className={`flex items-start gap-4 ${exhibitionDateLines.length > 0 || exhibitionHoursParts.length > 0 ? 'col-span-2 pt-4 border-t border-neutral-500/10' : 'col-span-2'}`}>
                              <MapPin size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                              <div>
                                 <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Venue</p>
                                 <p className={`text-sm ${uiConfig.text}`}>{activeExhibition.venue}</p>
                              </div>
                           </div>
                         )}
                         {activeExhibition.admission && activeExhibition.admission.trim() !== '' && (
                           <div className={`flex items-start gap-4 col-span-2 pt-4 border-t border-neutral-500/10`}>
                              <Ticket size={16} className={`mt-0.5 opacity-40 ${uiConfig.text}`} strokeWidth={1.5} />
                              <div>
                                 <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${uiConfig.text}`}>Admission</p>
                                 <p className={`text-sm ${uiConfig.text}`}>{activeExhibition.admission}</p>
                              </div>
                           </div>
                         )}
                     </div>
                   )}

                   <div className="space-y-8">
                      {activeExhibition.overview && activeExhibition.overview.trim() !== '' && (
                        <div className="space-y-6">
                          <div className={`flex items-center gap-4 border-b pb-2 ${uiConfig.border}`}>
                             <h3 className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${uiConfig.text}`}>Overview</h3>
                          </div>
                          <p className={`text-sm leading-8 font-light ${uiConfig.text} opacity-80 whitespace-pre-line`}>
                            {activeExhibition.overview}
                          </p>
                        </div>
                      )}
                      
                      {activeExhibition.supportedBy && activeExhibition.supportedBy.trim() !== '' && ( 
                        <div className={`pt-6 border-t ${uiConfig.border} flex flex-col gap-2 opacity-50`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${uiConfig.text}`}>Supported By</p>
                            <p className={`text-sm ${uiConfig.text}`}>{activeExhibition.supportedBy}</p>
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
                  className={`flex-1 h-16 flex items-center justify-center gap-4 font-bold tracking-[0.3em] uppercase transition-all duration-500 rounded-sm border ${uiConfig.border} ${uiConfig.text} hover:bg-neutral-500/5 group`}
               >
                  <Info size={18} strokeWidth={1.5} className="group-hover:rotate-12 transition-transform opacity-60" />
                  <span className="text-sm">Exhibition</span>
               </button>
               {activeExhibition.admissionLink ? (() => {
                 const buttonConfig = getButtonConfig(activeExhibition.exhibit_linktype);
                 const ButtonIcon = buttonConfig.icon;
                 return (
                   <a 
                     href={activeExhibition.admissionLink} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className={`flex-1 h-16 flex items-center justify-center gap-4 font-bold tracking-[0.5em] uppercase transition-all duration-500 rounded-sm bg-neutral-900 text-white hover:bg-black shadow-xl group`}
                   >
                      <ButtonIcon size={20} strokeWidth={1.5} />
                      <span className="text-sm">{buttonConfig.text}</span>
                   </a>
                 );
               })() : (
                  <button className={`flex-1 h-16 flex items-center justify-center gap-4 font-bold tracking-[0.5em] uppercase transition-all duration-500 rounded-sm bg-white/10 text-neutral-400 cursor-not-allowed border ${uiConfig.border}`} disabled>
                      <Ticket size={20} strokeWidth={1.5} />
                      <span className="text-sm">N/A</span>
                  </button>
               )}
             </div>
           ) : (
               activeExhibition.status === 'future' ? (
                   <button className={`w-full h-16 flex items-center justify-center gap-4 font-bold tracking-[0.5em] uppercase transition-all duration-500 bg-cyan-600 text-white hover:bg-cyan-700 rounded-sm shadow-xl shadow-cyan-500/20 group`}>
                      <Calendar size={20} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
                      <span className="text-sm">Remind Me</span>
                   </button>
               ) : activeExhibition.admissionLink ? (() => {
                 const buttonConfig = getButtonConfig(activeExhibition.exhibit_linktype, activeExhibition.status);
                 const ButtonIcon = buttonConfig.icon;
                 return (
                   <a 
                     href={activeExhibition.admissionLink} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className={`w-full h-16 flex items-center justify-center gap-4 font-bold tracking-[0.5em] uppercase transition-all duration-500 rounded-sm bg-neutral-900 text-white hover:bg-black shadow-xl group`}
                   >
                      <ButtonIcon size={20} strokeWidth={1.5} />
                      <span className="text-sm">{buttonConfig.text}</span>
                   </a>
                 );
               })() : (
                  <button className={`w-full h-16 flex items-center justify-center gap-4 font-bold tracking-[0.5em] uppercase transition-all duration-500 rounded-sm bg-white/10 text-neutral-400 cursor-not-allowed border ${uiConfig.border}`} disabled>
                      <Ticket size={20} strokeWidth={1.5} />
                      <span className="text-sm">{activeExhibition.status === 'past' ? 'View Archive' : 'N/A'}</span>
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