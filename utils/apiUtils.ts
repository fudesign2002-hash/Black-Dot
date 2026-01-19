
/**
 * Utility to detect the running auth server (pusher-auth) and provide base URLs
 * for both Pusher auth and Umami proxy stats.
 */

let cachedAuthEndpoint = '';

export async function getAuthEndpoint(): Promise<string> {
  // Always use the relative API path, never probe other ports
  return '/api/pusher-auth';
}

/**
 * Returns the base URL (origin + port) for API calls, derived from the auth endpoint.
 */
export async function getApiBaseUrl(): Promise<string> {
  const authEndpoint = await getAuthEndpoint();
  
  // If it's a full URL (http://...), strip the path to get the base
  if (authEndpoint.startsWith('http')) {
    try {
      const url = new URL(authEndpoint);
      return url.origin;
    } catch (e) {
      return '';
    }
  }
  
  // If it's relative, return empty string so relative fetches work as expected
  return '';
}

/**
 * Helper to fetch from the Umami proxy, using the detected server base.
 */
export async function fetchUmamiProxy(queryString: string): Promise<Response> {
  const base = await getApiBaseUrl();
  const url = `${base}/api/umami-stats${queryString}`;
  return fetch(url);
}
