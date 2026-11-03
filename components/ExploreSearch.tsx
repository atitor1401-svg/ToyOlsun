// Full-screen, Instagram-style "Explore" search for the catalog.
// - Empty query: recent searches, popular tags and a photo mosaic.
// - Typing: instant results across title, tags, category, address and
//   description; forgiving about Azerbaijani letters (ə/e, ş/s, ç/c, ı/i...).
// Rendered as an overlay inside the catalog screen (not a Modal), so the
// service detail modal can open on top of it and closing that returns here.
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated, BackHandler, FlatList, Keyboard, Platform, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors as Brand } from '@/constants/brand';
import { matchesCategory } from '@/lib/categories';

type Lang = 'az' | 'ru' | 'en';

export interface ExploreService {
    id: string;
    category: string;
    title: string;
    price: number;
    unit: string;
    rating: string;
    img: string;
    tags: string[];
    address?: string;
    description?: string;
    images?: string[];
}

interface Props<T extends ExploreService> {
    visible: boolean;
    onClose: () => void;
    services: T[];
    lang: Lang;
    onOpenService: (item: T) => void;
    tagLabel: (tag: string, lang: Lang) => string;
    formatPrice: (value: number) => string;
}

const TEXT = {
    az: {
        placeholder: 'Zal, müğənni, fotoqraf axtar…', cancel: 'Ləğv et', recent: 'Son axtarışlar',
        clear: 'Təmizlə', popular: 'Populyar', explore: 'Kəşf et', services: 'Xidmətlər', tags: 'Etiketlər',
        noResults: 'Heç nə tapılmadı', noResultsSub: 'Başqa söz yoxlayın və ya kateqoriyanı dəyişin',
    },
    ru: {
        placeholder: 'Найти зал, певца, фотографа…', cancel: 'Отмена', recent: 'Недавние',
        clear: 'Очистить', popular: 'Популярное', explore: 'Интересное', services: 'Услуги', tags: 'Теги',
        noResults: 'Ничего не найдено', noResultsSub: 'Попробуйте другое слово или категорию',
    },
    en: {
        placeholder: 'Search venues, singers, photographers…', cancel: 'Cancel', recent: 'Recent',
        clear: 'Clear', popular: 'Popular', explore: 'Explore', services: 'Services', tags: 'Tags',
        noResults: 'No results', noResultsSub: 'Try another word or category',
    },
};

const CATEGORIES: { id: string; az: string; ru: string; en: string }[] = [
    { id: 'all', az: 'Hamısı', ru: 'Все', en: 'All' },
    { id: 'venues', az: 'Zallar', ru: 'Залы', en: 'Venues' },
    { id: 'artists', az: 'Artistlər', ru: 'Артисты', en: 'Artists' },
    { id: 'dj', az: 'DJ', ru: 'DJ', en: 'DJ' },
    { id: 'media', az: 'Foto & Video', ru: 'Фото и Видео', en: 'Photo & Video' },
    { id: 'cars', az: 'VIP Kortej', ru: 'VIP Кортеж', en: 'VIP Cortege' },
    { id: 'wedding_dress', az: 'Gəlinlik', ru: 'Свадебное платье', en: 'Wedding Dress' },
    { id: 'flowers', az: 'Gül Dükanı', ru: 'Цветочный магазин', en: 'Flower Shop' },
    { id: 'decor', az: 'Dekor', ru: 'Декор', en: 'Decor' },
    { id: 'tourism', az: 'Bal Ayı', ru: 'Медовый месяц', en: 'Honeymoon' },
];
const categoryName = (id: string, lang: Lang) => CATEGORIES.find(c => c.id === id)?.[lang] ?? '';

const RECENT_KEY = 'toyolsun.explore.recent';
const MAX_RECENT = 8;
const GAP = 2;

