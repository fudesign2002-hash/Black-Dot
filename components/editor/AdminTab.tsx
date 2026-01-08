


import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Exhibition } from '../../types';
import { FileText, Layout, Calendar, MapPin, Clock, Ticket, Loader2, Check, Copy } from 'lucide-react'; // REMOVED: Image icon

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
}

const DEBOUNCE_DELAY = 700;

// NEW: Explicitly define the keys of Exhibition that are string or string | undefined
type ExhibitionEditableFieldKeys =
  'title' | 'subtitle' | 'overview' | 'dateFrom' | 'dateTo' |
  'venue' | 'hours' | 'admissionLink' | 'admission' | 'supportedBy'; // REMOVED: artist, dates, exhibit_poster

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

const AdminTab: React.FC<AdminTabProps> = React.memo(({ uiConfig, activeExhibition, onUpdateExhibition }) => {
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
  }));
  // FIX: Type updateStatus with Partial<Record<ExhibitionEditableFieldKeys, ...>> to allow empty object initialization
  const [updateStatus, setUpdateStatus] = useState<Partial<Record<ExhibitionEditableFieldKeys, 'idle' | 'saving' | 'saved' | 'error'>>>({});
  // FIX: Type timeoutRefs with Partial<Record<ExhibitionEditableFieldKeys, number | undefined>> to allow empty object initialization
  const timeoutRefs = useRef<Partial<Record<ExhibitionEditableFieldKeys, number | undefined>>>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

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
          // MODIFIED: value is now guaranteed to be a string (possibly empty)
          const updatedField: Partial<Exhibition> = { [field]: value };
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
  const embedUrl = `${currentOrigin}/?embed=true&exhibitionId=${activeExhibition.id}`;
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;

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
        <InputField label="Purchase Ticket Link" field="admissionLink" icon={Ticket} value={localExhibition.admissionLink} onChange={handleChange} statusIcon={getStatusIcon('admissionLink')} uiConfig={uiConfig} />


        {/* Embed panel moved to top */}
      </div>
    </div>
  );
});

export default AdminTab;