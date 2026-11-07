// Instagram-style Stories row shown above the catalog. Replaces the popup
// banner: nothing blocks the screen, people tap a circle when they want.
//
// Stories come from three places:
//  - "New": the latest services added to the catalog
//  - "Top": the best-rated services
//  - every 'popup' banner from Supabase app_announcements (managed by the team)
// Seen stories get a grey ring; unseen ones a gold ring.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { premiumStyles } from '@/lib/typography';
import { scaled } from '@/lib/responsive';
import type { Announcement } from '@/components/Announcements';
import { pickAnnouncementText } from '@/components/Announcements';

type Lang = 'az' | 'ru' | 'en';

export interface StoryService {
    id: string;
    title: string;
    img: string;
    images?: string[];
    rating: string;
    price: number;
    unit: string;
    created_at?: string;
}

interface Slide {
    image?: string;
    title: string;
    body?: string;
    button?: string;
    onPress?: () => void;
}

interface Story {
    key: string;
    label: string;
    cover?: string;
    icon: keyof typeof Feather.glyphMap;
    slides: Slide[];
}

const SEEN_KEY = 'toyolsun.stories.seen';
const SLIDE_MS = 5000;

const TEXT = {
    az: { newLabel: 'Yeni', topLabel: 'Top', view: 'Bax', newTitle: 'Kataloqda yeni', topTitle: 'Ən yüksək reytinq', from: 'başlayaraq' },
    ru: { newLabel: 'Новое', topLabel: 'Топ', view: 'Смотреть', newTitle: 'Новое в каталоге', topTitle: 'Лучший рейтинг', from: 'от' },
    en: { newLabel: 'New', topLabel: 'Top', view: 'View', newTitle: 'New in the catalog', topTitle: 'Top rated', from: 'from' },
};

const photo = (s: StoryService) => s.images?.[0] || s.img;
const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')} AZN`;

interface Props {
    lang: Lang;
    services: StoryService[];
    announcements: Announcement[];
    onOpenService: (serviceId: string) => void;
    onSelectCategory: (category: string) => void;
}

