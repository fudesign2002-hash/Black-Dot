/**
 * Extracts a clean filename from a URL or pipe path.
 * Example: "https://.../03_White_Noise_10min.mp3-176991..." -> "03 White Noise 10min"
 */
export const cleanMusicFileName = (url: string | undefined): string => {
    if (!url) return '';
    
    try {
        // Decode URL to handle %20 etc.
        const decodedUrl = decodeURIComponent(url);
        
        // Get the part before any query parameters or fragments
        const baseUrl = decodedUrl.split('?')[0].split('#')[0];
        
        // Get the filename part (last segment of path)
        let filename = baseUrl.split('/').pop() || '';
        
        // 1. Remove .mp3 (case insensitive) and everything after it
        const mp3Index = filename.toLowerCase().lastIndexOf('.mp3');
        if (mp3Index !== -1) {
            filename = filename.substring(0, mp3Index);
        }

        // 2. Clear Firebase/Random IDs more aggressively
        // If the filename starts with a long string followed by a dash, take after the dash
        const lastDashIndex = filename.lastIndexOf('-');
        if (lastDashIndex !== -1 && lastDashIndex < 40) { // Limit to long prefix
            filename = filename.substring(lastDashIndex + 1);
        } else {
            // If no dash, find the first position of a digit (like '03') or an underscore
            // most music names start with a number or are preceded by the ID directly
            const match = filename.match(/[0-9_].*$/);
            if (match && match.index !== undefined && match.index > 15) {
                filename = filename.substring(match.index);
            }
        }

        // 3. Clean up formatting
        let cleanName = filename.replace(/^[_-\s]+/, ''); // Remove leading symbols
        cleanName = cleanName.replace(/[_-]/g, ' '); // Symbols to spaces
        
        // 4. Collapse multiple spaces and trim
        return cleanName.trim().replace(/\s+/g, ' ');
    } catch (e) {
        return '';
    }
};
