let currentUmamiPath = window.location.pathname;

export const setUmamiPath = (path: string) => {
  currentUmamiPath = path;
  console.debug('[umami] path updated to:', path);
  
  // NEW: Sync the browser's address bar with the virtual path.
  // This helps Umami's automatic tracker and other events stay on the correct context.
  try {
    if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        // Only update if it's different and non-empty
        if (path && window.location.pathname !== path) {
            window.history.replaceState(null, '', path + window.location.search);
        }
    }
  } catch (e) {
    console.warn('[umami] failed to sync history state:', e);
  }
};

export const trackUmamiEvent = (eventName: string, props?: Record<string, any>) => {
  try {
    const w = window as any;
    if (!w || !w.umami) return false;

    const cleanPath = currentUmamiPath.trim();
    const eventData = props || {};
    
    console.log('[Umami-Out] Tracking Event:', eventName, 'Path:', cleanPath);

    // Standard Cloud/v2 API using the callback pattern to override URL (Matches ReqBin behavior)
    if (typeof w.umami.track === 'function') {
      try { 
        w.umami.track((baseProps: any) => ({
          ...baseProps,
          name: eventName,
          url: cleanPath,
          data: eventData
        }));
        return true; 
      } catch (e) {
        // Fallback to simple signature if callback fails
        try { w.umami.track(eventName, eventData); return true; } catch (e2) {}
      }
    }

    // Legacy or alternative signatures
    if (typeof w.umami === 'function') {
      try { w.umami(eventName, eventData); return true; } catch (e) {}
    }
    
    return false;
  } catch (err) {
    console.error('[umami] error tracking event', err);
    return false;
  }
};
