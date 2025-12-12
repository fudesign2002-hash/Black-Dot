

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Activity,Waves,Zap,Image, FlameKindling, Palette, Camera, Sparkles, X, Loader2, AlertCircle, Snowflake, Leaf, CloudRain, Wind, MoonStar,Bubbles, Umbrella,PartyPopper } from 'lucide-react'; // Icons for effects and controls
import { SimplifiedLightingConfig, SimplifiedLightingPreset, ZoneLightingDesign, EffectRegistryType } from '../../types';

interface SceneTabProps {
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
  };
  lightingConfig: SimplifiedLightingConfig;
  onUpdateLighting: (newConfig: SimplifiedLightingConfig) => void;
  fullZoneLightingDesign: ZoneLightingDesign;
  currentZoneNameForEditor: string;
  activeExhibitionBackgroundUrl?: string;
  useExhibitionBackground: boolean;
  activeZoneTheme: string | null;
  onUpdateZoneTheme: (themeName: string | null) => Promise<void>;
  effectRegistry: EffectRegistryType | null; // NEW: Add effectRegistry prop
  isEffectRegistryLoading: boolean; // NEW: Add isEffectRegistryLoading prop
  activeZoneGravity: number | undefined; // NEW: Add activeZoneGravity
  onUpdateZoneGravity: (gravity: number | undefined) => Promise<void>; // NEW: Add onUpdateZoneGravity
}

// NEW: Mapping for Lucide React icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MoonStar: MoonStar,
  Snowflake: Snowflake,
  Leaf: Leaf, // Assuming 'Autumn' theme uses a leaf icon
  CloudRain: CloudRain,
  Wind: Wind, 
  Bubbles: Bubbles,
  Umbrella: Umbrella,
  PartyPopper: PartyPopper,
  FlameKindling: FlameKindling,
  Zap:Zap,
  Waves: Waves,
  Activity: Activity,
};


