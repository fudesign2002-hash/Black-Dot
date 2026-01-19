// Simple Umami proxy for dashboard reads
// Expects env: UMAMI_API_TOKEN, optional UMAMI_BASE_URL
// Deploy this under `api/umami-stats.js` (Vercel/Netlify-style).

const CACHE = new Map();
const TTL = 30 * 1000; // 30s cache

module.exports = async (req, res) => {
  const { exhibitionId, start, end, groupBy = 'hour', events } = req.query || {};
  const UMAMI_API_TOKEN = process.env.UMAMI_API_TOKEN;
  const UMAMI_BASE_URL = process.env.UMAMI_BASE_URL || 'https://cloud.umami.is/api';

  if (!UMAMI_API_TOKEN) {
    res.statusCode = 500;
    return res.json({ error: 'UMAMI_API_TOKEN not configured' });
  }

  const params = new URLSearchParams();
  if (events) params.set('events', events);
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  if (groupBy) params.set('groupBy', groupBy);

  // This `stats` path is a placeholder; adapt to your Umami deployment API paths.
  const targetUrl = `${UMAMI_BASE_URL}/stats?${params.toString()}`;
  const cacheKey = targetUrl + (exhibitionId ? `|ex:${exhibitionId}` : '');
  const now = Date.now();
  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.ts < TTL) {
    res.setHeader('x-cache', 'HIT');
    return res.json(cached.value);
  }

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        Authorization: `Bearer ${UMAMI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.statusCode = resp.status || 500;
      return res.json({ error: 'Umami request failed', details: text });
    }

    const json = await resp.json();

    // Try to filter by exhibitionId if Umami returned event properties
    const filtered = filterByExhibition(json, exhibitionId);

    CACHE.set(cacheKey, { ts: now, value: filtered });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.json(filtered);
  } catch (e) {
    res.statusCode = 500;
    return res.json({ error: e.message });
  }
};

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
