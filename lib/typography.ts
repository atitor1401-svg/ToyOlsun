// Premium typography for the whole app.
//
// Headings use Cormorant Garamond (an elegant serif), everything else uses
// Inter. Both include every Azerbaijani letter (ə ğ ı ş ç ö ü and capitals).
//
// Screens keep writing normal styles (fontWeight + optional serif family);
// `premiumStyles()` swaps in the matching font file. Android ignores
// fontWeight for custom fonts, so each weight must be its own family name.
// If the fonts haven't loaded (or ever fail), text falls back to the system
// font, so nothing can break.
import {
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    CormorantGaramond_400Regular_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from '@expo-google-fonts/inter';

export const fontAssets = {
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    CormorantGaramond_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
};

export const Type = {
    display: 'CormorantGaramond_700Bold',
    displaySemi: 'CormorantGaramond_600SemiBold',
    displayMedium: 'CormorantGaramond_500Medium',
    displayItalic: 'CormorantGaramond_400Regular_Italic',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemi: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
};

const SERIF_SYSTEM = new Set(['Georgia', 'serif', 'Times New Roman']);
const SANS_SYSTEM = new Set(['Helvetica Neue', 'sans-serif', 'System']);

function weightNumber(w: unknown): number {
    if (w === 'bold') return 700;
    if (w === undefined || w === 'normal') return 400;
    const n = parseInt(String(w), 10);
    return isNaN(n) ? 400 : n;
}

function familyFor(style: Record<string, any>): string | undefined {
    const ff = style.fontFamily;
    if (ff && !SERIF_SYSTEM.has(ff) && !SANS_SYSTEM.has(ff)) return undefined; // already a custom font
    const w = weightNumber(style.fontWeight);
    if (ff && SERIF_SYSTEM.has(ff)) {
        if (style.fontStyle === 'italic') return Type.displayItalic;
        return w >= 700 ? Type.display : w >= 600 ? Type.displaySemi : Type.displayMedium;
    }
    return w >= 700 ? Type.bodyBold : w >= 600 ? Type.bodySemi : w >= 500 ? Type.bodyMedium : Type.body;
}

// Adds the premium font to every text style (anything with fontSize,
// fontWeight or fontFamily) in a StyleSheet definition.
export function premiumStyles<T extends Record<string, any>>(styles: T): T {
    const out: Record<string, any> = {};
    for (const key of Object.keys(styles)) {
        const s = styles[key];
        if (s && typeof s === 'object' && ('fontSize' in s || 'fontWeight' in s || 'fontFamily' in s)) {
            const family = familyFor(s);
            if (family) {
                const { fontWeight, ...rest } = s;
                out[key] = { ...rest, fontFamily: family };
                continue;
            }
        }
        out[key] = s;
    }
    return out as T;
}
