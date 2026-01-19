// Simple Express server: Pusher Presence Channel auth (ESM)
import express from 'express';
import cors from 'cors';
import Pusher from 'pusher';

const PORT = process.env.PORT || 3002;
// Support multiple origins: development and production
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3004',
  'https://app.kurodot.io'
];

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin
    if (!origin) return callback(null, true);
    // allow any localhost
    if (origin && origin.startsWith('http://localhost:')) return callback(null, true);
    // allow kurodot.io domains
    if (origin.includes('kurodot.io')) return callback(null, true);
    
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const pusher = new Pusher({
  appId: '2103284',
  key: '262b770d3319b6acc099',
  secret: '36e9968adcbf037be74e',
  cluster: 'mt1',
  useTLS: true,
});

// Umami Configuration
const UMAMI_API_KEY = process.env.UMAMI_API_KEY || process.env.UMAMI_API_TOKEN;
const UMAMI_API_ENDPOINT = process.env.UMAMI_API_CLIENT_ENDPOINT || process.env.UMAMI_BASE_URL || 'https://api.umami.is/v1';

app.post('/pusher/auth', (req, res) => {
  console.log('[pusher-auth] Request body:', req.body);
  const { socket_id, channel_name } = req.body || {};
  
  if (socket_id === 'probe') {
    return res.status(200).json({ status: 'ok', message: 'Auth endpoint reachable' });
  }

  if (!socket_id || !channel_name) {
    return res.status(400).json({ error: 'socket_id and channel_name are required' });
  }
  try {
    // Generate a lightweight visitor identity; in production, use your auth session
    const presenceData = {
      user_id: `visitor_${Math.random().toString(36).slice(2, 10)}`,
      user_info: { displayName: 'Visitor' },
    };
    // Authorize for presence channels
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, presenceData);
    res.status(200).json(authResponse);
  } catch (err) {
    console.error('Pusher auth error:', err);
    res.status(500).json({ error: 'Auth failed' });
  }
});

// Umami Stats Proxy Route
app.get('/api/umami-stats', async (req, res) => {
  const { exhibitionId, websiteId, start, end, groupBy = 'hour', type: requestType = 'series', timezone = 'UTC', metric = 'browser' } = req.query || {};
  
  if (!UMAMI_API_KEY) {
    return res.status(500).json({ error: 'UMAMI_API_KEY not configured on server' });
  }

  const siteId = websiteId || '20b3507a-02cd-4fc4-a8e0-2f360e6002d0';
  
  const endAt = end ? Number(end) : Date.now();
  const startAt = start ? Number(start) : endAt - (7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    startAt: String(startAt),
    endAt: String(endAt),
    timezone: timezone
  });

  let endpointPath = 'stats'; // Default fallback
  
  if (requestType === 'stats') {
    endpointPath = 'stats';
  } else if (requestType === 'series' || requestType === 'pageviews') {
    endpointPath = 'pageviews'; // Umami v2 uses /pageviews for time-series
    params.set('unit', groupBy);
  } else if (requestType === 'metrics') {
    endpointPath = 'metrics';
    params.set('type', metric);
  }

  const baseUrl = UMAMI_API_ENDPOINT.replace(/\/$/, '');
  const targetUrl = `${baseUrl}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${params.toString()}`;

  console.log(`[umami-proxy] Fetching: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'x-umami-api-key': UMAMI_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[umami-proxy] Error ${response.status}: ${errorText}`);
      return res.status(response.status).json({ error: 'Umami API error', details: errorText });
    }

    let data = await response.json();
    console.log(`[umami-proxy] Success: ${endpointPath}, entries: ${Array.isArray(data) ? data.length : '1 (object)'}`);


    // Replicate Vercel logic: Filter events by name if this is an event metrics query
    if (requestType === 'metrics' && metric === 'event' && Array.isArray(data)) {
      const allowedEvents = new Set([
        'Focus-Artwork', 'Ranking-Mode', 'Zero-Gravity', 
        'Light-Toggle', 'Exhibit-Info', 'Artwork-Info', 'zoom'
      ]);
      data = data.filter(item => {
        const name = item.x || item.event || item.name;
        return name && allowedEvents.has(name);
      });
    }

    // Replicate Vercel logic: Filter by exhibitionId IF it's an event
    if (exhibitionId && Array.isArray(data) && requestType === 'metrics' && metric === 'event') {
      data = data.filter(item => {
        const props = item.props || item.meta;
        if (props && typeof props === 'object') {
            return props.exhibitionId === exhibitionId || props.exhibitId === exhibitionId;
        }
        // If no props found on individual event metrics, we can't filter by property in the proxy
        // without a more complex Umami query. For now, keep it to show overall site events
        // or ensure your Umami events are sent with these props.
        return true; 
      });
    }

    res.json(data);
  } catch (err) {
    console.error('Umami proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[pusher-auth] listening on http://localhost:${PORT}`);
  console.log(`[pusher-auth] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
