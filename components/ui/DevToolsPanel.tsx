import React, { useState, useEffect, useCallback, useRef } from 'react'; // NEW: Import useRef, useEffect, useCallback
import { X, Cpu, Info, Loader2, Focus, Check, Users, AlertCircle } from 'lucide-react'; // NEW: Import AlertCircle
import { FirebaseArtwork } from '../../types';

interface DevToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    panelBg: string;
    input: string; // FIX: Add input property to uiConfig type
  };
  isLoading: boolean;
  activeExhibitionTitle: string;
  activeZoneName: string;
  focusedArtwork: FirebaseArtwork | null;
  isEditorMode: boolean;
  activeEditorTab: 'lighting' | 'scene' | 'layout' | 'artworks' | 'admin';
  selectedArtworkTitle: string;
  fps: number;
  onlineUsers: number;
  setOnlineUsers: (users: number) => void;
  zoneCapacity: number;
  isDebugMode: boolean; // NEW: Add isDebugMode prop
  setIsDebugMode: (debug: boolean) => void; // NEW: Add setIsDebugMode prop
  isSnapshotEnabled: boolean; // NEW: Add isSnapshotEnabled prop
  onToggleSnapshot: (enabled: boolean) => void; // NEW: Add onToggleSnapshot prop
  effectRegistryError: string | null; // NEW: Add effectRegistryError prop
}

