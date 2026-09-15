import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/constants/brand';

interface CardProps extends ViewProps {
    padded?: boolean;
    elevated?: boolean;
}

// One shared card recipe (white bg, 16 radius, hairline border) instead of
// each screen retyping its own with radius drifting between 12/14/16.
export function Card({ padded = true, elevated = false, style, children, ...rest }: CardProps) {
    return (
        <View
            style={[
                styles.base,
                padded && styles.padded,
                elevated && Shadow.card,
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    padded: {
        padding: Spacing.lg,
    },
});
