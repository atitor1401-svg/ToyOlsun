// "Celebration plan": every kind of service for this event as a compact
// 3-column grid. Chosen ones get a gold tick; the rest open that catalog
// section on tap, so nothing important is forgotten.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { premiumStyles } from '@/lib/typography';
import { scaled, sz } from '@/lib/responsive';
import { SMETA_TEXT, type SmetaLang } from './smetaText';
import { isStepCovered, type PlanCategory, type PlanStep } from './plan';

interface Props {
    lang: SmetaLang;
    steps: PlanStep[];
    cart: { category: string; title?: string; tags?: string[] }[];
    labelFor: (step: PlanStep) => string;
    onAdd: (category: PlanCategory) => void;
}

export default function SmetaPlan({ lang, steps, cart, labelFor, onAdd }: Props) {
    const tx = SMETA_TEXT[lang];
    const covered = steps.map(step => isStepCovered(step, cart));
    const done = covered.filter(Boolean).length;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title} maxFontSizeMultiplier={1.15}>{tx.planTitle}</Text>
                <Text style={styles.progressText} maxFontSizeMultiplier={1.1}>{tx.planProgress(done, steps.length)}</Text>
            </View>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${steps.length ? (done / steps.length) * 100 : 0}%` }]} />
            </View>
            <View style={styles.grid}>
                {steps.map((step, i) => {
                    const isDone = covered[i];
                    return (
                        <TouchableOpacity
                            key={step.category}
                            style={[styles.tile, isDone && styles.tileDone]}
                            activeOpacity={0.8}
                            disabled={isDone}
                            accessibilityLabel={`${labelFor(step)}: ${isDone ? tx.chosen : tx.add}`}
                            onPress={() => { Haptics.selectionAsync(); onAdd(step.category); }}
                        >
                            <View style={[styles.icon, isDone && styles.iconDone]}>
                                <Feather name={isDone ? 'check' : step.icon} size={sz(14)} color={isDone ? '#1F1A17' : '#A8893E'} />
                            </View>
                            <Text style={[styles.label, isDone && styles.labelDone]} numberOfLines={2} maxFontSizeMultiplier={1.1}>{labelFor(step)}</Text>
                            {!isDone && <Feather name="plus" size={sz(12)} color="#A8893E" style={styles.plus} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    card: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#EDE6DC', padding: 16, marginBottom: 16 },
    header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    title: { fontSize: 20, fontFamily: 'Georgia', fontWeight: '600', color: '#1F1A17' },
    progressText: { fontSize: 12, fontWeight: '500', color: '#8A7E75' },
    track: { height: 3, borderRadius: 2, backgroundColor: '#F1ECE4', marginTop: 10, marginBottom: 12, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 2, backgroundColor: '#C9A44C' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    tile: {
        width: '33.333%', paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center',
        borderRadius: 14, borderWidth: 4, borderColor: '#FFF', backgroundColor: '#FBF8F3',
    },
    tileDone: { backgroundColor: '#FBF4E2' },
    icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFE2C2' },
    iconDone: { backgroundColor: '#E3C77A', borderColor: '#E3C77A' },
    label: { fontSize: 11.5, fontWeight: '500', color: '#1F1A17', textAlign: 'center', marginTop: 6, lineHeight: 14 },
    labelDone: { color: '#8A6D1F', fontWeight: '600' },
    plus: { position: 'absolute', top: 6, right: 7 },
})));
