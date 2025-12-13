import { logExhibitionsForOwner } from '../services/museumService';

// Expose a tiny debug API on window for quick runtime checks from the browser console.
// Usage in browser console:
//   window.__bd_debug.listExhibitionsForOwner('OWNER_UID');

(function attachDebug() {
  try {
    const w = window as any;
    if (!w.__bd_debug) w.__bd_debug = {};
    w.__bd_debug.listExhibitionsForOwner = async (ownerUid: string) => {
      if (!ownerUid) {
        // [log removed] Usage hint
        return;
      }
      try {
        await logExhibitionsForOwner(ownerUid);
      } catch (err) {
        // [log removed] Debug helper failed
      }
    };
  } catch (e) {
    // If not running in a browser environment, silently ignore.
  }
})();
