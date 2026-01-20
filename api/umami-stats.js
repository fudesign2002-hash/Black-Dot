export default async function handler(req, res) {
  const { exhibitionId, websiteId, start, end } = req.query || {};
  const UMAMI_API_KEY = process.env.UMAMI_API_KEY || process.env.UMAMI_API_TOKEN;
  const UMAMI_ENDPOINT = process.env.UMAMI_API_CLIENT_ENDPOINT || 'https://api.umami.is/v1';
  const siteId = websiteId || process.env.UMAMI_WEBSITE_ID || '20b3507a-02cd-4fc4-a8e0-2f360e6002d0';

  // 1. 基本安全檢查，防止 500 崩潰
  if (!UMAMI_API_KEY) return res.status(500).json({ error: 'Missing UMAMI_API_KEY' });

  // 2. 核心對齊：強制使用相對路徑 (與 Dashboard 一致)
  const params = new URLSearchParams();
  if (exhibitionId) {
    const filterPath = `/exhibition/${exhibitionId.trim()}`;
    params.set('url', filterPath); //
  }

  // 3. 強制時間範圍 (解決數據歸零問題)
  const now = Date.now();
  const startAt = start || (now - 24 * 60 * 60 * 1000); 
  params.set('startAt', String(startAt));
  params.set('endAt', String(end || now));

  try {
    const targetUrl = `${UMAMI_ENDPOINT}/websites/${siteId}/stats?${params.toString()}`;
    
    const resp = await fetch(targetUrl, {
      headers: { 
        'Content-Type': 'application/json',
        'x-umami-api-key': UMAMI_API_KEY 
      }
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return res.status(resp.status).json({ error: 'Umami API Error', details: errorText });
    }

    const data = await resp.json();
    // 輸出 Log 到 Vercel 控制台，方便我們檢查
    console.log(`[Umami-Success] Path: /exhibition/${exhibitionId}, Views: ${data.pageviews}`);
    
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Proxy Crash', message: e.message });
  }
}export default async function handler(req, res) {
  const { exhibitionId, websiteId, start, end } = req.query || {};
  const UMAMI_API_KEY = process.env.UMAMI_API_KEY || process.env.UMAMI_API_TOKEN;
  const UMAMI_ENDPOINT = process.env.UMAMI_API_CLIENT_ENDPOINT || 'https://api.umami.is/v1';
  const siteId = websiteId || process.env.UMAMI_WEBSITE_ID || '20b3507a-02cd-4fc4-a8e0-2f360e6002d0';

  // 1. 基本安全檢查，防止 500 崩潰
  if (!UMAMI_API_KEY) return res.status(500).json({ error: 'Missing UMAMI_API_KEY' });

  // 2. 核心對齊：強制使用相對路徑 (與 Dashboard 一致)
  const params = new URLSearchParams();
  if (exhibitionId) {
    const filterPath = `/exhibition/${exhibitionId.trim()}`;
    params.set('url', filterPath); //
  }

  // 3. 強制時間範圍 (解決數據歸零問題)
  const now = Date.now();
  const startAt = start || (now - 24 * 60 * 60 * 1000); 
  params.set('startAt', String(startAt));
  params.set('endAt', String(end || now));

  try {
    const targetUrl = `${UMAMI_ENDPOINT}/websites/${siteId}/stats?${params.toString()}`;
    
    const resp = await fetch(targetUrl, {
      headers: { 
        'Content-Type': 'application/json',
        'x-umami-api-key': UMAMI_API_KEY 
      }
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return res.status(resp.status).json({ error: 'Umami API Error', details: errorText });
    }

    const data = await resp.json();
    // 輸出 Log 到 Vercel 控制台，方便我們檢查
    console.log(`[Umami-Success] Path: /exhibition/${exhibitionId}, Views: ${data.pageviews}`);
    
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Proxy Crash', message: e.message });
  }
}