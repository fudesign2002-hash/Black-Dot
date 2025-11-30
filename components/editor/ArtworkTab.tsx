// components/editor/ArtworkTab.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Image as ImageIcon, Video, Check, UploadCloud, Loader2, Box, RefreshCw, Trash2, FileSize } from 'lucide-react'; // NEW: Added FileSize icon
import { FirebaseArtwork, ExhibitionArtItem, ArtworkData, ArtworkMaterialConfig, MaterialPreset } from '../../types';
import { storage } from '../../firebase';
import { getVideoEmbedUrl } from '../../services/utils/videoUtils';

// Define constants for image compression
const MAX_IMAGE_WIDTH = 1200; // Max width for image compression (pixels)
const MAX_IMAGE_HEIGHT = 1200; // Max height for image compression (pixels)
const JPEG_QUALITY = 0.8; // JPEG compression quality (0.0 to 1.0, where 1.0 is highest quality/least compression)

interface ArtworkTabProps {
  theme: {
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
  onOpenConfirmationDialog: (artworkId: string, artworkTitle: string, onConfirm: () => Promise<void>) => void; // NEW: Add onOpenConfirmationDialog prop
}

const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'original',
    name: 'Original GLB Material',
    iconColor: '#A0A0A0', // Grey for original
    config: null, // Signals to revert to GLB's intrinsic material (with base adjustments)
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
    iconColor: '#ADD8E6', // LightBlue
    config: { color: '#ADD8E6', roughness: 0.3, metalness: 0, transmission: 0.95, thickness: 1.5, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 1 },
  },
];


