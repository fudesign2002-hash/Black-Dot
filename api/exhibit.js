import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// 判斷是否已經有初始化的 app (以防 serverless cache)
let app;
let db;

export default async function handler(req, res) {
  // CORS 設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 取得 query string 中的 id，例如 /api/exhibit?id=123
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: '請提供展覽 ID (例如: /api/exhibit?id=123)' });
  }

  try {
    if (!app) {
      // 這裡請確保在 Vercel 環境變數有對應設定 
      const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
      };
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
    }

    const docRef = doc(db, 'exhibitions', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: '找不到該展覽' });
    }

    const data = docSnap.data();

    // 收集所有相關的 Artwork IDs
    // 包含 exhibit_artworks 與 defaultLayout 裡面的 artworkId
    const artworkIdsSet = new Set();
    
    if (Array.isArray(data.exhibit_artworks)) {
      data.exhibit_artworks.forEach(artId => {
        if (artId) artworkIdsSet.add(artId);
      });
    }
    
    if (Array.isArray(data.defaultLayout)) {
      data.defaultLayout.forEach(item => {
        if (item.artworkId) artworkIdsSet.add(item.artworkId);
      });
    }

    // 將 set 轉回陣列
    const artworkIds = Array.from(artworkIdsSet);
    
    // 為了小冊子而準備的 artworks 陣列
    let artworks = [];

    if (artworkIds.length > 0) {
      // 平行向 Firestore 發起請求撈取所有 Artwork
      const artworkPromises = artworkIds.map(async (artId) => {
        try {
          const artDocRef = doc(db, 'artworks', artId);
          const artDocSnap = await getDoc(artDocRef);
          if (artDocSnap.exists()) {
            const artData = artDocSnap.data();
            
            // 這裡特地只回傳「小冊子」會需要的基本資訊
            // 過濾掉燈光、位置、或過度複雜的3D資料
            return {
              id: artDocSnap.id,
              title: artData.title || 'Untitled',
              artist: artData.artist || '',
              type: artData.artwork_type || 'unknown',
              materials: artData.materials || '',
              medium: artData.artwork_medium || '',
              date: artData.artwork_date || '',
              dimensions: artData.artwork_dimensions || '',
              file: artData.file || '',
              artworkFile: artData.artwork_file || '',
              description: artData.description || '', // 如果有簡介的話
              // 可以加其他的只要不是 3D 定位
            };
          }
        } catch (err) {
          console.error(`Failed to fetch artwork ${artId}:`, err);
        }
        return null;
      });

      // 執行所有 promise 並過濾掉空缺
      const fetchedArtworks = await Promise.all(artworkPromises);
      artworks = fetchedArtworks.filter(a => a !== null);
    }

    // 將資料回傳給小冊子專用
    return res.status(200).json({ 
      exhibition: {
        id: docSnap.id,
        title: data.title,
        subtitle: data.subtitle || '',
        artist: data.artist || '',
        status: data.status,
        overview: data.overview || '',
        tags: data.tags || [],
        posterColor: data.posterColor || '',
        venue: data.venue || '',
        admission: data.admission || '',
        dates: data.dates || ''
      },
      artworks: artworks
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '伺服器錯誤', details: error.message });
  }
}