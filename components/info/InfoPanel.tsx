import React, { useMemo } from 'react';
import { X, Calendar, MapPin, Ticket, Clock, Loader2, Image, Brush, Layers, Ruler, Weight, Heart, Share2, Info } from 'lucide-react';
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

  return (
    <React.Fragment>
      {isOpen && (
        <div
          className="absolute inset-0 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div 
        className={`absolute top-0 right-0 h-full w-full md:w-[600px] z-50 backdrop-blur-xl shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden flex flex-col border-l ${uiConfig.border} ${uiConfig.panelBg} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-10 flex justify-between items-start">
          <div>
            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase block mb-3 ${showArtworkData ? 'text-cyan-500' : (activeExhibition.status === 'current' ? 'text-cyan-500' : 'text-neutral-500')}`}>
              {showArtworkData ? 'Artwork Details' : 'Exhibition Details'}
            </span>
            <h3 className={`text-3xl font-serif uppercase ${uiConfig.text}`}>{showArtworkData ? artworkDataForPanel?.title : activeExhibition.title}</h3>
            {showArtworkData ? (
              <div className="flex items-center gap-4 mt-2">
                 <p className={`text-sm opacity-60 ${uiConfig.text}`}>{`by ${artworkDataForPanel?.artist || 'Unknown Artist'}`}</p>
                 <div className="flex items-center gap-2">
                    <Heart className={`w-4 h-4 opacity-70 ${uiConfig.text}`} />
                    <span className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{artworkDataForPanel?.artwork_liked ?? '0'}</span>
                 </div>
                 {artworkDataForPanel?.artwork_shared !== undefined && (
                   <div className="flex items-center gap-2">
                     <Share2 className={`w-4 h-4 opacity-70 ${uiConfig.text}`} />
                     <span className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{artworkDataForPanel?.artwork_shared}</span>
                   </div>
                 )}
              </div>
            ) : (
              <p className={`text-sm mt-2 opacity-60 ${uiConfig.text}`}>{`Curated by ${activeExhibition.artist}`}</p>
            )}
          </div>
          <button onClick={onClose} className={`p-2 rounded-full hover:bg-neutral-500/10 transition-colors ${uiConfig.text}`}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-10 pb-20 scrollbar-hide`}>
           {showArtworkData ? (
             <React.Fragment>
                {isLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className={`w-6 h-6 animate-spin mx-auto mb-4 ${uiConfig.subtext}`} />
                    <p className={uiConfig.subtext}>Loading artwork details...</p>
                  </div>
                ) : (
                  <div className={`grid grid-cols-2 gap-6 mb-12 p-8 bg-neutral-500/5 border ${uiConfig.border}`}>
                    <div className="flex items-start gap-4 col-span-2">
                        <Image className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                        <div>
                            <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>Type</p>
                            <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{formatArtworkType(artworkDataForPanel?.artwork_type)}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <Brush className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                        <div>
                            <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>Artist</p>
                            <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{artworkDataForPanel?.artist || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4 col-span-2 pt-6 border-t border-neutral-500/10">
                        <Ruler className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                        <div>
                            <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>Materials / Size</p>
                            <p className={`text-sm ${artworkDataForPanel?.materials ? uiConfig.text : uiConfig.subtext}`}>{artworkDataForPanel?.materials || 'N/A'}</p>
                            <p className={`text-xs ${artworkDataForPanel?.size ? uiConfig.text : uiConfig.subtext}`}>{artworkDataForPanel?.size || 'N/A'}</p>
                        </div>
                    </div>
                    {artworkDataForPanel?.fileSizeMB !== undefined && (
                      <div className="flex items-start gap-4 col-span-2 pt-6 border-t border-neutral-500/10">
                          <Weight className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                          <div>
                              <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>File Size</p>
                              <p className={`text-sm ${uiConfig.text}`}>{artworkDataForPanel.fileSizeMB.toFixed(2)} MB</p>
                          </div>
                      </div>
                    )}
                  </div>
                )}
             </React.Fragment>
           ) : (
            <React.Fragment>
               {activeExhibition.exhibit_poster && (
                 <div className={`w-full aspect-[2/1] mb-12 relative overflow-hidden rounded-sm`}>
                    <img
                      src={activeExhibition.exhibit_poster}
                      alt={`${activeExhibition.title} poster`}
                      className="object-cover w-full h-full"
                    />
                 </div>
               )}

               {isLoading ? (
                 <div className="text-center py-12">
                   <Loader2 className={`w-6 h-6 animate-spin mx-auto mb-4 ${uiConfig.subtext}`} />
                   <p className={uiConfig.subtext}>Loading exhibition details from Firebase...</p>
                 </div>
               ) : (
                <React.Fragment>
                   <div className={`grid grid-cols-2 gap-6 mb-12 p-8 bg-neutral-500/5 border ${uiConfig.border}`}>
                      <div className="flex items-start gap-4">
                         <Calendar className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                         <div>
                            <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>Dates</p>
                            <p className={`text-sm font-mono tracking-tight ${uiConfig.text}`}>{activeExhibition.dates}</p>
                         </div>
                      </div>
                      <div className="flex items-start gap-4">
                         <Clock className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                         <div>
                            <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>Hours</p>
                            <p className={`text-sm font-mono tracking-tight ${activeExhibition.hours ? uiConfig.text : uiConfig.subtext}`}>{activeExhibition.hours || 'N/A'}</p>
                         </div>
                      </div>
                      <div className="flex items-start gap-4 col-span-2 pt-6 border-t border-neutral-500/10">
                         <MapPin className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                         <div>
                            <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>Venue</p>
                            <p className={`text-sm ${activeExhibition.venue ? uiConfig.text : uiConfig.subtext}`}>{activeExhibition.venue || 'N/A'}</p>
                         </div>
                      </div>
                      <div className="flex items-start gap-4 col-span-2 pt-6 border-t border-neutral-500/10">
                         <Ticket className={`w-4 h-4 mt-0.5 opacity-40 ${uiConfig.text}`} />
                         <div>
                            <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${uiConfig.text}`}>Admission</p>
                            <p className={`text-sm ${activeExhibition.admission ? uiConfig.text : uiConfig.subtext}`}>{activeExhibition.admission}</p>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-8">
                      <div className={`flex items-center gap-4 border-b pb-4 ${uiConfig.border}`}>
                         <span className={`text-xs font-bold tracking-[0.2em] uppercase ${uiConfig.text}`}>Overview</span>
                      </div>
                      <div className={`space-y-6 ${uiConfig.subtext}`}>
                        <p className="text-sm leading-8 font-light whitespace-pre-wrap">{activeExhibition.overview}</p>
                      </div>
                      
                      {activeExhibition.supportedBy && ( 
                        <div className={`pt-8 border-t ${uiConfig.border} flex flex-col gap-4 opacity-50`}>
                            <p className={`text-[10px] font-bold uppercase ${uiConfig.text}`}>Supported By</p>
                            <p className={`text-sm ${uiConfig.text}`}>{activeExhibition.supportedBy}</p>
                        </div>
                      )}
                   </div>
                </React.Fragment>
               )}
            </React.Fragment>
           )}
        </div>

        <div className={`p-8 border-t ${uiConfig.border} bg-neutral-500/5`}>
           {showArtworkData ? (
             <div className="flex gap-4">
               <button
                  onClick={onOpenExhibitionInfoFromArtwork}
                  className={`flex-1 py-4 flex items-center justify-center gap-4 font-bold tracking-[0.2em] uppercase transition-all duration-500 ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-neutral-900 hover:bg-neutral-200'}`}
                  title="Learn More About Exhibition"
               >
                  <Info className="w-4 h-4" />
                  <span>Learn More</span>
               </button>
               {activeExhibition.admissionLink ? ( 
                 <a 
                   href={activeExhibition.admissionLink} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className={`flex-1 py-4 flex items-center justify-center gap-4 font-bold tracking-[0.2em] uppercase transition-all duration-500 ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-neutral-900 hover:bg-neutral-200'}`}
                 >
                    <Ticket className="w-4 h-4" />
                    <span>Purchase Tickets</span>
                 </a>
               ) : (
                  <button className={`flex-1 py-4 flex items-center justify-center gap-4 font-bold tracking-[0.2em] uppercase transition-all duration-500 ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-neutral-900 hover:bg-neutral-200'}`} disabled>
                      <Ticket className="w-4 h-4" />
                      <span>Tickets N/A</span>
                  </button>
               )}
             </div>
           ) : (
               activeExhibition.status === 'future' ? (
                   <button className={`w-full py-4 flex items-center justify-center gap-4 font-bold tracking-[0.2em] uppercase transition-all duration-500 bg-green-600 text-white hover:bg-green-700`}>
                      <Ticket className="w-4 h-4" />
                      <span>Contact Curator</span>
                   </button>
               ) : activeExhibition.admissionLink ? ( 
                   <a 
                     href={activeExhibition.admissionLink} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className={`w-full py-4 flex items-center justify-center gap-4 font-bold tracking-[0.2em] uppercase transition-all duration-500 ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-neutral-900 hover:bg-neutral-200'}`}
                   >
                      <Ticket className="w-4 h-4" />
                      <span>{activeExhibition.status === 'past' ? 'View Archive' : 'Purchase Tickets'}</span>
                   </a>
               ) : (
                  <button className={`w-full py-4 flex items-center justify-center gap-4 font-bold tracking-[0.2em] uppercase transition-all duration-500 ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-neutral-900 hover:bg-neutral-200'}`} disabled>
                      <Ticket className="w-4 h-4" />
                      <span>{activeExhibition.status === 'past' ? 'View Archive' : 'Tickets N/A'}</span>
                  </button>
               )
           )}
        </div>
      </div>
    </React.Fragment>
  );
};

export default InfoPanel;