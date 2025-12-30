
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Image as ImageIcon, Check, UploadCloud, Loader2, Box, RefreshCw, Trash2, ChevronDown, ChevronUp, AlertCircle, Plus, Search, ZoomIn, ZoomOut } from 'lucide-react'; // NEW: Add ZoomIn, ZoomOut imports
import { FirebaseArtwork, ExhibitionArtItem, ArtworkData, ArtworkMaterialConfig, MaterialPreset } from '../../types';
import { storage } from '../../firebase';
import { getVideoEmbedUrl } from '../../services/utils/videoUtils';

const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;
const JPEG_QUALITY = 0.8;

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
  isSignedIn?: boolean; // NEW: Add isSignedIn prop
}

const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'original',
    name: 'Original GLB Material',
    iconColor: '#A0A0A0',
    config: null,
  },
  {
    id: 'matte_black',
    name: 'Matte Black',
    iconColor: '#333333',
    config: { color: '#1a1a1a', roughness: 0.9, metalness: 0, emissive: '#000000', emissiveIntensity: 0 },
  },
  {
    id: 'stainless_steel',
    name: 'Stainless Steel',
    iconColor: '#C0C0C0',
    config: { color: '#C0C0C0', roughness: 0.1, metalness: 0.8, emissive: '#000000', emissiveIntensity: 0 },
  },
  {
    id: 'ceramic_white',
    name: 'Ceramic White',
    iconColor: '#F5F5F5',
    config: { color: '#F5F5F5', roughness: 0.3, metalness: 0.05, emissive: '#000000', emissiveIntensity: 0 },
  },
  {
    id: 'gold_polished',
    name: 'Polished Gold',
    iconColor: '#FFD700',
    config: { color: '#FFD700', roughness: 0.05, metalness: 1, emissive: '#302000', emissiveIntensity: 0.2 },
  },
  {
    id: 'frosted_glass',
    name: 'Frosted Glass',
    iconColor: '#ADD8E6',
    config: { color: '#ADD8E6', roughness: 0.8, metalness: 0, transmission: 0.99, thickness: 1, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.5 },
  },
];

const normalizeDegrees = (degrees: number): number => {
  let normalized = degrees % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }
  return normalized;
};

