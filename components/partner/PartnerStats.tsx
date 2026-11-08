// Partner dashboard: how many people viewed, called, messaged... per period.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/brand';
import type { Language } from '@/app/(tabs)/index';
import { type ServiceStats, type StatsPeriod, getMyServiceStats, totalsOf } from '@/lib/partnerStats';

const TEXT = {
    az: { title: 'Statistika', days: '{n} gün', views: 'Baxış', calls: 'Zəng', whatsapp: 'WhatsApp', messages: 'Mesaj', favorites: 'Seçilmiş', orders: 'Smeta', shares: 'Paylaşım', empty: 'Hələ məlumat yoxdur. Müştərilər xidmətinizə baxdıqca burada görünəcək.', perService: 'Xidmətlər üzrə', failed: 'Yüklənmədi' },
    ru: { title: 'Статистика', days: '{n} дн.', views: 'Просмотры', calls: 'Звонки', whatsapp: 'WhatsApp', messages: 'Сообщения', favorites: 'Избранное', orders: 'Сметы', shares: 'Репосты', empty: 'Пока нет данных. Они появятся, когда клиенты начнут смотреть ваши услуги.', perService: 'По услугам', failed: 'Не загрузилось' },
    en: { title: 'Statistics', days: '{n} days', views: 'Views', calls: 'Calls', whatsapp: 'WhatsApp', messages: 'Messages', favorites: 'Saved', orders: 'Estimates', shares: 'Shares', empty: 'No data yet. It will appear as customers view your services.', perService: 'By service', failed: 'Could not load' },
};

const PERIODS: StatsPeriod[] = [7, 30, 90];
type Metric = 'views' | 'calls' | 'whatsapp' | 'messages' | 'favorites' | 'orders';
const METRICS: { key: Metric; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'views', icon: 'eye' },
    { key: 'calls', icon: 'phone' },
    { key: 'whatsapp', icon: 'message-square' },
    { key: 'messages', icon: 'message-circle' },
    { key: 'favorites', icon: 'heart' },
    { key: 'orders', icon: 'file-text' },
];

export default function PartnerStats({ lang, refreshKey }: { lang: Language; refreshKey?: unknown }) {
    const t = TEXT[lang];
    const [period, setPeriod] = useState<StatsPeriod>(30);
    const [rows, setRows] = useState<ServiceStats[] | null>(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(() => {
        setFailed(false);
        setRows(null);
        getMyServiceStats(period).then(setRows).catch(() => { setFailed(true); setRows([]); });
    }, [period]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const totals = rows ? totalsOf(rows) : null;
    const nothing = totals && METRICS.every(m => totals[m.key] === 0);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>{t.title}</Text>
                <View style={styles.periods}>
                    {PERIODS.map(p => (
                        <TouchableOpacity key={p} style={[styles.period, p === period && styles.periodOn]} onPress={() => setPeriod(p)}>
                            <Text style={[styles.periodText, p === period && styles.periodTextOn]}>{t.days.replace('{n}', String(p))}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {!rows ? (
                <ActivityIndicator color={Colors.gold} style={{ marginVertical: 20 }} />
            ) : failed ? (
                <Text style={styles.empty}>{t.failed}</Text>
            ) : (
                <>
                    <View style={styles.grid}>
                        {METRICS.map(m => (
                            <View key={m.key} style={styles.tile}>
                                <Feather name={m.icon} size={15} color={Colors.gold} />
                                <Text style={styles.value}>{totals![m.key]}</Text>
                                <Text style={styles.label} numberOfLines={1}>{t[m.key]}</Text>
                            </View>
                        ))}
                    </View>
                    {nothing ? <Text style={styles.empty}>{t.empty}</Text> : rows.length > 1 && (
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.subTitle}>{t.perService}</Text>
                            {rows.map(r => (
                                <View key={r.service_id} style={styles.svcRow}>
                                    <Text style={styles.svcTitle} numberOfLines={1}>{r.title}</Text>
                                    <Text style={styles.svcNums}>
                                        <Feather name="eye" size={12} color={Colors.textMuted} /> {r.views}   <Feather name="phone" size={12} color={Colors.textMuted} /> {r.calls + r.whatsapp}   <Feather name="message-circle" size={12} color={Colors.textMuted} /> {r.messages}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, marginTop: 18, borderWidth: 1, borderColor: Colors.border },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
    title: { fontSize: 18, fontWeight: '600', color: Colors.ink, marginRight: 8 },
    periods: { flexDirection: 'row', backgroundColor: '#F4EFE9', borderRadius: 16, padding: 3 },
    period: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 13 },
    periodOn: { backgroundColor: Colors.ink },
    periodText: { fontSize: 12, color: Colors.ink },
    periodTextOn: { color: Colors.white, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginHorizontal: -4 },
    tile: { width: '33.33%', padding: 4 },
    value: { fontSize: 22, fontWeight: '700', color: Colors.ink, marginTop: 4 },
    label: { fontSize: 12, color: Colors.textMuted },
    empty: { fontSize: 12.5, color: Colors.textMuted, marginTop: 10, lineHeight: 18 },
    subTitle: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: Colors.textMuted, marginBottom: 6 },
    svcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
    svcTitle: { flex: 1, fontSize: 13.5, color: Colors.ink, marginRight: 10 },
    svcNums: { fontSize: 12.5, color: Colors.textSecondary },
});
