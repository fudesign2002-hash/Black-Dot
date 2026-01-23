
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Image as ImageIcon, Box, Trash2, ChevronDown, ChevronUp, AlertCircle, Plus, Search, ZoomIn, ZoomOut } from 'lucide-react'; // NEW: Add ZoomIn, ZoomOut imports
import { FirebaseArtwork, ExhibitionArtItem, ArtworkData, ArtworkMaterialConfig } from '../../types';
import { StatusIndicator } from './EditorCommon';
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
  activeZoneId: string; // NEW: Add activeZoneId for zone-specific artwork settings
  onUpdateArtworkFile: (artworkId: string, newFileUrl: string) => Promise<void>;
  onUpdateArtworkField: (artworkId: string, field: string, value: any) => Promise<void>;
  onUpdateArtworkData: (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => Promise<void>;
  onFocusArtwork: (artworkInstanceId: string | null) => void;
  onOpenConfirmationDialog: (itemType: 'artwork_removal', artworkId: string, artworkTitle: string) => void;
  onSelectArtwork: (id: string | null) => void;
  onAddArtworkToLayout: (artwork: FirebaseArtwork) => Promise<boolean>;
  isSignedIn?: boolean; // NEW: Add isSignedIn prop
  ownerId?: string | null; // NEW: Curator identification for filtering
}

