
import React, { useState, useMemo, useCallback } from 'react';
import { Check, Trash2, ChevronDown, ChevronUp, Plus, Search, Loader2 } from 'lucide-react';
import { FirebaseArtwork, ExhibitionArtItem, ArtworkData } from '../../types';
import ArtworkSettingsForm from './ArtworkSettingsForm';

interface ArtworkTabProps {
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  firebaseArtworks: FirebaseArtwork[];
  currentLayout: ExhibitionArtItem[];
  onUpdateArtworkFile: (artworkId: string, newFileUrl: string) => Promise<void>;
  onUpdateArtworkData: (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => Promise<void>;
  onFocusArtwork: (artworkInstanceId: string | null) => void;
  onOpenConfirmationDialog: (itemType: 'artwork_removal', artworkId: string, artworkTitle: string) => void;
  onSelectArtwork: (id: string | null) => void;
  onAddArtworkToLayout: (artwork: FirebaseArtwork) => Promise<boolean>;
}

const ArtworkTab: React.FC<ArtworkTabProps> = React.memo(({ uiConfig, firebaseArtworks, currentLayout, onUpdateArtworkFile, onUpdateArtworkData, onFocusArtwork, onOpenConfirmationDialog, onSelectArtwork, onAddArtworkToLayout }) => {
  const [editingUrlArtworkId, setEditingUrlArtworkId] = useState<string | null>(null);
  const [addArtworkSearchQuery, setAddArtworkSearchQuery] = useState('');
  const [isAddArtworkSectionOpen, setIsAddArtworkSectionOpen] = useState(false);
  const [addArtworkStatus, setAddArtworkStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  const relevantArtworks = useMemo(() => {
    const artworkIdsInLayout = new Set(currentLayout.map(item => item.artworkId));
    return firebaseArtworks.filter(art => 
      artworkIdsInLayout.has(art.id) &&
      (art.artwork_type === 'painting' || art.artwork_type === 'motion' || art.artwork_type === 'sculpture')
    );
  }, [firebaseArtworks, currentLayout]);

  const availableArtworksToAdd = useMemo(() => {
    const artworkIdsInLayout = new Set(currentLayout.map(item => item.artworkId));
    return firebaseArtworks.filter(art => 
      !artworkIdsInLayout.has(art.id) &&
      (art.artwork_type === 'painting' || art.artwork_type === 'motion' || art.artwork_type === 'sculpture') &&
      (art.title.toLowerCase().includes(addArtworkSearchQuery.toLowerCase()) ||
       (art.artist?.toLowerCase().includes(addArtworkSearchQuery.toLowerCase())) ||
       (art.artwork_type.toLowerCase().includes(addArtworkSearchQuery.toLowerCase())))
    );
  }, [firebaseArtworks, currentLayout, addArtworkSearchQuery]);


  const handleAddArtworkStatus = useCallback((artworkId: string, status: 'idle' | 'saving' | 'saved' | 'error', duration: number = 2000) => {
    setAddArtworkStatus(prev => ({ ...prev, [artworkId]: status }));
    if (status === 'saved' || status === 'error') {
      setTimeout(() => setAddArtworkStatus(prev => ({ ...prev, [artworkId]: 'idle' })), duration);
    }
  }, [setAddArtworkStatus]);


  const handleToggleEdit = useCallback((artwork: FirebaseArtwork) => {
    const isCurrentlyEditing = editingUrlArtworkId === artwork.id;
    
    if (isCurrentlyEditing) {
      setEditingUrlArtworkId(null);
      onFocusArtwork(null);
      onSelectArtwork(null);
    } else {
      setEditingUrlArtworkId(artwork.id);
      
      const artworkInstance = currentLayout.find(item => item.artworkId === artwork.id);

      if (artworkInstance) {
          onSelectArtwork(artworkInstance.id);
      } else {
          onSelectArtwork(null); 
      }
    }
  }, [editingUrlArtworkId, currentLayout, onFocusArtwork, onSelectArtwork]);

  const handleArtworkDoubleClick = useCallback((artwork: FirebaseArtwork) => {
    const artworkInstance = currentLayout.find(item => item.artworkId === artwork.id);
    if (artworkInstance) {
      onFocusArtwork(artworkInstance.id);
      onSelectArtwork(artworkInstance.id);
      if (!editingUrlArtworkId) {
        handleToggleEdit(artwork);
      }
    }
  }, [currentLayout, onFocusArtwork, onSelectArtwork, editingUrlArtworkId, handleToggleEdit]);


  const handleRemoveClick = useCallback(async (artworkId: string, artworkTitle: string) => {
    onOpenConfirmationDialog('artwork_removal', artworkId, artworkTitle);
  }, [onOpenConfirmationDialog]);

  const getStatusIcon = useCallback((artworkId: string) => {
    const status = addArtworkStatus[artworkId];
    switch (status) {
      case 'saving':
        return <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />;
      case 'saved':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <span className="text-red-500 font-bold">!</span>;
      default:
        return null;
    }
  }, [addArtworkStatus]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
      <div className="space-y-4">
        {/* Add Artwork to Layout Section */}
        <div className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsAddArtworkSectionOpen(prev => !prev)}>
            <h4 className="font-bold text-sm">Add Artwork to Layout</h4>
            {isAddArtworkSectionOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
          {isAddArtworkSectionOpen && (
            <div className="mt-4">
              <div className="relative mb-4">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 ${text}`} />
                <input
                  type="text"
                  placeholder="Search artworks to add..."
                  value={addArtworkSearchQuery}
                  onChange={e => setAddArtworkSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-md text-xs ${input}`}
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                {availableArtworksToAdd.length > 0 ? (
                  availableArtworksToAdd.map(artwork => (
                    <div key={artwork.id} className={`flex items-center gap-3 p-3 rounded-md ${lightsOn ? 'bg-neutral-50' : 'bg-neutral-700'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`font-medium ${text} text-sm`}>{artwork.title}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            artwork.artwork_type === 'sculpture' ? 'bg-orange-100 text-orange-800' :
                            artwork.artwork_type === 'painting' ? 'bg-emerald-100 text-emerald-800' :
                            artwork.artwork_type === 'motion' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {artwork.artwork_type === 'sculpture' ? 'Sculpture' :
                             artwork.artwork_type === 'painting' ? 'Painting' :
                             artwork.artwork_type === 'motion' ? 'Motion' :
                             artwork.artwork_type}
                          </span>
                        </div>
                        {artwork.fileSizeMB && <p className={`text-xs ${subtext}`}>Size: {artwork.fileSizeMB.toFixed(2)} MB</p>}
                      </div>
                      <button
                        onClick={async () => {
                          handleAddArtworkStatus(artwork.id, 'saving');
                          try {
                            await onAddArtworkToLayout(artwork);
                            handleAddArtworkStatus(artwork.id, 'saved');
                          } catch (error) {
                            console.error("Error adding artwork to layout from UI:", error);
                            handleAddArtworkStatus(artwork.id, 'error', 3000);
                          }
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-colors 
                          ${lightsOn ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-blue-500 text-white hover:bg-blue-600'}
                          ${addArtworkStatus[artwork.id] === 'saving' ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                        disabled={addArtworkStatus[artwork.id] === 'saving'}
                      >
                        {getStatusIcon(artwork.id) || <Plus className="w-4 h-4" />}
                        <span>Add</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className={`${subtext} text-center py-4`}>No artworks found to add.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {relevantArtworks.map(artwork => (
          <div key={artwork.id} className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h4 className="font-bold text-sm cursor-pointer" onDoubleClick={() => handleArtworkDoubleClick(artwork)}>{artwork.title}</h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  artwork.artwork_type === 'sculpture' ? 'bg-orange-100 text-orange-800' :
                  artwork.artwork_type === 'painting' ? 'bg-emerald-100 text-emerald-800' :
                  artwork.artwork_type === 'motion' ? 'bg-indigo-100 text-indigo-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {artwork.artwork_type === 'sculpture' ? 'Sculpture' :
                   artwork.artwork_type === 'painting' ? 'Painting' :
                   artwork.artwork_type === 'motion' ? 'Motion' :
                   artwork.artwork_type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRemoveClick(artwork.id, artwork.title)}
                  className={`p-1.5 rounded-full hover:bg-red-500/10 transition-colors cursor-pointer ${text}`}
                  title="Remove Artwork from Layout"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
                <button
                  onClick={() => handleToggleEdit(artwork)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${editingUrlArtworkId === artwork.id ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'} ${text}`}
                  title={editingUrlArtworkId === artwork.id ? "Close Editor" : "Edit Artwork Settings"}
                >
                  {editingUrlArtworkId === artwork.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  
                </button>
              </div>
            </div>

            {editingUrlArtworkId === artwork.id && (
              <div className="mt-4">
                <ArtworkSettingsForm
                  artwork={artwork}
                  uiConfig={uiConfig}
                  onUpdateArtworkFile={onUpdateArtworkFile}
                  onUpdateArtworkData={onUpdateArtworkData}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

export default ArtworkTab;
