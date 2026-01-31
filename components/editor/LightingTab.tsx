

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Sun, Moon, Sparkles, Image, Palette } from 'lucide-react';
import { SimplifiedLightingConfig, SimplifiedLightingPreset, ZoneLightingDesign } from '../../types';
import { ControlRow } from './EditorCommon';

interface LightingTabProps {
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
  exhibitionTitle?: string; // NEW: Add exhibition title for display
  isSandboxMode?: boolean; // NEW: Add sandbox mode support
}

const fixedSpotlightPalette = ['#FFFFFF', '#FFFBEB', '#FFDDDD', '#DDEEFF', '#E0FFEE', '#FFEECC', '#CCEEFF', '#FFCCEE', '#EEEEEE', '#FFEEAA'];

const LightingTab: React.FC<LightingTabProps> = React.memo(({
  uiConfig,
  lightingConfig,
  onUpdateLighting,
  fullZoneLightingDesign,
  currentZoneNameForEditor,
  exhibitionTitle, // NEW: Get exhibition title
  isSandboxMode = false, // NEW: default to false
}) => {
    const { lightsOn, border, subtext } = uiConfig;
    const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';
    
    // REMOVED: floorColor states and refs
    // REMOVED: const [localFloorColor, setLocalFloorColor] = useState(lightingConfig.floorColor || '#000000');
    // REMOVED: const [displayedFloorColorHex, setDisplayedFloorColorHex] = useState(lightingConfig.floorColor || '#000000');
    // REMOVED: const floorColorDebounceRef = useRef<number | null>(null);

    // REMOVED: Sync local states with prop when lightingConfig.floorColor changes from outside
    // REMOVED: useEffect(() => {
    // REMOVED:   const newColor = lightingConfig.floorColor || '#000000';
    // REMOVED:   setLocalFloorColor(newColor);
    // REMOVED:   setDisplayedFloorColorHex(newColor);
    // REMOVED: }, [lightingConfig.floorColor]);

    const handleLightingValueChange = useCallback((key: keyof SimplifiedLightingConfig, value: any) => {
      // REMOVED: For floorColor, we need special handling to avoid immediate re-renders
      // REMOVED: if (key === 'floorColor') {
      // REMOVED:   setDisplayedFloorColorHex(value); // Update text display immediately
      // REMOVED:
      // REMOVED:   if (floorColorDebounceRef.current) {
      // REMOVED:     clearTimeout(floorColorDebounceRef.current);
      // REMOVED:   }
      // REMOVED:   floorColorDebounceRef.current = window.setTimeout(() => {
      // REMOVED:     // This update will eventually flow back to localFloorColor via useEffect
      // REMOVED:     onUpdateLighting({ ...lightingConfig, [key]: value });
      // REMOVED:   }, 300); // Debounce floor color updates
      // REMOVED: } else {
        onUpdateLighting({ ...lightingConfig, [key]: value });
      // REMOVED: }
    }, [onUpdateLighting, lightingConfig]);

    // REMOVED: Handle blur event for floorColor to ensure immediate save when losing focus
    // REMOVED: const handleFloorColorBlur = useCallback(() => {
    // REMOVED:   if (floorColorDebounceRef.current) {
    // REMOVED:     clearTimeout(floorColorDebounceRef.current);
    // REMOVED:   }
    // REMOVED:   // Use the last value from displayedFloorColorHex as the final value to commit
    // REMOVED:   // This ensures the value committed is what the user visually saw
    // REMOVED:   onUpdateLighting({ ...lightingConfig, floorColor: displayedFloorColorHex });
    // REMOVED: }, [onUpdateLighting, lightingConfig, displayedFloorColorHex]);

    const handleSpotlightColorSelect = useCallback((color: string) => onUpdateLighting({ ...lightingConfig, spotlightMode: 'manual', manualSpotlightColor: color }), [onUpdateLighting, lightingConfig]);
    const applyPreset = useCallback((preset: SimplifiedLightingPreset) => onUpdateLighting({ ...lightingConfig, lightsOn: true, ambientIntensity: preset.ambientIntensity, colorTemperature: preset.colorTemperature, spotlightMode: 'manual', manualSpotlightColor: preset.manualSpotlightColor }), [onUpdateLighting, lightingConfig]);

    const availablePresets = fullZoneLightingDesign.recommendedPresets;

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
            {isSandboxMode && (
                <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-center gap-3 flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-cyan-500" />
                    <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500">Sandbox Mode</p>
                        <p className="text-[10px] opacity-70 leading-tight">Changes are temporary and stored in your local browser.</p>
                    </div>
                </div>
            )}
            <div className="space-y-4">
                <div className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
                    <div className="flex items-start gap-4 w-full">
                        <Sparkles size={18} className="text-cyan-500 mt-1 shrink-0" />
                        <div>
                            <h4 className="font-bold text-sm mb-2">Lighting Presets for "{exhibitionTitle || currentZoneNameForEditor}"</h4>
                            <p className="text-sm leading-relaxed opacity-60 mb-4">{fullZoneLightingDesign.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {availablePresets.map((preset: SimplifiedLightingPreset) => (
                                    <button key={preset.name} onClick={() => applyPreset(preset)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors ${(lightingConfig.colorTemperature === preset.colorTemperature && lightingConfig.ambientIntensity === preset.ambientIntensity && lightingConfig.manualSpotlightColor === preset.manualSpotlightColor) ? (lightsOn ? 'bg-neutral-900 text-white shadow-md' : 'bg-white text-neutral-900 shadow-md') : (lightsOn ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700' : 'bg-neutral-700 hover:bg-neutral-600 text-white')}`}>{preset.name}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <ControlRow label="Ambient Environment" value={`${lightingConfig.colorTemperature}K`} border={border} controlBgClass={controlBgClass}>
                    <div className="w-full flex items-center gap-3">
                        <span className="text-amber-500"><Sun size={14} className="opacity-60" /></span>
                        <input 
                            type="range" 
                            min="2700" 
                            max="7500" 
                            step="100" 
                            value={lightingConfig.colorTemperature} 
                            onChange={e => handleLightingValueChange('colorTemperature', Number(e.target.value))} 
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            className="w-full h-1 bg-gradient-to-r from-amber-500 to-blue-500 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-neutral-300 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:shadow-lg" 
                        />
                        <span className="text-blue-500"><Moon size={14} className="opacity-60" /></span>
                    </div>
                </ControlRow>
                <ControlRow label="Master Lights" value={lightingConfig.lightsOn ? 'ON' : 'OFF'} border={border} controlBgClass={controlBgClass}>
                    <label htmlFor="lights-on-toggle" className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            id="lights-on-toggle"
                            className="sr-only peer"
                            checked={lightingConfig.lightsOn}
                            onChange={(e) => handleLightingValueChange('lightsOn', e.target.checked)}
                        />
                        <div className="w-14 h-8 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[6px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-600"></div>
                        <span className={`ml-3 text-sm font-medium ${uiConfig.text}`}>
                            {lightingConfig.lightsOn ? 'Lights On' : 'Lights Off'}
                        </span>
                    </label>
                </ControlRow>

                {!lightingConfig.lightsOn && (
                  <ControlRow label="Spotlight Palette" border={border} controlBgClass={controlBgClass}>
                    <div className="w-full flex items-center justify-start gap-3 flex-wrap">
                        {fixedSpotlightPalette.map((color: string) => (
                            <button key={color} onClick={() => handleSpotlightColorSelect(color)} className={`w-10 h-10 rounded-full border-2 transition-all duration-200 ${lightingConfig.manualSpotlightColor === color && lightingConfig.spotlightMode === 'manual' ? 'border-cyan-500 scale-110 shadow-lg' : (lightsOn ? 'border-white hover:border-neutral-300' : 'border-neutral-900 hover:border-neutral-600')}`} style={{ backgroundColor: color }} title={`Set spotlight to ${color}`} />
                        ))}
                    </div>
                  </ControlRow>
                )}
            </div>
        </div>
    );
});

export default LightingTab;