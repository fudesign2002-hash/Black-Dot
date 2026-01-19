


import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Exhibition, ExhibitionArtItem, FirebaseArtwork } from '../../types'; // MODIFIED: Add ExhibitionArtItem and FirebaseArtwork
import { FileText, Layout, Calendar, MapPin, Clock, Ticket, Loader2, Check, Copy, Trophy, Orbit, Users as UsersIcon, Sun, Box, BarChart2, ExternalLink, BookOpen, Instagram, Globe } from 'lucide-react'; // MODIFIED: Add BarChart2, ExternalLink, BookOpen, Instagram, Globe
import AnalyticsDashboard from '../ui/AnalyticsDashboard'; // NEW: Import AnalyticsDashboard

interface AdminTabProps {
  uiConfig: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  activeExhibition: Exhibition;
  onUpdateExhibition: (exhibitionId: string, updatedFields: Partial<Exhibition>) => Promise<void>;
  currentLayout: ExhibitionArtItem[]; // NEW: Add currentLayout
  firebaseArtworks: FirebaseArtwork[]; // NEW: Add firebaseArtworks
  onlineCount?: number; // NEW: Real-time user count
}

const DEBOUNCE_DELAY = 700;

// NEW: Explicitly define the keys of Exhibition that are string or string | undefined
type ExhibitionEditableFieldKeys =
  'title' | 'subtitle' | 'overview' | 'dateFrom' | 'dateTo' |
  'venue' | 'hours' | 'admissionLink' | 'admission' | 'supportedBy' | 'exhibit_capacity' | 'exhibit_linktype'; // REMOVED: artist, dates, exhibit_poster

// FIX: Refactored InputFieldProps to be generic to prevent 'never' type errors
interface InputFieldProps<T extends ExhibitionEditableFieldKeys> {
  label: string;
  field: T; // Use generic T for field
  icon: React.ComponentType<{ className?: string }>;
  inputType?: string;
  isTextArea?: boolean;
  value: string; // MODIFIED: Use string instead of string | undefined
  onChange: (value: string, field: T) => void; // onChange uses generic T and string
  statusIcon: React.ReactNode;
  uiConfig: AdminTabProps['uiConfig'];
  className?: string;
}

// FIX: Refactored InputFieldComponent to be generic and explicitly return React.JSX.Element
function InputFieldComponent<T extends ExhibitionEditableFieldKeys>({
  label, field, icon: Icon, inputType = 'text', isTextArea = false, value, onChange, statusIcon, uiConfig, className
}: InputFieldProps<T>): React.JSX.Element { // Explicitly define return type as React.JSX.Element
  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  const displayValue = value || '';

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value; // MODIFIED: Allow empty strings instead of converting to undefined
    onChange(newValue, field);
  }, [onChange, field]);

  return (
    <div className={`p-4 rounded-xl border ${border} ${controlBgClass} ${className || ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 opacity-70 ${text}`} />
        <p className={`text-sm font-medium ${text}`}>{label}</p>
        <div className="ml-auto flex items-center gap-2">
          {statusIcon}
        </div>
      </div>
      {isTextArea ? (
        <textarea
          value={displayValue}
          onChange={handleInputChange}
          className={`w-full px-3 py-2 rounded-md text-xs ${input} h-24 resize-y`}
          rows={3}
        />
      ) : (
        <input
          type={inputType}
          value={displayValue}
          onChange={handleInputChange}
          className={`w-full px-3 py-2 rounded-md text-xs ${input}`}
        />
      )}
    </div>
  );
}

// FIX: Correctly type InputField using React.memo with the generic component.
const InputField: typeof InputFieldComponent = React.memo(InputFieldComponent) as typeof InputFieldComponent;

