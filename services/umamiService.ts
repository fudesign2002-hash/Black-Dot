export const trackUmamiEvent = (eventName: string, props?: Record<string, any>) => {
  try {
    const w = window as any;
    if (!w) return false;
    // Common APIs used by different Umami builds
    if (typeof w.umami === 'function') {
      // Some builds expose umami as a function: umami('EventName', props)
      try { w.umami(eventName, props); return true; } catch (e) {}
    }
    if (w.umami && typeof w.umami.trackEvent === 'function') {
      try { w.umami.trackEvent(eventName, props); return true; } catch (e) {}
    }
    if (w.umami && typeof w.umami.track === 'function') {
      try { w.umami.track(eventName, props); return true; } catch (e) {}
    }
    // Fallback: some self-hosted scripts attach umami as an object with send method
    if (w.umami && typeof w.umami.send === 'function') {
      try { w.umami.send(eventName, props); return true; } catch (e) {}
    }
    console.debug('[umami] no supported API found for event', eventName);
    return false;
  } catch (err) {
    console.error('[umami] error tracking event', err);
    return false;
  }
};
