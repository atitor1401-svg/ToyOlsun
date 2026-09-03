import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    ScrollView, StatusBar, Image, Modal, Platform, Linking,
    SafeAreaView, PanResponder, Animated, KeyboardAvoidingView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabase';
import { useWindowDimensions, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';

interface Review {
  id: string;
  service_id: string;
  name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export type EventType = 'wedding' | 'khyna' | 'birthday';
export type SortOption = 'rating' | 'asc' | 'desc';
export type CategoryFilter = 'all' | 'venues' | 'artists' | 'media' | 'cars';
export type Language = 'az' | 'ru' | 'en';

export interface ServiceItem {
    id: string;
    event_type: EventType[];
    category: CategoryFilter;
    title: string;
    price: number;
    unit: string;
    rating: string;
    img: string;
    tags: string[];
    address?: string;
    phone?: string;
    description?: string;
    capacity?: string;
    images?: string[];
    telegram_chat_id?: string;
}

const TRANSLATIONS = {
    az: {
        welcomeSub: 'MƏRASİMİNİZİN NÖVÜNÜ SEÇİN',
        wedding: 'Toy Mərasimi', weddingDesc: 'Saraylar, ulduzlar, VIP kortej və dekoru',
        khyna: 'Xınayaxdı', khynaDesc: 'Ənənəvi mərasimlər, milli dekoru və foto',
        birthday: 'Ad Günü & Yubiley', birthdayDesc: 'Restoranlar, DJ, aparıcılar və şou-proqramlar',
        change: '‹ Dəyiş',
        weddingTitle: 'TOY MƏRASİMİ', khynaTitle: 'XINAYAXDI MƏRASİMİ',
        birthdayTitle: 'AD GÜNÜ & YUBİLEY', defaultTitle: 'MƏRASİM',
        paramsTitle: 'MƏRASİM PARAMETRLƏRİ',
        dateLabel: 'Tarix', guestsLabel: 'Qonaqlar',
        changeDate: 'Tarixi dəyiş', guestUnit: 'Nəfər',
        daysLeftPre: 'Mərasimə', daysLeftPost: 'gün qalıb',
        catAll: 'Hamısı', catVenues: 'Zallar', catArtists: 'Artistlər',
        catMedia: 'Foto & Video', catCars: 'VIP Kortej',
        catalog: 'KATALOQ', filters: 'Filtrlər', estPrice: 'Təxmini qiymət',
        details: 'Ətraflı bax →', addToCart: 'ƏLAVƏ ET', inCart: 'SMETADA',
        calcTitle: 'SMETA HESABLAMASI', guestsCount: 'qonaq',
        emptyCartTitle: 'Smeta boşdur',
        emptyCartSub: 'Kataloqdan xidmət seçin — büdcə avtomatik hesablanacaq',
        loadingText: 'Yüklənir...',
        errorTitle: 'Bağlantı xətası',
        errorDesc: 'İnternet bağlantınızı yoxlayın və yenidən cəhd edin',
        noResultsTitle: 'Nəticə tapılmadı',
        noResultsDesc: 'Filtrləri dəyişməyi sınayın',
        contactPhone: 'Əlaqə telefonu', totalEstimate: 'CƏMİ SMETA',
        sendManager: 'MENECERƏ GÖNDƏR', conciergeBadge: 'VIP XİDMƏT 24/7',
        conciergeTitle: 'Fərdi Toy Prodüseri',
        conciergeDesc: 'Şəxsi assistentiniz bütün təşkilati məsələləri öz üzərinə götürür: restoran bron, menyunun razılaşdırılması, artistlərin koordinasiyası.',
        writeWhatsapp: '💬 WHATSAPP-A YAZ', callProducer: '📞 PRODÜSERƏ ZƏNG ET',
        includedTitle: 'KONSYERj XİDMƏTİNƏ NƏ DAXİLDİR',
        feat1Title: 'Tam tayminq kontrolu', feat1Desc: 'Artistlərin gəlişi, tort çıxarılması və çəkilişin koordinasiyası.',
        feat2Title: 'Menyu & Endirim razılaşması', feat2Desc: 'Restoranlarla optimal qiymət üzrə danışıqlar.',
        feat3Title: 'Nadir lokasiyanın seçimi', feat3Desc: 'Eksklüziv zalların və tarixlərin bronlanması.',
        tabCatalog: 'KATALOQ', tabCart: 'SMETA', tabConcierge: 'KONSYERj',
        close: 'BAĞLA', reset: 'SIFIRLA', apply: 'TƏTBİQ ET', save: 'SAXLA',
        priceRange: 'Qiymət aralığı (AZN):', sortTitle: 'Sıralama:',
        sortRating: 'Reytinq', sortAsc: 'Qiymət (↑)', sortDesc: 'Qiymət (↓)',
        modalSuccessTitle: 'Müraciət Qəbul Edildi',
        modalSuccessDesc: 'AZN məbləğindəki smetanız fərdi menecerə göndərildi. Yarım saat ərzində sizinlə əlaqə saxlayacağıq.',
    },
    ru: {
        welcomeSub: 'ВЫБЕРИТЕ ТИП МЕРОПРИЯТИЯ',
        wedding: 'Свадебная церемония', weddingDesc: 'Дворцы, звезды, VIP кортеж и декор',
        khyna: 'Хнаяхды', khynaDesc: 'Традиционные обряды, национальный декор и фото',
        birthday: 'День рождения и Юбилей', birthdayDesc: 'Рестораны, DJ, ведущие и шоу-программы',
        change: '‹ Изменить',
        weddingTitle: 'СВАДЕБНАЯ ЦЕРЕМОНИЯ', khynaTitle: 'ХНАЯХДЫ',
        birthdayTitle: 'ДЕНЬ РОЖДЕНИЯ И ЮБИЛЕЙ', defaultTitle: 'МЕРОПРИЯТИЕ',
        paramsTitle: 'ПАРАМЕТРЫ МЕРОПРИЯТИЯ',
        dateLabel: 'Дата', guestsLabel: 'Гости',
        changeDate: 'Изменить дату', guestUnit: 'Человек',
        daysLeftPre: 'До события осталось', daysLeftPost: 'дней',
        catAll: 'Все', catVenues: 'Залы', catArtists: 'Артисты',
        catMedia: 'Фото и Видео', catCars: 'VIP Кортеж',
        catalog: 'КАТАЛОГ', filters: 'Фильтры', estPrice: 'Ориентировочная цена',
        details: 'Подробнее →', addToCart: 'ДОБАВИТЬ', inCart: 'В СМЕТЕ',
        calcTitle: 'РАСЧЕТ СМЕТЫ', guestsCount: 'гостей',
        emptyCartTitle: 'Смета пуста',
        emptyCartSub: 'Выберите услуги из каталога — бюджет рассчитается автоматически',
        loadingText: 'Загрузка...',
        errorTitle: 'Ошибка соединения',
        errorDesc: 'Проверьте подключение к интернету и попробуйте снова',
        noResultsTitle: 'Результатов не найдено',
        noResultsDesc: 'Попробуйте изменить фильтры',
        contactPhone: 'Контактный телефон', totalEstimate: 'ИТОГО СМЕТА',
        sendManager: 'ОТПРАВИТЬ МЕНЕДЖЕРУ', conciergeBadge: 'VIP СЕРВИС 24/7',
        conciergeTitle: 'Персональный свадебный продюсер',
        conciergeDesc: 'Ваш личный ассистент возьмет на себя все организационные вопросы: бронь ресторана, согласование меню, координация артистов.',
        writeWhatsapp: '💬 НАПИСАТЬ В WHATSAPP', callProducer: '📞 ПОЗВОНИТЬ ПРОДЮСЕРУ',
        includedTitle: 'ЧТО ВХОДИТ В КОНСЬЕРЖ-СЕРВИС',
        feat1Title: 'Полный тайминг-контроль', feat1Desc: 'Приезд артистов, вынос торта и координация съемок.',
        feat2Title: 'Согласование меню и скидок', feat2Desc: 'Переговоры с ресторанами для получения оптимальной цены.',
        feat3Title: 'Подбор редких локаций', feat3Desc: 'Бронирование эксклюзивных залов и дат.',
        tabCatalog: 'КАТАЛОГ', tabCart: 'СМЕТА', tabConcierge: 'КОНСЬЕРЖ',
        close: 'ЗАКРЫТЬ', reset: 'СБРОСИТЬ', apply: 'ПРИМЕНИТЬ', save: 'СОХРАНИТЬ',
        priceRange: 'Диапазон цен (AZN):', sortTitle: 'Сортировка:',
        sortRating: 'Рейтинг', sortAsc: 'Цена (↑)', sortDesc: 'Цена (↓)',
        modalSuccessTitle: 'Заявка принята',
        modalSuccessDesc: 'AZN отправлена персональному менеджеру. Мы свяжемся с вами в течение 30 минут.',
    },
    en: {
        welcomeSub: 'SELECT YOUR EVENT TYPE',
        wedding: 'Wedding Ceremony', weddingDesc: 'Palaces, stars, VIP cortege and decor',
        khyna: 'Khynayakhdy', khynaDesc: 'Traditional ceremonies, national decor and photo',
        birthday: 'Birthday & Anniversary', birthdayDesc: 'Restaurants, DJ, hosts and show programs',
        change: '‹ Change',
        weddingTitle: 'WEDDING CEREMONY', khynaTitle: 'KHYNAYAKHDY',
        birthdayTitle: 'BIRTHDAY & ANNIVERSARY', defaultTitle: 'EVENT',
        paramsTitle: 'EVENT PARAMETERS',
        dateLabel: 'Date', guestsLabel: 'Guests',
        changeDate: 'Change date', guestUnit: 'People',
        daysLeftPre: '', daysLeftPost: 'days left until event',
        catAll: 'All', catVenues: 'Venues', catArtists: 'Artists',
        catMedia: 'Photo & Video', catCars: 'VIP Cortege',
        catalog: 'CATALOG', filters: 'Filters', estPrice: 'Estimated price',
        details: 'Details →', addToCart: 'ADD TO ESTIMATE', inCart: 'ADDED',
        calcTitle: 'ESTIMATE CALCULATION', guestsCount: 'guests',
        emptyCartTitle: 'Estimate is empty',
        emptyCartSub: 'Select services from catalog — budget will be calculated automatically',
        loadingText: 'Loading...',
        errorTitle: 'Connection Error',
        errorDesc: 'Please check your internet connection and try again',
        noResultsTitle: 'No Results Found',
        noResultsDesc: 'Try changing the filters',
        contactPhone: 'Contact Phone', totalEstimate: 'TOTAL ESTIMATE',
        sendManager: 'SEND TO MANAGER', conciergeBadge: 'VIP SERVICE 24/7',
        conciergeTitle: 'Personal Wedding Producer',
        conciergeDesc: 'Your personal assistant takes care of all organization: venue booking, menu coordination, artist management.',
        writeWhatsapp: '💬 WRITE ON WHATSAPP', callProducer: '📞 CALL PRODUCER',
        includedTitle: 'WHAT IS INCLUDED IN CONCIERGE SERVICE',
        feat1Title: 'Full timing control', feat1Desc: 'Arrival of artists, cake presentation and shooting coordination.',
        feat2Title: 'Menu & Discount negotiation', feat2Desc: 'Negotiation with restaurants for the best price.',
        feat3Title: 'Rare location selection', feat3Desc: 'Booking exclusive venues and dates.',
        tabCatalog: 'CATALOG', tabCart: 'ESTIMATE', tabConcierge: 'CONCIERGE',
        close: 'CLOSE', reset: 'RESET', apply: 'APPLY', save: 'SAVE',
        priceRange: 'Price range (AZN):', sortTitle: 'Sort by:',
        sortRating: 'Rating', sortAsc: 'Price (↑)', sortDesc: 'Price (↓)',
        modalSuccessTitle: 'Request Received',
        modalSuccessDesc: 'AZN has been sent to your personal manager. We will contact you within 30 minutes.',
    }
};

const FONTS = {
    serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    sans: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
};

const formatCurrency = (val: number): string => val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const calculateDaysLeft = (targetDateStr: string): number => {
    try {
        const today = new Date();
        const target = new Date(targetDateStr);
        if (isNaN(target.getTime())) return 0;
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    } catch { return 0; }
};



function ImageWithLoader({ uri, width }: { uri: string; width: number }) {
    const [loading, setLoading] = useState(true);
    return (
        <View style={{ width, aspectRatio: 4/5, borderRadius: 12, backgroundColor: '#EFECE6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
            {loading && (
                <ActivityIndicator size="large" color="#D4AF37" style={{ position: 'absolute' }} />
            )}
            <Image
                source={{ uri, cache: 'force-cache' }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onLoadEnd={() => setLoading(false)}
            />
        </View>
    );
}

export default function LuxuryApp() {
    const [lang, setLang] = useState<Language>('az');
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [loadingServices, setLoadingServices] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<boolean>(false);
    const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
    const [activeTab, setActiveTab] = useState<'catalog' | 'cart' | 'concierge'>('catalog');
    const [selectedCat, setSelectedCat] = useState<CategoryFilter>('all');
    const [guests, setGuests] = useState<string>('200');
    const [eventDate, setEventDate] = useState<string>('2026-10-25');
    const [selectedDate, setSelectedDate] = useState<string>('2026-10-25');
    const [phone, setPhone] = useState<string>('+994 ');
    const [fullName, setFullName] = useState<string>('');
    const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);
    const [showDatePickerModal, setShowDatePickerModal] = useState<boolean>(false);
    const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
    const [checkoutModalVisible, setCheckoutModalVisible] = useState<boolean>(false);
    const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
    const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [minPrice, setMinPrice] = useState<string>('');
    const [maxPrice, setMaxPrice] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortOption>('rating');
    const [cart, setCart] = useState<ServiceItem[]>([]);

    const translateY = React.useRef(new Animated.Value(0)).current;
    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
            onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 120) {
                    Animated.timing(translateY, { toValue: 800, duration: 250, useNativeDriver: true }).start(() => {
                        setDetailModalVisible(false);
                        translateY.setValue(0);
                    });
                } else {
                    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
                }
            },
        })
    ).current;

    const { width } = useWindowDimensions();
    const t = TRANSLATIONS[lang];

    useEffect(() => {
    async function fetchServices() {
        try {
            setLoadingServices(true);
            const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('timeout')), 8000)
);
const { data, error } = await Promise.race([
    supabase.from('service').select('*'),
    timeoutPromise
]) as any;
            if (data && !error) {
                setServices(data as ServiceItem[]);
                setLoadError(false);
            } else {
                setLoadError(true);
            }
        } catch (e) {
            setLoadError(true);
        } finally {
            setLoadingServices(false);
        }
    }
    fetchServices();
}, []);

    const daysLeft = useMemo(() => calculateDaysLeft(eventDate), [eventDate]);
    const formattedDate = useMemo(() => {
        if (!eventDate) return 'Tarix seçin';
        const parts = eventDate.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : eventDate;
    }, [eventDate]);

    const parsedGuests = useMemo(() => { const val = parseInt(guests, 10); return isNaN(val) || val < 0 ? 0 : val; }, [guests]);
    const totalEstimate = useMemo(() => cart.reduce((sum, item) => {
        if (item.category === 'venues') return sum + (item.price * parsedGuests);
        return sum + item.price;
    }, 0), [cart, parsedGuests]);

    const [submitting, setSubmitting] = useState(false);

