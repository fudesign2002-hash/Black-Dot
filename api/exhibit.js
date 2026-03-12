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
      // Vercel serverless 中不支援 import.meta.env，請用 process.env
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

    // 將資料回傳
    const data = docSnap.data();
    return res.status(200).json({ 
      id: docSnap.id,
      title: data.title,
      artist: data.artist,
      status: data.status,
      overview: data.overview,
      // 您可以根據需求加上或過濾更多欄位
      fullData: data
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '伺服器錯誤', details: error.message });
  }
}