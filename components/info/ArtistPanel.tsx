import React, { useEffect, useState } from 'react';
import { X, ArrowLeft, Loader2, Link as LinkIcon } from 'lucide-react';

interface ArtistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  artistId: string;
  uiConfig: any;
}

interface ArtistData {
  id: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  website?: string;
  instagram?: string;
  [key: string]: any;
}

const ArtistPanel: React.FC<ArtistPanelProps> = ({ isOpen, onClose, onBack, artistId, uiConfig }) => {
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artistId || !isOpen) return;
    setLoading(true);
    setError(null);
    import('firebase/compat/app').then(firebase => {
      const db = firebase.default.firestore();
      // 先用 name 查詢
      db.collection('artists').where('name', '==', artistId).limit(1).get()
        .then(snapshot => {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            setArtist({ id: doc.id, ...doc.data() });
            setLoading(false);
          } else {
            // fallback: 用 id 查詢
            db.collection('artists').doc(artistId).get()
              .then(doc2 => {
                if (doc2.exists) {
                  setArtist({ id: doc2.id, ...doc2.data() });
                } else {
                  setArtist(null);
                  setError('Artist not found');
                }
              })
              .catch(e => setError(e.message || 'Error fetching artist'))
              .finally(() => setLoading(false));
          }
        })
        .catch(e => {
          setError(e.message || 'Error fetching artist');
          setLoading(false);
        });
    });
  }, [artistId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed top-0 right-0 h-full w-full md:w-[600px] z-50 backdrop-blur-xl shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] overflow-hidden flex flex-col border-l ${uiConfig.border} ${uiConfig.panelBg}`}>  
      <div className="pt-8 pb-4 pr-4 pl-8 flex justify-between items-start relative">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className={`mr-2 p-1 rounded-full hover:bg-neutral-200/30 transition-colors ${uiConfig.text}`} aria-label="Back to Info">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span className={`text-[10px] font-bold tracking-[0.3em] uppercase text-cyan-500`}>Artist Details</span>
          </div>
          <div className="space-y-1">
            <h3 className={`text-5xl font-serif font-medium tracking-tight uppercase ${uiConfig.text}`}>{artist?.name || ''}</h3>
          </div>
        </div>
        <button onClick={onClose} className={`absolute top-2 right-2 p-2 transition-all ${uiConfig.text} opacity-50 hover:opacity-100 z-10`} aria-label="Close Artist Panel">
          <X className="w-8 h-8" strokeWidth={1} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-10 scrollbar-hide">
        {loading ? (
          <div className="text-center py-10">
            <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 opacity-20 ${uiConfig.text}`} />
            <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${uiConfig.text}`}>Loading Artist</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : artist ? (
          <div className="space-y-8">
            {/* portrait 圖片，優先用 artist_portrait 欄位，其次 avatarUrl */}
            {(artist.artist_portrait || artist.avatarUrl) && (
              <div className={`w-full aspect-[16/9] mb-8 relative overflow-hidden border ${uiConfig.border}`}>
                <img
                  src={artist.artist_portrait || artist.avatarUrl}
                  alt={artist.name || 'Artist Portrait'}
                  className="object-cover w-full h-full scale-105 hover:scale-100 transition-transform duration-1000"
                />
              </div>
            )}
            {artist.bio && (
              <div>
                <h4 className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${uiConfig.text}`}>Bio</h4>
                <p className={`text-sm leading-8 font-light ${uiConfig.text} opacity-80 whitespace-pre-line`}>{artist.bio}</p>
              </div>
            )}
            {artist.website && (
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-black opacity-80" />
                <a
                  href={artist.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 underline break-all"
                >
                  {artist.website}
                </a>
              </div>
            )}
            {artist.instagram && (
              <div>
                <a href={artist.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-500 underline">Instagram</a>
              </div>
            )}
            {/* 顯示其他欄位（排除敏感/技術欄位） */}
            {Object.entries(artist).map(([key, value]) => (
              [
                'id',
                'name',
                'bio',
                'avatarUrl',
                'website',
                'instagram',
                'lastModified',
                'artistID',
                'ownerId',
                'ownerEmail',
                'artist_portrait_filesize',
                'artist_portrait',
              ].includes(key)
                ? null
                : (
                  <div key={key}>
                    <span className="font-bold text-xs uppercase opacity-60">{key}</span>: <span className="text-sm opacity-80">{String(value)}</span>
                  </div>
                )
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ArtistPanel;
