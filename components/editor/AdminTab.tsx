// components/editor/AdminTab.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Exhibition } from '../../types';
import { FileText, Layout, Calendar, MapPin, Clock, Ticket, Loader2, Check, Copy } from 'lucide-react'; // NEW: Added Copy icon

interface AdminTabProps {
  theme: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    input: string;
  };
  activeExhibition: Exhibition;
  onUpdateExhibition: (exhibitionId: string, updatedFields: Partial<Exhibition>) => Promise<void>;
}

const DEBOUNCE_DELAY = 700; // ms

// Moved InputField component definition outside AdminTab
interface InputFieldProps {
  label: string;
  // FIX: Changed 'field' type from `string` to `keyof Exhibition` to resolve 'string is not assignable to never' error
  field: keyof Exhibition;
  icon: React.ElementType;
  type?: string;
  isTextArea?: boolean;
  value: string;
  onChange: (value: string) => void;
  statusIcon: React.ReactNode;
  theme: AdminTabProps['theme']; // Pass theme explicitly
  className?: string; // Add className prop for layout
}

const InputField: React.FC<InputFieldProps> = React.memo(({
  label, field, icon: Icon, type = 'text', isTextArea = false, value, onChange, statusIcon, theme, className
}) => {
  const { lightsOn, text, subtext, border, input } = theme;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  return (
    <div className={`p-4 rounded-xl border ${border} ${controlBgClass} ${className || ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-70" />
        <p className={`text-sm font-medium ${text}`}>{label}</p>
        <div className="ml-auto flex items-center gap-2">
          {statusIcon}
        </div>
      </div>
      {isTextArea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 rounded-md text-xs ${input} h-24 resize-y`}
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 rounded-md text-xs ${input}`}
        />
      )}
    </div>
  );
});

const AdminTab: React.FC<AdminTabProps> = React.memo(({ theme, activeExhibition, onUpdateExhibition }) => {
  const [localExhibition, setLocalExhibition] = useState<Partial<Exhibition>>({});
  const [updateStatus, setUpdateStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const timeoutRefs = useRef<Record<string, number>>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const { lightsOn, text, subtext, border, input } = theme;
  const controlBgClass = lightsOn ? 'bg-neutral-100' : 'bg-neutral-800';

  // Initialize local state when activeExhibition changes
  useEffect(() => {
    setLocalExhibition({
      title: activeExhibition.title,
      subtitle: activeExhibition.subtitle,
      overview: activeExhibition.overview,
      dateFrom: activeExhibition.dateFrom,
      dateTo: activeExhibition.dateTo,
      venue: activeExhibition.venue,
      hours: activeExhibition.hours,
      admissionLink: activeExhibition.admissionLink,
    });
    setUpdateStatus({}); // Reset status when exhibition changes
    // Clear any pending debounce timeouts for previous exhibition
    Object.values(timeoutRefs.current).forEach(clearTimeout);
    timeoutRefs.current = {};
  }, [activeExhibition]);

  const handleUpdateStatus = useCallback((field: string, status: 'idle' | 'saving' | 'saved' | 'error', duration: number = 2000) => {
    setUpdateStatus(prev => ({ ...prev, [field]: status }));
    if (status === 'saved' || status === 'error') {
      setTimeout(() => setUpdateStatus(prev => ({ ...prev, [field]: 'idle' })), duration);
    }
  }, []);

  const handleChange = useCallback((field: keyof Exhibition, value: string) => {
    setLocalExhibition(prev => ({ ...prev, [field]: value }));
    handleUpdateStatus(field as string, 'idle'); // Reset status to idle when typing

    // Clear previous debounce timeout for this field
    if (timeoutRefs.current[field as string]) {
      clearTimeout(timeoutRefs.current[field as string]);
    }

    // Set a new debounce timeout
    timeoutRefs.current[field as string] = window.setTimeout(async () => {
      if (activeExhibition.id) {
        handleUpdateStatus(field as string, 'saving');
        try {
          // Construct partial update object for Firebase
          const updatedField: Partial<Exhibition> = { [field]: value };
          await onUpdateExhibition(activeExhibition.id, updatedField);
          handleUpdateStatus(field as string, 'saved');
        } catch (error) {
          console.error(`Failed to update ${field}:`, error);
          handleUpdateStatus(field as string, 'error', 3000);
        }
      }
    }, DEBOUNCE_DELAY);
  }, [activeExhibition.id, onUpdateExhibition, handleUpdateStatus]);

  const getStatusIcon = (field: string) => {
    switch (updateStatus[field]) {
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

  const currentOrigin = window.location.origin;
  const embedUrl = `${currentOrigin}/?embed=true&exhibitionId=${activeExhibition.id}`;
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;

  const handleCopy = useCallback(async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-neutral-500/5">
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${border} ${controlBgClass}`}>
          <h4 className="font-bold text-sm mb-2">Exhibition Details for "{activeExhibition.title}"</h4>
          <p className={`text-sm leading-relaxed ${subtext}`}>
            Edit the core information for this exhibition. Changes will be saved automatically.
          </p>
        </div>

        <InputField label="Title" field="title" icon={FileText} value={localExhibition.title || ''} onChange={(val) => handleChange('title', val)} statusIcon={getStatusIcon('title')} theme={theme} />
        <InputField label="Subtitle" field="subtitle" icon={Layout} value={localExhibition.subtitle || ''} onChange={(val) => handleChange('subtitle', val)} statusIcon={getStatusIcon('subtitle')} theme={theme} />
        <InputField label="Overview" field="overview" icon={FileText} isTextArea value={localExhibition.overview || ''} onChange={(val) => handleChange('overview', val)} statusIcon={getStatusIcon('overview')} theme={theme} />
        
        {/* Group Date From and Date To on the same line */}
        <div className="flex gap-4">
          <InputField label="Date From" field="dateFrom" icon={Calendar} type="date" value={localExhibition.dateFrom || ''} onChange={(val) => handleChange('dateFrom', val)} statusIcon={getStatusIcon('dateFrom')} theme={theme} className="flex-1" />
          <InputField label="Date To" field="dateTo" icon={Calendar} type="date" value={localExhibition.dateTo || ''} onChange={(val) => handleChange('dateTo', val)} statusIcon={getStatusIcon('dateTo')} theme={theme} className="flex-1" />
        </div>

        <InputField label="Venue" field="venue" icon={MapPin} value={localExhibition.venue || ''} onChange={(val) => handleChange('venue', val)} statusIcon={getStatusIcon('venue')} theme={theme} />
        <InputField label="Hours" field="hours" icon={Clock} value={localExhibition.hours || ''} onChange={(val) => handleChange('hours', val)} statusIcon={getStatusIcon('hours')} theme={theme} />
        <InputField label="Purchase Ticket Link" field="admissionLink" icon={Ticket} value={localExhibition.admissionLink || ''} onChange={(val) => handleChange('admissionLink', val)} statusIcon={getStatusIcon('admissionLink')} theme={theme} />

        {/* NEW: Embed Options Section */}
        <div className={`p-4 rounded-xl border ${border} ${controlBgClass} mt-6`}>
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
      </div>
    </div>
  );
});

export default AdminTab;