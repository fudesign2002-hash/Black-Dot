import React from 'react';
import { X, Cpu, Info, Loader2, Focus, Check } from 'lucide-react'; // NEW: Import Focus icon and Check
import { FirebaseArtwork } from '../../types';

interface DevToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    panelBg: string;
  };
  isLoading: boolean;
  activeExhibitionTitle: string;
  activeZoneName: string;
  focusedArtwork: FirebaseArtwork | null;
  isEditorMode: boolean;
  // FIX: Added 'admin' to the activeEditorTab type.
  activeEditorTab: 'lighting' | 'layout' | 'artworks' | 'admin';
  selectedArtworkTitle: string;
  fps: number; // NEW: FPS prop
}

const DevToolsPanel: React.FC<DevToolsPanelProps> = React.memo(({
  isOpen,
  onClose,
  theme,
  isLoading,
  activeExhibitionTitle,
  activeZoneName,
  focusedArtwork,
  isEditorMode,
  activeEditorTab,
  selectedArtworkTitle,
  fps,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-4 right-4 z-50 pointer-events-none">
      <div
        className={`w-full max-w-sm flex flex-col rounded-lg shadow-xl overflow-hidden pointer-events-auto ${theme.panelBg} border ${theme.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-3 border-b flex items-center justify-between ${theme.border}`}>
          <div className="flex items-center gap-2">
            <Cpu className={`w-5 h-5 opacity-70 ${theme.text}`} />
            <div>
              <h3 className={`text-base font-serif font-bold ${theme.text}`}>Dev Tools</h3>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded-full hover:bg-black/5 ${theme.text}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-xs font-mono space-y-2">
          <div className="flex justify-between items-center">
            <span className={`${theme.subtext}`}>FPS:</span>
            <span className={`${theme.text} font-bold`}>{fps}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className={`${theme.subtext}`}>Loading:</span>
            <span className={`${theme.text} flex items-center gap-1 ${isLoading ? 'text-amber-500' : 'text-green-500'}`}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isLoading ? 'Active' : 'Idle'}
            </span>
          </div>

          <div className="border-t pt-2 mt-2 space-y-1 ${theme.border}">
            <p className={`${theme.subtext} flex items-center gap-2`}><Info className="w-4 h-4" /> Current State</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between">
                <span className={`${theme.subtext}`}>Exhibition:</span>
                <span className={`${theme.text} truncate max-w-[60%]`}>{activeExhibitionTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${theme.subtext}`}>Zone:</span>
                <span className={`${theme.text} truncate max-w-[60%]`}>{activeZoneName}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-2 mt-2 space-y-1 ${theme.border}">
            <p className={`${theme.subtext} flex items-center gap-2`}><Focus className="w-4 h-4" /> Proximity Focus</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between">
                <span className={`${theme.subtext}`}>Artwork:</span>
                <span className={`${theme.text} truncate max-w-[60%]`}>{focusedArtwork ? focusedArtwork.title : 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${theme.subtext}`}>Type:</span>
                <span className={`${theme.text}`}>{focusedArtwork ? focusedArtwork.artwork_type : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-2 mt-2 space-y-1 ${theme.border}">
            <p className={`${theme.subtext} flex items-center gap-2`}><Info className="w-4 h-4" /> Editor State</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between">
                <span className={`${theme.subtext}`}>Mode:</span>
                <span className={`${theme.text} ${isEditorMode ? 'text-cyan-500' : 'text-neutral-500'}`}>{isEditorMode ? 'Active' : 'Inactive'}</span>
              </div>
              {isEditorMode && (
                <>
                  <div className="flex justify-between">
                    <span className={`${theme.subtext}`}>Tab:</span>
                    <span className={`${theme.text} capitalize`}>{activeEditorTab}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${theme.subtext}`}>Selected Artwork:</span>
                    <span className={`${theme.text} truncate max-w-[60%]`}>{selectedArtworkTitle || 'None'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* NEW: AI Studio Link */}
          <div className="border-t pt-2 mt-2 space-y-1 ${theme.border}">
            <p className={`${theme.subtext} flex items-center gap-2`}><Info className="w-4 h-4" /> Resources</p>
            <div className="ml-4">
              <a
                href="https://aistudio.google.com/apps/drive/1Uqc_LDgzoFJilBq--qzBfHFoVFW9_79_?showPreview=true&showAssistant=true"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs ${theme.text} hover:underline block`}
              >
                AI Studio Link
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DevToolsPanel;