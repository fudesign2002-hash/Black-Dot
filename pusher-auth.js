// Simple Pusher auth endpoint for Presence Channels
// Run this separately or in Vercel/Firebase Functions
// Usage: http://localhost:3001/api/pusher-auth

const Pusher = require('pusher');

// Initialize Pusher
const pusher = new Pusher({
  appId: '2103284',
  key: '262b770d3319b6acc099',
  secret: '36e9968adcbf037be74e',
  cluster: 'mt1',
  useTLS: true,
});

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { socket_id, channel_name } = req.body;

  if (!socket_id || !channel_name) {
    return res.status(400).json({ error: 'socket_id and channel_name required' });
  }

  try {
    const auth = pusher.authorizeChannel(socket_id, channel_name, {
      user_id: Math.random().toString(36).substr(2, 9),
      user_info: {
        name: 'Visitor',
      },
    });
    res.status(200).json(auth);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
