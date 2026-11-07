// Size adaptation for small phones.
//
// Designs are drawn for a ~390×800 pt screen (a regular iPhone). On smaller
// screens (many Android phones, iPhone SE) sizes shrink in proportion, down to
// 82%. Larger screens keep the design as is, so nothing grows.
import { Dimensions } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 800;
const MIN_SCALE = 0.82;

const { width, height } = Dimensions.get('window');

export const uiScale = Math.min(1, Math.max(MIN_SCALE, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT)));

// Phones with little vertical room (most budget Android phones, iPhone SE):
// screens use tighter spacing so key buttons fit without scrolling.
export const isShortScreen = height < 760;

// Scales one number (rounded to half a point so lines stay crisp).
export const sz = (n: number): number => (uiScale === 1 ? n : Math.round(n * uiScale * 2) / 2);

// Style keys that are sizes. Borders, letter spacing, opacity, flex and
// shadows are left alone: shrinking them looks wrong.
const SIZE_KEYS = new Set([
    'fontSize', 'lineHeight',
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'padding', 'paddingVertical', 'paddingHorizontal', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
    'margin', 'marginVertical', 'marginHorizontal', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'borderRadius', 'gap', 'rowGap', 'columnGap',
    'top', 'bottom', 'left', 'right',
]);

/**
 * Scales the size values of a StyleSheet definition for small screens.
 * Pass `only` to scale just some styles (e.g. the new premium sections of a
 * big screen) and leave the rest untouched.
 */
export function scaled<T extends Record<string, any>>(styles: T, only?: (key: string) => boolean): T {
    if (uiScale === 1) return styles;
    const out: Record<string, any> = {};
    for (const key of Object.keys(styles)) {
        const style = styles[key];
        if (!style || typeof style !== 'object' || (only && !only(key))) {
            out[key] = style;
            continue;
        }
        const next: Record<string, any> = {};
        for (const prop of Object.keys(style)) {
            const v = style[prop];
            next[prop] = SIZE_KEYS.has(prop) && typeof v === 'number' ? sz(v) : v;
        }
        out[key] = next;
    }
    return out as T;
}