const SceneTab: React.FC<SceneTabProps> = React.memo(({
  uiConfig,
  lightingConfig,
  onUpdateLighting,
  fullZoneLightingDesign,
  currentZoneNameForEditor, // Keep for context/labels if needed
  activeExhibitionBackgroundUrl,
  useExhibitionBackground,
  activeZoneTheme,
  onUpdateZoneTheme,
  effectRegistry, // NEW: Destructure effectRegistry
  isEffectRegistryLoading, // NEW: Destructure isEffectRegistryLoading
  activeZoneGravity, // NEW: Destructure activeZoneGravity
  onUpdateZoneGravity, // NEW: Destructure onUpdateZoneGravity
}) => {
    const { lightsOn, border, subtext } = uiConfig;
    const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';
    
    // Controlled state for the input's value prop, updated from lightingConfig or onBlur/debounce end
    const [localFloorColor, setLocalFloorColor] = useState(lightingConfig.floorColor || '#000000');
    // State for immediate visual feedback on the text label next to the color picker
    const [displayedFloorColorHex, setDisplayedFloorColorHex] = useState(lightingConfig.floorColor || '#000000');
    const floorColorDebounceRef = useRef<number | null>(null);
    const isFloorEditingRef = useRef(false);

    // Background color local state and debounce
    const [localBackgroundColor, setLocalBackgroundColor] = useState(lightingConfig.backgroundColor || '#ffffff');
    const [displayedBackgroundColorHex, setDisplayedBackgroundColorHex] = useState(lightingConfig.backgroundColor || '#ffffff');
    const backgroundColorDebounceRef = useRef<number | null>(null);
    const isBackgroundEditingRef = useRef(false);
    // Validation error states for hex inputs
    const [floorColorError, setFloorColorError] = useState<string | null>(null);
    const [backgroundColorError, setBackgroundColorError] = useState<string | null>(null);


    // Sync local states with prop when lightingConfig.floorColor or background changes from outside
    useEffect(() => {
      const newColor = lightingConfig.floorColor || '#000000';
      setLocalFloorColor(newColor);
      setDisplayedFloorColorHex(newColor);
    }, [lightingConfig.floorColor]);

    useEffect(() => {
      const newBgColor = lightingConfig.backgroundColor || '#ffffff';
      setLocalBackgroundColor(newBgColor);
      setDisplayedBackgroundColorHex(newBgColor);
    }, [lightingConfig.backgroundColor]);
    const normalizeHex = (hex: string): string | null => {
      if (!hex) return null;
      let h = hex.trim().toUpperCase();
      if (!h.startsWith('#')) h = `#${h}`;
      const m = /^#([0-9A-F]{3}|[0-9A-F]{6})$/.exec(h);
      if (!m) return null;
      if (m[1].length === 3) {
        const r = m[1][0];
        const g = m[1][1];
        const b = m[1][2];
        return `#${r}${r}${g}${g}${b}${b}`;
      }
      return h;
    };

    const LOG_SCENETAB = false;

    // Text input handler: update local state; persist only if not actively editing
    const handleLightingTextChange = useCallback((key: keyof SimplifiedLightingConfig, value: string) => {
      const input = value || '';
      const normalized = normalizeHex(input);
      if (key === 'floorColor') {
        setDisplayedFloorColorHex(input.toUpperCase());
        if (normalized) {
          setLocalFloorColor(normalized);
          setFloorColorError(null);
          if (!isFloorEditingRef.current) {
            if (floorColorDebounceRef.current) clearTimeout(floorColorDebounceRef.current);
            floorColorDebounceRef.current = window.setTimeout(() => {
              onUpdateLighting({ ...lightingConfig, floorColor: normalized });
            }, 250);
          }
        } else {
          setFloorColorError('Invalid hex color');
        }
      } else if (key === 'backgroundColor') {
        setDisplayedBackgroundColorHex(input.toUpperCase());
        if (normalized) {
          setLocalBackgroundColor(normalized);
          setBackgroundColorError(null);
          if (!isBackgroundEditingRef.current) {
            if (backgroundColorDebounceRef.current) clearTimeout(backgroundColorDebounceRef.current);
            backgroundColorDebounceRef.current = window.setTimeout(() => {
              onUpdateLighting({ ...lightingConfig, backgroundColor: normalized });
            }, 250);
          }
        } else {
          setBackgroundColorError('Invalid hex color');
        }
      } else {
        onUpdateLighting({ ...lightingConfig, [key]: input });
      }
    }, [onUpdateLighting, lightingConfig]);

    // Color picker handler: commit immediately (with debounce) to support dragging
    const handleLightingPickerChange = useCallback((key: keyof SimplifiedLightingConfig, value: string) => {
      const normalized = normalizeHex(value);
      if (!normalized) return;
      if (key === 'floorColor') {
        setDisplayedFloorColorHex(normalized);
        setLocalFloorColor(normalized);
        setFloorColorError(null);
        if (floorColorDebounceRef.current) clearTimeout(floorColorDebounceRef.current);
        floorColorDebounceRef.current = window.setTimeout(() => {
          onUpdateLighting({ ...lightingConfig, floorColor: normalized });
        }, 150);
      } else if (key === 'backgroundColor') {
        setDisplayedBackgroundColorHex(normalized);
        setLocalBackgroundColor(normalized);
        setBackgroundColorError(null);
        if (backgroundColorDebounceRef.current) clearTimeout(backgroundColorDebounceRef.current);
        backgroundColorDebounceRef.current = window.setTimeout(() => {
          onUpdateLighting({ ...lightingConfig, backgroundColor: normalized });
        }, 150);
      } else {
        onUpdateLighting({ ...lightingConfig, [key]: normalized });
      }
    }, [onUpdateLighting, lightingConfig]);

    const handleClearColors = useCallback(() => {
      if (floorColorDebounceRef.current) clearTimeout(floorColorDebounceRef.current);
      if (backgroundColorDebounceRef.current) clearTimeout(backgroundColorDebounceRef.current);
      const newConfig: SimplifiedLightingConfig = { ...lightingConfig, floorColor: undefined, backgroundColor: undefined } as any;
      onUpdateLighting(newConfig);
      // Local inputs will sync from props when lightingConfig updates via useEffect; provide immediate visual fallback
      setLocalFloorColor('#000000');
      setDisplayedFloorColorHex('#000000');
      setFloorColorError(null);
      setLocalBackgroundColor('#ffffff');
      setDisplayedBackgroundColorHex('#ffffff');
      setBackgroundColorError(null);
    }, [onUpdateLighting, lightingConfig]);

    // Boolean toggles or non-color fields
    const handleLightingBooleanChange = useCallback((key: keyof SimplifiedLightingConfig, value: boolean) => {
      onUpdateLighting({ ...lightingConfig, [key]: value });
    }, [onUpdateLighting, lightingConfig]);

    // Handle blur event for floorColor to ensure immediate save when losing focus
    const handleFloorColorBlur = useCallback(() => {
      if (floorColorDebounceRef.current) {
        clearTimeout(floorColorDebounceRef.current);
      }
      const normalized = normalizeHex(displayedFloorColorHex);
      if (normalized) {
        setLocalFloorColor(normalized);
        setFloorColorError(null);
        
        onUpdateLighting({ ...lightingConfig, floorColor: normalized });
      } else {
        setFloorColorError('Invalid hex color');
      }
      isFloorEditingRef.current = false;
    }, [onUpdateLighting, lightingConfig, displayedFloorColorHex]);

    const handleBackgroundColorBlur = useCallback(() => {
      if (backgroundColorDebounceRef.current) {
        clearTimeout(backgroundColorDebounceRef.current);
      }
      const normalized = normalizeHex(displayedBackgroundColorHex);
      if (normalized) {
        setLocalBackgroundColor(normalized);
        setBackgroundColorError(null);
        
        onUpdateLighting({ ...lightingConfig, backgroundColor: normalized });
      } else {
        setBackgroundColorError('Invalid hex color');
      }
      isBackgroundEditingRef.current = false;
    }, [onUpdateLighting, lightingConfig, displayedBackgroundColorHex]);

    const ControlRow: React.FC<{ label: string; value?: string; children: React.ReactNode }> = ({ label, value, children }) => (
        <div className={`p-4 rounded-xl border flex flex-col items-start gap-3 ${border} ${controlBgClass}`}>
            <div className="w-full flex justify-between items-center">
                <p className="text-sm font-medium">{label}</p>
                {value && <p className="text-[10px] font-mono uppercase opacity-50">{value}</p>}
            </div>
            {children}
        </div>
    );

    interface ColorFieldProps {
      label: string;
      icon?: React.ComponentType<{ className?: string }>;
      pickerValue: string;
      hexValue: string;
      onPickerChange: (value: string) => void;
      onTextChange: (value: string) => void;
      onBlur: () => void;
      error?: string | null;
      lightsOn: boolean;
      disabled?: boolean;
      textClass: string;
    }

    const ColorField: React.FC<ColorFieldProps> = ({
      label,
      icon: Icon,
      pickerValue,
      hexValue,
      onPickerChange,
      onTextChange,
      onBlur,
      error,
      lightsOn,
      disabled = false,
      textClass,
    }) => (
      <div className={`w-full rounded-xl border px-3 py-3 ${controlBgClass}`}>
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className="w-4 h-4" />}
          <span className="text-sm font-semibold">{label}</span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => { if (!disabled) onPickerChange(e.target.value); }}
            onFocus={() => { (label === 'Floor' ? isFloorEditingRef : isBackgroundEditingRef).current = true; }}
            onMouseDown={(e) => { e.stopPropagation(); }}
            className={`w-10 h-10 rounded-md border-2 cursor-pointer transition-all duration-150 hover:scale-[1.02] ${lightsOn ? 'border-neutral-300 shadow-sm' : 'border-neutral-700 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled}
            aria-label={`${label} color`}
          />
          <input
            type="text"
            value={hexValue}
            onChange={(e) => { if (!disabled) onTextChange(e.target.value); }}
            onFocus={() => { (label === 'Floor' ? isFloorEditingRef : isBackgroundEditingRef).current = true; }}
            onBlur={onBlur}
            onMouseDown={(e) => { e.stopPropagation(); }}
            className={`w-24 text-xs font-mono px-2 py-1 rounded border ${error ? 'border-red-500' : lightsOn ? 'border-neutral-300 bg-white' : 'border-neutral-700 bg-neutral-900'} ${textClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled}
            maxLength={7}
            placeholder="#FFFFFF"
            title={`Edit ${label.toLowerCase()} hex code`}
          />
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        {disabled && label === 'Background' && (
          <p className="text-xs text-neutral-500 mt-2">Background is disabled when "Use Exhibition Background" is enabled.</p>
        )}
      </div>
    );

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
            <div className="space-y-4">
                {/* NEW: Use Exhibition Background Toggle */}
                <ControlRow label="Use Exhibition Background" value={useExhibitionBackground ? 'ON' : 'OFF'}>
                  <label htmlFor="exhibition-background-toggle" className="relative inline-flex items-center cursor-pointer">
                      <input
                          type="checkbox"
                          id="exhibition-background-toggle"
                          className="sr-only peer"
                          checked={useExhibitionBackground}
                          onChange={(e) => handleLightingBooleanChange('useExhibitionBackground', e.target.checked)}
                          disabled={!activeExhibitionBackgroundUrl} // Disable if no URL is provided
                      />
                      <div className="w-14 h-8 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[6px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                      <span className={`ml-3 text-sm font-medium ${uiConfig.text}`}>
                          {useExhibitionBackground ? 'Enabled' : 'Disabled'}
                      </span>
                  </label>
                  {!activeExhibitionBackgroundUrl && (
                    <div className="flex items-center text-amber-500 text-xs mt-2">
                        <Image className="w-4 h-4 mr-1" /> No background URL set for this exhibition.
                    </div>
                  )}
                </ControlRow>

                {/* Floor + Background Color selectors, always visible */}
                <ControlRow label="Colors">
                  <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ColorField
                      label="Floor"
                      icon={Palette}
                      pickerValue={localFloorColor}
                      hexValue={displayedFloorColorHex}
                      onPickerChange={(value) => handleLightingPickerChange('floorColor', value)}
                      onTextChange={(value) => handleLightingTextChange('floorColor', value)}
                      onBlur={handleFloorColorBlur}
                      error={floorColorError}
                      lightsOn={lightsOn}
                      textClass={uiConfig.text}
                    />

                    <ColorField
                      label="Background"
                      icon={Palette}
                      pickerValue={localBackgroundColor}
                      hexValue={displayedBackgroundColorHex}
                                onPickerChange={(value) => handleLightingPickerChange('backgroundColor', value)}
                                onTextChange={(value) => handleLightingTextChange('backgroundColor', value)}
                                onBlur={handleBackgroundColorBlur}
                                disabled={useExhibitionBackground}
                      error={backgroundColorError}
                      lightsOn={lightsOn}
                      textClass={uiConfig.text}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClearColors(); }}
                      className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300 text-neutral-800"
                      title="Reset colors to zone defaults"
                    >
                      Reset Colors
                    </button>
                  </div>
                </ControlRow>

                {/* MODIFIED: Theme Selection Section - now uses a grid of cards */}
                <div className={`flex-shrink-0 pt-4 mt-4 border-t ${border}`}>
                    <p className={`text-[10px] font-bold tracking-[0.2em] uppercase ${subtext}`}>Environment Theme</p>
                    {isEffectRegistryLoading ? (
                      <div className="flex items-center text-cyan-500 text-xs mt-2">
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Loading effects...
                      </div>
                    ) : (effectRegistry ? (
                      <div className="max-w-fit mx-auto"> {/* Added wrapper div for centering */}
                        <div className="grid grid-cols-4 gap-3 mt-2"> {/* Changed to grid with 4 columns and decreased gap */}
                        {Object.keys(effectRegistry).map((effectName) => {
                            const effectData = effectRegistry[effectName];
                            // FIX: Access icon property correctly from effectData
                            const iconName = effectData.icon;
                            // FIX: Access light property correctly from env object
                            const lightSetting = effectData.env.light; // <-- Get light setting here

                            const IconComponent = ICON_MAP[iconName] || Sparkles; // Fallback to Sparkles

                            const isSelected = activeZoneTheme === effectName;
                            
                            // Determine if this effect should be hidden
                            const isHiddenForLightMode = lightSetting === 'off' && lightsOn; // <-- Conditional logic

                            if (isHiddenForLightMode) {
                              return null; // Don't render the button if it should be hidden
                            }

                            const cardBgClass = isSelected
                              ? (lightsOn ? 'bg-neutral-900' : 'bg-white')
                              : (lightsOn ? 'bg-neutral-100 hover:bg-neutral-200' : 'bg-neutral-800 hover:bg-neutral-700');
                            const cardTextClass = isSelected
                              ? (lightsOn ? 'text-white' : 'text-neutral-900')
                              : (lightsOn ? 'text-neutral-700' : 'text-white');
                            const iconColorClass = isSelected
                              ? (lightsOn ? 'text-cyan-400' : 'text-cyan-500') // Selected icon color
                              : cardTextClass; // Unselected icon color matches text

                            const cardShadowClass = isSelected
                              ? (lightsOn ? 'shadow-[0_0_15px_rgba(0,0,0,0.1)]' : 'shadow-[0_0_15px_rgba(0,192,255,0.3)]')
                              : ''; // No shadow for unselected

                            return (
                                <button
                                key={effectName}
                                onClick={() => onUpdateZoneTheme(effectName)}
                                className={`w-24 h-24 flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-colors duration-200 shadow-md ${cardBgClass} ${cardShadowClass}`}
                                >
                                <IconComponent className={`w-6 h-6 mb-2 ${iconColorClass}`} /> {/* Reduced icon size and margin */}
                                <span className={`text-xs font-bold uppercase text-center ${cardTextClass}`}> {/* Reduced text size */}
                                    {effectName}
                                </span>
                                </button>
                            );
                        })}
                        {/* Button to deactivate all effects (No Theme) */}
                        <button
                            onClick={() => onUpdateZoneTheme(null)}
                            className={`w-24 h-24 flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-colors duration-200 shadow-md 
                            ${activeZoneTheme === null
                                ? (lightsOn ? 'bg-neutral-900 shadow-[0_0_15px_rgba(0,0,0,0.1)]' : 'bg-white shadow-[0_0_15px_rgba(0,192,255,0.3)]') 
                                : (lightsOn ? 'bg-neutral-100 hover:bg-neutral-200' : 'bg-neutral-800 hover:bg-neutral-700')
                            }`}
                        >
                            <X className={`w-8 h-8 mb-2 ${activeZoneTheme === null ? (lightsOn ? 'text-red-600' : 'text-red-500') : (lightsOn ? 'text-neutral-700' : 'text-white')}`} /> {/* Reduced icon size and margin */}
                            <span className={`text-xs font-bold uppercase text-center ${activeZoneTheme === null ? (lightsOn ? 'text-red-600' : 'text-red-500') : (lightsOn ? 'text-neutral-700' : 'text-white')}`}> {/* Reduced text size */}
                                No Theme
                            </span>
                        </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-500 text-xs mt-2">
                          <AlertCircle className="w-4 h-4 mr-1" /> Failed to load effects.
                      </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default SceneTab;