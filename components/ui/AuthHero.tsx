// Elegant brand header for the sign-in / sign-up screens (customer and
// partner): small gold kicker, serif "Toy Olsun", a thin ornament and a
// one-line promise.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { premiumStyles } from '@/lib/typography';
import { scaled } from '@/lib/responsive';

export default function AuthHero({ kicker, title = 'Toy Olsun', subtitle }: { kicker: string; title?: string; subtitle?: string }) {
    return (
        <View style={styles.wrap}>
            <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>{kicker}</Text>
            <Text style={styles.title} maxFontSizeMultiplier={1.1}>{title}</Text>
            <View style={styles.ornament}>
                <View style={styles.line} />
                <View style={styles.diamond} />
                <View style={styles.line} />
            </View>
            {subtitle ? <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>{subtitle}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    wrap: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
    kicker: { fontSize: 11, fontWeight: '600', color: '#A8893E', letterSpacing: 3, textTransform: 'uppercase' },
    title: { fontSize: 42, fontFamily: 'Georgia', fontWeight: '600', color: '#1F1A17', marginTop: 6, lineHeight: 48 },
    ornament: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    line: { width: 36, height: StyleSheet.hairlineWidth * 2, backgroundColor: '#C9A44C' },
    diamond: { width: 6, height: 6, backgroundColor: '#C9A44C', transform: [{ rotate: '45deg' }], marginHorizontal: 8 },
    subtitle: { fontSize: 13, color: '#7A6F66', marginTop: 12, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
})));