const sendToTelegram = async (): Promise<boolean> => {
        if (submitting) return false;
        setSubmitting(true);
        try {
            const { data, error } = await supabase.functions.invoke('submit-order', {
                body: {
                    fullName,
                    phone,
                    eventDate: formattedDate,
                    guests: parsedGuests,
                    cart,
                    totalEstimate,
                    lang
                }
            });
            if (error) throw error;
            return true;
        } catch (e) {
            console.error('Order submission error:', e);
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const filteredServices = useMemo(() => {
        return services.filter(item => {
            if (selectedEventType && !item.event_type?.includes(selectedEventType)) return false;
            if (selectedCat !== 'all' && item.category !== selectedCat) return false;
            const min = parseFloat(minPrice), max = parseFloat(maxPrice);
            if (!isNaN(min) && item.price < min) return false;
            if (!isNaN(max) && item.price > max) return false;
            return true;
        }).sort((a, b) => {
            if (sortBy === 'asc') return a.price - b.price;
            if (sortBy === 'desc') return b.price - a.price;
            return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
        });
    }, [services, selectedEventType, selectedCat, minPrice, maxPrice, sortBy]);

    const toggleCart = useCallback((item: ServiceItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCart(prev => prev.some(c => c.id === item.id) ? prev.filter(c => c.id !== item.id) : [...prev, item]);
    }, []);

    const openDetail = (item: ServiceItem) => {
        setSelectedItem(item);
        translateY.setValue(0);
        setDetailModalVisible(true);
    };



    const getEventTitle = useCallback(() => {
        switch (selectedEventType) {
            case 'wedding': return t.weddingTitle;
            case 'khyna': return t.khynaTitle;
            case 'birthday': return t.birthdayTitle;
            default: return t.defaultTitle;
        }
    }, [selectedEventType, t]);

    if (!selectedEventType) {
        return (
            <SafeAreaView style={styles.welcomeContainer}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.langSelectorContainer}>
                    {(['az', 'ru', 'en'] as Language[]).map(l => (
                        <TouchableOpacity key={l} style={[styles.langBtn, lang === l && styles.langBtnActive]} onPress={() => { Haptics.selectionAsync(); setLang(l); }}>
                            <Text style={[styles.langBtnText, lang === l && styles.langBtnTextActive]}>{l.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.welcomeHeader}>
                    <Text style={styles.brandBadge}>CONCIERGE & ATELIER</Text>
                    <Text style={styles.brandTitle}>TOY OLSUN</Text>
                    <View style={styles.headerDivider} />
                    <Text style={styles.welcomeSub}>{t.welcomeSub}</Text>
                </View>
                <View style={styles.eventCardsContainer}>
                    {[
                        { type: 'wedding', icon: '💍', title: t.wedding, desc: t.weddingDesc },
                        { type: 'khyna', icon: '🌹', title: t.khyna, desc: t.khynaDesc },
                        { type: 'birthday', icon: '🎉', title: t.birthday, desc: t.birthdayDesc },
                    ].map(item => (
                        <TouchableOpacity key={item.type} style={styles.eventTypeCard} activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSelectedEventType(item.type as EventType); }}>
                            <Text style={styles.eventTypeIcon}>{item.icon}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.eventTypeName}>{item.title}</Text>
                                <Text style={styles.eventTypeDesc}>{item.desc}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.topHeader}>
                <TouchableOpacity style={styles.changeEventBtn} onPress={() => setSelectedEventType(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.changeEventText}>{t.change}</Text>
                </TouchableOpacity>
                <Text style={styles.brandBadge}>{getEventTitle()}</Text>
                <Text style={styles.brandTitle}>TOY OLSUN</Text>
                <View style={styles.headerDivider} />
            </View>

            {activeTab === 'catalog' && (
                <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.configCard}>
                        <Text style={styles.configHeader}>{t.paramsTitle}</Text>
                        <View style={styles.configRow}>
                            <TouchableOpacity style={[styles.configBox, { flex: 1.2, marginRight: 8 }]} onPress={() => setShowDatePickerModal(true)}>
                                <Text style={styles.configLabel}>{t.dateLabel}</Text>
                                <Text style={styles.configValueText}>{formattedDate}</Text>
                                <Text style={styles.configSubText}>{t.changeDate}</Text>
                            </TouchableOpacity>
                            <View style={[styles.configBox, { flex: 0.8 }]}>
                                <Text style={styles.configLabel}>{t.guestsLabel}</Text>
                                <TextInput style={styles.configInput} value={guests} onChangeText={setGuests} keyboardType="numeric" maxLength={4} placeholderTextColor="#A0968E" />
                                <Text style={styles.configSubText}>{t.guestUnit}</Text>
                            </View>
                        </View>
                        <View style={styles.countdownBanner}>
                            <Text style={styles.countdownText}>{t.daysLeftPre} <Text style={styles.countdownDays}>{daysLeft}</Text> {t.daysLeftPost}</Text>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                        {[{ id: 'all', name: t.catAll }, { id: 'venues', name: t.catVenues }, { id: 'artists', name: t.catArtists }, { id: 'media', name: t.catMedia }, { id: 'cars', name: t.catCars }].map(f => (
                            <TouchableOpacity key={f.id} style={[styles.chip, selectedCat === f.id && styles.activeChip]} onPress={() => { Haptics.selectionAsync(); setSelectedCat(f.id as CategoryFilter); }}>
                                <Text style={[styles.chipText, selectedCat === f.id && styles.activeChipText]}>{f.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.segmentHeader}>
                        <Text style={styles.sectionHeading}>{t.catalog} ({filteredServices.length})</Text>
                        <TouchableOpacity style={[styles.filterBtn, (minPrice || maxPrice) ? styles.filterBtnActive : null]} onPress={() => setFilterModalVisible(true)}>
                            <Text style={styles.filterBtnText}>{t.filters} {(minPrice || maxPrice) ? '•' : ''}</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingServices ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>{t.loadingText}</Text>
                        </View>
                    ) : loadError ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>{t.errorTitle}</Text>
                            <Text style={styles.emptySub}>{t.errorDesc}</Text>
                            <TouchableOpacity 
                                style={[styles.checkoutBtn, { marginTop: 16, backgroundColor: '#2C2623' }]} 
                                onPress={() => {
                                    setLoadingServices(true);
                                    setLoadError(false);
                                    supabase.from('service').select('*').then(({ data, error }) => {
                                        if (data && !error) {
                                            setServices(data as ServiceItem[]);
                                            setLoadError(false);
                                        } else {
                                            setLoadError(true);
                                        }
                                        setLoadingServices(false);
                                    });
                                }}
                            >
                                <Text style={[styles.checkoutBtnText, { color: '#FFF' }]}>Yenidən cəhd et</Text>
                            </TouchableOpacity>
                        </View>
                    ) : filteredServices.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>{t.noResultsTitle}</Text>
                            <Text style={styles.emptySub}>{t.noResultsDesc}</Text>
                        </View>
                    ) : filteredServices.map(item => {
                        const inCart = cart.some(c => c.id === item.id);
                        return (
                            <View key={item.id} style={styles.card}>
                                <View style={styles.imageContainer}>
                                    <Image source={{ uri: item.img }} style={styles.cardImg} resizeMode="cover" />
                                    <View style={styles.ratingBadge}><Text style={styles.cardRating}>{item.rating} ★</Text></View>
                                </View>
                                <View style={styles.cardBody}>
                                    <Text style={styles.cardTitle}>{item.title}</Text>
                                    <View style={styles.tagRow}>
                                        {item.tags?.map((tTag, idx) => <View key={idx} style={styles.tagBadge}><Text style={styles.tagText}>{tTag}</Text></View>)}
                                    </View>
                                    <View style={styles.cardFooter}>
                                        <View>
                                            <Text style={styles.priceLabel}>{t.estPrice}</Text>
                                            <Text style={styles.priceValue}>{formatCurrency(item.price)} <Text style={styles.priceUnit}>{item.unit}</Text></Text>
                                        </View>
                                        <View style={{ flexDirection: 'column', gap: 6 }}>
                                            <TouchableOpacity style={styles.detailBtn} onPress={() => openDetail(item)}>
                                                <Text style={styles.detailBtnText}>{t.details}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.addBtn, inCart && styles.addedBtn]} activeOpacity={0.7} onPress={() => toggleCart(item)}>
                                                <Text style={[styles.addBtnText, inCart && styles.addedBtnText]}>{inCart ? t.inCart : t.addToCart}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {activeTab === 'cart' && (
                <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.sectionHeading}>{t.calcTitle}</Text>
                    <Text style={styles.cartSub}>{formattedDate} • {parsedGuests} {t.guestsCount}</Text>
                    {cart.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>{t.emptyCartTitle}</Text>
                            <Text style={styles.emptySub}>{t.emptyCartSub}</Text>
                        </View>
                    ) : (
                        <>
                            {cart.map(item => {
                                const itemTotal = item.category === 'venues' ? item.price * parsedGuests : item.price;
                                return (
                                    <View key={item.id} style={styles.cartItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cartItemTitle}>{item.title}</Text>
                                            <Text style={styles.cartItemSub}>{item.category === 'venues' ? `${item.price} AZN × ${parsedGuests} ${t.guestUnit}` : item.unit}</Text>
                                        </View>
                                        <Text style={styles.cartItemPrice}>{formatCurrency(itemTotal)} AZN</Text>
                                        <TouchableOpacity onPress={() => toggleCart(item)} style={styles.removeBtn}>
                                            <Text style={{ color: '#8A7E75', fontSize: 16 }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                            <View style={styles.contactCard}>
                                <Text style={styles.contactHeader}>{t.contactPhone}</Text>
                                <TextInput style={[styles.phoneInput, { marginBottom: 10 }]} placeholder="+994 (50) 000-00-00" placeholderTextColor="#A0968E" keyboardType="phone-pad" value={phone}
                                    onChangeText={(text) => { if (!text.startsWith('+994 ')) setPhone('+994 '); else setPhone(text); }} />
                                <TextInput style={styles.phoneInput} placeholder="Ad və Soyad" placeholderTextColor="#A0968E" value={fullName} onChangeText={setFullName} />
                            </View>
                            <TouchableOpacity 
                                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 }}
                                onPress={() => setPrivacyAccepted(!privacyAccepted)}
                                activeOpacity={0.7}
                            >
                                <View style={{ 
                                    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, 
                                    borderColor: privacyAccepted ? '#D4AF37' : '#8A7E75', 
                                    backgroundColor: privacyAccepted ? '#D4AF37' : 'transparent',
                                    justifyContent: 'center', alignItems: 'center', marginRight: 8 
                                }}>
                                    {privacyAccepted && <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                                </View>
                                <Text style={{ fontSize: 12, color: '#6A625C', flex: 1 }}>
                                    Şəxsi məlumatlarımın işlənməsinə razıyam.{' '}
                                    <Text 
                                        style={{ color: '#D4AF37', textDecorationLine: 'underline' }}
                                        onPress={() => Linking.openURL('https://atitor1401-svg.github.io/ToyOlsun/index.html')}
                                    >
                                        Məxfilik Siyasəti
                                    </Text>
                                </Text>
                            </TouchableOpacity>
                            <View style={styles.totalCard}>
                                <Text style={styles.totalTitle}>{t.totalEstimate}</Text>
                                <Text style={styles.totalAmount}>{formatCurrency(totalEstimate)} AZN</Text>
                                <TouchableOpacity 
                                    style={[styles.checkoutBtn, submitting && { opacity: 0.6 }]} 
                                    activeOpacity={0.8} 
                                    disabled={submitting}
                                    onPress={async () => {
                                        if (!fullName.trim() || phone.trim() === '+994' || !privacyAccepted) {
                                            return;
                                        }
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        const success = await sendToTelegram();
                                        if (success) {
                                            setCheckoutModalVisible(true);
                                        }
                                    }}
                                >
                                    <Text style={styles.checkoutBtnText}>{submitting ? t.loadingText : t.sendManager}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </ScrollView>
            )}

            {activeTab === 'concierge' && (
                <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.conciergeCard}>
                        <Text style={styles.conciergeBadge}>{t.conciergeBadge}</Text>
                        <Text style={styles.conciergeTitle}>{t.conciergeTitle}</Text>
                        <Text style={styles.conciergeDesc}>{t.conciergeDesc}</Text>
                        <TouchableOpacity style={styles.whatsappBtn} activeOpacity={0.8} onPress={() => Linking.openURL('https://wa.me/994502503171')}>
                            <Text style={styles.whatsappBtnText}>{t.writeWhatsapp}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.callBtn} activeOpacity={0.8} onPress={() => Linking.openURL('tel:+994502503171')}>
                            <Text style={styles.callBtnText}>{t.callProducer}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.conciergeServicesList}>
                        <Text style={styles.sectionHeading}>{t.includedTitle}</Text>
                        {[{ title: t.feat1Title, desc: t.feat1Desc }, { title: t.feat2Title, desc: t.feat2Desc }, { title: t.feat3Title, desc: t.feat3Desc }].map((s, idx) => (
                            <View key={idx} style={styles.conciergeFeatureBox}>
                                <Text style={styles.conciergeFeatureTitle}>✓ {s.title}</Text>
                                <Text style={styles.conciergeFeatureDesc}>{s.desc}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}

            <View style={styles.tabBar}>
                <TouchableOpacity style={[styles.tabItem, activeTab === 'catalog' && styles.tabItemActive]} onPress={() => setActiveTab('catalog')}>
                    <Text style={[styles.tabText, activeTab === 'catalog' && styles.tabTextActive]}>{t.tabCatalog}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabItem, activeTab === 'cart' && styles.tabItemActive]} onPress={() => setActiveTab('cart')}>
                    <Text style={[styles.tabText, activeTab === 'cart' && styles.tabTextActive]}>{t.tabCart} {cart.length > 0 ? `(${cart.length})` : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabItem, activeTab === 'concierge' && styles.tabItemActive]} onPress={() => setActiveTab('concierge')}>
                    <Text style={[styles.tabText, activeTab === 'concierge' && styles.tabTextActive]}>{t.tabConcierge}</Text>
                </TouchableOpacity>
            </View>

            {/* DATE PICKER MODAL */}
            <Modal animationType="fade" onRequestClose={() => setShowDatePickerModal(false)} transparent visible={showDatePickerModal}>
                <TouchableOpacity activeOpacity={1} onPress={() => setShowDatePickerModal(false)} style={styles.modalOverlayCenter}>
                    <TouchableOpacity activeOpacity={1} style={styles.datePickerModalContent}>
                        <Calendar
                            current={eventDate}
                            onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
                            markedDates={{ [selectedDate]: { selected: true, selectedColor: '#2C2623' } }}
                            theme={{ selectedDayBackgroundColor: '#2C2623', todayTextColor: '#2C2623', arrowColor: '#2C2623' }}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                            <TouchableOpacity onPress={() => setShowDatePickerModal(false)} style={styles.secondaryBtn}>
                                <Text style={styles.secondaryBtnText}>{t.close}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setEventDate(selectedDate); setShowDatePickerModal(false); }} style={styles.primaryBtn}>
                                <Text style={styles.primaryBtnText}>{t.save}</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* DETAIL MODAL */}
            <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayBottom}>
                    <Animated.View style={[styles.modalContentBottom, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
                        <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeXBtn}>
                            <Text style={styles.closeXBtnText}>✕</Text>
                        </TouchableOpacity>
                        {selectedItem && (
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                {selectedItem.images && selectedItem.images.length > 0 ? (
                                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={width - 40} snapToAlignment="start" style={{ marginBottom: 12 }}>
                                        {selectedItem.images.map((imgUrl, idx) => (
                                            <ImageWithLoader key={idx} uri={imgUrl} width={width - 40} />
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <Image source={{ uri: selectedItem.img }} style={styles.detailImg} />
                                )}
                                <Text style={styles.detailTitle}>{selectedItem.title}</Text>
                                <Text style={styles.detailPrice}>{formatCurrency(selectedItem.price)} {selectedItem.unit}</Text>
                                {selectedItem.description && <Text style={styles.detailDesc}>{selectedItem.description}</Text>}
                                {selectedItem.address && <Text style={styles.detailInfo}>📍 {selectedItem.address}</Text>}
                                {selectedItem.phone && <Text style={styles.detailInfo}>📞 {selectedItem.phone}</Text>}
                                {selectedItem.capacity && <Text style={styles.detailInfo}>👥 {selectedItem.capacity}</Text>}
                                <TouchableOpacity style={[styles.addBtn, { marginTop: 20, alignItems: 'center' }]} onPress={() => { toggleCart(selectedItem); setDetailModalVisible(false); }}>
                                    <Text style={styles.addBtnText}>{cart.some(c => c.id === selectedItem.id) ? t.inCart : t.addToCart}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailModalVisible(false)}>
                                    <Text style={styles.closeBtnText}>{t.close}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </Animated.View>
                </KeyboardAvoidingView>
            </Modal>

            {/* FILTER MODAL */}
            <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
                <TouchableOpacity activeOpacity={1} onPress={() => setFilterModalVisible(false)} style={styles.modalOverlayCenter}>
                    <TouchableOpacity activeOpacity={1} style={styles.filterModalContent}>
                        <Text style={styles.sectionHeading}>{t.filters}</Text>
                        <Text style={styles.filterLabel}>{t.priceRange}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
                            <TextInput placeholder="Min" value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" style={styles.filterInput} placeholderTextColor="#A0968E" />
                            <TextInput placeholder="Max" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" style={styles.filterInput} placeholderTextColor="#A0968E" />
                        </View>
                        <Text style={styles.filterLabel}>{t.sortTitle}</Text>
                        <View style={{ gap: 6, marginVertical: 10 }}>
                            {[{ id: 'rating', label: t.sortRating }, { id: 'asc', label: t.sortAsc }, { id: 'desc', label: t.sortDesc }].map(s => (
                                <TouchableOpacity key={s.id} style={[styles.sortOption, sortBy === s.id && styles.sortOptionActive]} onPress={() => setSortBy(s.id as SortOption)}>
                                    <Text style={[styles.sortOptionText, sortBy === s.id && styles.sortOptionTextActive]}>{s.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setMinPrice(''); setMaxPrice(''); setSortBy('rating'); }}>
                                <Text style={styles.secondaryBtnText}>{t.reset}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryBtn} onPress={() => setFilterModalVisible(false)}>
                                <Text style={styles.primaryBtnText}>{t.apply}</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* CHECKOUT SUCCESS MODAL */}
            <Modal visible={checkoutModalVisible} transparent animationType="fade" onRequestClose={() => setCheckoutModalVisible(false)}>
                <TouchableOpacity activeOpacity={1} onPress={() => setCheckoutModalVisible(false)} style={styles.modalOverlayCenter}>
                    <View style={styles.checkoutSuccessContent}>
                        <Text style={styles.checkoutSuccessTitle}>✓ {t.modalSuccessTitle}</Text>
                        <Text style={styles.checkoutSuccessDesc}>{formatCurrency(totalEstimate)} {t.modalSuccessDesc}</Text>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => setCheckoutModalVisible(false)}>
                            <Text style={styles.primaryBtnText}>{t.close}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF8F5' },
    welcomeContainer: { flex: 1, backgroundColor: '#FAF8F5', justifyContent: 'center', paddingHorizontal: 20 },
    langSelectorContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
    langBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#EFECE6' },
    langBtnActive: { backgroundColor: '#2C2623' },
    langBtnText: { fontSize: 12, fontWeight: '600', color: '#6A625C' },
    langBtnTextActive: { color: '#FFF' },
    welcomeHeader: { alignItems: 'center', marginBottom: 30 },
    brandBadge: { fontSize: 11, color: '#8A7E75', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    brandTitle: { fontSize: 26, fontFamily: FONTS.serif, fontWeight: '700', color: '#2C2623', letterSpacing: 1 },
    headerDivider: { width: 40, height: 2, backgroundColor: '#D4AF37', marginVertical: 10 },
    welcomeSub: { fontSize: 12, letterSpacing: 1.5, color: '#6A625C', fontWeight: '600' },
    eventCardsContainer: { gap: 14 },
    eventTypeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#EFECE6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    eventTypeIcon: { fontSize: 28, marginRight: 16 },
    eventTypeName: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 4 },
    eventTypeDesc: { fontSize: 12, color: '#8A7E75' },
    topHeader: { alignItems: 'center', paddingTop: 10, paddingBottom: 12, backgroundColor: '#FAF8F5', borderBottomWidth: 1, borderBottomColor: '#EFECE6', position: 'relative' },
    changeEventBtn: { position: 'absolute', left: 16, top: 12 },
    changeEventText: { fontSize: 14, color: '#8A7E75', fontWeight: '600' },
    scrollArea: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 80 },
    configCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EFECE6', marginBottom: 16 },
    configHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: '#8A7E75', marginBottom: 12 },
    configRow: { flexDirection: 'row', marginBottom: 12 },
    configBox: { backgroundColor: '#FAF8F5', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EFECE6' },
    configLabel: { fontSize: 10, textTransform: 'uppercase', color: '#8A7E75', fontWeight: '600' },
    configValueText: { fontSize: 15, fontWeight: '700', color: '#2C2623', marginTop: 4 },
    configSubText: { fontSize: 10, color: '#A0968E', marginTop: 2 },
    configInput: { fontSize: 15, fontWeight: '700', color: '#2C2623', marginTop: 2, padding: 0 },
    countdownBanner: { backgroundColor: '#2C2623', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
    countdownText: { color: '#EFECE6', fontSize: 12 },
    countdownDays: { color: '#D4AF37', fontWeight: '700', fontSize: 14 },
    filterBar: { flexDirection: 'row', marginBottom: 16 },
    chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFECE6', marginRight: 8 },
    activeChip: { backgroundColor: '#2C2623', borderColor: '#2C2623' },
    chipText: { fontSize: 13, color: '#6A625C', fontWeight: '500' },
    activeChipText: { color: '#FFF' },
    segmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionHeading: { fontSize: 14, fontWeight: '700', letterSpacing: 1, color: '#2C2623' },
    filterBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFECE6' },
    filterBtnActive: { backgroundColor: '#D4AF37' },
    filterBtnText: { fontSize: 12, fontWeight: '600', color: '#2C2623' },
    card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#EFECE6', marginBottom: 16, overflow: 'hidden' },
    imageContainer: { height: 180, position: 'relative' },
    cardImg: { width: '100%', height: '100%' },
    ratingBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(44,38,35,0.85)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
    cardRating: { color: '#D4AF37', fontSize: 12, fontWeight: '700' },
    cardBody: { padding: 14 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 8 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    tagBadge: { backgroundColor: '#FAF8F5', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: '#EFECE6' },
    tagText: { fontSize: 11, color: '#8A7E75' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FAF8F5' },
    priceLabel: { fontSize: 10, color: '#A0968E', textTransform: 'uppercase' },
    priceValue: { fontSize: 16, fontWeight: '700', color: '#2C2623' },
    priceUnit: { fontSize: 11, fontWeight: '400', color: '#8A7E75' },
    detailBtn: { paddingVertical: 4, alignItems: 'flex-end' },
    detailBtnText: { fontSize: 12, color: '#8A7E75', fontWeight: '600' },
    addBtn: { backgroundColor: '#2C2623', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    addedBtn: { backgroundColor: '#EFECE6' },
    addBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    addedBtnText: { color: '#2C2623' },
    cartSub: { fontSize: 12, color: '#8A7E75', marginBottom: 16 },
    emptyBox: { backgroundColor: '#FFF', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EFECE6', marginVertical: 20 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 6 },
    emptySub: { fontSize: 12, color: '#8A7E75', textAlign: 'center' },
    cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EFECE6', marginBottom: 10 },
    cartItemTitle: { fontSize: 14, fontWeight: '700', color: '#2C2623' },
    cartItemSub: { fontSize: 12, color: '#8A7E75', marginTop: 2 },
    cartItemPrice: { fontSize: 14, fontWeight: '700', color: '#2C2623', marginRight: 12 },
    removeBtn: { padding: 4 },
    contactCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EFECE6', marginTop: 10, marginBottom: 16 },
    contactHeader: { fontSize: 12, fontWeight: '700', color: '#2C2623', marginBottom: 10, textTransform: 'uppercase' },
    phoneInput: { backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#EFECE6', borderRadius: 8, padding: 12, fontSize: 14, color: '#2C2623' },
    totalCard: { backgroundColor: '#2C2623', padding: 20, borderRadius: 16, alignItems: 'center' },
    totalTitle: { color: '#A0968E', fontSize: 11, textTransform: 'uppercase' },
    totalAmount: { color: '#D4AF37', fontSize: 24, fontWeight: '700', marginVertical: 8 },
    checkoutBtn: { backgroundColor: '#D4AF37', paddingVertical: 12, width: '100%', borderRadius: 8, alignItems: 'center', marginTop: 6 },
    checkoutBtnText: { color: '#2C2623', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
    conciergeCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#EFECE6', marginBottom: 20, alignItems: 'center' },
    conciergeBadge: { fontSize: 10, fontWeight: '700', color: '#D4AF37', letterSpacing: 1, marginBottom: 8 },
    conciergeTitle: { fontSize: 18, fontFamily: FONTS.serif, fontWeight: '700', color: '#2C2623', marginBottom: 8, textAlign: 'center' },
    conciergeDesc: { fontSize: 13, color: '#6A625C', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
    whatsappBtn: { backgroundColor: '#25D366', width: '100%', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
    whatsappBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    callBtn: { backgroundColor: '#2C2623', width: '100%', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    callBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    conciergeServicesList: { gap: 10 },
    conciergeFeatureBox: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#EFECE6' },
    conciergeFeatureTitle: { fontSize: 13, fontWeight: '700', color: '#2C2623', marginBottom: 4 },
    conciergeFeatureDesc: { fontSize: 12, color: '#8A7E75' },
    tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EFECE6', paddingBottom: Platform.OS === 'ios' ? 20 : 10, paddingTop: 10 },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 6 },
    tabItemActive: { borderTopWidth: 2, borderTopColor: '#2C2623', marginTop: -10, paddingTop: 14 },
    tabText: { fontSize: 11, fontWeight: '600', color: '#A0968E' },
    tabTextActive: { color: '#2C2623' },
    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    datePickerModalContent: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 20, padding: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
    modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContentBottom: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
    closeXBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
    closeXBtnText: { fontSize: 22, color: '#8A7E75', fontWeight: '300' },
    detailImg: { width: '100%', height: 200, borderRadius: 12, marginBottom: 14 },
    detailTitle: { fontSize: 18, fontWeight: '700', color: '#2C2623', marginBottom: 4 },
    detailPrice: { fontSize: 16, fontWeight: '700', color: '#D4AF37', marginBottom: 10 },
    detailDesc: { fontSize: 13, color: '#6A625C', lineHeight: 18, marginBottom: 10 },
    detailInfo: { fontSize: 12, color: '#8A7E75', marginBottom: 4 },
    reviewSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#EFECE6', paddingTop: 14 },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    reviewTitle: { fontSize: 14, fontWeight: '700', color: '#2C2623' },
    reviewItem: { backgroundColor: '#FAF8F5', padding: 10, borderRadius: 8, marginBottom: 8 },
    reviewName: { fontSize: 12, fontWeight: '700', color: '#2C2623' },
    reviewRating: { fontSize: 11, color: '#D4AF37' },
    reviewComment: { fontSize: 12, color: '#6A625C', marginTop: 4 },
    closeBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
    closeBtnText: { color: '#8A7E75', fontWeight: '600', fontSize: 13 },
    filterModalContent: { width: '100%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
    filterLabel: { fontSize: 12, fontWeight: '600', color: '#2C2623', marginTop: 10 },
    filterInput: { flex: 1, backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#EFECE6', borderRadius: 8, padding: 10, fontSize: 13, color: '#2C2623' },
    sortOption: { padding: 10, backgroundColor: '#FAF8F5', borderRadius: 8, borderWidth: 1, borderColor: '#EFECE6' },
    sortOptionActive: { backgroundColor: '#2C2623', borderColor: '#2C2623' },
    sortOptionText: { fontSize: 12, color: '#6A625C', textAlign: 'center' },
    sortOptionTextActive: { color: '#FFF', fontWeight: '700' },
    checkoutSuccessContent: { width: '100%', maxWidth: 320, backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center' },
    checkoutSuccessTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 8 },
    checkoutSuccessDesc: { fontSize: 13, color: '#6A625C', textAlign: 'center', marginBottom: 16 },
    primaryBtn: { backgroundColor: '#2C2623', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    secondaryBtn: { backgroundColor: '#EFECE6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    secondaryBtnText: { color: '#2C2623', fontWeight: '600', fontSize: 13 },
});
