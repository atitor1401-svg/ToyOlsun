// Wedding preparation checklist (bottom sheet).
// Groups: "do now" (time has come, not done), "later", "done".
// Each item can open the matching catalogue section.
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/brand';
import { IconButton } from '@/components/ui/IconButton';
import type { CategoryFilter, Language } from '@/app/(tabs)/index';
import { CHECKLIST, type ChecklistItem, isDue } from '@/lib/weddingPlan';

const TEXT = {
    az: { title: 'Toy hazırlığı', now: 'İndi vaxtıdır', later: 'Sonra', done: 'Hazırdır', progress: '{d} / {n} hazırdır', left: 'Toya {n} gün qaldı', past: 'Tarix keçib', months: '{n} ay qalmış', weeks: '{n} həftə qalmış', last: 'Son həftə', open: 'Bax', noDate: 'Tarixi seçin ki, nə vaxt nə etmək lazım olduğunu göstərək.' },
    ru: { title: 'Подготовка к свадьбе', now: 'Пора сделать', later: 'Позже', done: 'Готово', progress: 'Готово {d} из {n}', left: 'До свадьбы {n} дн.', past: 'Дата прошла', months: 'за {n} мес.', weeks: 'за {n} нед.', last: 'Последняя неделя', open: 'Смотреть', noDate: 'Выберите дату, чтобы мы подсказали, что и когда делать.' },
    en: { title: 'Wedding prep', now: 'Time to do', later: 'Later', done: 'Done', progress: '{d} of {n} done', left: '{n} days to the wedding', past: 'Date has passed', months: '{n} months before', weeks: '{n} weeks before', last: 'Final week', open: 'View', noDate: 'Pick your date so we can show what to do and when.' },
};

type Props = {
    visible: boolean;
    lang: Language;
    daysLeft: number | null;
    done: string[];
    onToggle: (key: string) => void;
    onOpenCategory: (c: CategoryFilter) => void;
    onClose: () => void;
};

export default function ChecklistModal({ visible, lang, daysLeft, done, onToggle, onOpenCategory, onClose }: Props) {
    const t = TEXT[lang];
    const insets = useSafeAreaInsets();
    const isDone = (i: ChecklistItem) => done.includes(i.key);
    const now = CHECKLIST.filter(i => !isDone(i) && isDue(i, daysLeft));
    const later = CHECKLIST.filter(i => !isDone(i) && !isDue(i, daysLeft));
    const finished = CHECKLIST.filter(isDone);
    const pct = Math.round((finished.length / CHECKLIST.length) * 100);

    const when = (i: ChecklistItem) =>
        i.monthsBefore === 0 ? t.last
            : i.monthsBefore < 1 ? t.weeks.replace('{n}', String(Math.round(i.monthsBefore * 4)))
            : t.months.replace('{n}', String(i.monthsBefore));

    const Row = ({ item }: { item: ChecklistItem }) => {
        const checked = isDone(item);
        return (
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.check, checked && styles.checkOn]}
                    onPress={() => { Haptics.selectionAsync(); onToggle(item.key); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                >
                    {checked && <Feather name="check" size={14} color={Colors.white} />}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, checked && styles.itemDone]}>{item.title[lang]}</Text>
                    <Text style={styles.itemWhen}>{when(item)}</Text>
                </View>
                {item.category && !checked && (
                    <TouchableOpacity style={styles.openBtn} onPress={() => { onClose(); onOpenCategory(item.category!); }}>
                        <Text style={styles.openText}>{t.open}</Text>
                        <Feather name="chevron-right" size={14} color={Colors.ink} />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const Group = ({ title, items }: { title: string; items: ChecklistItem[] }) =>
        items.length ? (
            <View style={{ marginTop: 18 }}>
                <Text style={styles.groupTitle}>{title}</Text>
                {items.map(i => <Row key={i.key} item={i} />)}
            </View>
        ) : null;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t.title}</Text>
                        <IconButton icon="x" onPress={onClose} />
                    </View>

                    <View style={styles.summary}>
                        <Text style={styles.countdown}>
                            {daysLeft == null ? t.noDate : daysLeft < 0 ? t.past : t.left.replace('{n}', String(daysLeft))}
                        </Text>
                        <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>
                        <Text style={styles.progress}>{t.progress.replace('{d}', String(finished.length)).replace('{n}', String(CHECKLIST.length))}</Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Group title={t.now} items={now} />
                        <Group title={t.later} items={later} />
                        <Group title={t.done} items={finished} />
                        <View style={{ height: 12 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(20,16,14,0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#F7F3EE', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, maxHeight: '88%' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 24, fontWeight: '600', color: Colors.ink, fontFamily: 'Georgia' },
    summary: { backgroundColor: Colors.ink, borderRadius: 18, padding: 16, marginTop: 14 },
    countdown: { color: Colors.white, fontSize: 17, fontWeight: '600' },
    bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 12, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3, backgroundColor: Colors.gold },
    progress: { color: '#CFC5BB', fontSize: 12.5, marginTop: 8 },
    groupTitle: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: Colors.textMuted, marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
    check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#B9AEA4', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    checkOn: { backgroundColor: Colors.success, borderColor: Colors.success },
    itemTitle: { fontSize: 14.5, color: Colors.ink, fontWeight: '500' },
    itemDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
    itemWhen: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
    openBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F4EFE9', marginLeft: 8 },
    openText: { fontSize: 12.5, color: Colors.ink, marginRight: 2 },
});
