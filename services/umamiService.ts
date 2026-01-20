let currentUmamiPath = window.location.pathname;

export const setUmamiPath = (path: string) => {
  currentUmamiPath = path;
  console.debug('[umami] path updated to:', path);
};

export const trackUmamiEvent = (eventName: string, props?: Record<string, any>) => {
  try {
    const w = window as any;
    if (!w) return false;

    // Ensure URL is strictly a relative path to match API query expectation
    // and remove any potential accidental spaces.
    const cleanPath = currentUmamiPath.trim();
    const enrichedProps = { ...props, url: cleanPath };
    
    console.log('[Umami-Out] Sending Payload:', { event: eventName, props: enrichedProps });
    
    // 🚀 [Umami-Deploy-Check] Path Sent 驗證
    console.log('🚀 [Umami-Deploy-Check] Path Sent:', window.location.origin + cleanPath);

    // Common APIs used by different Umami builds
    if (typeof w.umami === 'function') {
      try { w.umami(eventName, enrichedProps); return true; } catch (e) {}
    }
    if (w.umami && typeof w.umami.trackEvent === 'function') {
      try { w.umami.trackEvent(eventName, enrichedProps); return true; } catch (e) {}
    }
    if (w.umami && typeof w.umami.track === 'function') {
      try { 
        w.umami.track(eventName, enrichedProps); 
        return true; 
      } catch (e) {}
    }
    // Fallback: some self-hosted scripts attach umami as an object with send method
    if (w.umami && typeof w.umami.send === 'function') {
      try { w.umami.send(eventName, enrichedProps); return true; } catch (e) {}
    }
    console.debug('[umami] no supported API found for event', eventName);
    return false;
  } catch (err) {
    console.error('[umami] error tracking event', err);
    return false;
  }
};
