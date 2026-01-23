import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { Exhibition } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiConfig: any;
  exhibitions: Exhibition[];
  onExhibitionSelect: (index: number) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, uiConfig, exhibitions, onExhibitionSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
    const [searchFilter, setSearchFilter] = useState<'all' | 'now showing' | 'past' | 'permanent' | 'future'>('all');
  const { lightsOn } = uiConfig;

  if (!isOpen) return null;
  
  const filteredExhibitions = exhibitions.filter(exhibition => {
      const matchesSearch = exhibition.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            exhibition.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            exhibition.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = searchFilter === 'all' || exhibition.status === searchFilter;
      return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
      switch(status) {
        case 'now showing': return 'bg-cyan-500 shadow-[0_0_8px_cyan]';
          case 'past': return 'bg-red-500';
          case 'permanent': return 'bg-black';
          case 'future': return 'bg-green-500';
          default: return 'bg-gray-400';
      }
  };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
                <div 
                    className={`w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl shadow-2xl overflow-hidden transition-all box-border max-w-full ${lightsOn ? 'bg-white' : 'bg-neutral-900 border border-neutral-800'}`}
                    onClick={e => e.stopPropagation()}
                >
            <div className={`p-6 border-b flex items-center justify-between ${uiConfig.border}`}>
                <div>
                    <h3 className={`text-xl font-serif font-bold ${uiConfig.text}`}>Exhibition Archive</h3>
                    <p className={`text-[10px] uppercase tracking-widest opacity-60 mt-1 ${uiConfig.subtext}`}>Total Exhibitions: {exhibitions.length}</p>
                </div>
                <button onClick={onClose} className={`p-2 rounded-full hover:bg-black/5 ${uiConfig.text}`}>
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className={`p-6 pb-2 space-y-4`}>
                <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 ${uiConfig.text}`} />
                    <input 
                        type="text" 
                        placeholder="Search by title, artist, or tag..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-colors ${uiConfig.input}`} 
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {['all', 'now showing', 'permanent', 'past', 'future'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setSearchFilter(filter as any)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                                searchFilter === filter 
                                  ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black')
                                  : (lightsOn ? 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700')
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-2">
                {filteredExhibitions.map((exhibition) => (
                    <div 
                      key={exhibition.id}
                      onClick={() => {
                          const targetIndex = exhibitions.findIndex(ex => ex.id === exhibition.id);
                          if (targetIndex !== -1) {
                              onExhibitionSelect(targetIndex);
                          }
                      }}
                      className={`group flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer ${lightsOn ? 'hover:bg-neutral-100' : 'hover:bg-neutral-800'}`}
                      role="button" tabIndex={0}
                    >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(exhibition.status)}`} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-bold tracking-widest uppercase opacity-50 ${uiConfig.text}`}>{exhibition.status}</span>
                                {exhibition.status === 'now showing' && <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 text-[9px] font-bold">LIVE</span>}
                            </div>
                            <h4 className={`text-lg font-serif font-medium truncate ${uiConfig.text}`}>{exhibition.title}</h4>
                            <p className={`text-xs truncate ${uiConfig.subtext}`}>{exhibition.artist}</p>
                        </div>
                        <div className={`text-right hidden sm:block ${uiConfig.subtext}`}>
                            <p className="text-xs font-mono">{exhibition.dates}</p>
                        </div>
                    </div>
                ))}
                {filteredExhibitions.length === 0 && (
                    <div className={`text-center py-12 ${uiConfig.subtext}`}>
                        <p>No exhibitions found.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default SearchModal;