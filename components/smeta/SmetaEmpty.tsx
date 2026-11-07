// Empty estimate: an elegant invitation to start, with shortcuts to the
// first categories of this celebration's plan.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { premiumStyles } from '@/lib/typography';
import { scaled } from '@/lib/responsive';
import { SMETA_TEXT, type SmetaLang } from './smetaText';
import type { PlanCategory, PlanStep } from './plan';

interface Props {
    lang: SmetaLang;
    steps: PlanStep[];
    labelFor: (step: PlanStep) => string;
    onStart: (category: PlanCategory) => void;
}

export default function SmetaEmpty({ lang, steps, labelFor, onStart }: Props) {
    const tx = SMETA_TEXT[lang];
    return (
        <View style={styles.card}>
            <View style={styles.seal}>
                <Feather name="feather" size={22} color="#A8893E" />
            </View>
            <Text style={styles.title} maxFontSizeMultiplier={1.15}>{tx.emptyTitle}</Text>
            <Text style={styles.sub} maxFontSizeMultiplier={1.2}>{tx.emptySub}</Text>
            <Text style={styles.startWith} maxFontSizeMultiplier={1.1}>{tx.startWith}</Text>
            <View style={styles.list}>
                {steps.slice(0, 3).map(step => (
                    <TouchableOpacity
                        key={step.category}
                        style={styles.item}
                        activeOpacity={0.85}
                        onPress={() => { Haptics.selectionAsync(); onStart(step.category); }}
                    >
                        <Feather name={step.icon} size={16} color="#A8893E" />
                        <Text style={styles.itemText} numberOfLines={1} maxFontSizeMultiplier={1.15}>{labelFor(step)}</Text>
                        <Feather name="arrow-up-right" size={16} color="#1F1A17" />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    card: { backgroundColor: '#FFF', borderRadius: 22, borderWidth: 1, borderColor: '#EDE6DC', paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' },
    seal: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF5EA', borderWidth: 1, borderColor: '#EFE2C2', marginBottom: 14 },
    title: { fontSize: 26, fontFamily: 'Georgia', fontWeight: '600', color: '#1F1A17', textAlign: 'center' },
    sub: { fontSize: 13.5, color: '#7A6F66', textAlign: 'center', lineHeight: 20, marginTop: 8, paddingHorizontal: 6 },
    startWith: { fontSize: 10.5, fontWeight: '600', color: '#A8893E', letterSpacing: 2, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
    list: { alignSelf: 'stretch', gap: 8 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#EDE6DC', backgroundColor: '#FBF8F3' },
    itemText: { flex: 1, fontSize: 14.5, fontWeight: '500', color: '#1F1A17' },
})));
