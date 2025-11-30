

import React from 'react';
import { X, Calendar, MapPin, Ticket, Clock, Loader2 } from 'lucide-react';
import { Exhibition } from '../../types';

interface InfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
  activeExhibition: Exhibition;
  isLoading: boolean;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ isOpen, onClose, theme, activeExhibition, isLoading }) => {
  const { lightsOn } = theme;

  return (
    <>
      {isOpen && (
        <div
          className="absolute inset-0 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div 
        className={`absolute top-0 right-0 h-full w-full md:w-[600px] z-50 backdrop-blur-xl shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden flex flex-col border-l ${theme.border} ${theme.panelBg} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-10 flex justify-between items-start">
          <div>
            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase block mb-3 ${activeExhibition.status === 'current' ? 'text-cyan-500' : 'text-neutral-500'}`}>Exhibition Details</span>
            <h3 className={`text-3xl font-serif uppercase ${theme.text}`}>{activeExhibition.title}</h3>
            <p className={`text-sm mt-2 opacity-60 ${theme.text}`}>Curated by {activeExhibition.artist}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full hover:bg-neutral-500/10 transition-colors ${theme.text}`}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-10 pb-20 scrollbar-hide`}>
           <div className={`w-full aspect-[2/1] mb-12 relative overflow-hidden rounded-sm ${activeExhibition.posterColor} opacity-90`}>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.8),transparent)]"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black opacity-5 rounded-full blur-3xl"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <h1 className="text-4xl font-serif text-white mix-blend-overlay tracking-widest">{activeExhibition.id.toUpperCase()}</h1>
              </div>
           </div>

           {isLoading ? (
             <div className="text-center py-12">
               <Loader2 className={`w-6 h-6 animate-spin mx-auto mb-4 ${theme.subtext}`} />
               <p className={theme.subtext}>Loading exhibition details from Firebase...</p>
             </div>
           ) : (
            <>
               <div className={`grid grid-cols-2 gap-6 mb-12 p-8 bg-neutral-500/5 border ${theme.border}`}>
                  <div className="flex items-start gap-4">
                     <Calendar className={`w-4 h-4 mt-0.5 opacity-40 ${theme.text}`} />
                     <div>
                        <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${theme.text}`}>Dates</p>
                        <p className={`text-sm font-mono tracking-tight ${theme.text}`}>{activeExhibition.dates}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-4">
                     <Clock className={`w-4 h-4 mt-0.5 opacity-40 ${theme.text}`} />
                     <div>
                        <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${theme.text}`}>Hours</p>
                        <p className={`text-sm font-mono tracking-tight ${activeExhibition.hours ? theme.text : theme.subtext}`}>{activeExhibition.hours || 'N/A'}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-4 col-span-2 pt-6 border-t border-neutral-500/10">
                     <MapPin className={`w-4 h-4 mt-0.5 opacity-40 ${theme.text}`} />
                     <div>
                        <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${theme.text}`}>Venue</p>
                        <p className={`text-sm ${activeExhibition.venue ? theme.text : theme.subtext}`}>{activeExhibition.venue || 'N/A'}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-4 col-span-2 pt-6 border-t border-neutral-500/10">
                     <Ticket className={`w-4 h-4 mt-0.5 opacity-40 ${theme.text}`} />
                     <div>
                        <p className={`text-[10px] font-bold uppercase opacity-40 mb-2 ${theme.text}`}>Admission</p>
                        <p className={`text-sm ${activeExhibition.admission ? theme.text : theme.subtext}`}>{activeExhibition.admission}</p>
                     </div>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className={`flex items-center gap-4 border-b pb-4 ${theme.border}`}>
                     <span className={`text-xs font-bold tracking-[0.2em] uppercase ${theme.text}`}>Overview</span>
                  </div>
                  <div className={`space-y-6 ${theme.subtext}`}>
                    <p className="text-sm leading-8 font-light whitespace-pre-wrap">{activeExhibition.overview}</p>
                  </div>
                  
                  {activeExhibition.supportedBy && ( 
                    <div className={`pt-8 border-t ${theme.border} flex flex-col gap-4 opacity-50`}>
                        <p className={`text-[10px] font-bold uppercase ${theme.text}`}>Supported By</p>
                        <p className={`text-sm ${theme.text}`}>{activeExhibition.supportedBy}</p>
                    </div>
                  )}
               </div>
            </>
           )}
        </div>

        <div className={`p-8 border-t ${theme.border} bg-neutral-500/5`}>
           {activeExhibition.status === 'future' ? (
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
           )}
        </div>
      </div>
    </>
  );
};

export default InfoPanel;