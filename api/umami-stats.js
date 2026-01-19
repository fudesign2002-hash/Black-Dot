// Simple Umami proxy for dashboard reads
// Expects env: UMAMI_API_TOKEN, optional UMAMI_BASE_URL
// Deploy this under `api/umami-stats.js` (Vercel/Netlify-style).

const CACHE = new Map();
const TTL = 30 * 1000; // 30s cache

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
  const siteId = websiteId || '20b3507a-02cd-4fc4-a8e0-2f360e6002d0';
  
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
    // pure number (ms)
    if (/^\d+$/.test(s)) return Number(s);
    const parsed = Date.parse(s);
    return isNaN(parsed) ? undefined : parsed;
  };

  let startAt = parseToMs(start);
  let endAt = parseToMs(end);
  // default: last 7 days if not provided or invalid
  const nowTs = Date.now();
  if (!endAt) endAt = nowTs;
  if (!startAt) startAt = endAt - 7 * 24 * 60 * 60 * 1000;

  const params = new URLSearchParams();
  if (startAt) params.set('startAt', String(startAt));
  if (endAt) params.set('endAt', String(endAt));
  
  // Umami requires a timezone string; default to UTC if not provided
  const tz = timezone || 'UTC';
  if (tz) params.set('timezone', tz);

  // For type=series (time-series data), add unit parameter
  if (type === 'series' && groupBy) {
    params.set('unit', groupBy);
  }
  
  // For type=metrics, query param 'metric' should be passed through automatically

  // Use Umami Cloud / API client endpoints for website stats/events series
  // Stats (summary or time-series): GET /websites/:websiteId/stats
  // Metrics: GET /websites/:websiteId/metrics
  // Note: stats endpoint returns time-series when startAt/endAt + unit are provided
  const endpointPath = type === 'metrics' ? 'metrics' : 'stats';
  const targetUrl = `${UMAMI_API_CLIENT_ENDPOINT.replace(/\/$/, '')}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${params.toString()}`;
  const cacheKey = targetUrl + (exhibitionId ? `|ex:${exhibitionId}` : '');
  const now = Date.now();
  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.ts < TTL) {
    res.setHeader('x-cache', 'HIT');
    return sendJSON(res, 200, cached.value);
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (UMAMI_API_KEY) headers['x-umami-api-key'] = UMAMI_API_KEY;

    const resp = await fetch(targetUrl, { headers });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Umami proxy error', { targetUrl, status: resp.status, bodyPreview: text && text.slice ? text.slice(0,500) : String(text) });
      // If Umami returned HTML (likely 404 page), return an empty time-series structure so frontend doesn't break
      if (typeof text === 'string' && text.trim().startsWith('<')) {
        return sendJSON(res, 502, { warning: 'Umami endpoint returned HTML (not JSON)', status: resp.status, rows: [] });
      }
      try {
        const parsed = JSON.parse(text);
        return sendJSON(res, resp.status || 500, { error: 'Umami request failed', details: parsed });
      } catch (e) {
        return sendJSON(res, resp.status || 500, { error: 'Umami request failed', details: text });
      }
    }

    const json = await resp.json();

    // Only keep canonical event names; ignore any non-matching events
    const allowedEvents = new Set([
      'Focus-Artwork',
      'Ranking-Mode',
      'Zero-Gravity',
      'Light-Toggle',
      'Exhibit-Info',
      'Artwork-Info'
    ]);

    const filteredByName = filterToAllowedEvents(json, allowedEvents);

    // Try to filter by exhibitionId if Umami returned event properties
    const filtered = filterByExhibition(filteredByName, exhibitionId);

    CACHE.set(cacheKey, { ts: now, value: filtered });
    return sendJSON(res, 200, filtered);
  } catch (e) {
    return sendJSON(res, 500, { error: e.message });
  }
}

function filterByExhibition(raw, exhibitionId) {
  if (!exhibitionId) return raw;

  // Heuristics: Umami may return an array of events or an object with rows/results.
  if (Array.isArray(raw)) {
    return raw.filter(item => {
      const props = item.props || item.meta || item;
      return props && (props.exhibitionId === exhibitionId || props.exhibitId === exhibitionId);
    });
  }

  if (raw && Array.isArray(raw.rows)) {
    return { ...raw, rows: raw.rows.filter(r => r.props && (r.props.exhibitionId === exhibitionId || r.props.exhibitId === exhibitionId)) };
  }

  // Fallback: return original payload if we can't confidently filter
  return raw;
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
