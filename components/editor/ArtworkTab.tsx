import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Image as ImageIcon, Video, Check, UploadCloud, Loader2, Box, RefreshCw, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'; // NEW: Added AlertCircle for error state
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
  onRemoveArtworkFromLayout: (artworkId: string) => Promise<void>;
  onOpenConfirmationDialog: (artworkId: string, artworkTitle: string, onConfirm: () => Promise<void>) => void;
  onSelectArtwork: (id: string | null) => void;
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

const ArtworkTab: React.FC<ArtworkTabProps> = React.memo(({ uiConfig, firebaseArtworks, currentLayout, onUpdateArtworkFile, onUpdateArtworkData, onFocusArtwork, onRemoveArtworkFromLayout, onOpenConfirmationDialog, onSelectArtwork }) => {
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

  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  const relevantArtworks = useMemo(() => {
    const artworkIdsInLayout = new Set(currentLayout.map(item => item.artworkId));
    return firebaseArtworks.filter(art => 
      artworkIdsInLayout.has(art.id) &&
      (art.artwork_type === 'painting' || art.artwork_type === 'motion' || art.artwork_type === 'sculpture')
    );
  }, [firebaseArtworks, currentLayout]);

  const handleUpdateStatus = useCallback((artworkId: string, status: 'idle' | 'saving' | 'saved' | 'error', duration: number = 2000) => {
    setUpdateStatus(prev => ({ ...prev, [artworkId]: status }));
    if (status === 'saved' || status === 'error') {
      setTimeout(() => setUpdateStatus(prev => ({ ...prev, [artworkId]: 'idle' })), duration);
    }
  }, [setUpdateStatus]);

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
      console.error("Failed to update artwork file:", error);
      handleUpdateStatus(artworkId, 'error', 3000); 
      setPreviewMediaError(prev => ({ ...prev, [artworkId]: true }));
    }
  }, [editingUrlArtworkId, originalArtworkFile, onUpdateArtworkFile, handleUpdateStatus]);

  const handleGlbAxisRotate = useCallback(async (artworkId: string, uiAxisIndex: 0 | 1 | 2) => {
    handleUpdateStatus(artworkId, 'saving');
    
    const currentArtwork = firebaseArtworks.find(art => art.id === artworkId);
    if (!currentArtwork) {
        console.error("Artwork not found for ID:", artworkId);
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
        console.error("Failed to save GLB rotation:", error);
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
        console.error("Failed to save material preset:", error);
        handleUpdateStatus(artworkId, 'error', 3000);
    }
  }, [onUpdateArtworkData, handleUpdateStatus]);

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

      if (artwork.artwork_type === 'sculpture' && artwork.artwork_file?.toLowerCase().includes('.glb')) {
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
    const onConfirmRemoval = async () => {
      handleUpdateStatus(artworkId, 'saving');
      try {
        await onRemoveArtworkFromLayout(artworkId);
        handleUpdateStatus(artworkId, 'saved');
        if (editingUrlArtworkId === artworkId) {
          setEditingUrlArtworkId(null);
          onFocusArtwork(null);
          onSelectArtwork(null);
        }
      } catch (error) {
        console.error("Failed to remove artwork from layout:", error);
        handleUpdateStatus(artworkId, 'error', 3000);
        throw error;
      }
    };

    onOpenConfirmationDialog(artworkId, artworkTitle, onConfirmRemoval);
  }, [editingUrlArtworkId, onFocusArtwork, onSelectArtwork, onRemoveArtworkFromLayout, handleUpdateStatus, onOpenConfirmationDialog]);

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
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(resolve => img.onload = resolve);

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
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file); // Fallback to original if blob conversion fails
          }
        }, 'image/jpeg', JPEG_QUALITY);
      });
    }

    const storageRef = storage.ref();
    const artworkFilesRef = storageRef.child(`artwork_files/${artworkId}/${processedFile.name}`);
    const uploadTask = artworkFilesRef.put(processedFile);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
        setUploadMessage(`Uploading: ${progress.toFixed(0)}%`);
      },
      (error) => {
        console.error("Upload failed:", error);
        setUploadMessage('Upload failed!');
        setIsUploading(false);
        handleUpdateStatus(artworkId, 'error', 3000);
      },
      async () => {
        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
        await handleSaveUrl(artworkId, downloadURL);
        setUploadMessage('Upload complete!');
        setIsUploading(false);
        setUploadProgress(0);
        handleUpdateStatus(artworkId, 'saved');
      }
    );
  }, [firebaseArtworks, handleSaveUrl, handleUpdateStatus]);


  const getMediaPreview = useCallback((artwork: FirebaseArtwork) => {
    const fileUrl = artwork.artwork_file || artwork.file;
    if (!fileUrl) return null;

    const isVideo = fileUrl && (fileUrl.includes('vimeo.com') || fileUrl.includes('youtube.com') || /\.(mp4|webm|ogg|mov)$/i.test(fileUrl.split('?')[0]));
    const isImage = fileUrl && (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i.test(fileUrl.split('?')[0]));
    const isGlb = fileUrl && fileUrl.toLowerCase().includes('.glb');

    const hasError = previewMediaError[artwork.id];
    
    if (hasError) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-red-800 text-white rounded-md text-center">
          <AlertCircle className="w-8 h-8 mr-2" />
          Error Loading Media
        </div>
      );
    }

    if (isVideo) {
      const embedUrl = getVideoEmbedUrl(fileUrl);
      if (!embedUrl) {
        return (
          <div className="flex items-center justify-center w-full h-full bg-red-800 text-white rounded-md text-center">
            <AlertCircle className="w-8 h-8 mr-2" />
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
        Unsupported File Type
      </div>
    );
  }, [previewMediaError, setPreviewMediaError]);


  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
          <h4 className="font-bold text-sm mb-4">Artwork Management</h4>
          <p className={`text-sm leading-relaxed ${subtext}`}>
            Configure media files and display settings for artworks in this zone. Double-click an artwork to quickly select it and open its editor.
          </p>
        </div>

        {relevantArtworks.length === 0 && (
          <div className={`text-center py-12 ${subtext}`}>
            <p>No artworks found in this zone layout.</p>
          </div>
        )}

        {relevantArtworks.map((artwork) => {
          const isEditing = editingUrlArtworkId === artwork.id;
          const status = updateStatus[artwork.id] || 'idle';
          const isGlb = (artwork.artwork_file || artwork.file)?.toLowerCase().includes('.glb');

          return (
            <div
              key={artwork.id}
              className={`p-4 rounded-xl border ${border} ${controlBgClass}
                          ${isEditing ? (lightsOn ? 'ring-2 ring-cyan-500' : 'ring-2 ring-cyan-400') : ''}`}
              onDoubleClick={() => handleArtworkDoubleClick(artwork)}
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {(artwork.artwork_type === 'painting' || artwork.artwork_type === 'motion') ? <ImageIcon className={`w-4 h-4 opacity-70 ${text}`} /> : <Box className={`w-4 h-4 opacity-70 ${text}`} />}
                  <h4 className={`text-sm font-medium ${text} truncate`}>{artwork.title}</h4>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {status === 'saving' && <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />}
                  {status === 'saved' && <Check className="w-4 h-4 text-green-500" />}
                  {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" title="Error saving" />}
                  <button
                    onClick={() => handleToggleEdit(artwork)}
                    className={`p-1.5 rounded-full transition-colors duration-200 ${isEditing ? (lightsOn ? 'bg-neutral-900 text-white' : 'bg-white text-black') : (lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700')} ${text}`}
                    title={isEditing ? 'Close Editor' : 'Open Editor'}
                  >
                    {isEditing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRemoveClick(artwork.id, artwork.title)}
                    className={`p-1.5 rounded-full transition-colors duration-200 hover:bg-red-500/20 text-red-500`}
                    title="Remove from Layout"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 space-y-4">
                  <div className={`w-full aspect-video rounded-md overflow-hidden bg-neutral-700/50 flex items-center justify-center ${text}`}>
                    {getMediaPreview(artwork)}
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase mb-1 ${subtext}`}>Media URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={currentEditValue}
                        onChange={(e) => setCurrentEditValue(e.target.value)}
                        className={`flex-1 px-3 py-2 rounded-md text-xs ${input}`}
                        placeholder="Enter URL for image, video, or GLB"
                      />
                      <button
                        onClick={() => handleSaveUrl(artwork.id, currentEditValue)}
                        className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-colors duration-200 ${lightsOn ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-white text-black hover:bg-neutral-200'}`}
                        disabled={status === 'saving'}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase mb-1 ${subtext}`}>Upload File</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFileChange(e, artwork.id)}
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.glb"
                        disabled={isUploading}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex-1 px-4 py-2 rounded-md text-xs font-bold uppercase flex items-center justify-center gap-2 transition-colors duration-200 ${isUploading ? 'bg-neutral-500 text-white' : (lightsOn ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-neutral-700 text-white hover:bg-neutral-600')}`}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        {isUploading ? 'Uploading...' : 'Choose File'}
                      </button>
                    </div>
                    {uploadMessage && (
                      <p className={`mt-2 text-xs ${status === 'error' ? 'text-red-500' : (status === 'saved' ? 'text-green-500' : subtext)}`}>{uploadMessage}</p>
                    )}
                    {isUploading && uploadProgress > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                        <div className="bg-cyan-600 h-1 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    )}
                  </div>

                  {isGlb && (
                    <div className="space-y-4">
                      <h5 className={`text-sm font-bold mt-4 ${text}`}>3D Model Settings</h5>
                      
                      {/* Rotation controls */}
                      <div>
                        <label className={`block text-xs font-bold uppercase mb-1 ${subtext}`}>Rotation</label>
                        <div className="flex items-center gap-2">
                            {['Y', 'X', 'Z'].map((axis, index) => (
                                <button
                                    key={axis}
                                    onClick={() => handleGlbAxisRotate(artwork.id, index as 0 | 1 | 2)}
                                    className={`flex-1 px-3 py-2 rounded-md text-xs font-bold uppercase flex items-center justify-center gap-1 transition-colors duration-200 ${lightsOn ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-neutral-700 text-white hover:bg-neutral-600'}`}
                                    disabled={status === 'saving'}
                                    title={`Rotate around ${axis}-axis`}
                                >
                                    <RefreshCw className="w-3 h-3" /> {axis}: {glbPreviewRotation[index]}°
                                </button>
                            ))}
                        </div>
                      </div>

                      {/* Material Presets */}
                      <div>
                        <label className={`block text-xs font-bold uppercase mb-1 ${subtext}`}>Material Presets</label>
                        <div className="flex flex-wrap gap-2">
                          {MATERIAL_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              onClick={() => handleSaveMaterial(artwork.id, preset.id, preset.config)}
                              className={`px-3 py-2 rounded-full text-xs font-bold uppercase flex items-center gap-2 transition-colors duration-200
                                  ${selectedMaterialPresetId === preset.id
                                    ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-neutral-900 shadow-md')
                                    : (lightsOn ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' : 'bg-neutral-700 text-white hover:bg-neutral-600')
                                  }
                              `}
                              disabled={status === 'saving'}
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.iconColor }}></div>
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ArtworkTab;