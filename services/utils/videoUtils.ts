

export const getVideoEmbedUrl = (watchUrl: string): string | null => {
  try {
    const url = new URL(watchUrl);
    const host = url.hostname;

    if (host.includes('vimeo.com')) {
      // Extract video ID from pathname
      const vimeoIdMatch = url.pathname.match(/\/(\d+)/);
      if (vimeoIdMatch && vimeoIdMatch[1]) {
        const videoId = vimeoIdMatch[1];
        
        // Prepare embed parameters
        const embedParams = new URLSearchParams();
        embedParams.set('autoplay', '1');
        embedParams.set('loop', '1');
        embedParams.set('muted', '1');
        embedParams.set('byline', '0');
        embedParams.set('portrait', '0');
        embedParams.set('title', '0');

        // Merge original query parameters (like 'h') with embed-specific ones
        // Only add if not already set by embed defaults
        url.searchParams.forEach((value, key) => {
            if (!embedParams.has(key)) { 
                embedParams.set(key, value);
            }
        });

        return `https://player.vimeo.com/video/${videoId}?${embedParams.toString()}`;
      }
    }
  } catch (e) {
    console.error("Error parsing video URL:", e, watchUrl);
    return null;
  }
  return null;
};