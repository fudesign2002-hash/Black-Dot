// Simple Umami proxy for dashboard reads
// Expects env: UMAMI_API_TOKEN, optional UMAMI_BASE_URL
// Deploy this under `api/umami-stats.js` (Vercel/Netlify-style).

const CACHE = new Map();
const TTL = 0; // 暫時設為 0，避免抓到舊的全站數據

function sendJSON(res, status, body) {
  res.statusCode = status || 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // local caching policy for Vercel dev; production uses s-maxage
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const { exhibitionId, websiteId, start, end, groupBy = 'hour', events, timezone } = req.query || {};
  const UMAMI_API_KEY = process.env.UMAMI_API_KEY || process.env.UMAMI_API_TOKEN;
  const UMAMI_API_CLIENT_ENDPOINT = process.env.UMAMI_API_CLIENT_ENDPOINT || process.env.UMAMI_BASE_URL || 'https://api.umami.is/v1';

  if (!UMAMI_API_KEY) {
    return sendJSON(res, 500, { error: 'UMAMI_API_KEY not configured' });
  }

  // Support special proxy actions (e.g. list websites)
  const { action } = req.query || {};
  if (action === 'list-websites') {
    try {
      const listUrl = `${UMAMI_API_CLIENT_ENDPOINT.replace(/\/$/, '')}/websites`;
      const headers = { 'Content-Type': 'application/json', 'x-umami-api-key': UMAMI_API_KEY };
      const listResp = await fetch(listUrl, { headers });
      if (!listResp.ok) {
        const text = await listResp.text();
        try { return sendJSON(res, listResp.status || 500, { error: 'Failed to list websites', details: JSON.parse(text) }); } catch (e) { return sendJSON(res, listResp.status || 500, { error: 'Failed to list websites', details: text }); }
      }
      const sites = await listResp.json();
      return sendJSON(res, 200, sites);
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // Determine website id to query in Umami (Umami calls this websiteId)
  // Note: exhibitionId is passed for filtering, but we use the single shared website ID for Umami
  const siteId = websiteId || process.env.UMAMI_WEBSITE_ID || '20b3507a-02cd-4fc4-a8e0-2f360e6002d0';
  
  // Keep exhibitionId for potential filtering in post-processing
  const filterByExhibitionId = exhibitionId;
  
  if (!siteId) {
    return sendJSON(res, 400, { error: 'websiteId query param required' });
  }

  // Choose the type of data to fetch (stats, series, metrics, etc.)
  const { type = 'series' } = req.query || {};

  // Convert start/end to timestamps (ms). Support ISO date strings or ms timestamps.
  const parseToMs = (v) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    if (s.length === 0) return undefined;
    if (/^\d+$/.test(s)) return Number(s);
    const parsed = Date.parse(s);
    return isNaN(parsed) ? undefined : parsed;
  };

  let startAt = parseToMs(start);
  let endAt = parseToMs(end);
  const nowTs = Date.now();
  if (!endAt) endAt = nowTs;
  if (!startAt) {
    // 強制時間範圍擴張：預設回溯 7 天，確保涵蓋所有測試數據
    startAt = endAt - 7 * 24 * 60 * 60 * 1000; 
  }

  const params = new URLSearchParams();
  params.set('timezone', timezone || 'UTC');

  // 1. 核心過濾邏輯：根據證實，路徑必須是精確的相對路徑
  if (exhibitionId) {
    const filterPath = `/exhibition/${exhibitionId.trim()}`;
    params.set('url', filterPath);
    console.log(`[Umami-Proxy] Requesting Path: ${filterPath}`);
  }

  // 2. 修正時間戳 (避免數據歸零)
  // 確保 startAt 與 endAt 是數值格式，且範圍足夠覆蓋數據產生的時間
  const now = Date.now();
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  params.set('startAt', String(startAt || twentyFourHoursAgo));
  params.set('endAt', String(endAt || now));

  // For type=metrics, query param 'metric' should be passed through automatically
  if (req.query.metric) {
    params.set('type', req.query.metric);
  }

  // Choose the correct endpointPath based on type
  let endpointPath = 'stats';
  if (type === 'metrics') {
    endpointPath = 'metrics';
  } else if (type === 'pageviews' || type === 'series') {
    endpointPath = 'pageviews';
    if (groupBy) params.set('unit', groupBy);
  }

  const baseUrl = UMAMI_API_CLIENT_ENDPOINT.replace(/\/$/, '');
  
  // 3. 執行請求與錯誤處理 (解決 500 Internal Server Error)
  try {
    const targetUrl = `${baseUrl}/websites/${siteId}/${endpointPath}?${params.toString()}`;
    console.log('[Umami-API] Fetching from:', targetUrl);

    const resp = await fetch(targetUrl, { 
      headers: { 'x-umami-api-key': UMAMI_API_KEY } 
    });

    if (!resp.ok) {
        const errorDetail = await resp.text();
        console.error('[Umami-API-Error]', errorDetail);
        return res.status(resp.status).json({ error: 'Umami API Rejected', details: errorDetail });
    }

    const data = await resp.json();
    
    // 最終驗證輸出
    if (type === 'stats') {
        const views = data.pageviews?.value || 0;
        console.log(`[Umami-Success] Path: ${exhibitionId}, Views: ${views}`);
    }
    
    return res.status(200).json(data);
  } catch (e) {
    console.error('[Umami-Proxy-Crash]', e);
    return res.status(500).json({ error: 'Proxy Crash', message: e.message });
  }
}
}

function filterToAllowedEvents(raw, allowedSet) {
  if (!allowedSet) return raw;

  if (Array.isArray(raw)) {
    return raw.filter(item => {
      const name = item.x || item.event || item.name;
      return name && allowedSet.has(name);
    });
  }

  if (raw && Array.isArray(raw.rows)) {
    return { ...raw, rows: raw.rows.filter(r => {
      const name = r.x || (r.event && r.event.name) || r.event || r.name;
      return name && allowedSet.has(name);
    }) };
  }

  // fallback: return original
  return raw;
}
