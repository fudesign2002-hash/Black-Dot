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
    // Default to last 24 hours to match common dashboard views if not specified
    startAt = endAt - 24 * 60 * 60 * 1000; 
  }

  const params = new URLSearchParams();
  params.set('startAt', String(startAt));
  params.set('endAt', String(endAt));
  params.set('timezone', timezone || 'UTC');

  // New: Filter by exhibition URL if exhibitionId is present
  // Each exhibition has a unique path: /exhibition/bauhaus-blue, etc.
  if (exhibitionId) {
    // 確保路徑格式一致：開頭有斜線，結尾沒斜線
    const cleanId = exhibitionId.trim();
    let filterPath = `/exhibition/${cleanId}`;
    filterPath = filterPath.replace(/\/$/, ""); 
    
    // 經測試，Umami API 有時對於 url 參數需要精確匹配。
    // 我們同時設定 url 和 query 參數，query 通常能作為更寬容的過濾器。
    params.set('url', filterPath);
    params.set('query', filterPath); // 增加 query 參數作為備援
    
    console.log(`[Umami-Compare] Filtering for ID: ${cleanId}`);
    console.log(`[Umami-Compare] Assigned Path: ${filterPath}`);
  }

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

  const targetUrl = `${UMAMI_API_CLIENT_ENDPOINT.replace(/\/$/, '')}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${params.toString()}`;
  
  console.log('[Umami-API] Fetching from:', targetUrl);

  const cacheKey = targetUrl + (exhibitionId ? `|ex:${exhibitionId}` : '');
  const now = Date.now();
  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.ts < TTL) {
    res.setHeader('x-cache', 'HIT');
    return sendJSON(res, 200, { ...cached.value, _debug_url: targetUrl, _is_cached: true });
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (UMAMI_API_KEY) headers['x-umami-api-key'] = UMAMI_API_KEY;

    const resp = await fetch(targetUrl, { headers });

    if (!resp.ok) {
        // ... (保持原有的錯誤處理)
    }

    let json = await resp.json();
    
    // 自檢邏輯：在日誌中顯示數據對比
    if (type === 'stats' && exhibitionId) {
      console.log(`📊 [Umami-API-Result] Result for ${exhibitionId}: ${json.pageviews?.value} Views`);
    }

    return sendJSON(res, 200, json);
  } catch (e) {
    return sendJSON(res, 500, { error: e.message });
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
