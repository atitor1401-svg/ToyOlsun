// Slim bar pinned above the tab bar while the estimate is scrolled: total,
// per-guest cost and a button that jumps to the send section. It slides away
// once the full total card is on screen, so the two never show together.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { premiumStyles } from '@/lib/typography';
import { scaled } from '@/lib/responsive';
import { SMETA_TEXT, type SmetaLang } from './smetaText';

interface Props {
    lang: SmetaLang;
    visible: boolean;
    total: string;
    perGuest: string | null;
    count: number;
    onPress: () => void;
}

export default function SmetaStickyBar({ lang, visible, total, perGuest, count, onPress }: Props) {
    const tx = SMETA_TEXT[lang];
    const shown = useRef(new Animated.Value(visible ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(shown, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start();
    }, [visible, shown]);

    return (
        <Animated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[styles.wrap, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
        >
            <View style={styles.bar}>
                <View style={styles.info}>
                    <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                        {tx.services(count)}{perGuest ? `  ·  ${tx.perGuest} ${perGuest}` : ''}
                    </Text>
                    <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.1}>{total}</Text>
                </View>
                <TouchableOpacity style={styles.btn} activeOpacity={0.9} onPress={() => { Haptics.selectionAsync(); onPress(); }}>
                    <Text style={styles.btnText} allowFontScaling={false}>{tx.review}</Text>
                    <Feather name="arrow-down" size={15} color="#1F1A17" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    wrap: { position: 'absolute', left: 12, right: 12, bottom: 10 },
    bar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1A17', borderRadius: 20, paddingVertical: 10, paddingLeft: 18, paddingRight: 10,
        shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    },
    info: { flex: 1, marginRight: 10 },
    meta: { fontSize: 11, color: 'rgba(251,247,240,0.6)', fontWeight: '500' },
    total: { fontSize: 20, fontFamily: 'Georgia', fontWeight: '700', color: '#E3C77A', marginTop: 1 },
    btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E3C77A', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999 },
    btnText: { fontSize: 13.5, fontWeight: '700', color: '#1F1A17', letterSpacing: 0.4 },
})));
