

export const getVideoEmbedUrl = (watchUrl: string): string | null => {
  // Updated Vimeo regex to capture video ID from various URL formats, including those with query parameters.
  // It now matches the digit sequence after 'vimeo.com/' or specific path segments,
  // and then optionally ignores any characters that follow (like query parameters or hash fragments) until the end of the string.
  const vimeoRegExp = /(?:vimeo)\.com\/(?:video\/|channels\/\w+\/|groups\/[^\/]*\/videos\/|album\/\d+\/video\/|manage\/videos\/)?(\d+)(?:[/?#]|$)/;
  const vimeoMatch = watchUrl.match(vimeoRegExp);

  if (vimeoMatch && vimeoMatch[1]) { // Now the video ID is in vimeoMatch[1]
    const videoId = vimeoMatch[1];
    
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&loop=1&muted=1&byline=0&portrait=0&title=0`;
  }
  
  return null;
};