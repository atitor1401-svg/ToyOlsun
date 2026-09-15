import React from 'react';
import { StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/brand';

interface IconButtonProps extends TouchableOpacityProps {
    icon: keyof typeof Feather.glyphMap;
    size?: number;
    variant?: 'light' | 'dark';
    iconColor?: string;
}

// Circular icon-only button — replaces the various dashIconBtn/closeBtn/
// rootCloseBtn one-offs that each hand-picked a diameter and background.
export function IconButton({ icon, size = 34, variant = 'light', iconColor, style, ...rest }: IconButtonProps) {
    const bg = variant === 'dark' ? 'rgba(44,38,35,0.85)' : Colors.border;
    const color = iconColor ?? (variant === 'dark' ? Colors.white : Colors.ink);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[
                styles.base,
                { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
                style,
            ]}
            {...rest}
        >
            <Feather name={icon} size={size * 0.5} color={color} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
