// In-app information banners managed from Supabase (table app_announcements).
// - 'popup': a card shown once when the catalog opens.
// - 'strip': a slim, dismissible bar above the catalog.
// Each banner is shown once per phone; dismissed ids are kept in AsyncStorage.
// Any failure (no table yet, offline) simply shows nothing.
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Colors as Brand } from '@/constants/brand';

type Lang = 'az' | 'ru' | 'en';

interface Announcement {
    id: number;
    style: 'popup' | 'strip';
    priority: number;
    title_az: string; title_ru: string | null; title_en: string | null;
    body_az: string | null; body_ru: string | null; body_en: string | null;
    button_az: string | null; button_ru: string | null; button_en: string | null;
    image_url: string | null;
    action: 'service' | 'category' | 'url' | null;
    action_value: string | null;
}

const SEEN_KEY = 'toyolsun.announcements.seen';
const CLOSE = { az: 'Bağla', ru: 'Закрыть', en: 'Close' };
const VIEW = { az: 'Bax', ru: 'Смотреть', en: 'View' };

const pick = (a: Announcement, field: 'title' | 'body' | 'button', lang: Lang): string =>
    ((a as any)[`${field}_${lang}`] || (a as any)[`${field}_az`] || '') as string;

interface Props {
    lang: Lang;
    onOpenService: (serviceId: string) => void;
    onSelectCategory: (category: string) => void;
}

export function useAnnouncements() {
    const [items, setItems] = useState<Announcement[]>([]);
    const [seen, setSeen] = useState<number[] | null>(null);

    useEffect(() => {
        let alive = true;
        AsyncStorage.getItem(SEEN_KEY)
            .then(raw => { if (alive) setSeen(raw ? JSON.parse(raw) : []); })
            .catch(() => { if (alive) setSeen([]); });
        supabase
            .from('app_announcements')
            .select('*')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (alive && !error && Array.isArray(data)) setItems(data as Announcement[]);
            });
        return () => { alive = false; };
    }, []);

    const markSeen = useCallback((id: number) => {
        setSeen(prev => {
            const next = [...(prev || []), id];
            AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const unseen = seen ? items.filter(a => !seen.includes(a.id)) : [];
    return {
        popup: unseen.find(a => a.style === 'popup') || null,
        strip: unseen.find(a => a.style === 'strip') || null,
        markSeen,
    };
}

const runAction = (a: Announcement, props: Props, delayForModal: boolean) => {
    const value = (a.action_value || '').trim();
    if (!a.action || !value) return;
    const go = () => {
        if (a.action === 'service') props.onOpenService(value);
        else if (a.action === 'category') props.onSelectCategory(value);
        else if (a.action === 'url' && /^https?:\/\//i.test(value)) Linking.openURL(value).catch(() => {});
    };
    // iOS can't present the service sheet while the popup is still closing.
    if (delayForModal) setTimeout(go, 400); else go();
};

export function AnnouncementPopup(props: Props & { item: Announcement | null; onDone: (id: number) => void }) {
    const { item, lang, onDone } = props;
    if (!item) return null;
    const title = pick(item, 'title', lang);
    const body = pick(item, 'body', lang);
    const hasAction = !!item.action && !!item.action_value;
    const button = pick(item, 'button', lang) || VIEW[lang];

    return (
        <Modal visible transparent animationType="fade" onRequestClose={() => onDone(item.id)}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" transition={150} />
                    ) : null}
                    <View style={styles.cardBody}>
                        <Text style={styles.title} maxFontSizeMultiplier={1.2}>{title}</Text>
                        {body ? <Text style={styles.body} maxFontSizeMultiplier={1.2}>{body}</Text> : null}
                        <View style={styles.actions}>
                            {hasAction && (
                                <TouchableOpacity
                                    style={[styles.btn, styles.btnPrimary]}
                                    activeOpacity={0.85}
                                    onPress={() => { Haptics.selectionAsync(); onDone(item.id); runAction(item, props, true); }}
                                >
                                    <Text style={styles.btnPrimaryText} numberOfLines={1} allowFontScaling={false}>{button}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.btn, styles.btnGhost]} activeOpacity={0.85} onPress={() => onDone(item.id)}>
                                <Text style={styles.btnGhostText} numberOfLines={1} allowFontScaling={false}>{CLOSE[lang]}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export function AnnouncementStrip(props: Props & { item: Announcement | null; onDone: (id: number) => void }) {
    const { item, lang, onDone } = props;
    if (!item) return null;
    const title = pick(item, 'title', lang);
    const tappable = !!item.action && !!item.action_value;
    return (
        <View style={styles.strip}>
            <TouchableOpacity
                style={styles.stripMain}
                activeOpacity={tappable ? 0.7 : 1}
                disabled={!tappable}
                onPress={() => { Haptics.selectionAsync(); runAction(item, props, false); }}
            >
                <Feather name="bell" size={15} color={Brand.gold} />
                <Text style={styles.stripText} numberOfLines={2} maxFontSizeMultiplier={1.2}>{title}</Text>
                {tappable && <Feather name="chevron-right" size={16} color={Brand.textMuted} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDone(item.id)} hitSlop={10} style={styles.stripClose}>
                <Feather name="x" size={16} color={Brand.textMuted} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    card: { width: '100%', maxWidth: 380, backgroundColor: Brand.white, borderRadius: 20, overflow: 'hidden' },
    image: { width: '100%', aspectRatio: 16 / 10, backgroundColor: Brand.border },
    cardBody: { padding: 20 },
    title: { fontSize: 20, fontWeight: '700', color: Brand.ink, textAlign: 'center' },
    body: { fontSize: 15, color: Brand.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 21 },
    actions: { marginTop: 18, gap: 8 },
    btn: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    btnPrimary: { backgroundColor: Brand.ink },
    btnPrimaryText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
    btnGhost: { backgroundColor: 'transparent' },
    btnGhostText: { color: Brand.textMuted, fontSize: 15, fontWeight: '600' },

    strip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E6',
        borderWidth: 1, borderColor: '#F0E0B0', borderRadius: 14, marginBottom: 12, paddingLeft: 12,
    },
    stripMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
    stripText: { flex: 1, fontSize: 14, color: Brand.ink, fontWeight: '600' },
    stripClose: { paddingHorizontal: 12, paddingVertical: 11 },
});
