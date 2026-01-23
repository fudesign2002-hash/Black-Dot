
import React from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface ControlRowProps {
  label: string;
  value?: string;
  children: React.ReactNode;
  border?: string;
  controlBgClass?: string;
}

export const ControlRow: React.FC<ControlRowProps> = ({ 
  label, 
  value, 
  children, 
  border = 'border-neutral-200/60', 
  controlBgClass = 'bg-neutral-50/50' 
}) => (
    <div className={`p-4 rounded-xl border flex flex-col items-start gap-4 ${border} ${controlBgClass}`}>
        <div className="w-full flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
            {value && <p className="text-[10px] font-mono font-bold text-cyan-500/80">{value}</p>}
        </div>
        <div className="w-full">
            {children}
        </div>
    </div>
);

export type StatusType = 'idle' | 'saving' | 'saved' | 'error';

interface StatusIndicatorProps {
  status?: StatusType;
  size?: number;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  size = 14, 
  className = "" 
}) => {
  if (!status || status === 'idle') return null;
  
  switch (status) {
    case 'saving':
      return <Loader2 size={size} className={`text-cyan-500 animate-spin ${className}`} />;
    case 'saved':
      return <Check size={size} className={`text-green-500 ${className}`} />;
    case 'error':
      return <AlertCircle size={size} className={`text-red-500 ${className}`} />;
    default:
      return null;
  }
};
