// ToyOlsun brand design tokens — single source of truth for colors, radius,
// spacing and shadows so every screen renders the same "premium" visual
// language instead of each file redefining its own button/card recipe.
import { Platform } from 'react-native';

export const Colors = {
    ink: '#2C2623',
    gold: '#D4AF37',
    cream: '#FAF8F5',
    white: '#FFFFFF',
    border: '#EFECE6',
    textMuted: '#8A7E75',
    textPlaceholder: '#A0968E',
    textSecondary: '#6A625C',
    danger: '#B0392C',
    dangerLight: '#F5DCD9',
    success: '#2F7D5C',
    successLight: '#DCEEDC',
};

export const Radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const Shadow = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    modal: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
};

export const Fonts = {
    serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    sans: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
};
