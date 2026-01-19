// Simple Express server: Pusher Presence Channel auth
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Pusher = require('pusher');

// Umami Configuration
const UMAMI_API_KEY = process.env.UMAMI_API_KEY || process.env.UMAMI_API_TOKEN;
const UMAMI_API_ENDPOINT = process.env.UMAMI_API_CLIENT_ENDPOINT || process.env.UMAMI_BASE_URL || 'https://api.umami.is/v1';

const PORT = process.env.PORT || 3002;
const ORIGIN = process.env.ORIGIN || 'http://localhost:3001';

// If in test mode or SKIP_PORT_CHECK=1 is set, relax origin/port checks
const SKIP_PORT_CHECK = process.env.SKIP_PORT_CHECK === '1' || process.env.NODE_ENV === 'test';

const app = express();
app.use(cors({
  origin: SKIP_PORT_CHECK
    ? true
    : function (origin, callback) {
        // allow requests with no origin (e.g., curl, native apps)
        if (!origin) return callback(null, true);
        // allow any localhost with any port (e.g., http://localhost:3000..3999)
        if (origin && origin.startsWith('http://localhost:')) return callback(null, true);
        // allow explicitly configured ORIGIN
        if (ORIGIN && origin === ORIGIN) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
  credentials: true,
}));

if (SKIP_PORT_CHECK) {
  console.log('[pusher-auth] SKIP_PORT_CHECK enabled: skipping origin/port strict checks');
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const pusher = new Pusher({
  appId: '2103284',
  key: '262b770d3319b6acc099',
  secret: '36e9968adcbf037be74e',
  cluster: 'mt1',
  useTLS: true,
});

app.post('/pusher/auth', (req, res) => {
  const { socket_id, channel_name } = req.body || {};
  
  // Handle probe from App.tsx detection
  if (socket_id === 'probe') {
    return res.status(200).json({ status: 'ok', message: 'Auth endpoint reachable' });
  }

  if (!socket_id || !channel_name) {
    return res.status(400).json({ error: 'socket_id and channel_name are required' });
  }
  try {
    // In real apps, derive user from session/auth. Here we generate a random visitor id.
    const presenceData = {
      user_id: `visitor_${Math.random().toString(36).slice(2, 10)}`,
      user_info: {
        displayName: 'Visitor',
      },
    };
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, presenceData);
    res.json(authResponse);
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

  // CRITICAL FIX: Always default to the primary site ID. 
  // If we use exhibitionId as a siteId, Umami API will return 404/Empty.
  const siteId = websiteId || '20b3507a-02cd-4fc4-a8e0-2f360e6002d0';
  
  const endAt = end ? Number(end) : Date.now();
  const startAt = start ? Number(start) : endAt - (7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    startAt: String(startAt),
    endAt: String(endAt),
    timezone: timezone
  });

  let endpointPath = 'series';
  if (requestType === 'stats') {
    endpointPath = 'stats';
  } else if (requestType === 'series') {
    endpointPath = 'series';
    params.set('unit', groupBy);
  } else if (requestType === 'metrics') {
    endpointPath = 'metrics';
    params.set('type', metric);
  }

  // Robust URL construction for Umami Cloud (v2/v1)
  const baseUrl = UMAMI_API_ENDPOINT.replace(/\/$/, '');
  // Umami Cloud API typically uses /api/websites or /websites depending on the version
  // For v2 Cloud, it's often https://api.umami.is/api/websites/:id/...
  const targetUrl = `${baseUrl}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${params.toString()}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'x-umami-api-key': UMAMI_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Umami Proxy Error] ${response.status}: ${errorText} (URL: ${targetUrl})`);
      return res.status(response.status).json({ error: 'Umami API error', details: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Umami proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[pusher-auth] listening on http://localhost:${PORT} (allow origin ${ORIGIN})`);
});
