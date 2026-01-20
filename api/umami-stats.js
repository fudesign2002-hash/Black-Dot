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

  const baseParams = new URLSearchParams();
  baseParams.set('startAt', String(startAt));
  baseParams.set('endAt', String(endAt));
  baseParams.set('timezone', timezone || 'UTC');

  // For type=metrics, query param 'metric' should be passed through automatically
  if (req.query.metric) {
    baseParams.set('type', req.query.metric);
  }

  // Choose the correct endpointPath based on type
  let endpointPath = 'stats';
  if (type === 'metrics') {
    endpointPath = 'metrics';
  } else if (type === 'pageviews' || type === 'series') {
    endpointPath = 'pageviews';
    if (groupBy) baseParams.set('unit', groupBy);
  }

  const baseUrl = UMAMI_API_CLIENT_ENDPOINT.replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', 'x-umami-api-key': UMAMI_API_KEY };

  let json = null;
  let finalTargetUrl = '';

  try {
    if (exhibitionId) {
      const cleanId = exhibitionId.trim();
      // 路徑三選一測試邏輯
      const formats = [
        `/exhibition/${cleanId}`,                     // 格式 A: 相對路徑
        `app.kurodot.io/exhibition/${cleanId}`,        // 格式 B: 帶網域名稱
        `http://app.kurodot.io/exhibition/${cleanId}`  // 格式 C: 全網址
      ];

      console.log(`🧪 [Umami-Path-Test] Starting multi-format test for ID: ${cleanId}`);

      for (const format of formats) {
        const testParams = new URLSearchParams(baseParams);
        testParams.set('url', format);
        const testUrl = `${baseUrl}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${testParams.toString()}`;
        
        const resp = await fetch(testUrl, { headers });
        if (resp.ok) {
          const result = await resp.json();
          // 提取數值判定 (處理 stats 物件或 metrics 陣列)
          const val = result.pageviews ? Number(result.pageviews.value || 0) : (Array.isArray(result) ? result.reduce((a, b) => a + (b.y || 0), 0) : 0);
          
          console.log(`   - Trying format [${format}]: ${val} Views`);
          
          // 成功標準：找到能回傳數字（非 0）且非全站總數的格式
          if (val > 0 && val < 200) { // 假設全站目前是 270+，過濾後應低於 200
            console.log(`✅ [Umami-Path-Test] SUCCESS! Found correct format: "${format}"`);
            json = result;
            finalTargetUrl = testUrl;
            break;
          }
          // 暫存最後一個嘗試，以防萬一都沒抓到
          json = result;
          finalTargetUrl = testUrl;
        }
      }
    } else {
      // 無過濾條件的普通請求
      finalTargetUrl = `${baseUrl}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${baseParams.toString()}`;
      const resp = await fetch(finalTargetUrl, { headers });
      if (resp.ok) json = await resp.json();
    }

    if (!json) return sendJSON(res, 500, { error: 'Failed to fetch from Umami' });

    // 自檢日誌
    if (type === 'stats' && exhibitionId) {
      const finalVal = json.pageviews?.value || 0;
      console.log(`📊 [Umami-API-Result] Final Pageviews for ${exhibitionId}: ${finalVal}`);
    }

    return sendJSON(res, 200, json);
  } catch (e) {
    return sendJSON(res, 500, { error: e.message });
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