const DevToolsPanel: React.FC<DevToolsPanelProps> = React.memo(({
  isOpen,
  onClose,
  uiConfig,
  isLoading,
  activeExhibitionTitle,
  activeZoneName,
  focusedArtwork,
  isEditorMode,
  activeEditorTab,
  selectedArtworkTitle,
  fps,
  onlineUsers,
  setOnlineUsers,
  zoneCapacity,
  isDebugMode, // NEW: Destructure isDebugMode
  setIsDebugMode, // NEW: Destructure setIsDebugMode
  isSnapshotEnabled, // NEW: Destructure isSnapshotEnabled
  onToggleSnapshot, // NEW: Destructure onToggleSnapshot
  effectRegistryError, // NEW: Destructure effectRegistryError
}) => {
  const panelRef = useRef<HTMLDivElement>(null); // NEW: Ref for the panel
  const [position, setPosition] = useState({ x: 0, y: 0 }); // NEW: State for panel position
  const [isDragging, setIsDragging] = useState(false); // NEW: State for dragging status
  const dragStartOffset = useRef({ x: 0, y: 0 }); // NEW: Ref to store drag start offset

  // NEW: Calculate initial position on mount/open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      // Calculate initial position to be bottom-right, respecting padding
      const initialX = window.innerWidth - panelRef.current.offsetWidth - 16; // 16px from right (bottom-4 / right-4 implies 16px)
      const initialY = window.innerHeight - panelRef.current.offsetHeight - 16; // 16px from bottom
      setPosition({ x: initialX, y: initialY });
    }
  }, [isOpen]);

  // NEW: Handle dragging
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (!panelRef.current) return;
    setIsDragging(true);
    // Store offset from mouse position to panel's top-left corner
    dragStartOffset.current = {
      x: e.clientX - panelRef.current.getBoundingClientRect().left,
      y: e.clientY - panelRef.current.getBoundingClientRect().top,
    };
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    document.body.style.cursor = 'grabbing';
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: PointerEvent) => {
      // Calculate new position based on mouse movement and initial offset
      const newX = e.clientX - dragStartOffset.current.x;
      const newY = e.clientY - dragStartOffset.current.y;
      setPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);

    return () => {
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', handleDragEnd);
    };
  }, [isDragging]);


  if (!isOpen) return null;

  const onlineUserOptions = [20, 50, 100, 150, 200, 250, 500, 1000, 2500, 5000];

  return (
    <div 
      ref={panelRef} // NEW: Attach ref
      className={`fixed z-50 pointer-events-auto transition-all duration-200 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`} // NEW: Changed to fixed, removed bottom/right, added transition
      style={{ left: position.x, top: position.y }} // NEW: Control position via inline style
      onClick={(e) => e.stopPropagation()} // Prevent closing parent modals/panels
    >
      <div
        className={`w-full max-w-sm flex flex-col rounded-lg shadow-xl overflow-hidden ${uiConfig.panelBg} border ${uiConfig.border}`}
      >
        <div 
          className={`p-3 border-b flex items-center justify-between ${uiConfig.border} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} // NEW: Added cursor styles
          onPointerDown={handleDragStart} // NEW: Make header draggable
        >
          <div className="flex items-center gap-2">
            <Cpu className={`w-5 h-5 opacity-70 ${uiConfig.text}`} />
            <div>
              <h3 className={`text-base font-serif font-bold ${uiConfig.text}`}>Dev Tools</h3>
            </div>
          </div>
          <button onClick={onClose} className={`p-1 rounded-full hover:bg-black/5 ${uiConfig.text}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-xs font-mono space-y-2">
          <div className="flex justify-between items-center">
            <span className={`${uiConfig.subtext}`}>FPS:</span>
            <span className={`${uiConfig.text} font-bold`}>{fps}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className={`${uiConfig.subtext}`}>Loading:</span>
            <span className={`${uiConfig.text} flex items-center gap-1 ${isLoading ? 'text-amber-500' : 'text-green-500'}`}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isLoading ? 'Active' : 'Idle'}
            </span>
          </div>

          {/* NEW: Firebase Snapshots Toggle */}
          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Cpu className="w-4 h-4" /> Firebase Snapshots</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between items-center">
                <span className={`${uiConfig.subtext}`}>Status:</span>
                <button
                  onClick={() => onToggleSnapshot(!isSnapshotEnabled)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    isSnapshotEnabled
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isSnapshotEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>

          {/* NEW: Effect Registry Status */}
          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Cpu className="w-4 h-4" /> Effect Registry</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between items-center">
                <span className={`${uiConfig.subtext}`}>Status:</span>
                {effectRegistryError ? (
                  <span className={`${uiConfig.text} flex items-center gap-1 text-red-500`}>
                    <AlertCircle className="w-4 h-4" /> Error
                  </span>
                ) : (
                  <span className={`${uiConfig.text} flex items-center gap-1 ${isLoading ? 'text-amber-500' : 'text-green-500'}`}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isLoading ? 'Loading' : 'Loaded'}
                  </span>
                )}
              </div>
              {effectRegistryError && (
                <div className="text-red-500 text-xs mt-1 break-words max-w-full">
                  {effectRegistryError}
                </div>
              )}
            </div>
          </div>


          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Users className="w-4 h-4" /> Online Users</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between items-center">
                <span className={`${uiConfig.subtext}`}>Current:</span>
                <span className={`${uiConfig.text} font-bold`}>{onlineUsers} / {zoneCapacity}</span>
              </div>
              <div className="flex justify-between items-center">
                <label htmlFor="online-users-select" className={`${uiConfig.subtext}`}>Set for test:</label>
                <select
                  id="online-users-select"
                  value={onlineUsers}
                  onChange={(e) => setOnlineUsers(Number(e.target.value))}
                  className={`px-2 py-1 rounded-md text-xs ${uiConfig.input} max-w-[100px]`}
                >
                  {onlineUserOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Info className="w-4 h-4" /> Current State</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between">
                <span className={`${uiConfig.subtext}`}>Exhibition:</span>
                <span className={`${uiConfig.text} truncate max-w-[60%]`}>{activeExhibitionTitle}</span>
              </div>
              {/* REMOVED: Zone display */}
            </div>
          </div>

          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Focus className="w-4 h-4" /> Proximity Focus</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between">
                <span className={`${uiConfig.subtext}`}>Artwork:</span>
                <span className={`${uiConfig.text} truncate max-w-[60%]`}>{focusedArtwork ? focusedArtwork.title : 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className={`${uiConfig.subtext}`}>Type:</span>
                <span className={`${uiConfig.text}`}>{focusedArtwork ? focusedArtwork.artwork_type : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Info className="w-4 h-4" /> Editor State</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between">
                <span className={`${uiConfig.subtext}`}>Mode:</span>
                <span className={`${uiConfig.text} ${isEditorMode ? 'text-cyan-500' : 'text-neutral-500'}`}>{isEditorMode ? 'Active' : 'Inactive'}</span>
              </div>
              {isEditorMode && (
                <React.Fragment>
                  <div className="flex justify-between">
                    <span className={`${uiConfig.subtext}`}>Tab:</span>
                    <span className={`${uiConfig.text} capitalize`}>{activeEditorTab}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${uiConfig.subtext}`}>Selected Artwork:</span>
                    <span className={`${uiConfig.text} truncate max-w-[60%]`}>{selectedArtworkTitle || 'None'}</span>
                  </div>
                </React.Fragment>
              )}
            </div>
          </div>

          {/* NEW: Debug Mode Toggle */}
          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Cpu className="w-4 h-4" /> Debug Mode</p>
            <div className="ml-4 space-y-0.5">
              <div className="flex justify-between items-center">
                <span className={`${uiConfig.subtext}`}>Status:</span>
                <button
                  // FIX: Pass direct boolean value to setIsDebugMode instead of functional updater
                  onClick={() => setIsDebugMode(!isDebugMode)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    isDebugMode
                      ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                      : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {isDebugMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>


          <div className={`border-t pt-2 mt-2 space-y-1 ${uiConfig.border}`}>
            <p className={`${uiConfig.subtext} flex items-center gap-2`}><Info className="w-4 h-4" /> Resources</p>
            <div className="ml-4 space-y-1">
              {/* REMOVED: AI Studio Link */}
              <a
                href="https://tinyurl.com/mvsknwf3"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs ${uiConfig.text} hover:underline block`}
              >
                CMS Link
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DevToolsPanel;