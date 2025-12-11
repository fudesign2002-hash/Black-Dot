import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Image as ImageIcon, Check, UploadCloud, Loader2, Box, RefreshCw, AlertCircle } from 'lucide-react';
import { FirebaseArtwork, ArtworkData, ArtworkMaterialConfig, MaterialPreset } from '../../types';
import { storage } from '../../firebase';
import { getVideoEmbedUrl } from '../../services/utils/videoUtils';

const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;
const JPEG_QUALITY = 0.8;

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

interface ArtworkSettingsFormProps {
  artwork: FirebaseArtwork;
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  onUpdateArtworkFile: (artworkId: string, newFileUrl: string) => Promise<void>;
  onUpdateArtworkData: (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => Promise<void>;
}

const ArtworkSettingsForm: React.FC<ArtworkSettingsFormProps> = ({
  artwork,
  uiConfig,
  onUpdateArtworkFile,
  onUpdateArtworkData,
}) => {
  const [currentEditValue, setCurrentEditValue] = useState<string>('');
  const [originalArtworkFile, setOriginalArtworkFile] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewMediaError, setPreviewMediaError] = useState<boolean>(false);
  const [glbPreviewRotation, setGlbPreviewRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [selectedMaterialPresetId, setSelectedMaterialPresetId] = useState<string | null>(null);
  const [localScale, setLocalScale] = useState(1.0);

  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  // Initialize state when artwork changes
  useEffect(() => {
    const initialValue = artwork.artwork_file || artwork.file || '';
    setCurrentEditValue(initialValue);
    setOriginalArtworkFile(initialValue);
    setUpdateStatus('idle');
    setUploadMessage(null);
    setUploadProgress(0);
    setIsUploading(false);
    setPreviewMediaError(false);

    if ((artwork.artwork_type as string) === 'sculpture' || ((artwork.artwork_type as string) === 'sculpture' && artwork.artwork_file?.toLowerCase().includes('.glb'))) {
      // Initialize scale
      setLocalScale(artwork.artwork_data?.scale_offset ?? 1.0);

      // Initialize rotation
      const rotationOffset = artwork.artwork_data?.rotation_offset;
      const initialRotation: [number, number, number] = (rotationOffset && rotationOffset.length === 3)
          ? rotationOffset
          : [0, 0, 0];
      
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
      setLocalScale(1.0);
    }
  }, [artwork]);

  const handleUpdateStatus = useCallback((status: 'idle' | 'saving' | 'saved' | 'error', duration: number = 2000) => {
    setUpdateStatus(status);
    if (status === 'saved' || status === 'error') {
      setTimeout(() => setUpdateStatus('idle'), duration);
    }
  }, []);

  const handleSaveUrl = useCallback(async (urlToSave: string) => {
    if (urlToSave === originalArtworkFile) {
      handleUpdateStatus('idle');
      return;
    }

    handleUpdateStatus('saving');
    try {
      await onUpdateArtworkFile(artwork.id, urlToSave);
      handleUpdateStatus('saved');
      setOriginalArtworkFile(urlToSave);
      setCurrentEditValue(urlToSave);
      setPreviewMediaError(false);
    } catch (error) {
      handleUpdateStatus('error', 3000); 
      setPreviewMediaError(true);
    }
  }, [originalArtworkFile, onUpdateArtworkFile, handleUpdateStatus, artwork.id]);

  const handleGlbAxisRotate = useCallback(async (uiAxisIndex: 0 | 1 | 2) => {
    handleUpdateStatus('saving');
    
    const currentRotationOffsetFromDB = artwork.artwork_data?.rotation_offset;
    const initialRotation: [number, number, number] = (currentRotationOffsetFromDB && currentRotationOffsetFromDB.length === 3)
        ? currentRotationOffsetFromDB
        : [0, 0, 0];
    const newRotationOffsetRadians: [number, number, number] = [...initialRotation];

    const currentDegreeForUIaxis = glbPreviewRotation[uiAxisIndex];
    const newDegreeForUIaxis = normalizeDegrees(currentDegreeForUIaxis + 90);
    
    const radianValue = newDegreeForUIaxis * (Math.PI / 180);

    if (uiAxisIndex === 0) { 
      newRotationOffsetRadians[1] = radianValue; 
    } else if (uiAxisIndex === 1) { 
      newRotationOffsetRadians[0] = radianValue; 
    } else if (uiAxisIndex === 2) { 
      newRotationOffsetRadians[2] = radianValue; 
    }

    setGlbPreviewRotation((prev) => {
        const newGlbPreviewRotation: [number, number, number] = [prev[0], prev[1], prev[2]];
        newGlbPreviewRotation[uiAxisIndex] = newDegreeForUIaxis;
        return newGlbPreviewRotation;
    });

    try {
        await onUpdateArtworkData(artwork.id, { rotation_offset: newRotationOffsetRadians });
        handleUpdateStatus('saved');
    } catch (error) {
        handleUpdateStatus('error', 3000);
    }
  }, [glbPreviewRotation, artwork, onUpdateArtworkData, handleUpdateStatus]);

  const handleSaveMaterial = useCallback(async (presetId: string, materialConfig: ArtworkMaterialConfig | null) => {
    handleUpdateStatus('saving');
    try {
        setSelectedMaterialPresetId(presetId);
        await onUpdateArtworkData(artwork.id, { material: materialConfig });
        handleUpdateStatus('saved');
    } catch (error) {
        handleUpdateStatus('error', 3000);
    }
  }, [onUpdateArtworkData, handleUpdateStatus, artwork.id]);

  const handleScaleChange = useCallback(async (increment: number) => {
    handleUpdateStatus('saving');
    const currentScale = artwork.artwork_data?.scale_offset ?? 1.0;
    let newScale = currentScale + increment;

    newScale = Math.max(0.1, Math.min(5.0, newScale));
    
    setLocalScale(newScale);

    try {
        await onUpdateArtworkData(artwork.id, { scale_offset: newScale });
        handleUpdateStatus('saved');
    } catch (error) {
        handleUpdateStatus('error', 3000);
    }
  }, [artwork, onUpdateArtworkData, handleUpdateStatus]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadMessage('Uploading...');
    setPreviewMediaError(false);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension || '');
    const isGlb = fileExtension === 'glb';

    if (!isImage && !isVideo && !isGlb) {
      setUploadMessage('Unsupported file type.');
      setIsUploading(false);
      handleUpdateStatus('error');
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
            resolve(file);
          }
        }, 'image/jpeg', JPEG_QUALITY);
      });
    }

    const storageRef = storage.ref();
    const fileRef = storageRef.child(`artworks/${Date.now()}_${processedFile.name}`);
    const uploadTask = fileRef.put(processedFile);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        setUploadMessage('Upload failed.');
        setIsUploading(false);
        handleUpdateStatus('error');
      },
      async () => {
        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
        await onUpdateArtworkFile(artwork.id, downloadURL);
        setOriginalArtworkFile(downloadURL);
        setCurrentEditValue(downloadURL);
        setIsUploading(false);
        setUploadMessage(null);
        handleUpdateStatus('saved');
      }
    );
  }, [artwork.id, onUpdateArtworkFile, handleUpdateStatus]);

  const isGlb = artwork.artwork_file?.toLowerCase().includes('.glb') || artwork.file?.toLowerCase().includes('.glb');
  const isVideo = artwork.artwork_file?.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/) || artwork.file?.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
  const isImage = !isGlb && !isVideo;

  return (
    <div className="space-y-4">
      {/* Preview Area */}
      <div className={`w-full aspect-video ${controlBgClass} rounded-lg overflow-hidden flex items-center justify-center relative border ${border}`}>
        {isGlb ? (
          <div className="flex flex-col items-center justify-center text-neutral-500">
            <Box size={48} className="mb-2 opacity-50" />
            <span className="text-xs font-medium">GLB Model</span>
          </div>
        ) : isVideo ? (
          previewMediaError ? (
            <div className="flex flex-col items-center justify-center text-red-500 p-4 text-center">
              <AlertCircle size={24} className="mb-2" />
              <span className="text-xs">Failed to load video</span>
            </div>
          ) : (
            <video 
              src={currentEditValue} 
              className="w-full h-full object-contain" 
              controls 
              onError={() => setPreviewMediaError(true)}
            />
          )
        ) : (
          previewMediaError ? (
            <div className="flex flex-col items-center justify-center text-red-500 p-4 text-center">
              <AlertCircle size={24} className="mb-2" />
              <span className="text-xs">Failed to load image</span>
            </div>
          ) : (
            <img 
              src={currentEditValue} 
              alt={artwork.title} 
              className="w-full h-full object-contain"
              onError={() => setPreviewMediaError(true)}
            />
          )
        )}
        
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-10">
            <Loader2 className="animate-spin mb-2" size={24} />
            <span className="text-xs font-medium">{Math.round(uploadProgress)}%</span>
            {uploadMessage && <span className="text-[10px] mt-1 opacity-80">{uploadMessage}</span>}
          </div>
        )}
      </div>

      {/* URL Input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={currentEditValue}
            onChange={(e) => setCurrentEditValue(e.target.value)}
            onBlur={() => handleSaveUrl(currentEditValue)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl(currentEditValue)}
            className={`flex-1 px-3 py-2 text-xs rounded border ${input} ${lightsOn ? 'bg-white' : 'bg-neutral-900'} ${text} focus:outline-none focus:ring-1 focus:ring-blue-500`}
            placeholder="https://..."
          />
          <div className="flex items-center justify-center w-8">
            {updateStatus === 'saving' && <Loader2 size={14} className={`animate-spin ${subtext}`} />}
            {updateStatus === 'saved' && <Check size={14} className="text-green-500" />}
            {updateStatus === 'error' && <AlertCircle size={14} className="text-red-500" />}
          </div>
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,.glb"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`w-full py-2 px-3 rounded border ${border} ${controlBgClass} ${text} text-xs font-medium hover:opacity-80 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <UploadCloud size={14} />
          UPLOAD FILE
        </button>
      </div>

      {/* GLB Controls */}
      {isGlb && (
        <>
          <div className={`pt-4 border-t ${border}`}>
            <label className={`text-[10px] font-bold ${subtext} uppercase tracking-wider mb-3 block`}>
              GLB Model Rotation
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Y', axis: 0 },
                { label: 'X', axis: 1 },
                { label: 'Z', axis: 2 }
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => handleGlbAxisRotate(item.axis as 0 | 1 | 2)}
                    className={`w-full aspect-square rounded border ${border} ${controlBgClass} flex items-center justify-center hover:bg-blue-500/10 hover:border-blue-500/50 transition-colors group`}
                  >
                    <RefreshCw size={16} className={`${subtext} group-hover:text-blue-500 transition-colors`} />
                  </button>
                  <span className={`text-[10px] ${subtext}`}>{item.label}: {glbPreviewRotation[item.axis as 0 | 1 | 2]}°</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`pt-4 border-t ${border}`}>
            <div className="flex items-center justify-between mb-3">
                <label className={`text-[10px] font-bold ${subtext} uppercase tracking-wider block`}>
                Sculpture Scale
                </label>
            </div>
            <div className={`flex items-center justify-between px-3 py-2 rounded border ${border} ${controlBgClass}`}>
                <button 
                    onClick={() => handleScaleChange(-0.1)}
                    className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${text}`}
                >
                    <span className="text-lg font-bold">-</span>
                </button>
                <span className={`text-xs font-medium ${text}`}>
                    {Math.round(localScale * 100)}%
                </span>
                <button 
                    onClick={() => handleScaleChange(0.1)}
                    className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${text}`}
                >
                    <span className="text-lg font-bold">+</span>
                </button>
            </div>
          </div>

          <div className={`pt-4 border-t ${border}`}>
            <label className={`text-[10px] font-bold ${subtext} uppercase tracking-wider mb-3 block`}>
              Material Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MATERIAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSaveMaterial(preset.id, preset.config)}
                  className={`flex items-center gap-2 p-2 rounded border text-left transition-all ${
                    selectedMaterialPresetId === preset.id
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                      : `${border} ${controlBgClass} hover:border-blue-500/50`
                  }`}
                >
                  <div 
                    className="w-3 h-3 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: preset.iconColor }}
                  />
                  <span className={`text-[10px] font-medium ${text} truncate`}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ArtworkSettingsForm;
