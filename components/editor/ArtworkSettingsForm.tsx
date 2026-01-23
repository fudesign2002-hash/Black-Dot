import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from './ArtworkSettingsForm.module.css';
import { Image as ImageIcon, Check, UploadCloud, Loader2, Box, RefreshCw, AlertCircle, Calendar, Layers, Minus, Plus } from 'lucide-react';
import { FirebaseArtwork, ArtworkData, ArtworkMaterialConfig, MaterialPreset } from '../../types';
import { storage } from '../../firebase';
import { getVideoEmbedUrl } from '../../services/utils/videoUtils';
import { StatusIndicator } from './EditorCommon';

const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;
const WEBP_QUALITY = 0.7;

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
  activeZoneId: string;
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  onUpdateArtworkFile: (artworkId: string, newFileUrl: string) => Promise<void>;
  onUpdateArtworkData: (artworkId: string, updatedArtworkData: Partial<ArtworkData>) => Promise<void>;
  onUpdateArtworkField: (artworkId: string, field: string, value: any) => Promise<void>;
  showTitle?: boolean;
}

const ArtworkSettingsForm: React.FC<ArtworkSettingsFormProps> = ({
  artwork,
  activeZoneId,
  uiConfig,
  onUpdateArtworkFile,
  onUpdateArtworkData,
  onUpdateArtworkField,
  showTitle = false,
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
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(artwork.title);
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);
  const [tempMetadata, setTempMetadata] = useState({
    date: artwork.artwork_date || '',
    medium: artwork.artwork_medium || '',
    dimensions: artwork.artwork_dimensions || '',
  });

  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  useEffect(() => {
    const initialValue = artwork.artwork_file || artwork.file || '';
    setCurrentEditValue(initialValue);
    setOriginalArtworkFile(initialValue);
    setUpdateStatus('idle');
    setUploadMessage(null);
    setUploadProgress(0);
    setIsUploading(false);
    setPreviewMediaError(false);
    setTempTitle(artwork.title);
    setTempMetadata({
      date: artwork.artwork_date || '',
      medium: artwork.artwork_medium || '',
      dimensions: artwork.artwork_dimensions || '',
    });

    if ((artwork.artwork_type as string) === 'sculpture' || ((artwork.artwork_type as string) === 'sculpture' && artwork.artwork_file?.toLowerCase().includes('.glb'))) {
      const zoneScale = artwork.artwork_data?.scale_offset_per_zone?.[activeZoneId];
      setLocalScale(zoneScale ?? artwork.artwork_data?.scale_offset ?? 1.0);

      const rotationOffset = artwork.artwork_data?.rotation_offset;
      const initialRotation: [number, number, number] = (rotationOffset && rotationOffset.length === 3)
          ? rotationOffset
          : [0, 0, 0];
      
      setGlbPreviewRotation([
          normalizeDegrees(initialRotation[1] * (180 / Math.PI)), 
          normalizeDegrees(initialRotation[0] * (180 / Math.PI)), 
          normalizeDegrees(initialRotation[2] * (180 / Math.PI)), 
      ]);

      const zoneMaterial = artwork.artwork_data?.material_per_zone?.[activeZoneId];
      const savedMaterial = zoneMaterial !== undefined ? zoneMaterial : artwork.artwork_data?.material;
      let presetIdFound: string | null = 'original';
      if (savedMaterial) {
          const matchedPreset = MATERIAL_PRESETS.find(preset => {
              if (!preset.config) return false;
              const keys: Array<keyof ArtworkMaterialConfig> = ['color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity', 'transmission', 'thickness', 'clearcoat', 'clearcoatRoughness', 'transparent', 'opacity', 'side'];
              return keys.every(key => (preset.config?.[key] === savedMaterial[key]) || (preset.config?.[key] === undefined && savedMaterial[key] === null));
          });
          if (matchedPreset) presetIdFound = matchedPreset.id;
      }
      setSelectedMaterialPresetId(presetIdFound);
    } else {
      setGlbPreviewRotation([0, 0, 0]);
      setSelectedMaterialPresetId(null);
      setLocalScale(1.0);
    }
  }, [artwork, activeZoneId]);

  const handleUpdateStatus = useCallback((status: 'idle' | 'saving' | 'saved' | 'error', duration: number = 2000) => {
    setUpdateStatus(status);
    if (status === 'saved' || status === 'error') {
      setTimeout(() => setUpdateStatus('idle'), duration);
    }
  }, []);

  const handleSaveUrl = useCallback(async (urlToSave: string) => {
    if (urlToSave === originalArtworkFile) return;
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

  const handleTitleSave = useCallback(async () => {
    if (!tempTitle.trim() || tempTitle === artwork.title) {
      setIsEditingTitle(false);
      return;
    }
    handleUpdateStatus('saving');
    try {
      await onUpdateArtworkField(artwork.id, 'title', tempTitle.trim());
      handleUpdateStatus('saved');
      setIsEditingTitle(false);
    } catch (error) {
      handleUpdateStatus('error', 3000);
    }
  }, [tempTitle, artwork.id, artwork.title, onUpdateArtworkField, handleUpdateStatus]);

  const handleMetadataSave = useCallback(async () => {
    handleUpdateStatus('saving');
    try {
      await Promise.all([
        onUpdateArtworkField(artwork.id, 'artwork_date', tempMetadata.date),
        onUpdateArtworkField(artwork.id, 'artwork_medium', tempMetadata.medium),
        onUpdateArtworkField(artwork.id, 'artwork_dimensions', tempMetadata.dimensions),
      ]);
      handleUpdateStatus('saved');
      setEditingMetadataId(null);
    } catch (error) {
      handleUpdateStatus('error', 3000);
    }
  }, [tempMetadata, artwork.id, onUpdateArtworkField, handleUpdateStatus]);

  const handleGlbAxisRotate = useCallback(async (uiAxisIndex: 0 | 1 | 2) => {
    handleUpdateStatus('saving');
    const initialRotation: [number, number, number] = (artwork.artwork_data?.rotation_offset && artwork.artwork_data?.rotation_offset.length === 3)
        ? artwork.artwork_data?.rotation_offset
        : [0, 0, 0];
    const newRotationOffsetRadians: [number, number, number] = [...initialRotation];
    const currentDegreeForUIaxis = glbPreviewRotation[uiAxisIndex];
    const newDegreeForUIaxis = normalizeDegrees(currentDegreeForUIaxis + 90);
    const radianValue = newDegreeForUIaxis * (Math.PI / 180);
    if (uiAxisIndex === 0) newRotationOffsetRadians[1] = radianValue; 
    else if (uiAxisIndex === 1) newRotationOffsetRadians[0] = radianValue; 
    else if (uiAxisIndex === 2) newRotationOffsetRadians[2] = radianValue;

    setGlbPreviewRotation((prev) => {
        const newRot: [number, number, number] = [...prev];
        newRot[uiAxisIndex] = newDegreeForUIaxis;
        return newRot;
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
        const newMaterialPerZone = {
          ...(artwork.artwork_data?.material_per_zone || {}),
          [activeZoneId]: materialConfig
        };
        await onUpdateArtworkData(artwork.id, { material_per_zone: newMaterialPerZone });
        handleUpdateStatus('saved');
    } catch (error) {
        handleUpdateStatus('error', 3000);
    }
  }, [artwork, activeZoneId, onUpdateArtworkData, handleUpdateStatus]);

  const handleScaleChange = useCallback(async (increment: number) => {
    handleUpdateStatus('saving');
    const currentScale = artwork.artwork_data?.scale_offset_per_zone?.[activeZoneId] ?? artwork.artwork_data?.scale_offset ?? 1.0;
    let newScale = Math.max(0.1, Math.min(5.0, currentScale + increment));
    setLocalScale(newScale);
    try {
        const newScalePerZone = {
          ...(artwork.artwork_data?.scale_offset_per_zone || {}),
          [activeZoneId]: newScale
        };
        await onUpdateArtworkData(artwork.id, { scale_offset_per_zone: newScalePerZone });
        handleUpdateStatus('saved');
    } catch (error) {
        handleUpdateStatus('error', 3000);
    }
  }, [artwork, activeZoneId, onUpdateArtworkData, handleUpdateStatus]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true); setUploadProgress(0); setUploadMessage('Uploading...');
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension || '');
    const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension || '');
    const isGlb = fileExtension === 'glb';
    if (!isImage && !isVideo && !isGlb) { setUploadMessage('Unsupported file type.'); setIsUploading(false); handleUpdateStatus('error'); return; }

    let processedFile = file;
    if (isImage) {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image(); img.src = objectUrl;
      try { await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); setTimeout(() => reject(), 5000); }); }
      catch (e) { setUploadMessage('Failed to load image.'); setIsUploading(false); handleUpdateStatus('error'); return; }
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let width = img.width, height = img.height;
      if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
        if (width > height) { height = Math.round(height * (MAX_IMAGE_WIDTH / width)); width = MAX_IMAGE_WIDTH; }
        else { width = Math.round(width * (MAX_IMAGE_HEIGHT / height)); height = MAX_IMAGE_HEIGHT; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); if (ctx) ctx.drawImage(img, 0, 0, width, height);
      processedFile = await new Promise<File>(resolve => {
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }));
          else resolve(file);
        }, 'image/webp', WEBP_QUALITY);
      });
    }

    const storageRef = storage.ref();
    const newName = `${Date.now()}_${processedFile.name}`;
    const folderName = (artwork.artwork_type || 'unknown').toString().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const fileRef = storageRef.child(`artwork_files/${folderName}/${artwork.id}/${newName}`);
    const uploadTask = fileRef.put(processedFile);
    uploadTask.on('state_changed', 
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => { setUploadMessage('Upload failed.'); setIsUploading(false); handleUpdateStatus('error'); },
      async () => {
        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
        try {
          await onUpdateArtworkFile(artwork.id, downloadURL);
          const previousUrl = artwork.artwork_file || artwork.file || '';
          if (previousUrl) try { await storage.refFromURL(previousUrl).delete(); } catch(e){}
        } finally { setOriginalArtworkFile(downloadURL); setCurrentEditValue(downloadURL); setIsUploading(false); setUploadMessage(null); handleUpdateStatus('saved'); }
      }
    );
  }, [artwork.id, artwork.artwork_type, onUpdateArtworkFile, handleUpdateStatus]);

  const lastSegment = (artwork.artwork_file || artwork.file || '').split('?')[0].split('/').pop() || '';
  const isGlb = /\.glb(?:$|-[0-9]+$)/i.test(lastSegment);
  const isVideo = /\.(mp4|webm|ogg|mov)(?:$|-[0-9]+$)/i.test(lastSegment);

  // Responsive panel class
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const checkScreen = () => setIsSmallScreen(window.innerWidth <= 600);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  return (
    <div className={`${styles['artwork-settings-panel']} ${isSmallScreen ? styles.small : ''} space-y-4`}>
      {showTitle && (
        <div className="flex items-center gap-2">
           {isEditingTitle ? (
             <input autoFocus type="text" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditingTitle(false); }} className={`flex-1 text-sm font-bold bg-white dark:bg-neutral-900 rounded-lg border ${border} px-3 py-1 outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all`} />
           ) : (
             <h4 className="font-bold text-sm cursor-text truncate px-1 -mx-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors" onClick={() => setIsEditingTitle(true)} title="Click to rename">{artwork.title}</h4>
           )}
        </div>
      )}

      {(artwork.artwork_type === 'painting' || artwork.artwork_type === 'photography') && (
        <>
          <div className={`w-full aspect-video bg-neutral-200 dark:bg-neutral-800 rounded-md overflow-hidden flex items-center justify-center text-neutral-500 relative`}>
            {isGlb ? (
              <div className="flex flex-col items-center"><Box size={40} className="mb-2 opacity-50" /><span>GLB Model</span></div>
            ) : isVideo ? ( previewMediaError ? <AlertCircle size={32} /> : 
              <iframe src={getVideoEmbedUrl(currentEditValue) || ''} frameBorder="0" allowFullScreen style={{ width: '100%', height: '100%', pointerEvents: 'none' }} onError={() => setPreviewMediaError(true)} />
            ) : ( previewMediaError ? <AlertCircle size={32} /> : <img src={currentEditValue} alt={artwork.title} className="object-cover w-full h-full" onError={() => setPreviewMediaError(true)} />
            )}
            {isUploading && <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-10"><Loader2 className="animate-spin mb-2" size={24} /><span className="text-xs font-medium">{Math.round(uploadProgress)}%</span></div>}
          </div>
          <div className="relative">
            <input type="text" value={currentEditValue} onChange={e => setCurrentEditValue(e.target.value)} placeholder="Enter URL..." className={`w-full pr-10 py-2 rounded-md text-xs ${input}`} />
            <button onClick={() => handleSaveUrl(currentEditValue)} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'} ${updateStatus === 'saved' ? 'text-green-500' : (updateStatus === 'error' ? 'text-red-500' : '')}`} disabled={currentEditValue === originalArtworkFile || updateStatus === 'saving'}>{updateStatus !== 'idle' ? <StatusIndicator status={updateStatus} size={14} /> : <Check className="w-4 h-4" />}</button>
          </div>
          <div className="relative">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className={`w-full px-4 py-2 rounded-md flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors ${lightsOn ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300' : 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'} ${isUploading ? 'opacity-70' : ''}`} disabled={isUploading}>{isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}{uploadMessage || 'Upload File'}</button>
            {isUploading && <div className="absolute inset-x-0 bottom-0 h-1 bg-cyan-500 rounded-md" style={{ width: `${uploadProgress}%` }}></div>}
          </div>
        </>
      )}

      <div className={`p-4 rounded-xl border ${border} ${lightsOn ? 'bg-neutral-100' : 'bg-neutral-800'} space-y-4`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${subtext} opacity-50`}>Artwork Information</p>
        <div className="grid grid-cols-1 gap-5">
          <div className="flex gap-4">
            <div className={`mt-1 p-2 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-900'} h-fit shadow-sm`}><Calendar size={14} className="opacity-40" /></div>
            <div className="flex-1 space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-widest ${subtext} opacity-60`}>Creation Date</label>
              {editingMetadataId === artwork.id ? (
                <input autoFocus type="text" value={tempMetadata.date} onChange={e => setTempMetadata(prev => ({ ...prev, date: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleMetadataSave(); if (e.key === 'Escape') setEditingMetadataId(null); }} className={`w-full px-3 py-1.5 rounded-lg border ${border} text-xs font-semibold ${input} outline-none`} />
              ) : (
                <p className={`text-sm font-bold ${text} cursor-text hover:bg-black/5 dark:hover:bg-white/5 rounded px-1 -mx-1 transition-colors`} onClick={() => setEditingMetadataId(artwork.id)}>{artwork.artwork_date || '-'}</p>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <div className={`mt-1 p-2 rounded-xl border ${border} ${lightsOn ? 'bg-white' : 'bg-neutral-900'} h-fit shadow-sm`}><Layers size={14} className="opacity-40" /></div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-widest ${subtext} opacity-60`}>Medium & Dimensions</label>
                {editingMetadataId === artwork.id ? (
                  <div className="space-y-2">
                    <input type="text" value={tempMetadata.medium} onChange={e => setTempMetadata(prev => ({ ...prev, medium: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleMetadataSave(); if (e.key === 'Escape') setEditingMetadataId(null); }} className={`w-full px-3 py-1.5 rounded-lg border ${border} text-xs font-semibold ${input}`} />
                    <input type="text" value={tempMetadata.dimensions} onChange={e => setTempMetadata(prev => ({ ...prev, dimensions: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleMetadataSave(); if (e.key === 'Escape') setEditingMetadataId(null); }} className={`w-full px-3 py-1.5 rounded-lg border ${border} text-xs font-mono font-semibold ${input}`} />
                  </div>
                ) : (
                  <div className="space-y-1.5 cursor-text hover:bg-black/5 dark:hover:bg-white/5 rounded px-1 -mx-1 transition-colors" onClick={() => setEditingMetadataId(artwork.id)}>
                    <p className={`text-sm font-bold ${text} leading-tight`}>{artwork.artwork_medium || '-'}</p>
                    <p className={`text-[11px] font-mono ${subtext} opacity-80`}>{artwork.artwork_dimensions || '-'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(artwork.artwork_type as string) === 'sculpture' && (
        <>
          <div className="mt-6 space-y-5">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${subtext}`}>GLB Model Rotation</p>
              <div className="flex items-center gap-8 px-4">
                  {['Y', 'X', 'Z'].map((axis, index) => (
                      <div key={axis} className="flex-1 flex flex-col items-center">
                          <button onClick={() => handleGlbAxisRotate(index as 0 | 1 | 2)} className={`w-full aspect-square flex items-center justify-center rounded-lg border transition-all ${lightsOn ? 'bg-neutral-50/50 border-neutral-200/60 hover:bg-white' : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'} ${text}`}><RefreshCw size={15}/></button>
                          <span className={`text-[11px] font-medium mt-3 ${subtext}`}>{axis}: {glbPreviewRotation[index]}°</span>
                      </div>
                  ))}
              </div>
          </div>
          <div className="mt-6 space-y-5">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${subtext}`}>Sculpture Scale</p>
              <div className={`flex items-center h-12 rounded-xl border ${lightsOn ? 'bg-neutral-50/50 border-neutral-200/60' : 'bg-neutral-800'}`}>
                  <button onClick={() => handleScaleChange(-0.2)} className={`w-12 h-full flex items-center justify-center transition-colors hover:bg-neutral-200/30 ${text}`}><Minus size={14} strokeWidth={3} className="opacity-80" /></button>
                  <div className="flex-1 text-center"><span className={`text-sm font-bold tracking-tight ${text}`}>{Math.round(localScale * 100)}%</span></div>
                  <button onClick={() => handleScaleChange(0.2)} className={`w-12 h-full flex items-center justify-center transition-colors hover:bg-neutral-200/30 ${text}`}><Plus size={14} strokeWidth={3} className="opacity-80" /></button>
              </div>
          </div>
          <div className="mt-6 space-y-5">
            <p className={`text-[10px] font-bold uppercase ${subtext}`}>Material Presets</p>
            <div className="grid grid-cols-2 gap-2">
                {MATERIAL_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => handleSaveMaterial(preset.id, preset.config)} className={`flex items-center gap-2 p-1.5 rounded border text-left transition-all ${selectedMaterialPresetId === preset.id ? (lightsOn ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-100 bg-white text-neutral-900') : `${border} ${controlBgClass}`} `}>
                        <span className="w-2.5 h-2.5 rounded-full border border-gray-400" style={{ backgroundColor: preset.iconColor }}></span>
                        <span className="text-[10px] font-bold uppercase tracking-tight">{preset.name}</span>
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
