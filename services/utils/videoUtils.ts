
export const getVideoEmbedUrl = (watchUrl: string): string | null => {
  const vimeoRegExp = /(?:vimeo)\.com\/(?:video\/|channels\/\w+\/|groups\/([^\/]*)\/videos\/|album\/\d+\/video\/|)\/?(\d+)/;
  const vimeoMatch = watchUrl.match(vimeoRegExp);

  if (vimeoMatch && vimeoMatch[2]) {
    const videoId = vimeoMatch[2];
    
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&loop=1&muted=1&byline=0&portrait=0&title=0`;
  }
  
  return null;
};