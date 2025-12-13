
export const kelvinToHex = (kelvin: number): string => {
    const temp = kelvin / 100;
    let r, g, b;

    if (temp <= 66) {
        r = 255;
        g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    } else {
        r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
        g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    }

    if (temp >= 66) {
        b = 255;
    } else if (temp <= 19) {
        b = 0;
    } else {
        b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    }

    const clamp = (val: number) => Math.max(0, Math.min(255, val));
    const toHex = (c: number) => ('0' + Math.round(clamp(c)).toString(16)).slice(-2);

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Map gravity (0..100) or normalized t (0..1) to the legend gradient colors.
export const gravityToHex = (value: number, isPercent = true): string => {
    // value: if isPercent true -> 0..100, else 0..1
    const t = isPercent ? Math.max(0, Math.min(100, value)) / 100 : Math.max(0, Math.min(1, value));
    // Gradient stops matching the legend
    const stops = ['#ffd400', '#9ad34a', '#3fc7a6', '#2aa6b3', '#3f6aa8', '#5b2d7a'];

    const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

    const hexToRgb = (hex: string) => {
        const h = hex.replace('#','');
        const bigint = parseInt(h, 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    const rgbToHex = (r: number, g: number, b: number) => {
        const toHex = (c: number) => ('0' + Math.round(Math.max(0, Math.min(255, c))).toString(16)).slice(-2);
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const segments = stops.length - 1;
    const seg = Math.min(segments - 1, Math.floor(t * segments));
    const segT = (t - (seg / segments)) * segments;

    const a = hexToRgb(stops[seg]);
    const b = hexToRgb(stops[seg + 1]);

    const r = lerp(a[0], b[0], segT);
    const g = lerp(a[1], b[1], segT);
    const bl = lerp(a[2], b[2], segT);

    return rgbToHex(r, g, bl);
};