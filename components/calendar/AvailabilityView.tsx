// Service page (customer): "Is it free on my date?" + a calendar of busy days.
// Shows nothing when the partner hasn't marked any busy days yet, so services
// that don't use the calendar don't look "always free" by mistake.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/brand';
import type { Language } from '@/app/(tabs)/index';
import { fetchBusyDates, toDayString } from '@/lib/availability';
import { CALENDAR_THEME, useCalendarLocale } from './calendarLocale';

const TEXT = {
    az: { freeOn: 'Seçdiyiniz tarixdə boşdur', busyOn: 'Seçdiyiniz tarixdə məşğuldur', show: 'Boş günlərə bax', hide: 'Təqvimi gizlət', busy: 'Məşğul' },
    ru: { freeOn: 'Свободно в выбранную дату', busyOn: 'Занято в выбранную дату', show: 'Посмотреть свободные дни', hide: 'Скрыть календарь', busy: 'Занято' },
    en: { freeOn: 'Free on your date', busyOn: 'Booked on your date', show: 'See free days', hide: 'Hide calendar', busy: 'Busy' },
};

type Props = { serviceId: string | number; eventDate: string | null; lang: Language };

export default function AvailabilityView({ serviceId, eventDate, lang }: Props) {
    useCalendarLocale(lang);
    const t = TEXT[lang];
    const [busy, setBusy] = useState<string[] | null>(null);
    const [open, setOpen] = useState(false);
    const today = toDayString(new Date());

    useEffect(() => {
        let alive = true;
        const end = new Date(); end.setFullYear(end.getFullYear() + 2);
        fetchBusyDates(serviceId, today, toDayString(end)).then(d => { if (alive) setBusy(d); });
        return () => { alive = false; };
    }, [serviceId, today]);

    const marked = useMemo(() => {
        const m: Record<string, any> = {};
        (busy || []).forEach(d => { m[d] = { disabled: true, disableTouchEvent: true, marked: true, dotColor: Colors.danger }; });
        if (eventDate) m[eventDate] = { ...(m[eventDate] || {}), selected: true, selectedColor: Colors.ink };
        return m;
    }, [busy, eventDate]);

    if (!busy || busy.length === 0) return null;
    const busyOnDate = !!eventDate && busy.includes(eventDate);

    return (
        <View style={styles.wrap}>
            {eventDate && eventDate >= today ? (
                <View style={[styles.status, busyOnDate ? styles.statusBusy : styles.statusFree]}>
                    <Feather name={busyOnDate ? 'x-circle' : 'check-circle'} size={16} color={busyOnDate ? Colors.danger : Colors.success} />
                    <Text style={[styles.statusText, { color: busyOnDate ? Colors.danger : Colors.success }]}>{busyOnDate ? t.busyOn : t.freeOn}</Text>
                </View>
            ) : null}
            <TouchableOpacity onPress={() => setOpen(o => !o)} style={styles.toggle} activeOpacity={0.7}>
                <Feather name="calendar" size={14} color={Colors.ink} />
                <Text style={styles.toggleText}>{open ? t.hide : t.show}</Text>
            </TouchableOpacity>
            {open && (
                <Calendar
                    current={eventDate && eventDate >= today ? eventDate : today}
                    minDate={today}
                    markedDates={marked}
                    firstDay={1}
                    theme={CALENDAR_THEME}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginTop: 14 },
    status: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    statusFree: { backgroundColor: Colors.successLight },
    statusBusy: { backgroundColor: Colors.dangerLight },
    statusText: { fontSize: 13.5, fontWeight: '600', marginLeft: 8 },
    toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    toggleText: { fontSize: 13.5, color: Colors.ink, marginLeft: 6, textDecorationLine: 'underline' },
});
