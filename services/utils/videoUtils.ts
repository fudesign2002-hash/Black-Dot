

export const getVideoEmbedUrl = (watchUrl: string): string | null => {
  try {
    const url = new URL(watchUrl);
    const host = url.hostname;

    if (host.includes('vimeo.com')) {
      const vimeoIdMatch = url.pathname.match(/\/(\d+)/);
      if (vimeoIdMatch && vimeoIdMatch[1]) {
        const videoId = vimeoIdMatch[1];
        
        const embedParams = new URLSearchParams();
        embedParams.set('autoplay', '1');
        embedParams.set('loop', '1');
        embedParams.set('muted', '1');
        embedParams.set('byline', '0');
        embedParams.set('portrait', '0');
        embedParams.set('title', '0');

        url.searchParams.forEach((value, key) => {
            if (!embedParams.has(key)) { 
                embedParams.set(key, value);
            }
        });

        return `https://player.vimeo.com/video/${videoId}?${embedParams.toString()}`;
      }
    } else if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let videoId = url.searchParams.get('v');
      if (host.includes('youtu.be')) {
        videoId = url.pathname.split('/').pop();
      }

      if (videoId) {
        const embedParams = new URLSearchParams();
        embedParams.set('autoplay', '1');
        embedParams.set('loop', '1');
        embedParams.set('mute', '1');
        embedParams.set('controls', '0');
        embedParams.set('playlist', videoId);
        embedParams.set('modestbranding', '1');
        embedParams.set('rel', '0');
        embedParams.set('showinfo', '0');

        url.searchParams.forEach((value, key) => {
          if (!embedParams.has(key)) {
            embedParams.set(key, value);
          }
        });

        return `https://www.youtube.com/embed/${videoId}?${embedParams.toString()}`;
      }
    }
    else if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) {
        const directVideoParams = new URLSearchParams(url.search);
        directVideoParams.set('autoplay', '1');
        directVideoParams.set('loop', '1');
        directVideoParams.set('muted', '1');
        return `${url.origin}${url.pathname}?${directVideoParams.toString()}`;
    }
  } catch (e) {
    // 
    return null;
  }
  return null;
};