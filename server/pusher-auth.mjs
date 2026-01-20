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
  const startAt = start ? Number(start) : endAt - (24 * 60 * 60 * 1000);

  const baseUrl = UMAMI_API_ENDPOINT.replace(/\/$/, '');
  const headers = { 'Accept': 'application/json', 'x-umami-api-key': UMAMI_API_KEY };

  // Helper to fetch from Umami
  const fetchUmami = async (path, queryParams) => {
    const url = `${baseUrl}/websites/${encodeURIComponent(siteId)}/${path}?${queryParams.toString()}`;
    const resp = await fetch(url, { headers });
    return resp.ok ? resp.json() : null;
  };

  try {
    // [Format Check] 診斷資料庫內的網址格式
    const urlMetricsParams = new URLSearchParams({ startAt, endAt, type: 'url' });
    const topUrls = await fetchUmami('metrics', urlMetricsParams);
    if (topUrls && Array.isArray(topUrls)) {
      console.log(`[Umami-DB-Sample] 資料庫內的前三個網址: [${topUrls.slice(0, 3).map(u => u.x).join(', ')}]`);
    }

    // 準備基礎參數
    const baseParams = new URLSearchParams({ startAt, endAt });
    let endpointPath = 'stats';
    if (requestType === 'stats') {
      endpointPath = 'stats';
    } else if (requestType === 'series' || requestType === 'pageviews') {
      endpointPath = 'pageviews'; 
      baseParams.set('unit', groupBy);
    } else if (requestType === 'metrics') {
      endpointPath = 'metrics';
      baseParams.set('type', metric);
    }

    // [Request Comparison] A 請求 (全站) vs B 請求 (過濾)
    const controlParams = new URLSearchParams(baseParams);
    
    // 定義過濾路徑 (預設為 /exhibition/ID)
    let currentPath = `/exhibition/${(exhibitionId || '').trim()}`;
    const testParams = new URLSearchParams(baseParams);
    testParams.set('url', currentPath);

    const [controlData, testDataInitial] = await Promise.all([
      fetchUmami(endpointPath, controlParams),
      fetchUmami(endpointPath, testParams)
    ]);

    // 📡 [Umami-API-Fetch] 驗證 Log
    console.log(`📡 [Umami-API-Fetch] WebsiteID: ${siteId}`);
    console.log(`📡 [Umami-API-Fetch] Request Path: ${currentPath}`);
    console.log(`📡 [Umami-API-Fetch] Full API URL: ${baseUrl}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${testParams.toString()}`);

    let finalTestData = testDataInitial;
    let finalPathUsed = currentPath;

    // 自動修補與診斷邏輯
    if (exhibitionId && controlData) {
      // 提取核心數值進行比較 (處理 Stats 物件, Pageviews 陣列或 Metrics 陣列)
      const getVal = (data) => {
        if (!data) return 0;
        // 1. Stats 格式: { pageviews: { value: 10 }, ... }
        if (data.pageviews && typeof data.pageviews === 'object' && !Array.isArray(data.pageviews)) {
          return Number(data.pageviews.value || 0);
        }
        // 2. Pageviews 趨勢格式: { pageviews: [{x, y}, ...], ... }
        if (data.pageviews && Array.isArray(data.pageviews)) {
          return data.pageviews.reduce((sum, item) => sum + Number(item.y || 0), 0);
        }
        // 3. Metrics 格式: [{x, y}, ...]
        if (Array.isArray(data)) {
          return data.reduce((sum, item) => sum + Number(item.y || 0), 0);
        }
        return 0;
      };

      const A = getVal(controlData);
      const B = getVal(testDataInitial);

      // 📊 [Umami-API-Result] 驗證 Log
      const isFiltered = B < A && B >= 0;
      console.log(`📊 [Umami-API-Result] Filtered: ${B}, Total: ${A}`);
      console.log(`📊 [Umami-API-Result] Status: ${isFiltered ? '✅ SUCCESS' : '❌ FAILED - Showing Total Data'}`);

      // 🔍 [Umami-DB-Actual-Paths] 自檢
      if (!isFiltered || B === 0) {
        const urlMetricsParams = new URLSearchParams({ startAt, endAt, type: 'url' });
        const dbPathsSample = await fetchUmami('metrics', urlMetricsParams);
        if (dbPathsSample && Array.isArray(dbPathsSample)) {
           console.log('🔍 [Umami-DB-Actual-Paths]:', dbPathsSample.slice(0, 5).map(u => u.x));
        }
      }

      // 只有在 stats 類型時才打印詳細診斷，避免日誌過多
      if (requestType === 'stats') {
        const final_api_url_with_params = `${baseUrl}/websites/${encodeURIComponent(siteId)}/${endpointPath}?${testParams.toString()}`;
        console.log(`* [Umami-Compare] 目前數據: A: ${A}, B: ${B}`);
      }

      // 修正 Undefined 判定並實施更嚴格的 B < A 檢查
      // 如果 B === A 且 A > 0 (過濾失效)，或者 B === 0 但 A > 0 (可能是路徑格式不對)
      if (A > 0 && (B === A || B === 0)) {
        if (requestType === 'stats') {
            console.log(`* [Umami-Compare] 結果: ${B === A ? '❌ 失敗 (數據相同)' : '⚠️ 警告 (數據為 0)'}`);
        }
        
        // 自動修復邏輯: 嘗試匹配資料庫中可能存在的不同格式
        const possiblePaths = [
          currentPath, 
          `http://localhost:3000${currentPath}`,
          currentPath.replace('/exhibition/', '/analytics/'),
          exhibitionId.trim() // 直接搜 ID (query 模式)
        ];

        for (const altPath of possiblePaths) {
          if (requestType === 'stats') console.log(`[Umami-AutoRepair] 嘗試路徑: "${altPath}"...`);
          const repairParams = new URLSearchParams(baseParams);
          if (altPath === exhibitionId.trim()) {
            repairParams.set('query', altPath);
          } else {
            repairParams.set('url', altPath);
          }

          const repairData = await fetchUmami(endpointPath, repairParams);
          const repairB = getVal(repairData);
          
          if (repairData && repairB > 0 && (repairB < A || altPath !== currentPath)) {
            finalTestData = repairData;
            finalPathUsed = altPath;
            if (requestType === 'stats') {
                console.log(`✅ [Umami-Compare] 自動修復成功! 使用: "${altPath}" (B: ${repairB} < A: ${A})`);
            }
            break;
          }
        }
      } else if (requestType === 'stats') {
        console.log(`✅ [Umami-Compare] 結果: 成功 (數據已過濾) (A: ${A}, B: ${B})`);
      }
    }

    // 將修復後的路徑套用到其他類型請求
    if (requestType !== 'stats' && exhibitionId) {
        const finalParams = new URLSearchParams(baseParams);
        if (finalPathUsed === (exhibitionId || '').trim()) {
            finalParams.set('query', finalPathUsed);
        } else {
            finalParams.set('url', finalPathUsed);
        }
        finalTestData = await fetchUmami(endpointPath, finalParams);
    }

    // Add debug info to response
    if (finalTestData && typeof finalTestData === 'object' && !Array.isArray(finalTestData)) {
      finalTestData._debug_final_path_used = finalPathUsed;
    }

    res.json(finalTestData || { error: 'Failed to fetch' });
  } catch (err) {
    console.error('Umami proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[pusher-auth] listening on http://localhost:${PORT}`);
  console.log(`[pusher-auth] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