const AdminTab: React.FC<AdminTabProps> = React.memo(({ uiConfig, activeExhibition, onUpdateExhibition, currentLayout, firebaseArtworks, onlineCount = 0 }) => {
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false); // NEW: State for analytics dashboard
  // FIX: Type localExhibition with Record<ExhibitionEditableFieldKeys, string> to consistently use strings
  const [localExhibition, setLocalExhibition] = useState<Record<ExhibitionEditableFieldKeys, string>>(() => ({
    title: activeExhibition.title || '',
    subtitle: activeExhibition.subtitle || '',
    overview: activeExhibition.overview || '',
    dateFrom: activeExhibition.dateFrom || '',
    dateTo: activeExhibition.dateTo || '',
    venue: activeExhibition.venue || '',
    hours: activeExhibition.hours || '',
    admissionLink: activeExhibition.admissionLink || '',
    admission: activeExhibition.admission || '',
    supportedBy: activeExhibition.supportedBy || '',
    exhibit_capacity: String(activeExhibition.exhibit_capacity ?? 100),
    exhibit_linktype: activeExhibition.exhibit_linktype || 'tickets',
  }));
  // FIX: Type updateStatus with Partial<Record<ExhibitionEditableFieldKeys, ...>> to allow empty object initialization
  const [updateStatus, setUpdateStatus] = useState<Partial<Record<ExhibitionEditableFieldKeys, 'idle' | 'saving' | 'saved' | 'error'>>>({});
  // FIX: Type timeoutRefs with Partial<Record<ExhibitionEditableFieldKeys, number | undefined>> to allow empty object initialization
  const timeoutRefs = useRef<Partial<Record<ExhibitionEditableFieldKeys, number | undefined>>>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [embedOptions, setEmbedOptions] = useState({
      ranking: true,
      zeroGravity: true,
      userCount: true,
      lights: true,
      logo: true,
      exhibitInfo: true
  });

  const { lightsOn, text, subtext, border, input } = uiConfig;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  // NEW: Define handleUpdateStatus here
  // FIX: Update handleUpdateStatus signature to accept non-generic field
  const handleUpdateStatus = useCallback((
    field: ExhibitionEditableFieldKeys,
    status: 'idle' | 'saving' | 'saved' | 'error',
    duration: number = 2000
  ) => {
    setUpdateStatus(prev => ({ ...prev, [field]: status }));
    if (status === 'saved' || status === 'error') {
      if (timeoutRefs.current[field]) {
        clearTimeout(timeoutRefs.current[field]);
      }
      timeoutRefs.current[field] = window.setTimeout(() => {
        setUpdateStatus(prev => ({ ...prev, [field]: 'idle' }));
      }, duration) as unknown as number;
    }
  }, []);

  useEffect(() => {
    // FIX: Initialize local state with exhibition fields, handling potential undefined/empty values
    const initialLocalExhibition: Record<ExhibitionEditableFieldKeys, string> = {
      title: activeExhibition.title || '',
      subtitle: activeExhibition.subtitle || '',
      overview: activeExhibition.overview || '',
      dateFrom: activeExhibition.dateFrom || '',
      dateTo: activeExhibition.dateTo || '',
      venue: activeExhibition.venue || '',
      hours: activeExhibition.hours || '',
      admissionLink: activeExhibition.admissionLink || '',
      admission: activeExhibition.admission || '',
      supportedBy: activeExhibition.supportedBy || '',
      exhibit_capacity: String(activeExhibition.exhibit_capacity ?? 100),
      exhibit_linktype: activeExhibition.exhibit_linktype || 'tickets',
    };
    setLocalExhibition(initialLocalExhibition);
    // FIX: Clear updateStatus by setting an empty object, now compatible with Partial<Record>
    setUpdateStatus({});
    Object.values(timeoutRefs.current).forEach(clearTimeout);
    // FIX: Reset timeoutRefs.current to an empty object, now compatible with Partial<Record>
    timeoutRefs.current = {};
  }, [activeExhibition]);

  // FIX: Update handleChange signature to accept string and be generic
  const handleChange = useCallback(<T extends ExhibitionEditableFieldKeys>(
    value: string,
    field: T
  ) => {
    // FIX: Refactored state update to use the spread syntax for creating the new state.
    setLocalExhibition(prev => ({
      ...prev,
      [field]: value,
    }));
    // FIX: Call the defined handleUpdateStatus
    handleUpdateStatus(field, 'idle');

    if (timeoutRefs.current[field]) {
      clearTimeout(timeoutRefs.current[field]);
    }

    timeoutRefs.current[field] = window.setTimeout(async () => {
      if (activeExhibition.id) {
        // FIX: Call the defined handleUpdateStatus
        handleUpdateStatus(field, 'saving');
        try {
          // MODIFIED: Convert exhibit_capacity to number if it's the field being updated
          let updatedField: Partial<Exhibition>;
          if (field === 'exhibit_capacity') {
            const numValue = parseInt(value, 10);
            updatedField = { [field]: isNaN(numValue) ? 100 : numValue };
          } else {
            updatedField = { [field]: value };
          }
          if ((import.meta as any).env?.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[AdminTab] onUpdateExhibition call', { field, value, exhibitionId: activeExhibition.id });
          }
          await onUpdateExhibition(activeExhibition.id, updatedField);
          // FIX: Call the defined handleUpdateStatus
          handleUpdateStatus(field, 'saved');
        } catch (error) {
          // 
          // FIX: Call the defined handleUpdateStatus
          handleUpdateStatus(field, 'error', 3000);
        }
      }
    }, DEBOUNCE_DELAY) as unknown as number;
  }, [activeExhibition.id, onUpdateExhibition, handleUpdateStatus]);

  // FIX: Use non-generic field in getStatusIcon
  const getStatusIcon = useCallback((field: ExhibitionEditableFieldKeys) => {
    return updateStatus[field] === 'saving'
      ? <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
      : updateStatus[field] === 'saved'
      ? <Check className="w-4 h-4 text-green-500" />
      : updateStatus[field] === 'error'
      ? <span className="text-red-500 font-bold">!</span>
      : null;
  }, [updateStatus]);

  const currentOrigin = window.location.origin;
  const embedUrl = React.useMemo(() => {
    let url = `${currentOrigin}/?embed=true&exhibitionId=${activeExhibition.id}`;
    if (!embedOptions.ranking) url += '&rankingMode=off';
    if (!embedOptions.zeroGravity) url += '&zeroGravity=off';
    if (!embedOptions.userCount) url += '&userCount=off';
    if (!embedOptions.lights) url += '&lights=off';
    if (!embedOptions.logo) url += '&logo=off';
    if (!embedOptions.exhibitInfo) url += '&info=off';
    return url;
  }, [currentOrigin, activeExhibition.id, embedOptions]);

  const embedCode = React.useMemo(() => {
    return `<iframe src="${embedUrl}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;
  }, [embedUrl]);

  const handleCopy = useCallback(async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      // 
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
          <h4 className="font-bold text-sm mb-4">Embed Exhibition</h4>
          <p className={`text-sm leading-relaxed ${subtext} mb-4`}>
            Use the URL or iframe code below to embed this exhibition into another webpage.
          </p>

          <div className="mb-6 space-y-3">
              <label className={`block text-xs font-bold uppercase ${subtext}`}>Embed Feature Config</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                      { id: 'ranking' as const, label: 'Ranking Mode', icon: Trophy },
                      { id: 'zeroGravity' as const, label: 'Zero Gravity', icon: Orbit },
                      { id: 'userCount' as const, label: 'Online Users', icon: UsersIcon },
                      { id: 'lights' as const, label: 'Light Toggle', icon: Sun },
                      { id: 'logo' as const, label: 'Brand Logo', icon: Box },
                      { id: 'exhibitInfo' as const, label: 'Exhibit Info', icon: FileText },
                  ].map((option) => (
                      <button
                          key={option.id}
                          onClick={() => setEmbedOptions(prev => ({ ...prev, [option.id]: !prev[option.id] }))}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              embedOptions[option.id]
                                  ? (lightsOn ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white border-white text-black')
                                  : (lightsOn ? 'bg-white border-neutral-200 text-neutral-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500')
                          }`}
                      >
                          <option.icon className={`w-5 h-5 ${embedOptions[option.id] ? (lightsOn ? 'text-orange-400' : 'text-orange-600') : 'text-current opacity-30'}`} />
                          <span className="text-[10px] font-bold flex-1 text-left leading-tight">{option.label}</span>
                          <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                              embedOptions[option.id]
                                  ? (lightsOn ? 'bg-orange-500 border-orange-500' : 'bg-orange-600 border-orange-600')
                                  : 'border-current opacity-20'
                          }`}>
                              {embedOptions[option.id] && <Check className="w-3 h-3 text-white" />}
                          </div>
                      </button>
                  ))}
              </div>
          </div>

          <div className="mb-4">
              <label className={`block text-xs font-bold uppercase mb-2 ${subtext}`}>Embed URL</label>
              <div className="relative">
                  <input
                      type="text"
                      readOnly
                      value={embedUrl}
                      className={`w-full pr-12 py-2 rounded-md text-xs ${input}`}
                  />
                  <button
                      onClick={() => handleCopy(embedUrl)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'} ${copyStatus === 'copied' ? 'text-green-500' : (copyStatus === 'error' ? 'text-red-500' : '')}`}
                      title="Copy URL"
                  >
                      {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
              </div>
          </div>

          <div>
              <label className={`block text-xs font-bold uppercase mb-2 ${subtext}`}>Embed Code (Iframe)</label>
              <div className="relative">
                  <textarea
                      readOnly
                      value={embedCode}
                      rows={5}
                      className={`w-full pr-12 py-2 rounded-md text-xs ${input} resize-y`}
                  />
                   <button
                      onClick={() => handleCopy(embedCode)}
                      className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${lightsOn ? 'hover:bg-neutral-200' : 'hover:bg-neutral-700'} ${copyStatus === 'copied' ? 'text-green-500' : (copyStatus === 'error' ? 'text-red-500' : '')}`}
                      title="Copy Code"
                  >
                      {copyStatus === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
              </div>
          </div>
        </div>

        {/* NEW: Analytics Dashboard Button */}
        <div className={`p-4 rounded-xl border ${border} ${lightsOn ? 'bg-cyan-50' : 'bg-cyan-900/20'} flex items-center justify-between`}>
          <div>
            <h4 className={`text-sm font-bold ${text} flex items-center gap-2`}>
              <BarChart2 className="w-4 h-4 text-cyan-500" />
              Exhibition Analytics
            </h4>
            <p className={`text-[11px] ${subtext}`}>View visitor insights and artwork performance</p>
          </div>
          <button
            onClick={() => setIsAnalyticsOpen(true)}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95"
          >
            Open Dashboard
          </button>
        </div>

        <InputField label="Title" field="title" icon={FileText} value={localExhibition.title} onChange={handleChange} statusIcon={getStatusIcon('title')} uiConfig={uiConfig} />
        <InputField label="Subtitle" field="subtitle" icon={Layout} value={localExhibition.subtitle} onChange={handleChange} statusIcon={getStatusIcon('subtitle')} uiConfig={uiConfig} />

        <div className="flex gap-4">
          <InputField label="Date From" field="dateFrom" icon={Calendar} inputType="date" value={localExhibition.dateFrom} onChange={handleChange} statusIcon={getStatusIcon('dateFrom')} uiConfig={uiConfig} className="flex-1" />
          <InputField label="Date To" field="dateTo" icon={Calendar} inputType="date" value={localExhibition.dateTo} onChange={handleChange} statusIcon={getStatusIcon('dateTo')} uiConfig={uiConfig} className="flex-1" />
        </div>

        <InputField label="Hours" field="hours" icon={Clock} value={localExhibition.hours} onChange={handleChange} statusIcon={getStatusIcon('hours')} uiConfig={uiConfig} />
        <InputField label="Venue" field="venue" icon={MapPin} value={localExhibition.venue} onChange={handleChange} statusIcon={getStatusIcon('venue')} uiConfig={uiConfig} />
        <InputField label="Admission" field="admission" icon={Ticket} value={localExhibition.admission} onChange={handleChange} statusIcon={getStatusIcon('admission')} uiConfig={uiConfig} />
        <InputField label="Overview" field="overview" icon={FileText} isTextArea value={localExhibition.overview} onChange={handleChange} statusIcon={getStatusIcon('overview')} uiConfig={uiConfig} />
        <InputField label="Supported By" field="supportedBy" icon={FileText} value={localExhibition.supportedBy} onChange={handleChange} statusIcon={getStatusIcon('supportedBy')} uiConfig={uiConfig} />
        
        {/* Action Button Section */}
        <div className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className={`w-4 h-4 opacity-70 ${text}`} />
            <p className={`text-sm font-medium ${text}`}>Action Button</p>
            <div className="ml-auto flex items-center gap-2">
              {getStatusIcon('admissionLink')}
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <select
              value={localExhibition.exhibit_linktype}
              onChange={(e) => handleChange(e.target.value, 'exhibit_linktype')}
              className={`px-3 py-2 rounded-md text-xs ${input} border ${border}`}
            >
              <option value="tickets">Tickets</option>
              <option value="learn_more">Learn More</option>
              <option value="instagram">Instagram</option>
              <option value="website">Website</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              {getStatusIcon('exhibit_linktype')}
            </div>
          </div>
          <input
            type="text"
            value={localExhibition.admissionLink}
            onChange={(e) => handleChange(e.target.value, 'admissionLink')}
            className={`w-full px-3 py-2 rounded-md text-xs ${input}`}
            placeholder="https://..."
          />
        </div>
        
        <InputField label="Exhibit Capacity" field="exhibit_capacity" icon={UsersIcon} inputType="number" value={localExhibition.exhibit_capacity} onChange={handleChange} statusIcon={getStatusIcon('exhibit_capacity')} uiConfig={uiConfig} />


        {/* Embed panel moved to top */}
      </div>

      {/* NEW: Analytics Dashboard Modal */}
      <AnalyticsDashboard 
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        uiConfig={{
          ...uiConfig,
          panelBg: lightsOn ? 'bg-white' : 'bg-[#1a1a1a]', // Assign dashboard background
        }}
        exhibition={activeExhibition}
        currentLayout={currentLayout}
        firebaseArtworks={firebaseArtworks}
        onlineCount={onlineCount}
      />
    </div>
  );
});

export default AdminTab;