const ArtworkTab: React.FC<ArtworkTabProps> = React.memo(({ theme, firebaseArtworks, currentLayout, onUpdateArtworkFile, onUpdateArtworkData, onFocusArtwork, onRemoveArtworkFromLayout, onOpenConfirmationDialog }) => {
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
  const [selectedMaterialPresetId, setSelectedMaterialPresetId] = useState<string | null>(null); // NEW: State for selected material preset

  const { lightsOn, text, subtext, border, input } = theme;
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

  const handleRotateAndSaveGlb = useCallback(async (artworkId: string, axis: 0 | 1 | 2) => {
    handleUpdateStatus(artworkId, 'saving');
    
    const newRotationDegrees = [...glbPreviewRotation];
    newRotationDegrees[axis] = (newRotationDegrees[axis] + 90);
    if (newRotationDegrees[axis] > 180) newRotationDegrees[axis] -= 360;
    if (newRotationDegrees[axis] < -180) newRotationDegrees[axis] += 360;
    
    setGlbPreviewRotation(newRotationDegrees as [number, number, number]);

    try {
        const rotationOffsetRadians: [number, number, number] = [
            newRotationDegrees[0] * (Math.PI / 180),
            newRotationDegrees[1] * (Math.PI / 180),
            newRotationDegrees[2] * (Math.PI / 180),
        ];
        await onUpdateArtworkData(artworkId, { rotation_offset: rotationOffsetRadians });
        handleUpdateStatus(artworkId, 'saved');
    } catch (error) {
        console.error("Failed to save GLB rotation:", error);
        handleUpdateStatus(artworkId, 'error', 3000);
    }
  }, [glbPreviewRotation, onUpdateArtworkData, handleUpdateStatus]);

  // NEW: handleSaveMaterial function
  const handleSaveMaterial = useCallback(async (artworkId: string, presetId: string, materialConfig: ArtworkMaterialConfig | null) => {
    handleUpdateStatus(artworkId, 'saving');
    try {
        setSelectedMaterialPresetId(presetId); // Update local UI state
        await onUpdateArtworkData(artworkId, { material: materialConfig });
        handleUpdateStatus(artworkId, 'saved');
    } catch (error) {
        console.error("Failed to save material preset:", error);
        handleUpdateStatus(artworkId, 'error', 3000);
    }
  }, [onUpdateArtworkData, handleUpdateStatus]);

  const handleEditClick = useCallback((artwork: FirebaseArtwork) => {
    setEditingUrlArtworkId(artwork.id);
    const initialValue = artwork.artwork_file || artwork.file || '';
    setCurrentEditValue(initialValue);
    setOriginalArtworkFile(initialValue);
    setUpdateStatus(prev => ({ ...prev, [artwork.id]: 'idle' }));
    setUploadMessage(null);
    setUploadProgress(0);
    setIsUploading(false);
    setPreviewMediaError(prev => ({ ...prev, [artwork.id]: false }));
    
    if (artwork.artwork_type === 'sculpture' && artwork.artwork_file?.toLowerCase().includes('.glb')) {
        const rotationOffset = artwork.artwork_data?.rotation_offset || [0, 0, 0];
        setGlbPreviewRotation([
            rotationOffset[0] * (180 / Math.PI),
            rotationOffset[1] * (180 / Math.PI),
            rotationOffset[2] * (180 / Math.PI),
        ]);

        // NEW: Determine selected material preset based on saved artwork_data.material
        const savedMaterial = artwork.artwork_data?.material;
        let presetIdFound: string | null = 'original'; // Default to original
        if (savedMaterial) {
            const matchedPreset = MATERIAL_PRESETS.find(preset => {
                if (!preset.config) return false; // Skip 'original' preset for config comparison
                // FIX: Removed 'ior' from the keys array as it is not part of ArtworkMaterialConfig
                const keys: Array<keyof ArtworkMaterialConfig> = ['color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity', 'transmission', 'thickness', 'clearcoat', 'clearcoatRoughness', 'transparent', 'opacity', 'side'];
                return keys.every(key => preset.config?.[key] === savedMaterial[key]);
            });
            if (matchedPreset) {
                presetIdFound = matchedPreset.id;
            } else {
                // If a material config exists but doesn't match a predefined preset, consider it 'original' for UI purposes.
                // This means the user saved *some* custom material, but not one of our presets.
                // To allow reverting to GLB default, 'original' refers to the state without artwork_data.material override.
                presetIdFound = 'original'; 
            }
        }
        setSelectedMaterialPresetId(presetIdFound);

        const artworkInstance = currentLayout.find(item => item.artworkId === artwork.id);
        if (artworkInstance) {
            onFocusArtwork(artworkInstance.id);
        }
    } else {
        setGlbPreviewRotation([0, 0, 0]);
        setSelectedMaterialPresetId(null); // Clear material selection for non-GLB
        onFocusArtwork(null);
    }
  }, [setUpdateStatus, currentLayout, onFocusArtwork, firebaseArtworks]); // Added firebaseArtworks to deps

  // NEW: Handle removal of artwork from layout using custom confirmation dialog
  const handleRemoveClick = useCallback(async (artworkId: string, artworkTitle: string) => {
    const onConfirmRemoval = async () => {
      handleUpdateStatus(artworkId, 'saving');
      try {
        await onRemoveArtworkFromLayout(artworkId);
        handleUpdateStatus(artworkId, 'saved');
        if (editingUrlArtworkId === artworkId) {
          setEditingUrlArtworkId(null);
          onFocusArtwork(null);
        }
      } catch (error) {
        console.error("Failed to remove artwork from layout:", error);
        handleUpdateStatus(artworkId, 'error', 3000);
        throw error; // Re-throw to be caught by the App component's confirmation dialog error handling
      }
    };

    onOpenConfirmationDialog(artworkId, artworkTitle, onConfirmRemoval);
  }, [editingUrlArtworkId, onFocusArtwork, onRemoveArtworkFromLayout, handleUpdateStatus, onOpenConfirmationDialog]);

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
        console.error("Artwork not found for ID:", artworkId);
        setUploadMessage('Upload failed: Artwork not found.');
        setIsUploading(false);
        setUploadProgress(0);
        return;
    }

    const uploadAndSave = async (blobToUpload: Blob, originalFileName: string) => {
        let subfolder = 'other'; // Default fallback
        switch (artwork.artwork_type) {
            case 'painting':
                subfolder = 'painting';
                break;
            case 'sculpture':
                subfolder = 'sculpture';
                break;
            case 'motion':
            case 'media':
                subfolder = 'media'; 
                break;
        }

        try {
            const fileName = blobToUpload.type.startsWith('image/') ? `compressed_${originalFileName}` : originalFileName;
            // NEW: Include artworkId in the storage path for better traceability
            const storageRef = storage.ref().child(`artwork_files/${subfolder}/${artworkId}-${Date.now()}_${fileName}`);
            const uploadTask = storageRef.put(blobToUpload);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload failed:", error);
                    setUploadMessage('Upload failed!');
                    setIsUploading(false);
                    setUploadProgress(0);
                    setPreviewMediaError(prev => ({ ...prev, [artworkId]: true }));
                },
                async () => {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    setCurrentEditValue(downloadURL);
                    setUploadMessage('Upload successful! Saving...');
                    setIsUploading(false);
                    setUploadProgress(100);
                    if (fileInputRef.current) fileInputRef.current.value = "";

                    await handleSaveUrl(artwork.id, downloadURL); // Use artwork.id for consistency
                    setUploadMessage('Saved!');
                }
            );
        } catch (error) {
            console.error("Error initiating upload:", error);
            setUploadMessage('Upload failed!');
            setIsUploading(false);
            setUploadProgress(0);
            setPreviewMediaError(prev => ({ ...prev, [artworkId]: true }));
        }
    };

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image(); // Use global Image constructor
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions to fit within MAX_IMAGE_WIDTH/HEIGHT while maintaining aspect ratio
                if (width > height) {
                    if (width > MAX_IMAGE_WIDTH) {
                        height *= MAX_IMAGE_WIDTH / width;
                        width = MAX_IMAGE_WIDTH;
                    }
                } else {
                    if (height > MAX_IMAGE_HEIGHT) {
                        width *= MAX_IMAGE_HEIGHT / height;
                        height = MAX_IMAGE_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    console.error("Failed to get 2D canvas context.");
                    setUploadMessage('Image compression failed!');
                    setIsUploading(false);
                    setUploadProgress(0);
                    setPreviewMediaError(prev => ({ ...prev, [artworkId]: true }));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        uploadAndSave(blob, file.name);
                    } else {
                        console.error("Failed to compress image to Blob.");
                        setUploadMessage('Image compression failed!');
                        setIsUploading(false);
                        setUploadProgress(0);
                        setPreviewMediaError(prev => ({ ...prev, [artworkId]: true }));
                    }
                }, 'image/jpeg', JPEG_QUALITY); // Specify JPEG quality

            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    } else {
        // Not an image, upload directly
        uploadAndSave(file, file.name);
    }
}, [handleSaveUrl, firebaseArtworks]);

  const getStatusIcon = (status: 'idle' | 'saving' | 'saved' | 'error', artworkId: string) => {
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
  };

  const renderMediaPreview = useCallback((artwork: FirebaseArtwork, url: string | undefined, size: 'small' | 'large' = 'small') => {
    if (!url) {
      return (
        <div className={`flex items-center justify-center ${size === 'small' ? 'h-24' : 'h-[150px]'} bg-neutral-500/10 rounded-md text-sm ${subtext}`}>
          No preview content.
        </div>
      );
    }

    const currentError = previewMediaError[artwork.id];
    const aspectRatioClass = artwork.artwork_type === 'painting' ? 'aspect-square' : 'aspect-video';
    const errorBgClass = `w-full h-full bg-gray-400 flex items-center justify-center text-white text-sm rounded-sm ${aspectRatioClass}`;

    if (currentError) {
      return (
        <div className={errorBgClass}>
          <span className="flex items-center gap-1.5">{artwork.artwork_type === 'painting' ? <ImageIcon className="w-4 h-4" /> : (artwork.artwork_type === 'sculpture' ? <Box className="w-4 h-4" /> : <Video className="w-4 h-4" />)} Failed to load</span>
        </div>
      );
    }

    if (artwork.artwork_type === 'painting') {
      return (
        <img
          src={url}
          alt="Artwork Preview"
          className={`max-w-full ${size === 'small' ? 'max-h-24' : 'max-h-[150px]'} object-contain rounded-sm`}
          crossOrigin="anonymous"
          onError={() => setPreviewMediaError(prev => ({ ...prev, [artwork.id]: true }))}
        />
      );
    } else if (artwork.artwork_type === 'motion') {
      const isDirectVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
      const isVimeo = url.includes('vimeo.com');

      if (isDirectVideo) {
        return (
          <video
            src={url}
            controls
            loop
            muted
            className={`max-w-full ${size === 'small' ? 'max-h-24' : 'max-h-[150px]'} object-contain rounded-sm`}
            crossOrigin="anonymous"
            onError={() => setPreviewMediaError(prev => ({ ...prev, [artwork.id]: true }))}
          >
            Your browser does not support this video format.
          </video>
        );
      } else if (isVimeo) {
        return (
          <iframe
            src={getVideoEmbedUrl(url) || ''}
            width="100%"
            height={size === 'small' ? "96" : "150"}
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups"
            style={{ display: 'block' }}
            title="Vimeo video player preview"
            onError={() => setPreviewMediaError(prev => ({ ...prev, [artwork.id]: true }))}
          />
        );
      } else {
        return (
          <div className={`flex items-center justify-center ${size === 'small' ? 'h-24' : 'h-[150px]'} bg-neutral-500/10 rounded-md text-sm ${subtext}`}>
            <span className="flex items-center gap-1.5"><Video className="w-4 h-4" /> Invalid video URL (preview failed)</span>
          </div>
        );
      }
    } else if (artwork.artwork_type === 'sculpture') {
      return null;
    }
    return null;
  }, [previewMediaError, subtext]);


  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
          <h4 className="font-bold text-sm mb-2">Editable Artworks in Current Zone</h4>
          <p className={`text-sm leading-relaxed ${subtext}`}>
            Here you can update the media URLs and, for GLB sculptures, adjust their display rotation.
            Changes will be saved automatically to Firebase.
          </p>
        </div>

        {relevantArtworks.length === 0 ? (
          <div className={`text-center py-8 ${subtext}`}>
            No editable painting, motion, or GLB sculpture artworks found in this zone.
          </div>
        ) : (
          <div className="space-y-3">
            {relevantArtworks.map((artwork) => (
              <div key={artwork.id} className={`p-4 rounded-xl border ${border} ${controlBgClass} flex flex-col gap-2`}>
                <div className="flex items-center gap-2 mb-2">
                  {artwork.artwork_type === 'painting' ? (
                    <ImageIcon className="w-4 h-4 opacity-70" />
                  ) : artwork.artwork_type === 'sculpture' ? (
                    <Box className="w-4 h-4 opacity-70" />
                  ) : (
                    <Video className="w-4 h-4 opacity-70" />
                  )}
                  <h5 className={`font-medium text-sm ${text}`}>{artwork.title}</h5>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${lightsOn ? 'bg-neutral-200 text-neutral-600' : 'bg-neutral-700 text-neutral-300'}`}>
                    {artwork.artwork_type}
                  </span>
                  {artwork.fileSizeMB !== undefined && ( // NEW: Display file size
                    <span className={`text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full ${lightsOn ? 'bg-neutral-100 text-neutral-500' : 'bg-neutral-800 text-neutral-400'}`}>
                      {artwork.fileSizeMB.toFixed(2)} MB
                    </span>
                  )}
                  <div className="w-4 h-4 flex items-center justify-center ml-auto">
                    {getStatusIcon(updateStatus[artwork.id] || 'idle', artwork.id)}
                  </div>
                  {/* NEW: Remove button */}
                  <button
                    onClick={() => handleRemoveClick(artwork.id, artwork.title)}
                    className={`p-2 rounded-full transition-colors ${lightsOn ? 'hover:bg-red-100 text-red-600' : 'hover:bg-red-900/50 text-red-400'}`}
                    title={`Remove "${artwork.title}" from layout`}
                    disabled={isUploading || updateStatus[artwork.id] === 'saving'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {editingUrlArtworkId === artwork.id ? (
                  <>
                    <p className={`text-xs ${subtext}`}>Current URL:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentEditValue}
                        onChange={(e) => setCurrentEditValue(e.target.value)}
                        onBlur={(e) => {
                          if (e.target.value !== originalArtworkFile) {
                            handleSaveUrl(artwork.id, e.target.value);
                          }
                        }}
                        className={`flex-1 px-3 py-2 rounded-md text-xs ${input}`}
                        disabled={isUploading || updateStatus[artwork.id] === 'saving'}
                      />
                    </div>

                    {artwork.artwork_type !== 'sculpture' && (currentEditValue ? (
                      <div className={`mt-2 p-2 border ${border} rounded-md bg-neutral-500/10 flex items-center justify-center`} style={{minHeight: '80px'}}>
                        {renderMediaPreview(artwork, currentEditValue, 'large')}
                      </div>
                    ) : (
                      <div className={`mt-2 p-2 border ${border} rounded-md bg-neutral-500/10 flex items-center justify-center h-[100px] ${subtext} text-sm`}>
                        No preview content.
                      </div>
                    ))}

                    {artwork.artwork_type === 'sculpture' && artwork.artwork_file?.toLowerCase().includes('.glb') && (
                        <div className="mt-4 border-t pt-4">
                            <p className={`text-xs font-bold uppercase mb-2 ${subtext}`}>GLB Rotation (Degrees)</p>
                            <div className="flex flex-col gap-2">
                                {['X (Roll)', 'Y (Pitch)', 'Z (Yaw)'].map((label, index) => (
                                    <div key={label} className="flex items-center gap-2">
                                        <label className={`w-16 shrink-0 text-xs ${subtext}`}>{label}:</label>
                                        <span className={`text-sm ${text}`}>{Math.round(glbPreviewRotation[index])}°</span>
                                        <button
                                            onClick={() => handleRotateAndSaveGlb(artwork.id, index as 0 | 1 | 2)}
                                            className={`p-2 ml-auto rounded-md transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'}`}
                                            disabled={updateStatus[artwork.id] === 'saving'}
                                        >
                                             <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* NEW: Material Presets Section */}
                            <div className="mt-4 border-t pt-4">
                                <p className={`text-xs font-bold uppercase mb-2 ${subtext}`}>GLB Material Presets</p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {MATERIAL_PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleSaveMaterial(artwork.id, preset.id, preset.config)}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-md transition-colors relative
                                                ${selectedMaterialPresetId === preset.id ? (lightsOn ? 'bg-neutral-200' : 'bg-neutral-700') : (lightsOn ? 'hover:bg-neutral-100' : 'hover:bg-neutral-800')}
                                                {(isUploading || updateStatus[artwork.id] === 'saving') ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                            title={preset.name} // Tooltip
                                            disabled={isUploading || updateStatus[artwork.id] === 'saving'}
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-full border-2 ${selectedMaterialPresetId === preset.id ? (lightsOn ? 'border-neutral-900' : 'border-white') : (lightsOn ? 'border-neutral-300' : 'border-neutral-600')}`}
                                                style={{ backgroundColor: preset.iconColor }}
                                            ></div>
                                            <span className={`text-[10px] text-center ${selectedMaterialPresetId === preset.id ? (lightsOn ? 'text-neutral-900' : 'text-white') : subtext}`}>{preset.id === 'original' ? 'Original' : preset.name.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 border-t pt-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        id={`file-upload-${artwork.id}`}
                        onChange={(e) => handleFileChange(e, artwork.id)}
                        className="hidden"
                        accept={artwork.artwork_type === 'painting' ? 'image/*' : (artwork.artwork_type === 'motion' ? 'video/*' : (artwork.artwork_type === 'sculpture' ? '.glb' : '*/*'))}
                        disabled={isUploading || updateStatus[artwork.id] === 'saving'}
                      />
                      <label
                        htmlFor={`file-upload-${artwork.id}`}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold uppercase cursor-pointer transition-colors ${lightsOn ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'} ${(isUploading || updateStatus[artwork.id] === 'saving') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isUploading ? 'UPLOADING...' : 'UPLOAD NEW FILE'}
                      </label>
                      {isUploading && (
                        <div className="w-full mt-2 bg-neutral-200 rounded-full h-1.5 dark:bg-neutral-700">
                          <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      )}
                      {uploadMessage && (
                        <p className={`text-center mt-2 text-xs ${uploadMessage.includes('successful') || uploadMessage.includes('Saved') ? 'text-green-500' : 'text-red-500'}`}>
                          {uploadMessage}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    {artwork.artwork_type !== 'sculpture' && (
                        <div className={`flex-1 flex items-center justify-center p-2 rounded-md border ${border} bg-neutral-500/10 max-h-28`} >
                          {renderMediaPreview(artwork, artwork.artwork_file || artwork.file, 'small')}
                        </div>
                    )}
                    <button
                      onClick={() => handleEditClick(artwork)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${lightsOn ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'}`}
                    >
                      EDIT
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ArtworkTab;