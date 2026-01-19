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

  // Determine website id to query in Umami (Umami calls this websiteId)
  const siteId = websiteId || exhibitionId;
  if (!siteId) {
    return sendJSON(res, 400, { error: 'websiteId or exhibitionId query param required' });
  }

  // Convert start/end to timestamps (ms). Support ISO date strings or ms timestamps.
  const startAt = start ? (isNaN(Number(start)) ? Date.parse(start) : Number(start)) : undefined;
  const endAt = end ? (isNaN(Number(end)) ? Date.parse(end) : Number(end)) : undefined;

  const params = new URLSearchParams();
  if (startAt) params.set('startAt', String(startAt));
  if (endAt) params.set('endAt', String(endAt));
  if (groupBy) params.set('unit', groupBy);
  if (events) params.set('event', events);
  // Umami requires a timezone string; default to UTC if not provided
  const tz = timezone || 'UTC';
  if (tz) params.set('timezone', tz);

  // Use Umami Cloud / API client endpoints for website stats/events series
  // For events time-series: GET /websites/:websiteId/events/series
  const targetUrl = `${UMAMI_API_CLIENT_ENDPOINT.replace(/\/$/, '')}/websites/${encodeURIComponent(siteId)}/events/series?${params.toString()}`;
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

    // Try to filter by exhibitionId if Umami returned event properties
    const filtered = filterByExhibition(json, exhibitionId);

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
