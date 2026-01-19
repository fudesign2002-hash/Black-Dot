// Simple Express server: Pusher Presence Channel auth
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Pusher = require('pusher');

const PORT = process.env.PORT || 3002;
const ORIGIN = process.env.ORIGIN || 'http://localhost:3001';

const app = express();
app.use(cors({
  origin: function (origin, callback) {
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
app.use(bodyParser.json());

const pusher = new Pusher({
  appId: '2103284',
  key: '262b770d3319b6acc099',
  secret: '36e9968adcbf037be74e',
  cluster: 'mt1',
  useTLS: true,
});

app.post('/pusher/auth', (req, res) => {
  const { socket_id, channel_name } = req.body || {};
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

app.listen(PORT, () => {
  console.log(`[pusher-auth] listening on http://localhost:${PORT} (allow origin ${ORIGIN})`);
});
