// Short message that slides in at the top, stays ~3 seconds and hides itself.
// Show one by passing a new `toast` object (a fresh `id` replays it).
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { premiumStyles } from '@/lib/typography';
import { scaled, sz } from '@/lib/responsive';

export interface ToastMessage {
    id: number;
    title: string;
    body?: string;
}

const VISIBLE_MS = 3000;

export default function Toast({ toast, onHide }: { toast: ToastMessage | null; onHide: () => void }) {
    const shown = useRef(new Animated.Value(0)).current;
    const onHideRef = useRef(onHide);
    onHideRef.current = onHide;

    useEffect(() => {
        if (!toast) return;
        shown.setValue(0);
        const anim = Animated.sequence([
            Animated.timing(shown, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.delay(VISIBLE_MS),
            Animated.timing(shown, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]);
        anim.start(({ finished }) => { if (finished) onHideRef.current(); });
        return () => anim.stop();
    }, [toast, shown]);

    if (!toast) return null;

    return (
        <Animated.View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={[styles.wrap, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}
        >
            <View style={styles.card}>
                <View style={styles.icon}>
                    <Feather name="alert-circle" size={sz(16)} color="#1F1A17" />
                </View>
                <View style={styles.texts}>
                    <Text style={styles.title} maxFontSizeMultiplier={1.15}>{toast.title}</Text>
                    {toast.body ? <Text style={styles.body} maxFontSizeMultiplier={1.15}>{toast.body}</Text> : null}
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    wrap: { position: 'absolute', top: 10, left: 12, right: 12, zIndex: 20 },
    card: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1A17', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14,
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12,
    },
    icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E3C77A', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    texts: { flex: 1 },
    title: { fontSize: 14, fontWeight: '600', color: '#FBF7F0' },
    body: { fontSize: 12.5, color: 'rgba(251,247,240,0.75)', marginTop: 2, lineHeight: 17 },
})));