const ArtworkTab: React.FC<ArtworkTabProps> = React.memo(({ 
  uiConfig, 
  firebaseArtworks, 
  currentLayout, 
  activeZoneId, // NEW: Add activeZoneId for zone-specific artwork settings
  onUpdateArtworkFile, 
  onUpdateArtworkField,
  onUpdateArtworkData, 
  onFocusArtwork, 
  onOpenConfirmationDialog, 
  onSelectArtwork, 
  onAddArtworkToLayout,
  isSignedIn = false, // NEW: Add isSignedIn prop
  ownerId = null, // NEW: Curator identification for filtering
}) => {
  const [editingUrlArtworkId, setEditingUrlArtworkId] = useState<string | null>(null);
  const [currentEditValue, setCurrentEditValue] = useState<string>('');
  const [originalArtworkFile, setOriginalArtworkFile] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [editingTitleArtworkId, setEditingTitleArtworkId] = useState<string | null>(null); // NEW: State for title editing
  const [tempTitle, setTempTitle] = useState<string>(''); // NEW: Temporary state for title input
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewMediaError, setPreviewMediaError] = useState<Record<string, boolean>>({});
  const [addArtworkSearchQuery, setAddArtworkSearchQuery] = useState('');
  const [addArtworkArtistFilter, setAddArtworkArtistFilter] = useState('All'); // NEW: Filter by artist
  const [isAddArtworkSectionOpen, setIsAddArtworkSectionOpen] = useState(false);
  const [addArtworkStatus, setAddArtworkStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  // NEW: Get unique artists from all available artworks (those not yet in layout)
  const uniqueArtists = useMemo(() => {
    const artworkIdsInLayout = new Set(currentLayout.map(item => item.artworkId));
    const artists = new Set<string>();
    
    firebaseArtworks.forEach(art => {
      const isAvailable = !artworkIdsInLayout.has(art.id) && 
        (art.artwork_type === 'painting' || art.artwork_type === 'photography' || art.artwork_type === 'motion' || art.artwork_type === 'sculpture');
      
      // Allow if:
      // 1. No owner requirement (not signed in)
      // 2. Matches requested owner UID
      // 3. Has no owner at all (consider public/system artworks)
      // 4. Is a system/OOTB artwork (available to all)
      const isOwnedByCurator = !ownerId || art.ownerId === ownerId || !art.ownerId || art.artist?.toUpperCase() === 'OOTB';

      if (isAvailable && isOwnedByCurator) {
        const artistName = art.artist?.trim();
        if (artistName) {
          if (artistName.toUpperCase() === 'OOTB') {
            artists.add('System');
          } else {
            artists.add(artistName);
          }
        }
      }
    });
    
    const sortedArtists = Array.from(artists).sort();
    const finalArtists = ['All', ...sortedArtists.filter(a => a !== 'System')];
    if (artists.has('System')) {
      finalArtists.push('System');
    }
    return finalArtists;
  }, [firebaseArtworks, currentLayout, ownerId]);

  const relevantArtworks = useMemo(() => {
    const artworkIdsInLayout = new Set(currentLayout.map(item => item.artworkId));
    return firebaseArtworks.filter(art => 
      artworkIdsInLayout.has(art.id) &&
      (art.artwork_type === 'painting' || art.artwork_type === 'photography' || art.artwork_type === 'motion' || art.artwork_type === 'sculpture')
    );
  }, [firebaseArtworks, currentLayout]);

  const availableArtworksToAdd = useMemo(() => {
    const artworkIdsInLayout = new Set(currentLayout.map(item => item.artworkId));
    return firebaseArtworks.filter(art => 
      !artworkIdsInLayout.has(art.id) &&
      (art.artwork_type === 'painting' || art.artwork_type === 'photography' || art.artwork_type === 'motion' || art.artwork_type === 'sculpture') &&
      (art.title.toLowerCase().includes(addArtworkSearchQuery.toLowerCase()) ||
       (art.artist?.toLowerCase().includes(addArtworkSearchQuery.toLowerCase())) ||
       (art.artwork_type.toLowerCase().includes(addArtworkSearchQuery.toLowerCase()))) &&
      (addArtworkArtistFilter === 'All' || 
       (addArtworkArtistFilter === 'System' && art.artist?.toUpperCase() === 'OOTB') ||
       art.artist === addArtworkArtistFilter) &&
      (!ownerId || art.ownerId === ownerId || !art.ownerId || art.artist?.toUpperCase() === 'OOTB') // NEW: Ownership, public, or system check
    );
  }, [firebaseArtworks, currentLayout, addArtworkSearchQuery, addArtworkArtistFilter, ownerId]);


  const handleUpdateStatus = useCallback((artworkId: string, status: 'idle' | 'saving' | 'saved' | 'error', duration: number = 2000) => {
    setUpdateStatus(prev => ({ ...prev, [artworkId]: status }));
    if (status === 'saved' || status === 'error') {
      setTimeout(() => setUpdateStatus(prev => ({ ...prev, [artworkId]: 'idle' })), duration);
    }
  }, [setUpdateStatus]);

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
    // Enable title editing on double click
    setEditingTitleArtworkId(artwork.id);
    setTempTitle(artwork.title);
    
    const artworkInstance = currentLayout.find(item => item.artworkId === artwork.id);
    if (artworkInstance) {
      onFocusArtwork(artworkInstance.id);
      onSelectArtwork(artworkInstance.id);
      if (!editingUrlArtworkId) {
        handleToggleEdit(artwork);
      }
    }
  }, [currentLayout, onFocusArtwork, onSelectArtwork, editingUrlArtworkId, handleToggleEdit]);

  const handleTitleSave = useCallback(async (artworkId: string) => {
    if (!tempTitle.trim()) {
      setEditingTitleArtworkId(null);
      return;
    }
    
    try {
      setUpdateStatus(prev => ({ ...prev, [artworkId]: 'saving' }));
      await onUpdateArtworkField(artworkId, 'title', tempTitle.trim());
      setUpdateStatus(prev => ({ ...prev, [artworkId]: 'saved' }));
      setTimeout(() => setUpdateStatus(prev => ({ ...prev, [artworkId]: 'idle' })), 2000);
      setEditingTitleArtworkId(null);
    } catch (error) {
      setUpdateStatus(prev => ({ ...prev, [artworkId]: 'error' }));
      setTimeout(() => setUpdateStatus(prev => ({ ...prev, [artworkId]: 'idle' })), 3000);
    }
  }, [tempTitle, onUpdateArtworkField]);


  const handleRemoveClick = useCallback(async (artworkId: string, artworkTitle: string) => {
    onOpenConfirmationDialog('artwork_removal', artworkId, artworkTitle);
  }, [onOpenConfirmationDialog]);

  useEffect(() => {
    if (editingUrlArtworkId) {
        setPreviewMediaError(prev => ({ ...prev, [editingUrlArtworkId]: false }));
    }
  }, [currentEditValue, editingUrlArtworkId]);

  const getStatusIcon = useCallback((artworkId: string, type: 'update' | 'add') => {
    const statusMap = type === 'update' ? updateStatus : addArtworkStatus;
    return <StatusIndicator status={statusMap[artworkId]} size={14} />;
  }, [updateStatus, addArtworkStatus]);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
      <div className="space-y-4">
        {/* Add Artwork to Layout Section */}
        {isSignedIn && (
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

              {/* NEW: Artist Filter Tabs */}
              {uniqueArtists.length > 2 && (
                <div className="mb-4 text-center">
                  <div className="flex flex-wrap items-center justify-start gap-2">
                    {uniqueArtists.map(artist => (
                      <button
                        key={artist}
                        onClick={() => setAddArtworkArtistFilter(artist)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border ${
                          addArtworkArtistFilter === artist
                            ? (lightsOn ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-white text-neutral-900')
                            : (lightsOn ? 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600')
                        }`}
                      >
                        {artist}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                {availableArtworksToAdd.length > 0 ? (
                  availableArtworksToAdd.map(artwork => (
                    <div key={artwork.id} className={`flex items-center gap-3 p-3 rounded-md ${lightsOn ? 'bg-neutral-50' : 'bg-neutral-700'}`}>
                      <div className="flex-1">
                        <p className={`font-medium ${text} text-sm`}>{artwork.title}</p>
                        <div className="flex flex-wrap gap-x-2">
                          {artwork.artist && <p className={`text-xs ${subtext} font-bold`}>{artwork.artist}</p>}
                          <p className={`text-xs ${subtext} opacity-60`}>Type: {artwork.artwork_type.replace(/_/g, ' ')}</p>
                          {artwork.fileSizeMB && <p className={`text-xs ${subtext} opacity-60`}>Size: {artwork.fileSizeMB.toFixed(2)} MB</p>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          handleAddArtworkStatus(artwork.id, 'saving');
                          try {
                            await onAddArtworkToLayout(artwork);
                            handleAddArtworkStatus(artwork.id, 'saved');
                          } catch (error) {
                            handleAddArtworkStatus(artwork.id, 'error', 3000);
                          }
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-colors 
                          ${lightsOn ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-blue-500 text-white hover:bg-blue-600'}
                          ${addArtworkStatus[artwork.id] === 'saving' ? 'opacity-70 cursor-not-allowed' : ''}
                        `}
                        disabled={addArtworkStatus[artwork.id] === 'saving'}
                      >
                        {getStatusIcon(artwork.id, 'add') || <Plus className="w-4 h-4" />}
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
        )}

        {relevantArtworks.map(artwork => (
          <div key={artwork.id} className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
            <div className={`flex items-center justify-between ${editingUrlArtworkId === artwork.id ? 'mb-3' : ''}`}>
              <div className="flex-1 flex items-center gap-2 overflow-hidden mr-2">
                {editingTitleArtworkId === artwork.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={() => handleTitleSave(artwork.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave(artwork.id);
                      if (e.key === 'Escape') setEditingTitleArtworkId(null);
                    }}
                    className={`flex-1 text-sm font-bold bg-white dark:bg-neutral-900 rounded-lg border ${border} px-3 py-1 outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all`}
                  />
                ) : (
                  <h4 
                    className="font-bold text-sm cursor-text truncate px-1 -mx-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors" 
                    onClick={() => handleArtworkDoubleClick(artwork)}
                    title="Click to rename"
                  >
                    {artwork.title}
                  </h4>
                )}
                <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                  (artwork.artwork_type === 'painting' || artwork.artwork_type === 'photography')
                    ? 'bg-cyan-100 text-cyan-700' 
                    : artwork.artwork_type === 'sculpture' 
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-violet-100 text-violet-700'
                }`}>
                  {artwork.artwork_type.charAt(0).toUpperCase() + artwork.artwork_type.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isSignedIn && (
                  <button
                    onClick={() => handleRemoveClick(artwork.id, artwork.title)}
                    className={`p-1.5 rounded-full hover:bg-red-500/10 transition-colors ${text}`}
                    title="Remove Artwork from Layout"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
                <button
                  onClick={() => handleToggleEdit(artwork)}
                  className={`p-1.5 rounded-full transition-colors ${editingUrlArtworkId === artwork.id ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : 'hover:bg-black/5'} ${text}`}
                  title={editingUrlArtworkId === artwork.id ? "Close Editor" : "Edit Artwork Settings"}
                >
                  {editingUrlArtworkId === artwork.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  
                </button>
              </div>
            </div>

            {editingUrlArtworkId === artwork.id && (
              <div className="mt-4 space-y-4">
                <ArtworkSettingsForm
                  artwork={artwork}
                  activeZoneId={activeZoneId}
                  uiConfig={uiConfig}
                  onUpdateArtworkFile={onUpdateArtworkFile}
                  onUpdateArtworkData={onUpdateArtworkData}
                  onUpdateArtworkField={onUpdateArtworkField}
                  showTitle={false}
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