export default function Stories({ lang, services, announcements, onOpenService, onSelectCategory }: Props) {
    const handlers = useRef({ onOpenService, onSelectCategory });
    handlers.current = { onOpenService, onSelectCategory };
    const tx = TEXT[lang];
    const [seen, setSeen] = useState<string[]>([]);
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    useEffect(() => {
        AsyncStorage.getItem(SEEN_KEY).then(raw => { if (raw) setSeen(JSON.parse(raw)); }).catch(() => {});
    }, []);

    const markSeen = useCallback((key: string) => {
        setSeen(prev => {
            if (prev.includes(key)) return prev;
            const next = [...prev, key];
            AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const stories = useMemo<Story[]>(() => {
        const withPhoto = services.filter(photo);
        const serviceSlide = (s: StoryService): Slide => ({
            image: photo(s),
            title: s.title,
            body: `${tx.from === 'от' ? 'от ' : ''}${money(s.price)}${tx.from !== 'от' ? ` ${tx.from}` : ''} · ★ ${s.rating}`,
            button: tx.view,
            onPress: () => handlers.current.onOpenService(String(s.id)),
        });
        const list: Story[] = [];

        const newest = [...withPhoto]
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id))
            .slice(0, 6);
        if (newest.length) list.push({ key: `new-${newest[0].id}`, label: tx.newLabel, cover: photo(newest[0]), icon: 'zap', slides: newest.map(serviceSlide) });

        const top = [...withPhoto].sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0')).slice(0, 6);
        if (top.length) list.push({ key: `top-${top.map(s => s.id).join('.')}`, label: tx.topLabel, cover: photo(top[0]), icon: 'award', slides: top.map(serviceSlide) });

        for (const a of announcements) {
            const value = (a.action_value || '').trim();
            const onPress = !a.action || !value ? undefined
                : a.action === 'service' ? () => handlers.current.onOpenService(value)
                : a.action === 'category' ? () => handlers.current.onSelectCategory(value)
                : undefined;
            const title = pickAnnouncementText(a, 'title', lang);
            list.push({
                key: `ann-${a.id}`,
                label: title.length > 10 ? `${title.slice(0, 9)}…` : title,
                cover: a.image_url || undefined,
                icon: 'gift',
                slides: [{
                    image: a.image_url || undefined,
                    title,
                    body: pickAnnouncementText(a, 'body', lang) || undefined,
                    button: onPress ? (pickAnnouncementText(a, 'button', lang) || tx.view) : undefined,
                    onPress,
                }],
            });
        }
        return list;
    }, [services, announcements, lang, tx]);

    if (stories.length === 0) return null;

    return (
        <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.rowWrap}>
                {stories.map((s, i) => {
                    const isSeen = seen.includes(s.key);
                    return (
                        <TouchableOpacity key={s.key} style={styles.item} activeOpacity={0.85} onPress={() => { Haptics.selectionAsync(); setOpenIndex(i); }}>
                            {isSeen ? (
                                <View style={[styles.ring, styles.ringSeen]}>{renderAvatar(s)}</View>
                            ) : (
                                <LinearGradient colors={['#F1D88A', '#C9A44C', '#8E6B23']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                                    {renderAvatar(s)}
                                </LinearGradient>
                            )}
                            <Text style={[styles.label, isSeen && styles.labelSeen]} numberOfLines={1} maxFontSizeMultiplier={1.1}>{s.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            {openIndex !== null && (
                <StoryViewer
                    stories={stories}
                    startIndex={openIndex}
                    onSeen={markSeen}
                    onClose={() => setOpenIndex(null)}
                />
            )}
        </>
    );
}

function renderAvatar(s: Story) {
    return (
        <View style={styles.avatar}>
            {s.cover ? (
                <Image source={{ uri: s.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
                <LinearGradient colors={['#2C2623', '#1A1614']} style={[StyleSheet.absoluteFill, styles.avatarIconWrap]}>
                    <Feather name={s.icon} size={22} color="#E3C77A" />
                </LinearGradient>
            )}
        </View>
    );
}

function StoryViewer({ stories, startIndex, onSeen, onClose }: { stories: Story[]; startIndex: number; onSeen: (key: string) => void; onClose: () => void }) {
    const insets = useSafeAreaInsets();
    const [storyIdx, setStoryIdx] = useState(startIndex);
    const [slideIdx, setSlideIdx] = useState(0);
    const progress = useRef(new Animated.Value(0)).current;
    const story = stories[storyIdx];
    const slide = story?.slides[slideIdx];

    const next = useCallback(() => {
        if (!story) return;
        if (slideIdx < story.slides.length - 1) setSlideIdx(i => i + 1);
        else if (storyIdx < stories.length - 1) { setStoryIdx(i => i + 1); setSlideIdx(0); }
        else onClose();
    }, [story, slideIdx, storyIdx, stories.length, onClose]);

    const prev = useCallback(() => {
        if (slideIdx > 0) setSlideIdx(i => i - 1);
        else if (storyIdx > 0) { setStoryIdx(i => i - 1); setSlideIdx(0); }
    }, [slideIdx, storyIdx]);

    useEffect(() => { if (story) onSeen(story.key); }, [story, onSeen]);

    useEffect(() => {
        progress.setValue(0);
        const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: true });
        anim.start(({ finished }) => { if (finished) next(); });
        return () => anim.stop();
    }, [storyIdx, slideIdx, progress, next]);

    if (!story || !slide) return null;

    const act = () => {
        if (!slide.onPress) return;
        Haptics.selectionAsync();
        const go = slide.onPress;
        onClose();
        setTimeout(go, 350); // let the modal close first (iOS can't stack modals)
    };

    return (
        <Modal visible animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
            <StatusBar barStyle="light-content" />
            <View style={styles.viewer}>
                {slide.image ? (
                    <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                ) : (
                    <LinearGradient colors={['#2C2623', '#120F0E']} style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.85)']} locations={[0, 0.22, 0.55, 1]} style={StyleSheet.absoluteFill} />

                <View style={[styles.bars, { top: insets.top + 10 }]}>
                    {story.slides.map((_, i) => (
                        <View key={i} style={styles.barTrack}>
                            <Animated.View style={[styles.barFill, {
                                transform: [{ scaleX: i < slideIdx ? 1 : i > slideIdx ? 0 : progress }],
                            }]} />
                        </View>
                    ))}
                </View>
                <View style={[styles.viewerHeader, { top: insets.top + 22 }]}>
                    <View style={styles.viewerAvatar}>{renderAvatar(story)}</View>
                    <Text style={styles.viewerName} numberOfLines={1}>{story.label}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn}>
                        <Feather name="x" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.tapZones}>
                    <Pressable style={{ flex: 1 }} onPress={prev} />
                    <Pressable style={{ flex: 2 }} onPress={next} />
                </View>

                <View style={[styles.caption, { paddingBottom: insets.bottom + 28 }]}>
                    <View style={styles.captionOrnament} />
                    <Text style={styles.captionTitle} numberOfLines={3}>{slide.title}</Text>
                    {slide.body ? <Text style={styles.captionBody} numberOfLines={4}>{slide.body}</Text> : null}
                    {slide.button ? (
                        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={act}>
                            <Text style={styles.ctaText} numberOfLines={1} allowFontScaling={false}>{slide.button}</Text>
                            <Feather name="arrow-up-right" size={16} color="#1F1A17" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create(premiumStyles(scaled({
    rowWrap: { marginBottom: 14, marginHorizontal: -4 },
    row: { paddingHorizontal: 4, gap: 14 },
    item: { alignItems: 'center', width: 70 },
    ring: { width: 68, height: 68, borderRadius: 34, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
    ringSeen: { backgroundColor: '#DDD6CD' },
    avatar: { width: '100%', height: '100%', borderRadius: 32, borderWidth: 2.5, borderColor: '#F7F3EE', overflow: 'hidden', backgroundColor: '#EFECE6' },
    avatarIconWrap: { alignItems: 'center', justifyContent: 'center' },
    label: { marginTop: 6, fontSize: 11, fontWeight: '600', color: '#1F1A17', letterSpacing: 0.3 },
    labelSeen: { color: '#8A7E75', fontWeight: '500' },

    viewer: { flex: 1, backgroundColor: '#000' },
    bars: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 3 },
    barTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
    barFill: { width: '100%', height: '100%', backgroundColor: '#FFF', transformOrigin: 'left' },
    viewerHeader: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', zIndex: 3 },
    viewerAvatar: { width: 34, height: 34, marginRight: 10 },
    viewerName: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600' },
    closeBtn: { padding: 4 },
    tapZones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 1 },
    caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, zIndex: 2 },
    captionOrnament: { width: 28, height: 1.5, backgroundColor: '#E3C77A', marginBottom: 12 },
    captionTitle: { color: '#FFF', fontSize: 32, fontFamily: 'Georgia', fontWeight: '600', lineHeight: 36 },
    captionBody: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, marginTop: 8 },
    cta: { marginTop: 20, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E3C77A', paddingVertical: 13, paddingHorizontal: 22, borderRadius: 999 },
    ctaText: { color: '#1F1A17', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
})));
