

import React, { useState, useMemo } from 'react';
import { X, Loader2, Folder, FileText } from 'lucide-react';
import { Exhibition, ExhibitionZone } from '../types';

interface FirebaseDocument {
  id: string;
  data: any;
  collection: 'exhibitions' | 'zones';
}

interface FirebaseViewerProps {
  isOpen: boolean;
  onClose: () => void;
  lightsOn: boolean;
  theme: {
    text: string;
    subtext: string;
    border: string;
    panelBg: string;
  };
  exhibitions: Exhibition[];
  zones: ExhibitionZone[];
  isLoading: boolean;
}

const FirebaseViewer: React.FC<FirebaseViewerProps> = ({ 
  isOpen, 
  onClose, 
  lightsOn, 
  theme, 
  exhibitions, 
  zones,
  isLoading 
}) => {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const allDocuments = useMemo((): FirebaseDocument[] => {
    const docs: FirebaseDocument[] = [];
    exhibitions.forEach(ex => docs.push({ id: ex.id, data: ex, collection: 'exhibitions' }));
    zones.forEach(zone => docs.push({ id: zone.id, data: zone, collection: 'zones' }));
    return docs.sort((a, b) => a.id.localeCompare(b.id));
  }, [exhibitions, zones]);

  const selectedDocument = allDocuments.find(doc => doc.id === selectedDocumentId);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full max-w-xl max-h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${theme.panelBg} border ${theme.border}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-6 border-b flex items-center justify-between ${theme.border}`}>
          <div className="flex items-center gap-3">
            <Folder className={`w-5 h-5 opacity-70 ${theme.text}`} />
            <div>
              <h3 className={`text-xl font-serif font-bold ${theme.text}`}>Firebase Document Viewer</h3>
              <p className={`text-xs mt-1 ${theme.subtext}`}>
                Live data from 'exhibitions' and 'zones' collections.
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full hover:bg-black/5 ${theme.text}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={`w-6 h-6 animate-spin ${theme.subtext}`} />
            </div>
          )}
          {!isLoading && allDocuments.length === 0 && (
            <div className={`text-center py-8 ${theme.subtext}`}>
              <p>No documents found.</p>
            </div>
          )}
          {!isLoading && allDocuments.map((doc) => (
            <button
              key={`${doc.collection}-${doc.id}`}
              onClick={() => setSelectedDocumentId(doc.id)}
              className={`group flex items-start gap-3 p-3 rounded-xl transition-all w-full text-left cursor-pointer ${
                lightsOn ? 'hover:bg-neutral-100' : 'hover:bg-neutral-800'
              }`}
            >
              <FileText className={`w-4 h-4 opacity-50 ${theme.text} mt-1`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-mono truncate ${theme.text}`}>{doc.id}</p>
                <p className={`text-xs ${theme.subtext} truncate`}>
                  Collection: <span className="font-bold">{doc.collection}</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedDocument && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDocumentId(null)}>
          <div
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${theme.panelBg} border ${theme.border}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-6 border-b flex items-center justify-between ${theme.border}`}>
              <div>
                <h3 className={`text-lg font-serif font-bold ${theme.text}`}>Document: {selectedDocument.id}</h3>
                <p className={`text-xs mt-1 ${theme.subtext}`}>Collection: '{selectedDocument.collection}'</p>
              </div>
              <button onClick={() => setSelectedDocumentId(null)} className={`p-2 rounded-full hover:bg-black/5 ${theme.text}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className={`text-xs leading-relaxed ${theme.text} p-4 rounded-lg ${lightsOn ? 'bg-neutral-50 border border-neutral-200' : 'bg-neutral-800 border border-neutral-700'}`}>
                <code>{JSON.stringify(selectedDocument.data, null, 2)}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FirebaseViewer;