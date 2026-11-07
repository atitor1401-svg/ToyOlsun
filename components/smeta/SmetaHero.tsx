// Dark "invitation" card at the top of the estimate: event, date, guests and
// the countdown, set in the brand's serif with gold details.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { premiumStyles } from '@/lib/typography';
import { scaled } from '@/lib/responsive';
import { SMETA_TEXT, type SmetaLang } from './smetaText';

interface Props {
    lang: SmetaLang;
    eventTitle: string;
    date: string;
    guests: number;
    daysLeft: number;
}

export default function SmetaHero({ lang, eventTitle, date, guests, daysLeft }: Props) {
    const tx = SMETA_TEXT[lang];
    return (
        <LinearGradient colors={['#2E2724', '#1A1614']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
            <View style={styles.frame} pointerEvents="none" />
            <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>{eventTitle}</Text>
            <Text style={styles.title} maxFontSizeMultiplier={1.1}>{tx.heroKicker}</Text>
            <View style={styles.ornament}>
                <View style={styles.line} />
                <View style={styles.diamond} />
                <View style={styles.line} />
            </View>
            <View style={styles.stats}>
                <Stat label={tx.date} value={date} />
                <View style={styles.divider} />
                <Stat label={tx.guests} value={String(guests)} />
                <View style={styles.divider} />
                <Stat label={tx.daysLeft} value={String(Math.max(daysLeft, 0))} />
            </View>
        </LinearGradient>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.1}>{value}</Text>
            <Text style={styles.statLabel} numberOfLines={1} maxFontSizeMultiplier={1.1}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    card: { borderRadius: 22, paddingVertical: 26, paddingHorizontal: 20, alignItems: 'center', marginBottom: 18, overflow: 'hidden' },
    frame: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(227,199,122,0.45)' },
    kicker: { fontSize: 10.5, fontWeight: '600', color: '#C9A44C', letterSpacing: 2.6, textTransform: 'uppercase', textAlign: 'center' },
    title: { fontSize: 34, fontFamily: 'Georgia', fontWeight: '600', color: '#FBF7F0', marginTop: 6, lineHeight: 40, textAlign: 'center' },
    ornament: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 18 },
    line: { width: 30, height: 1, backgroundColor: 'rgba(227,199,122,0.7)' },
    diamond: { width: 5, height: 5, backgroundColor: '#E3C77A', transform: [{ rotate: '45deg' }], marginHorizontal: 8 },
    stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
    stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    statValue: { fontSize: 22, fontFamily: 'Georgia', fontWeight: '600', color: '#E3C77A' },
    statLabel: { fontSize: 10, fontWeight: '500', color: 'rgba(251,247,240,0.6)', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
    divider: { width: 1, height: 30, backgroundColor: 'rgba(227,199,122,0.25)' },
})));
