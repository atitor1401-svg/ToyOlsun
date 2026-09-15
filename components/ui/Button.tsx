import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/brand';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

interface ButtonProps extends TouchableOpacityProps {
    label: string;
    variant?: Variant;
    size?: Size;
    icon?: keyof typeof Feather.glyphMap;
    loading?: boolean;
    fullWidth?: boolean;
}

const VARIANT_STYLES: Record<Variant, { bg: string; text: string }> = {
    primary: { bg: Colors.ink, text: Colors.white },
    gold: { bg: Colors.gold, text: Colors.ink },
    secondary: { bg: Colors.border, text: Colors.ink },
    ghost: { bg: 'transparent', text: Colors.ink },
    danger: { bg: Colors.dangerLight, text: Colors.danger },
};

export function Button({
    label,
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    fullWidth = false,
    disabled,
    style,
    ...rest
}: ButtonProps) {
    const v = VARIANT_STYLES[variant];
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            disabled={isDisabled}
            style={[
                styles.base,
                size === 'sm' ? styles.sizeSm : styles.sizeMd,
                { backgroundColor: v.bg },
                fullWidth && styles.fullWidth,
                isDisabled && styles.disabled,
                style,
            ]}
            {...rest}
        >
            {loading ? (
                <ActivityIndicator color={v.text} size="small" />
            ) : (
                <View style={styles.content}>
                    {icon && <Feather name={icon} size={size === 'sm' ? 15 : 17} color={v.text} style={styles.icon} />}
                    <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: v.text }]} numberOfLines={1}>
                        {label}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sizeMd: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    sizeSm: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    fullWidth: {
        width: '100%',
    },
    disabled: {
        opacity: 0.5,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        marginRight: Spacing.sm,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    labelSm: {
        fontSize: 13,
    },
});
