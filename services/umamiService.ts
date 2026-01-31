let currentUmamiPath = window.location.pathname;

export const setUmamiPath = (path: string) => {
  currentUmamiPath = path;
  
  // LOG: currentUmamiPath updated for tracking
};

export const trackUmamiEvent = (eventName: string, props?: Record<string, any>) => {
  try {
    const w = window as any;
    if (!w || !w.umami) return false;

    const cleanPath = currentUmamiPath.trim();
    const eventData = props || {};
    
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
