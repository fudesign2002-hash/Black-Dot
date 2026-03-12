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
    
    // ======== 加入 UMAMI 數據撈取 (可選) ========
    let umamiStats = null;
    try {
      const UMAMI_API_KEY = process.env.UMAMI_API_KEY || process.env.UMAMI_API_TOKEN;
      const UMAMI_ENDPOINT = process.env.UMAMI_API_CLIENT_ENDPOINT || process.env.UMAMI_BASE_URL || 'https://api.umami.is/v1';
      const UMAMI_WID = process.env.UMAMI_WEBSITE_ID || '20b3507a-02cd-4fc4-a8e0-2f360e6002d0'; // 專案預設或抓取環境變數
      
      if (UMAMI_API_KEY) {
        // 設定大範圍時間，取得從以前到現在的觀看次數
        const endAt = Date.now();
        const startAt = endAt - (365 * 24 * 60 * 60 * 1000); // 過去一年
        
        // 此展覽在前端的路徑為 /exhibition/{id}
        const targetPath = `/exhibition/${id}`;
        // 依照 Umami API 要求帶入 query string
        const url = `${UMAMI_ENDPOINT.replace(/\/$/, '')}/websites/${UMAMI_WID}/stats?startAt=${startAt}&endAt=${endAt}&url=${encodeURIComponent(targetPath)}`;

        const umamiRes = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'x-umami-api-key': UMAMI_API_KEY
          }
        });
        
        if (umamiRes.ok) {
          umamiStats = await umamiRes.json();
        } else {
           console.warn('Umami fetch failed:', await umamiRes.text());
        }
      }
    } catch (umamiErr) {
      console.warn('Umami stats error:', umamiErr);
    }
    // ===========================================
    
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
              artistInfo: artData.artist_info || artData.artistBio || '', // 擴充：加入藝術家生平或介紹
              type: artData.artwork_type || 'unknown',
              materials: artData.materials || '',
              medium: artData.artwork_medium || '',
              date: artData.artwork_date || '',
              dimensions: artData.artwork_dimensions || '',
              file: artData.file || '',
              artworkFile: artData.artwork_file || '',
              description: artData.description || artData.artwork_description || '', // 擴充：加強敘述的讀取
              digitalSize: artData.digitalSize || '', // 擴充：數位檔案大小等額外資訊
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
      stats: umamiStats, // 將 Umami 數據同捆回傳給前端
      artworks: artworks
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '伺服器錯誤', details: error.message });
  }
}