const ArtworkTab: React.FC<ArtworkTabProps> = React.memo(({ 
  uiConfig, 
  firebaseArtworks, 
  currentLayout, 
  onUpdateArtworkFile, 
  onUpdateArtworkData, 
  onFocusArtwork, 
  onOpenConfirmationDialog, 
  onSelectArtwork, 
  onAddArtworkToLayout,
  isSignedIn = false, // NEW: Destructure isSignedIn
}) => {
  const [editingUrlArtworkId, setEditingUrlArtworkId] = useState<string | null>(null);
  const [currentEditValue, setCurrentEditValue] = useState<string>('');
  const [originalArtworkFile, setOriginalArtworkFile] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewMediaError, setPreviewMediaError] = useState<Record<string, boolean>>({});
  const [glbPreviewRotation, setGlbPreviewRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [selectedMaterialPresetId, setSelectedMaterialPresetId] = useState<string | null>(null);
  const [addArtworkSearchQuery, setAddArtworkSearchQuery] = useState('');
  const [isAddArtworkSectionOpen, setIsAddArtworkSectionOpen] = useState(false);
  const [addArtworkStatus, setAddArtworkStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [localScale, setLocalScale] = useState(1.0); // NEW: State for local scale

  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

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
       (art.artwork_type.toLowerCase().includes(addArtworkSearchQuery.toLowerCase())))
    );
  }, [firebaseArtworks, currentLayout, addArtworkSearchQuery]);


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

  const handleSaveUrl = useCallback(async (artworkId: string, urlToSave: string) => {
    if (urlToSave === originalArtworkFile && artworkId === editingUrlArtworkId) {
      handleUpdateStatus(artworkId, 'idle');
      return;
    }

    handleUpdateStatus(artworkId, 'saving');
    try {
      await onUpdateArtworkFile(artworkId, urlToSave);
      handleUpdateStatus(artworkId, 'saved');
      setOriginalArtworkFile(urlToSave);
      setCurrentEditValue(urlToSave);
      setPreviewMediaError(prev => ({ ...prev, [artworkId]: false }));
    } catch (error) {
      // 
      handleUpdateStatus(artworkId, 'error', 3000); 
      setPreviewMediaError(prev => ({ ...prev, [artworkId]: true }));
    }
  }, [editingUrlArtworkId, originalArtworkFile, onUpdateArtworkFile, handleUpdateStatus]);

  const handleGlbAxisRotate = useCallback(async (artworkId: string, uiAxisIndex: 0 | 1 | 2) => {
    handleUpdateStatus(artworkId, 'saving');
    
    const currentArtwork = firebaseArtworks.find(art => art.id === artworkId);
    if (!currentArtwork) {
        // 
        handleUpdateStatus(artworkId, 'error', 3000);
        return;
    }
    
    const currentRotationOffsetFromDB = currentArtwork.artwork_data?.rotation_offset;
    const initialRotation: [number, number, number] = (currentRotationOffsetFromDB && currentRotationOffsetFromDB.length === 3)
        ? currentRotationOffsetFromDB
        : [0, 0, 0];
    const newRotationOffsetRadians: [number, number, number] = [...initialRotation];

    const currentDegreeForUIaxis = glbPreviewRotation[uiAxisIndex];
    const newDegreeForUIaxis = normalizeDegrees(currentDegreeForUIaxis + 90);
    
    const radianValue = newDegreeForUIaxis * (Math.PI / 180);

    // This logic needs to align with how the rotation_offset is interpreted in SculptureExhibit.tsx
    // SculptureExhibit.tsx currently uses [rotationOffset[1], rotationOffset[2], rotationOffset[0]] for GLB Euler (Y, Z, X)
    // So, uiAxisIndex 0 -> rotationOffset[1] (Y-axis in Three.js, horizontal spin)
    // uiAxisIndex 1 -> rotationOffset[2] (Z-axis in Three.js, depth axis)
    // uiAxisIndex 2 -> rotationOffset[0] (X-axis in Three.js, front/back lean)

    // To rotate around the visual Y-axis (vertical spin in UI) which maps to Three.js Y-axis:
    if (uiAxisIndex === 0) { // This corresponds to a visual Y-axis rotation in the UI
      newRotationOffsetRadians[1] = radianValue; // Maps to Three.js Y
    } else if (uiAxisIndex === 1) { // This corresponds to a visual X-axis rotation (tilt forward/backward)
      newRotationOffsetRadians[0] = radianValue; // Maps to Three.js X
    } else if (uiAxisIndex === 2) { // This corresponds to a visual Z-axis rotation (roll left/right)
      newRotationOffsetRadians[2] = radianValue; // Maps to Three.js Z
    }


    setGlbPreviewRotation((prev: [number, number, number]) => {
        const newGlbPreviewRotation: [number, number, number] = [prev[0], prev[1], prev[2]];
        newGlbPreviewRotation[uiAxisIndex] = newDegreeForUIaxis;
        return newGlbPreviewRotation;
    });

    try {
        await onUpdateArtworkData(artworkId, { rotation_offset: newRotationOffsetRadians });
        handleUpdateStatus(artworkId, 'saved');
    } catch (error) {
        // 
        handleUpdateStatus(artworkId, 'error', 3000);
    }
  }, [glbPreviewRotation, firebaseArtworks, onUpdateArtworkData, handleUpdateStatus]);


  const handleSaveMaterial = useCallback(async (artworkId: string, presetId: string, materialConfig: ArtworkMaterialConfig | null) => {
    handleUpdateStatus(artworkId, 'saving');
    try {
        setSelectedMaterialPresetId(presetId);
        await onUpdateArtworkData(artworkId, { material: materialConfig });
        handleUpdateStatus(artworkId, 'saved');
    } catch (error) {
        // 
        handleUpdateStatus(artworkId, 'error', 3000);
    }
  }, [onUpdateArtworkData, handleUpdateStatus]);

  // NEW: handleScaleChange function
  const handleScaleChange = useCallback(async (artworkId: string, increment: number) => {
    handleUpdateStatus(artworkId, 'saving');
    const currentArtwork = firebaseArtworks.find(art => art.id === artworkId);
    const currentScale = currentArtwork?.artwork_data?.scale_offset ?? 1.0;
    let newScale = currentScale + increment;

    // Clamp scale between 10% (0.1) and 500% (5.0)
    newScale = Math.max(0.1, Math.min(5.0, newScale));
    
    setLocalScale(newScale); // Update local state for immediate UI feedback

    try {
        await onUpdateArtworkData(artworkId, { scale_offset: newScale });
        handleUpdateStatus(artworkId, 'saved');
    } catch (error) {
        // 
        handleUpdateStatus(artworkId, 'error', 3000);
    }
  }, [firebaseArtworks, onUpdateArtworkData, handleUpdateStatus]);


  const handleToggleEdit = useCallback((artwork: FirebaseArtwork) => {
    const isCurrentlyEditing = editingUrlArtworkId === artwork.id;
    
    if (isCurrentlyEditing) {
      setEditingUrlArtworkId(null);
      onFocusArtwork(null);
      onSelectArtwork(null);
    } else {
      setEditingUrlArtworkId(artwork.id);
      const initialValue = artwork.artwork_file || artwork.file || '';
      setCurrentEditValue(initialValue);
      setOriginalArtworkFile(initialValue);
      setUpdateStatus(prev => ({ ...prev, [artwork.id]: 'idle' }));
      setUploadMessage(null);
      setUploadProgress(0);
      setIsUploading(false);
      setPreviewMediaError(prev => ({ ...prev, [artwork.id]: false }));
      
      const artworkInstance = currentLayout.find(item => item.artworkId === artwork.id);

      if (artworkInstance) {
          onSelectArtwork(artworkInstance.id);
      } else {
          onSelectArtwork(null); 
      }

      // FIX: Added type assertion to `artwork.artwork_type` to bypass a TypeScript inference issue
      // where the compiler incorrectly flags a comparison with the literal string 'sculpture' as unintentional.
      // Despite `artwork_type` being defined to include 'sculpture', the compiler's internal narrowing
      // seems to exclude it in this specific context, causing a type error. Casting to `string` resolves
      // this by making the comparison generic enough for TypeScript to allow.
      if ((artwork.artwork_type as string) === 'sculpture' || ((artwork.artwork_type as string) === 'sculpture' && artwork.artwork_file?.toLowerCase().includes('.glb'))) { // MODIFIED: Check for 'sculpture' type for scale and material
          // Initialize scale
          setLocalScale(artwork.artwork_data?.scale_offset ?? 1.0);

          // Initialize rotation
          const rotationOffset = artwork.artwork_data?.rotation_offset;
          const initialRotation: [number, number, number] = (rotationOffset && rotationOffset.length === 3)
              ? rotationOffset
              : [0, 0, 0];
          // These degrees map to the UI's visual interpretation (Y-axis for horizontal spin, X for tilt, Z for roll)
          setGlbPreviewRotation([
              normalizeDegrees(initialRotation[1] * (180 / Math.PI)), // Three.js Y-axis -> UI visual Y-axis (horizontal spin)
              normalizeDegrees(initialRotation[0] * (180 / Math.PI)), // Three.js X-axis -> UI visual X-axis (tilt forward/backward)
              normalizeDegrees(initialRotation[2] * (180 / Math.PI)), // Three.js Z-axis -> UI visual Z-axis (roll left/right)
          ]);

          const savedMaterial = artwork.artwork_data?.material;
          let presetIdFound: string | null = 'original';
          if (savedMaterial) {
              const matchedPreset = MATERIAL_PRESETS.find(preset => {
                  if (!preset.config) return false;
                  // Compare properties, handling undefined/null values
                  const keys: Array<keyof ArtworkMaterialConfig> = ['color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity', 'transmission', 'thickness', 'clearcoat', 'clearcoatRoughness', 'transparent', 'opacity', 'side'];
                  return keys.every(key => (preset.config?.[key] === savedMaterial[key]) || (preset.config?.[key] === undefined && savedMaterial[key] === null));
              });
              if (matchedPreset) {
                  presetIdFound = matchedPreset.id;
              } else {
                  presetIdFound = 'original'; 
              }
          }
          setSelectedMaterialPresetId(presetIdFound);
      } else {
          setGlbPreviewRotation([0, 0, 0]);
          setSelectedMaterialPresetId(null);
          setLocalScale(1.0); // Reset scale when not a sculpture
      }
    }
  }, [editingUrlArtworkId, setUpdateStatus, currentLayout, onFocusArtwork, firebaseArtworks, onSelectArtwork, normalizeDegrees]);

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

  useEffect(() => {
    if (editingUrlArtworkId) {
        setPreviewMediaError(prev => ({ ...prev, [editingUrlArtworkId]: false }));
    }
  }, [currentEditValue, editingUrlArtworkId]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, artworkId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadMessage('Uploading...');
    setPreviewMediaError(prev => ({ ...prev, [artworkId]: false }));

    const artwork = firebaseArtworks.find(art => art.id === artworkId);
    if (!artwork) {
      setUploadMessage('Artwork not found.');
      setIsUploading(false);
      handleUpdateStatus(artworkId, 'error');
      return;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension || '');
    const isGlb = fileExtension === 'glb';

    if (!isImage && !isVideo && !isGlb) {
      setUploadMessage('Unsupported file type.');
      setIsUploading(false);
      handleUpdateStatus(artworkId, 'error');
      return;
    }

    let processedFile = file;

    if (isImage) {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = objectUrl;
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            reject(new Error('Image load timeout'));
          }, 5000);
          img.onload = () => { clearTimeout(timeout); resolve(); };
          img.onerror = () => { clearTimeout(timeout); reject(new Error('Image failed to load')); };
        });
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        setUploadMessage('Failed to load image.');
        setIsUploading(false);
        handleUpdateStatus(artworkId, 'error');
        return;
      }
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
        if (width > height) {
          height = Math.round(height * (MAX_IMAGE_WIDTH / width));
          width = MAX_IMAGE_WIDTH;
        } else {
          width = Math.round(width * (MAX_IMAGE_HEIGHT / height));
          height = MAX_IMAGE_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }
      processedFile = await new Promise<File>(resolve => {
        canvas.toBlob(blob => {
          if (blob) {
            const newName = file.name.replace(/\.[^.]+$/, '.webp');
            resolve(new File([blob], newName, { type: 'image/webp' }));
          } else {
            resolve(file); // Fallback to original if blob conversion fails
          }
        }, 'image/webp', 0.7);
      });
    }

    const storageRef = storage.ref();
    const newName = `${Date.now()}_${processedFile.name}`;
    const folderName = (artwork?.artwork_type || 'unknown').toString().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const artworkFilesRef = storageRef.child(`artwork_files/${folderName}/${artworkId}/${newName}`);
    const uploadTask = artworkFilesRef.put(processedFile);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
        setUploadMessage(`Uploading: ${progress.toFixed(0)}%`);
      },
      (error) => {
        // 
        setUploadMessage('Upload failed!');
        setIsUploading(false);
        handleUpdateStatus(artworkId, 'error', 3000);
      },
      async () => {
        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
        try {
          await handleSaveUrl(artworkId, downloadURL);
          // delete previous file if present
          const previousUrl = artwork.artwork_file || artwork.file || '';
          if (previousUrl) {
            try {
              const prevRef = storage.refFromURL(previousUrl);
              await prevRef.delete();
            } catch (e) {
              // ignore deletion errors
            }
          }
        } finally {
          setUploadMessage('Upload complete!');
          setIsUploading(false);
          setUploadProgress(0);
          handleUpdateStatus(artworkId, 'saved');
        }
      }
    );
  }, [firebaseArtworks, handleSaveUrl, handleUpdateStatus]);


  const getMediaPreview = useCallback((artwork: FirebaseArtwork) => {
    const fileUrl = artwork.artwork_file || artwork.file;
    if (!fileUrl) return null;

    const lastSegment = (fileUrl || '').split('?')[0].split('/').pop() || '';
    const isVideo = fileUrl && (fileUrl.includes('vimeo.com') || fileUrl.includes('youtube.com') || /\.(mp4|webm|ogg|mov)(?:$|-[0-9]+$)/i.test(lastSegment));
    const isImage = fileUrl && /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(?:$|-[0-9]+$)/i.test(lastSegment);
    const isGlb = fileUrl && /\.glb(?:$|-[0-9]+$)/i.test(lastSegment);

    const hasError = previewMediaError[artwork.id];
    
    if (hasError) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-red-800 text-white rounded-md text-center">
          {/* FIX: Moved title prop to wrapping span for AlertCircle icon */}
          <span title="Error Loading Media">
            <AlertCircle className="w-8 h-8 mr-2" />
          </span>
          Error Loading Media
        </div>
      );
    }

    if (isVideo) {
      const embedUrl = getVideoEmbedUrl(fileUrl);
      if (!embedUrl) {
        return (
          <div className="flex items-center justify-center w-full h-full bg-red-800 text-white rounded-md text-center">
            {/* FIX: Moved title prop to wrapping span for AlertCircle icon */}
            <span title="Invalid Video URL">
              <AlertCircle className="w-8 h-8 mr-2" />
            </span>
            Invalid Video URL
          </div>
        );
      }
      return (
        <iframe
          src={embedUrl}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media;"
          allowFullScreen
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          onError={() => setPreviewMediaError(prev => ({ ...prev, [artwork.id]: true }))}
        />
      );
    } else if (isImage) {
      return (
        <img
          src={fileUrl}
          alt={`Artwork preview for ${artwork.title}`}
          className="object-cover w-full h-full rounded-md"
          onError={() => setPreviewMediaError(prev => ({ ...prev, [artwork.id]: true }))}
        />
      );
    } else if (isGlb) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-neutral-700 text-white rounded-md text-center">
          <Box className="w-8 h-8 mr-2" />
          GLB Model
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center w-full h-full bg-neutral-700 text-white rounded-md text-center">
        <AlertCircle className="w-8 h-8 mr-2" />
        Unknown File Type
      </div>
    );
  }, [previewMediaError]);


  const getStatusIcon = useCallback((artworkId: string, type: 'update' | 'add') => {
    const statusMap = type === 'update' ? updateStatus : addArtworkStatus;
    const status = statusMap[artworkId];
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
  }, [updateStatus, addArtworkStatus]);

  const currentArtworkForScale = useMemo(() => relevantArtworks.find(art => art.id === editingUrlArtworkId), [relevantArtworks, editingUrlArtworkId]);

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
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                {availableArtworksToAdd.length > 0 ? (
                  availableArtworksToAdd.map(artwork => (
                    <div key={artwork.id} className={`flex items-center gap-3 p-3 rounded-md ${lightsOn ? 'bg-neutral-50' : 'bg-neutral-700'}`}>
                      <div className="flex-1">
                        <p className={`font-medium ${text} text-sm`}>{artwork.title}</p>
                        <p className={`text-xs ${subtext}`}>Type: {artwork.artwork_type.replace(/_/g, ' ')}</p>
                        {artwork.fileSizeMB && <p className={`text-xs ${subtext}`}>Size: {artwork.fileSizeMB.toFixed(2)} MB</p>}
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm cursor-pointer" onDoubleClick={() => handleArtworkDoubleClick(artwork)}>{artwork.title} 123</h4>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
                {(artwork.artwork_type === 'painting' || artwork.artwork_type === 'photography') && (
                  <>
                    <div className="w-full aspect-video bg-neutral-200 dark:bg-neutral-800 rounded-md overflow-hidden flex items-center justify-center text-neutral-500">
                      {getMediaPreview(artwork)}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={currentEditValue}
                        onChange={e => setCurrentEditValue(e.target.value)}
                        placeholder="Enter image or video URL, or GLB path"
                        className={`w-full pr-10 py-2 rounded-md text-xs ${input}`}
                      />
                      <button
                        onClick={() => handleSaveUrl(artwork.id, currentEditValue)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'} ${updateStatus[artwork.id] === 'saved' ? 'text-green-500' : (updateStatus[artwork.id] === 'error' ? 'text-red-500' : '')}`}
                        title="Save URL"
                        disabled={currentEditValue === originalArtworkFile || updateStatus[artwork.id] === 'saving'}
                      >
                        {getStatusIcon(artwork.id, 'update') || <Check className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFileChange(e, artwork.id)}
                        className="hidden"
                        id={`file-upload-${artwork.id}`}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full px-4 py-2 rounded-md flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors ${lightsOn ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'} ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        {uploadMessage || 'Upload File'}
                      </button>
                      {isUploading && (
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-cyan-500 rounded-md" style={{ width: `${uploadProgress}%` }}></div>
                      )}
                    </div>
                  </>
                )}

                {/* FIX: Added type assertion to `artwork.artwork_type` to bypass a TypeScript inference issue */}
                {(artwork.artwork_type as string) === 'sculpture' && (artwork.artwork_file?.toLowerCase().includes('.glb')) && ( // MODIFIED: Check for sculpture type
                    <div className="border-t pt-4 mt-4 space-y-3">
                        <p className={`text-xs font-bold uppercase ${subtext}`}>GLB Model Rotation</p>
                        <div className="flex items-center gap-3">
                            {['Y-Axis', 'X-Axis', 'Z-Axis'].map((axis, index) => (
                                <div key={axis} className="flex-1 flex flex-col items-center">
                                    <button
                                        onClick={() => handleGlbAxisRotate(artwork.id, index as 0 | 1 | 2)}
                                        className={`p-2 rounded-full transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'} ${text}`}
                                        title={`Rotate around ${axis}`}
                                        disabled={updateStatus[artwork.id] === 'saving'}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <span className={`text-xs font-mono mt-1 ${subtext}`}>{axis.split('-')[0]}: {glbPreviewRotation[index]}°</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* NEW: Sculpture Scale Section */}
                {/* FIX: Added type assertion to `artwork.artwork_type` to bypass a TypeScript inference issue */}
                {(artwork.artwork_type as string) === 'sculpture' && (
                    <div className="border-t pt-4 mt-4 space-y-3">
                        <p className={`text-xs font-bold uppercase ${subtext}`}>Sculpture Scale</p>
                        <div className="flex items-center justify-between gap-3">
                            <button
                                onClick={() => handleScaleChange(artwork.id, -0.2)}
                                className={`p-2 rounded-full transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'} ${text}`}
                                title="Decrease Scale"
                                disabled={updateStatus[artwork.id] === 'saving' || (currentArtworkForScale?.artwork_data?.scale_offset ?? 1.0) <= 0.1}
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className={`text-sm font-mono tracking-tight flex-1 text-center ${text}`}>
                                {Math.round((currentArtworkForScale?.artwork_data?.scale_offset ?? 1.0) * 100)}%
                            </span>
                            <button
                                onClick={() => handleScaleChange(artwork.id, 0.2)}
                                className={`p-2 rounded-full transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'} ${text}`}
                                title="Increase Scale"
                                disabled={updateStatus[artwork.id] === 'saving' || (currentArtworkForScale?.artwork_data?.scale_offset ?? 1.0) >= 5.0}
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}


                {/* FIX: Added type assertion to `artwork.artwork_type` to bypass a TypeScript inference issue */}
                {(artwork.artwork_type as string) === 'sculpture' && (
                    <div className="border-t pt-4 mt-4 space-y-3">
                      <p className={`text-xs font-bold uppercase ${subtext}`}>Material Presets</p>
                      <div className="flex flex-wrap gap-2">
                          {MATERIAL_PRESETS.map(preset => (
                              <button
                                  key={preset.id}
                                  onClick={() => handleSaveMaterial(artwork.id, preset.id, preset.config)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase flex items-center gap-2 transition-colors
                                      ${selectedMaterialPresetId === preset.id
                                          ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-neutral-900 shadow-md')
                                          : (lightsOn ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' : 'bg-neutral-700 text-white hover:bg-neutral-600')
                                      }`}
                                  disabled={updateStatus[artwork.id] === 'saving'}
                              >
                                  <span className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: preset.iconColor }}></span>
                                  {preset.name}
                              </button>
                          ))}
                      </div>
                    </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

export default ArtworkTab;