// Lower-cases and folds letters so "sebine" finds "Səbinə". Works one UTF-16
// unit at a time and always returns a string of the same length, so match
// positions can be used to highlight the original text.
const FOLD: Record<string, string> = { 'ə': 'e', 'ı': 'i', 'ё': 'е' };
const fold = (input: string): string => {
    let out = '';
    for (let i = 0; i < input.length; i++) {
        const lower = input[i].toLowerCase();
        const mapped = FOLD[lower] ?? lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
        out += mapped.charAt(0) || input[i];
    }
    return out;
};

// Stable shuffle that changes once a day, so the mosaic feels fresh without
// jumping around while someone is browsing.
const dailyOrder = <T extends ExploreService>(items: T[]): T[] => {
    const day = new Date().toISOString().slice(0, 10);
    const hash = (s: string) => {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        return h >>> 0;
    };
    return [...items].sort((a, b) => hash(day + a.id) - hash(day + b.id));
};

const coverOf = (s: ExploreService) => s.images?.[0] || s.img;

export default function ExploreSearch<T extends ExploreService>({
    visible, onClose, services, lang, onOpenService, tagLabel, formatPrice,
}: Props<T>) {
    const t = TEXT[lang];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
    const appear = useRef(new Animated.Value(0)).current;

    const [mounted, setMounted] = useState(visible);
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);
    const [category, setCategory] = useState('all');
    const [recent, setRecent] = useState<string[]>([]);

    // Fade/slide in and out; stay mounted until the exit animation ends.
    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(appear, { toValue: 1, duration: 220, useNativeDriver: true }).start();
            const focus = setTimeout(() => inputRef.current?.focus(), 250);
            return () => clearTimeout(focus);
        }
        Keyboard.dismiss();
        Animated.timing(appear, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
            if (finished) setMounted(false);
        });
    }, [visible, appear]);

    useEffect(() => {
        AsyncStorage.getItem(RECENT_KEY)
            .then(raw => { if (raw) setRecent(JSON.parse(raw)); })
            .catch(() => { /* recent searches are a convenience only */ });
    }, []);

    const saveRecent = useCallback((term: string) => {
        const clean = term.trim();
        if (clean.length < 2) return;
        setRecent(prev => {
            const next = [clean, ...prev.filter(r => fold(r) !== fold(clean))].slice(0, MAX_RECENT);
            AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const removeRecent = useCallback((term: string) => {
        setRecent(prev => {
            const next = prev.filter(r => r !== term);
            AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const clearRecent = useCallback(() => {
        setRecent([]);
        AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
    }, []);

    const close = useCallback(() => {
        Keyboard.dismiss();
        onClose();
    }, [onClose]);

    // Android hardware back closes the explore screen first.
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
        return () => sub.remove();
    }, [visible, close]);

    const inCategory = useMemo(
        () => (category === 'all' ? services : services.filter(s => matchesCategory(s, category))),
        [services, category],
    );

    // Pre-folded search text per service, built once per data change.
    const index = useMemo(() => inCategory.map(s => {
        const tagText = (s.tags || []).map(tag =>
            [tagLabel(tag, 'az'), tagLabel(tag, 'ru'), tagLabel(tag, 'en')].join(' ')).join(' ');
        const cat = CATEGORIES.find(c => c.id === s.category);
        return {
            item: s,
            title: fold(s.title || ''),
            tags: fold(tagText),
            category: fold(cat ? `${cat.az} ${cat.ru} ${cat.en}` : ''),
            address: fold(s.address || ''),
            description: fold(s.description || ''),
        };
    }), [inCategory, tagLabel]);

    const tokens = useMemo(() => fold(deferredQuery).split(/\s+/).filter(Boolean), [deferredQuery]);

    const results = useMemo(() => {
        if (tokens.length === 0) return [];
        const scored: { item: T; score: number }[] = [];
        for (const row of index) {
            let score = 0;
            let all = true;
            for (const tok of tokens) {
                let best = 0;
                if (row.title.startsWith(tok)) best = 10;
                else if (row.title.includes(' ' + tok)) best = 8;
                else if (row.title.includes(tok)) best = 6;
                else if (row.tags.includes(tok)) best = 4;
                else if (row.category.includes(tok)) best = 3;
                else if (row.address.includes(tok)) best = 3;
                else if (row.description.includes(tok)) best = 1;
                if (best === 0) { all = false; break; }
                score += best;
            }
            if (all) scored.push({ item: row.item, score });
        }
        return scored
            .sort((a, b) => b.score - a.score || parseFloat(b.item.rating || '0') - parseFloat(a.item.rating || '0'))
            .map(r => r.item);
    }, [index, tokens]);

    // Tag counts in the current category: drive "Popular" and tag suggestions.
    const tagStats = useMemo(() => {
        const counts = new Map<string, number>();
        inCategory.forEach(s => (s.tags || []).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
        return [...counts.entries()]
            .map(([tag, count]) => ({ tag, count, label: tagLabel(tag, lang) }))
            .filter(x => x.label)
            .sort((a, b) => b.count - a.count);
    }, [inCategory, tagLabel, lang]);

    const matchingTags = useMemo(() => {
        if (tokens.length === 0) return [];
        const q = tokens.join(' ');
        return tagStats.filter(x => fold(x.label).includes(q)).slice(0, 6);
    }, [tagStats, tokens]);

    const mosaicItems = useMemo(() => dailyOrder(inCategory.filter(s => !!coverOf(s))), [inCategory]);

    // Groups of 5: one tall tile + a 2x2 of small ones, alternating sides.
    const blocks = useMemo(() => {
        const out: { key: string; items: T[]; tallLeft: boolean }[] = [];
        for (let i = 0; i < mosaicItems.length; i += 5) {
            out.push({ key: mosaicItems[i].id, items: mosaicItems.slice(i, i + 5), tallLeft: (i / 5) % 2 === 1 });
        }
        return out;
    }, [mosaicItems]);

    const tile = (width - GAP * 2) / 3;

    const open = useCallback((item: T) => {
        Haptics.selectionAsync();
        if (query.trim()) saveRecent(query);
        Keyboard.dismiss();
        onOpenService(item);
    }, [query, saveRecent, onOpenService]);

    const applyTerm = (term: string) => {
        Haptics.selectionAsync();
        setQuery(term);
        saveRecent(term);
    };

    const renderTile = (item: T, w: number, h: number, showTitle: boolean) => (
        <TouchableOpacity key={item.id} activeOpacity={0.85} onPress={() => open(item)} style={{ width: w, height: h }}>
            <Image
                source={{ uri: coverOf(item) }}
                style={styles.tileImg}
                contentFit="cover"
                transition={150}
                recyclingKey={item.id}
                cachePolicy="memory-disk"
            />
            {(item.images?.length || 0) > 1 && (
                <View style={styles.multiBadge}><Feather name="copy" size={13} color="#fff" /></View>
            )}
            {showTitle && (
                <View style={styles.tileCaption}>
                    <Text style={styles.tileCaptionText} numberOfLines={1} allowFontScaling={false}>{item.title}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    const renderBlock = ({ item: block }: { item: { items: T[]; tallLeft: boolean } }) => {
        const [first, ...rest] = block.items;
        if (block.items.length < 5) {
            return (
                <View style={[styles.row, { marginBottom: GAP }]}>
                    {block.items.map((s, i) => (
                        <View key={s.id} style={{ marginLeft: i === 0 ? 0 : GAP }}>{renderTile(s, tile, tile, false)}</View>
                    ))}
                </View>
            );
        }
        const tall = renderTile(first, tile, tile * 2 + GAP, true);
        const grid = (
            <View style={{ width: tile * 2 + GAP }}>
                <View style={styles.row}>
                    {renderTile(rest[0], tile, tile, false)}
                    <View style={{ width: GAP }} />
                    {renderTile(rest[1], tile, tile, false)}
                </View>
                <View style={[styles.row, { marginTop: GAP }]}>
                    {renderTile(rest[2], tile, tile, false)}
                    <View style={{ width: GAP }} />
                    {renderTile(rest[3], tile, tile, false)}
                </View>
            </View>
        );
        return (
            <View style={[styles.row, { marginBottom: GAP }]}>
                {block.tallLeft ? tall : grid}
                <View style={{ width: GAP }} />
                {block.tallLeft ? grid : tall}
            </View>
        );
    };

    // Bold the first place the (folded) query appears in the title.
    const highlight = (title: string) => {
        const q = tokens[0];
        const at = q ? fold(title).indexOf(q) : -1;
        if (at < 0) return <Text style={styles.resultTitle} numberOfLines={1}>{title}</Text>;
        return (
            <Text style={styles.resultTitle} numberOfLines={1}>
                {title.slice(0, at)}
                <Text style={styles.resultTitleMatch}>{title.slice(at, at + q.length)}</Text>
                {title.slice(at + q.length)}
            </Text>
        );
    };

    if (!mounted) return null;

    const searching = tokens.length > 0;

    const header = (
        <View>
            {recent.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHead}>
                        <Text style={styles.sectionTitle} allowFontScaling={false}>{t.recent}</Text>
                        <TouchableOpacity onPress={clearRecent} hitSlop={8}>
                            <Text style={styles.sectionAction} allowFontScaling={false}>{t.clear}</Text>
                        </TouchableOpacity>
                    </View>
                    {recent.map(term => (
                        <View key={term} style={styles.recentRow}>
                            <TouchableOpacity style={styles.recentTap} onPress={() => applyTerm(term)}>
                                <Feather name="clock" size={15} color={Brand.textMuted} />
                                <Text style={styles.recentText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{term}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeRecent(term)} hitSlop={10}>
                                <Feather name="x" size={16} color={Brand.textPlaceholder} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
            {tagStats.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { marginBottom: 10 }]} allowFontScaling={false}>{t.popular}</Text>
                    <View style={styles.tagWrap}>
                        {tagStats.slice(0, 10).map(x => (
                            <TouchableOpacity key={x.tag} style={styles.tagChip} onPress={() => applyTerm(x.label)}>
                                <Text style={styles.tagChipText} allowFontScaling={false}>#{x.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
            <Text style={[styles.sectionTitle, styles.exploreTitle]} allowFontScaling={false}>{t.explore}</Text>
        </View>
    );

    return (
        <Animated.View
            style={[
                StyleSheet.absoluteFill,
                styles.overlay,
                {
                    paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 4),
                    opacity: appear,
                    transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                },
            ]}
        >
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <Feather name="search" size={17} color={Brand.textMuted} />
                    <TextInput
                        ref={inputRef}
                        value={query}
                        onChangeText={setQuery}
                        placeholder={t.placeholder}
                        placeholderTextColor={Brand.textPlaceholder}
                        style={styles.searchInput}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        onSubmitEditing={() => saveRecent(query)}
                        maxFontSizeMultiplier={1.2}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                            <Feather name="x-circle" size={17} color={Brand.textPlaceholder} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity onPress={close} hitSlop={8} style={styles.cancelBtn}>
                    <Text style={styles.cancelText} allowFontScaling={false}>{t.cancel}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catBar}
                contentContainerStyle={styles.catBarContent}
                keyboardShouldPersistTaps="handled"
            >
                {CATEGORIES.map(c => {
                    const active = category === c.id;
                    return (
                        <TouchableOpacity
                            key={c.id}
                            style={[styles.catChip, active && styles.catChipActive]}
                            onPress={() => { Haptics.selectionAsync(); setCategory(c.id); }}
                        >
                            <Text style={[styles.catChipText, active && styles.catChipTextActive]} allowFontScaling={false}>{c[lang]}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {searching ? (
                <FlatList
                    data={results}
                    keyExtractor={item => item.id}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                    ListHeaderComponent={
                        <View>
                            {matchingTags.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={[styles.sectionTitle, { marginBottom: 10 }]} allowFontScaling={false}>{t.tags}</Text>
                                    <View style={styles.tagWrap}>
                                        {matchingTags.map(x => (
                                            <TouchableOpacity key={x.tag} style={styles.tagChip} onPress={() => applyTerm(x.label)}>
                                                <Text style={styles.tagChipText} allowFontScaling={false}>#{x.label} · {x.count}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                            {results.length > 0 && (
                                <Text style={[styles.sectionTitle, styles.resultsHeading]} allowFontScaling={false}>
                                    {t.services} · {results.length}
                                </Text>
                            )}
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Feather name="search" size={34} color={Brand.border} />
                            <Text style={styles.emptyTitle}>{t.noResults}</Text>
                            <Text style={styles.emptySub}>{t.noResultsSub}</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.resultRow} activeOpacity={0.7} onPress={() => open(item)}>
                            <Image source={{ uri: coverOf(item) }} style={styles.resultThumb} contentFit="cover" recyclingKey={item.id} cachePolicy="memory-disk" />
                            <View style={styles.resultBody}>
                                {highlight(item.title)}
                                <Text style={styles.resultSub} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                                    {[categoryName(item.category, lang), item.address].filter(Boolean).join(' · ')}
                                </Text>
                            </View>
                            <Text style={styles.resultPrice} allowFontScaling={false}>{formatPrice(item.price)} AZN</Text>
                        </TouchableOpacity>
                    )}
                />
            ) : (
                <FlatList
                    data={blocks}
                    keyExtractor={b => b.key}
                    renderItem={renderBlock}
                    ListHeaderComponent={header}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    initialNumToRender={3}
                    windowSize={5}
                    maxToRenderPerBatch={3}
                    removeClippedSubviews={Platform.OS === 'android'}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                />
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: { backgroundColor: Brand.cream, zIndex: 50, elevation: 50 },
    row: { flexDirection: 'row' },

    searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
    searchBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Brand.white, borderRadius: 14, borderWidth: 1, borderColor: Brand.border,
        paddingHorizontal: 12, height: 42,
    },
    searchInput: { flex: 1, fontSize: 15, color: Brand.ink, paddingVertical: 0 },
    cancelBtn: { marginLeft: 12 },
    cancelText: { fontSize: 15, color: Brand.ink, fontWeight: '600' },

    catBar: { flexGrow: 0, marginBottom: 6 },
    catBarContent: { paddingHorizontal: 14, gap: 8 },
    catChip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
        backgroundColor: Brand.white, borderWidth: 1, borderColor: Brand.border,
    },
    catChipActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
    catChipText: { fontSize: 13, color: Brand.textSecondary, fontWeight: '600' },
    catChipTextActive: { color: Brand.white },

    section: { paddingHorizontal: 16, paddingTop: 12 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: Brand.ink },
    sectionAction: { fontSize: 13, color: Brand.gold, fontWeight: '600' },
    exploreTitle: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
    resultsHeading: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

    recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    recentTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    recentText: { flex: 1, fontSize: 14, color: Brand.ink },

    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tagChip: { backgroundColor: '#F3EBD3', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
    tagChipText: { fontSize: 13, color: '#6A5A2A', fontWeight: '600' },

    tileImg: { width: '100%', height: '100%', backgroundColor: Brand.border },
    multiBadge: { position: 'absolute', top: 6, right: 6, opacity: 0.95 },
    tileCaption: {
        position: 'absolute', left: 6, right: 6, bottom: 6,
        backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4,
    },
    tileCaptionText: { color: '#fff', fontSize: 11, fontWeight: '700' },

    resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9 },
    resultThumb: { width: 54, height: 54, borderRadius: 27, backgroundColor: Brand.border },
    resultBody: { flex: 1, marginHorizontal: 12 },
    resultTitle: { fontSize: 15, color: Brand.ink, fontWeight: '500' },
    resultTitleMatch: { fontWeight: '800' },
    resultSub: { fontSize: 13, color: Brand.textMuted, marginTop: 2 },
    resultPrice: { fontSize: 13, color: Brand.ink, fontWeight: '700' },

    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink, marginTop: 12 },
    emptySub: { fontSize: 14, color: Brand.textMuted, marginTop: 6, textAlign: 'center' },
});
