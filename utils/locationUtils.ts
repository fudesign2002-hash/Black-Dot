/**
 * Convert ISO 3166-1 alpha-2 country code to flag emoji
 */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  
  const codeUpper = code.toUpperCase();
  try {
    // Regional indicator symbols: U+1F1E6 to U+1F1FF
    const REGIONAL_INDICATOR_OFFSET = 0x1F1E6 - 65; // 65 is 'A'
    const firstChar = codeUpper.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET;
    const secondChar = codeUpper.charCodeAt(1) + REGIONAL_INDICATOR_OFFSET;
    return String.fromCodePoint(firstChar, secondChar);
  } catch {
    return '🌍';
  }
}

/**
 * Get country name from country code (basic mapping)
 */
export function getCountryName(code: string): string {
  const countryMap: Record<string, string> = {
    US: 'United States',
    GB: 'United Kingdom',
    DE: 'Germany',
    FR: 'France',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    CA: 'Canada',
    AU: 'Australia',
    JP: 'Japan',
    CN: 'China',
    IN: 'India',
    BR: 'Brazil',
    MX: 'Mexico',
    KR: 'South Korea',
    RU: 'Russia',
    TW: 'Taiwan',
    SG: 'Singapore',
    HK: 'Hong Kong',
    SE: 'Sweden',
    CH: 'Switzerland',
    NZ: 'New Zealand',
    ZA: 'South Africa',
    TR: 'Turkey',
    PL: 'Poland',
  };
  
  return countryMap[code?.toUpperCase()] || code || 'Unknown';
}
