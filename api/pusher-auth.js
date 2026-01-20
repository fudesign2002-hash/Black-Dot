import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '2103284',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || process.env.PUSHER_KEY || '262b770d3319b6acc099',
  secret: process.env.PUSHER_SECRET || '36e9968adcbf037be74e',
  cluster: process.env.PUSHER_CLUSTER || 'mt1',
  useTLS: true,
});

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Pusher sends data as application/x-www-form-urlencoded by default
  // Vercel handles body parsing, but sometimes we need to be careful
  const { socket_id, channel_name } = req.body || {};

  if (!socket_id || !channel_name) {
    return res.status(400).json({ error: 'socket_id and channel_name required' });
  }

  try {
    const presenceData = {
      user_id: `visitor_${Math.random().toString(36).slice(2, 10)}`,
      user_info: {
        displayName: 'Visitor',
      },
    };
    
    const authResponse = pusher.authorizeChannel(socket_id, channel_name, presenceData);
    res.status(200).json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    res.status(500).json({ error: error.message });
  }
}
