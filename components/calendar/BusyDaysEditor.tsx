// Partner dashboard: mark the days each service is already booked.
// Tap a day to switch it between free and busy; saved immediately.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/brand';
import type { Language } from '@/app/(tabs)/index';
import { fetchBusyDates, setBusyDate, toDayString } from '@/lib/availability';
import { CALENDAR_THEME, useCalendarLocale } from './calendarLocale';

const TEXT = {
    az: { title: 'Məşğul günlər', sub: 'Sifariş olunmuş günlərə toxunun. Müştərilər həmin günləri "məşğul" görəcək.', busy: 'Məşğul', free: 'Boş', failed: 'Yadda saxlanmadı. İnterneti yoxlayın.' },
    ru: { title: 'Занятые дни', sub: 'Отметьте забронированные дни. Клиенты увидят их как «занято».', busy: 'Занято', free: 'Свободно', failed: 'Не сохранено. Проверьте интернет.' },
    en: { title: 'Booked days', sub: 'Tap the days that are already booked. Customers will see them as "busy".', busy: 'Busy', free: 'Free', failed: 'Not saved. Check your connection.' },
};

type ServiceLite = { id: string | number; title: string };
type Props = { services: ServiceLite[]; lang: Language };

export default function BusyDaysEditor({ services, lang }: Props) {
    useCalendarLocale(lang);
    const t = TEXT[lang];
    const [serviceId, setServiceId] = useState<string | number | null>(services[0]?.id ?? null);
    const [busy, setBusy] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const today = toDayString(new Date());

    useEffect(() => {
        if (serviceId == null && services[0]) setServiceId(services[0].id);
    }, [services, serviceId]);

    const load = useCallback(async () => {
        if (serviceId == null) return;
        setLoading(true);
        const end = new Date(); end.setFullYear(end.getFullYear() + 2);
        const days = await fetchBusyDates(serviceId, today, toDayString(end));
        setBusy(new Set(days));
        setLoading(false);
    }, [serviceId, today]);

    useEffect(() => { load(); }, [load]);

    const toggle = async (day: DateData) => {
        if (serviceId == null || day.dateString < today) return;
        const key = day.dateString;
        const makeBusy = !busy.has(key);
        setError('');
        setBusy(prev => { const n = new Set(prev); makeBusy ? n.add(key) : n.delete(key); return n; });
        Haptics.selectionAsync();
        try {
            await setBusyDate(serviceId, key, makeBusy);
        } catch {
            setBusy(prev => { const n = new Set(prev); makeBusy ? n.delete(key) : n.add(key); return n; });
            setError(t.failed);
        }
    };

    const marked = useMemo(() => {
        const m: Record<string, any> = {};
        busy.forEach(d => { m[d] = { selected: true, selectedColor: Colors.danger }; });
        return m;
    }, [busy]);

    if (!services.length) return null;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.sub}>{t.sub}</Text>

            {services.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {services.map(s => (
                        <TouchableOpacity
                            key={s.id}
                            style={[styles.chip, String(s.id) === String(serviceId) && styles.chipOn]}
                            onPress={() => setServiceId(s.id)}
                        >
                            <Text style={[styles.chipText, String(s.id) === String(serviceId) && styles.chipTextOn]} numberOfLines={1}>{s.title}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {loading ? (
                <ActivityIndicator color={Colors.gold} style={{ marginVertical: 30 }} />
            ) : (
                <Calendar
                    minDate={today}
                    onDayPress={toggle}
                    markedDates={marked}
                    firstDay={1}
                    theme={CALENDAR_THEME}
                />
            )}

            <View style={styles.legend}>
                <View style={[styles.dot, { backgroundColor: Colors.danger }]} /><Text style={styles.legendText}>{t.busy}</Text>
                <View style={[styles.dot, { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, marginLeft: 16 }]} /><Text style={styles.legendText}>{t.free}</Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, marginTop: 18, borderWidth: 1, borderColor: Colors.border },
    title: { fontSize: 18, fontWeight: '600', color: Colors.ink },
    sub: { fontSize: 12.5, color: Colors.textMuted, marginTop: 4, marginBottom: 10, lineHeight: 18 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F4EFE9', marginRight: 8, maxWidth: 220 },
    chipOn: { backgroundColor: Colors.ink },
    chipText: { fontSize: 13, color: Colors.ink },
    chipTextOn: { color: Colors.white, fontWeight: '600' },
    legend: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
    legendText: { fontSize: 12.5, color: Colors.textSecondary },
    error: { color: Colors.danger, fontSize: 12.5, marginTop: 8 },
});
