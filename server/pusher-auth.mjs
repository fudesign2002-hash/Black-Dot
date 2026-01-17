// Simple Express server: Pusher Presence Channel auth (ESM)
import express from 'express';
import cors from 'cors';
import Pusher from 'pusher';

const PORT = process.env.PORT || 3002;
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

const app = express();
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const pusher = new Pusher({
  appId: '2103284',
  key: '262b770d3319b6acc099',
  secret: '36e9968adcbf037be74e',
  cluster: 'mt1',
  useTLS: true,
});

app.post('/pusher/auth', (req, res) => {
  console.log('[pusher-auth] Request body:', req.body);
  const { socket_id, channel_name } = req.body || {};
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

app.listen(PORT, () => {
  console.log(`[pusher-auth] listening on http://localhost:${PORT} (allow origin ${ORIGIN})`);
});
