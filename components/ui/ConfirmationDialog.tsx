import React from 'react';
import { X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose?: () => void; // Optional if `onCancel` handles closing
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme: {
    lightsOn: boolean;
    text: string;
    subtext: string;
    border: string;
    panelBg: string;
  };
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  theme,
}) => {
  if (!isOpen) return null;

  const { lightsOn } = theme;

  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking on the backdrop, not on the dialog itself
    if (e.target === e.currentTarget) {
      onCancel(); // Use onCancel to close the dialog
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleWrapperClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
    >
      <div
        className={`w-full max-w-sm flex flex-col rounded-2xl shadow-2xl overflow-hidden ${theme.panelBg} border ${theme.border}`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the dialog
      >
        <div className={`p-6 border-b flex items-center justify-between ${theme.border}`}>
          <h3 id="confirmation-dialog-title" className={`text-xl font-serif font-bold ${theme.text}`}>{title}</h3>
          <button onClick={onCancel} className={`p-2 rounded-full hover:bg-black/5 ${theme.text}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p id="confirmation-dialog-description" className={`text-base leading-relaxed ${theme.subtext}`}>
            {message}
          </p>
        </div>

        <div className={`p-6 border-t flex justify-end gap-3 ${theme.border}`}>
          <button
            onClick={onCancel}
            className={`px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-colors ${
              lightsOn ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider transition-colors bg-red-600 text-white hover:bg-red-700`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;