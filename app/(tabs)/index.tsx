import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
        ScrollView, StatusBar, Modal, Platform, Linking,
    PanResponder, Animated, KeyboardAvoidingView, AppState, Share,
    NativeSyntheticEvent, NativeScrollEvent
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ExpoLinking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { registerPushTokenForUser } from '../../lib/notifications';
import { sendOrderToTelegram, flushPendingOrderTelegrams } from '../../lib/orderTelegram';
import { useWindowDimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar } from 'react-native-calendars';
import PartnerPortal from './PartnerPortal';
import CustomerPortal, { ServiceReviews } from './CustomerPortal';
import { Feather, FontAwesome, Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Colors as Brand } from '@/constants/brand';
import ExploreSearch from '@/components/ExploreSearch';
import { matchesCategory } from '@/lib/categories';
import { normalizeAzPhone, isAzMobile, telUrl, whatsappUrl } from '@/lib/contact';
import { metaEvents } from '@/lib/metaEvents';
import { useAnnouncements, AnnouncementStrip } from '@/components/Announcements';
import Stories from '@/components/Stories';
import { useFavorites } from '@/lib/favorites';
import { useRememberedCovers } from '@/lib/coverCache';

// Welcome-card photos built into the app: shown on a first launch without
// internet, before any photo has been loaded from the server.
const BUNDLED_COVERS = {
    wedding: require('@/assets/images/covers/wedding.jpg'),
    khyna: require('@/assets/images/covers/khyna.jpg'),
    birthday: require('@/assets/images/covers/birthday.jpg'),
} as const;
import SmetaHero from '@/components/smeta/SmetaHero';
import SmetaPlan from '@/components/smeta/SmetaPlan';
import SmetaLine from '@/components/smeta/SmetaLine';
import SmetaEmpty from '@/components/smeta/SmetaEmpty';
import SmetaStickyBar from '@/components/smeta/SmetaStickyBar';
import { SMETA_TEXT } from '@/components/smeta/smetaText';
import Toast, { type ToastMessage } from '@/components/ui/Toast';
import { planFor, type PlanCategory, type PlanStep } from '@/components/smeta/plan';

import { premiumStyles } from '@/lib/typography';
import { scaled, isShortScreen } from '@/lib/responsive';
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
export type CategoryFilter = 'all' | 'venues' | 'artists' | 'dj' | 'media' | 'cars' | 'wedding_dress' | 'flowers' | 'decor' | 'tourism';
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
    owner_id?: string;
    promo_active?: boolean;
}

interface ReviewSummary {
    count: number;
    latestAuthor: string;
    latestComment: string;
    latestLikes: number;
}

const TAG_ID_LABELS: Record<string, { az: string; ru: string; en: string }> = {
    vip_level: { az: 'VIP Səviyyə', ru: 'VIP уровень', en: 'VIP Level' },
    palace: { az: 'Dövlət Sarayı', ru: 'Дворец', en: 'Palace' },
    panoramic: { az: 'Panoram', ru: 'Панорама', en: 'Panoramic View' },
    outdoor: { az: 'Açıq Hava', ru: 'На улице', en: 'Outdoor' },
    premium_hall: { az: 'Premium Zal', ru: 'Премиум зал', en: 'Premium Hall' },
    summer_terrace: { az: 'Yay Terrası', ru: 'Летняя терраса', en: 'Summer Terrace' },
    national_style: { az: 'Milli Üslub', ru: 'Нац. стиль', en: 'National Style' },
    restaurant_fun: { az: 'Restoran & Əyləncə', ru: 'Ресторан и развлечения', en: 'Restaurant & Fun' },
    pop_star: { az: 'Pop Ulduzu', ru: 'Поп-звезда', en: 'Pop Star' },
    live_vocal: { az: 'Canlı Səs', ru: 'Живой вокал', en: 'Live Vocal' },
    solo_singer: { az: 'Solo Müğənni', ru: 'Солист', en: 'Solo Singer' },
    peoples_artist: { az: 'Xalq Artisti', ru: 'Народный артист', en: 'People\'s Artist' },
    dj: { az: 'DJ', ru: 'DJ', en: 'DJ' },
    toastmaster: { az: 'Toastmaster', ru: 'Тамада', en: 'Toastmaster' },
    sound_system: { az: 'Səs Sistemi', ru: 'Звуковая система', en: 'Sound System' },
    light_show: { az: 'İşıq Şousu', ru: 'Световое шоу', en: 'Light Show' },
    open_format: { az: 'Hər Janr', ru: 'Любой жанр', en: 'Open Format' },
    national_music: { az: 'Milli Musiqi', ru: 'Нац. музыка', en: 'National Music' },
    mc_host: { az: 'Aparıcılıq', ru: 'Ведущий', en: 'MC / Host' },
    live_orchestra: { az: 'Canlı Orkestr', ru: 'Живой оркестр', en: 'Live Orchestra' },
    national_ensemble: { az: 'Milli Ansambl', ru: 'Нац. ансамбль', en: 'National Ensemble' },
    full_program: { az: 'Tam Proqram', ru: 'Полная программа', en: 'Full Program' },
    pro_photographer: { az: 'Peşəkar Fotoqraf', ru: 'Профессиональный фотограф', en: 'Professional Photographer' },
    '4k_video': { az: '4K Kino', ru: '4K видео', en: '4K Video' },
    drone_footage: { az: 'Aerofoto', ru: 'Аэросъёмка', en: 'Drone Footage' },
    studio_shoot: { az: 'Studiya Çəkilişi', ru: 'Студийная съёмка', en: 'Studio Shoot' },
    photo_album: { az: 'Foto Albom', ru: 'Фотоальбом', en: 'Photo Album' },
    wedding_shoot: { az: 'Toy Çəkilişi', ru: 'Свадебная съёмка', en: 'Wedding Shoot' },
    rolls_royce: { az: 'Rolls-Royce', ru: 'Rolls-Royce', en: 'Rolls-Royce' },
    with_driver: { az: 'Şofer Daxil', ru: 'С водителем', en: 'With Driver' },
    decorated_interior: { az: 'Bəzədilmiş Salon', ru: 'Украшенный салон', en: 'Decorated Interior' },
    white_color: { az: 'Ağ Rəng', ru: 'Белый цвет', en: 'White Color' },
    premium_brand: { az: 'Premium Marka', ru: 'Премиум марка', en: 'Premium Brand' },
    rental: { az: 'Kirayə', ru: 'Аренда', en: 'Rental' },
    purchase: { az: 'Alqı-satış', ru: 'Продажа', en: 'Purchase' },
    designer_model: { az: 'Dizayner Model', ru: 'Дизайнерская модель', en: 'Designer Model' },
    custom_fitting: { az: 'Ölçüyə Uyğunlaşdırma', ru: 'Подгонка по размеру', en: 'Custom Fitting' },
    accessories_included: { az: 'Aksessuarlar Daxil', ru: 'Аксессуары включены', en: 'Accessories Included' },
    bridal_bouquet: { az: 'Gəlin Buketi', ru: 'Букет невесты', en: 'Bridal Bouquet' },
    venue_decoration: { az: 'Zal Bəzəyi', ru: 'Оформление зала', en: 'Venue Decoration' },
    car_decoration: { az: 'Maşın Bəzəyi', ru: 'Оформление авто', en: 'Car Decoration' },
    fresh_flowers: { az: 'Təzə Güllər', ru: 'Свежие цветы', en: 'Fresh Flowers' },
    artificial_flowers: { az: 'Süni Güllər', ru: 'Искусственные цветы', en: 'Artificial Flowers' },
    stage_decoration: { az: 'Səhnə Dekoru', ru: 'Оформление сцены', en: 'Stage Decoration' },
    table_decoration: { az: 'Masa Dekoru', ru: 'Оформление столов', en: 'Table Decoration' },
    photo_zone: { az: 'Foto Zona', ru: 'Фотозона', en: 'Photo Zone' },
    balloon_decor: { az: 'Şar Dekoru', ru: 'Оформление шарами', en: 'Balloon Decor' },
    lighting_decor: { az: 'İşıqlandırma', ru: 'Световое оформление', en: 'Lighting' },
    khyna_decor: { az: 'Xına Dekoru', ru: 'Оформление хны', en: 'Khyna Decor' },
    wedding_arch: { az: 'Toy Tağı', ru: 'Свадебная арка', en: 'Wedding Arch' },
    international: { az: 'Xarici Ölkə', ru: 'За границей', en: 'International' },
    local_tours: { az: 'Yerli Turlar', ru: 'Местные туры', en: 'Local Tours' },
    all_inclusive: { az: 'All Inclusive', ru: 'Всё включено', en: 'All Inclusive' },
    beach_vacation: { az: 'Sahil İstirahəti', ru: 'Пляжный отдых', en: 'Beach Vacation' },
    vip_package: { az: 'VIP Paket', ru: 'VIP пакет', en: 'VIP Package' },
};

const resolveTagLabel = (tag: string, lang: Language): string => {
    const entry = TAG_ID_LABELS[tag];
    return entry ? entry[lang] : tag; // Legacy tags (raw text) fall back to showing as-is
};

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
        searchPlaceholder: 'Zal, müğənni, fotoqraf axtar…',
        callBtn: 'Zəng et', whatsappBtn: 'WhatsApp',
        whatsappMsg: 'Salam! Toy Olsun tətbiqində "{title}" xidmətinizi gördüm. Ətraflı məlumat ala bilərəm?',
        shareLabel: 'Paylaş', catAll: 'Hamısı', catVenues: 'Zallar', catArtists: 'Artistlər', catDj: 'DJ',
        catMedia: 'Foto & Video', catCars: 'VIP Kortej',
        catWeddingDress: 'Gəlinlik', catFlowers: 'Gül Dükanı', catDecor: 'Dekor', catTourism: 'Bal Ayı',
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
        partnerBtn: '+ Partnyor ol',
        promoBadge: 'Promo −5%', promoTitle: 'Promo kod', promoPlaceholder: 'Promo kodu yazın', promoApply: 'Tətbiq et',
        promoApplied: 'Promo tətbiq olundu', promoInvalid: 'Promo kod etibarsızdır', promoRemove: 'Ləğv et',
        promoOnlyMarked: 'Endirim yalnız "Promo" nişanlı xidmətlərə tətbiq olunur.',
        promoNoEligible: 'Səbətdəki xidmətlər promo-da iştirak etmir.', promoSaved: 'Endirim',
        partnerContactHint: 'Partnyor olmaq üçün əlavə məlumat: +994 50 250 31 71',
        customerBtn: '+ Müştəri kimi Qeydiyyat / Giriş',
        myAccountBtn: '👤 Şəxsi Kabinetim',
        partnerFormTitle: 'Partnyor Qeydiyyatı',
        partnerFormSub: 'Xidmətinizi əlavə edin — yoxlanışdan sonra kataloqda görünəcək',
        partnerName: 'Xidmətin adı',
        partnerNamePh: 'Məs: Elux Event Hall',
        partnerCategory: 'Kateqoriya',
        partnerTags: 'Xüsusiyyətlər (uyğun olanları seçin)',
        partnerEventTypes: 'Hansı tədbirlərə uyğundur',
        partnerPrice: 'Qiymət (AZN)',
        partnerPricePh: 'Məs: 150',
        partnerUnit: 'Ölçü vahidi',
        partnerAddress: 'Ünvan',
        partnerAddressPh: 'Şəhər, küçə',
        partnerPhone: 'Əlaqə telefonu',
        partnerDescription: 'Təsvir',
        partnerDescriptionPh: 'Xidmətiniz haqqında qısa məlumat',
        partnerCapacity: 'Tutum (istəyə bağlı)',
        partnerCapacityPh: 'Məs: 200-500',
        partnerImageUrl: 'Şəkil',
        partnerImageUrlPh: 'https://...',
        partnerImagePick: '📷 Şəkil seç',
        partnerImageNeedTitle: 'Şəkil əlavə etməzdən əvvəl xidmətin adını yazın',
        partnerImageChange: 'Dəyiş',
        partnerSubmit: 'MÜRACİƏT GÖNDƏR',
        partnerSubmitting: 'GÖNDƏRİLİR...',
        partnerSuccessTitle: 'Müraciətiniz Qəbul Edildi',
        partnerSuccessDesc: 'Xidmətiniz yoxlanışdan sonra kataloqda görünəcək. Bu adətən 1-2 iş günü çəkir.',
        partnerRequired: 'Zəhmət olmasa bütün məcburi xanaları doldurun',
        catVenuesShort: 'Zal', catArtistsShort: 'Artist', catMediaShort: 'Foto/Video', catCarsShort: 'Kortej',
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
        searchPlaceholder: 'Найти зал, певца, фотографа…',
        callBtn: 'Позвонить', whatsappBtn: 'WhatsApp',
        whatsappMsg: 'Здравствуйте! Увидел(а) вашу услугу «{title}» в приложении Toy Olsun. Можно узнать подробнее?',
        shareLabel: 'Поделиться', catAll: 'Все', catVenues: 'Залы', catArtists: 'Артисты', catDj: 'DJ',
        catMedia: 'Фото и Видео', catCars: 'VIP Кортеж',
        catWeddingDress: 'Свадебное платье', catFlowers: 'Цветочный магазин', catDecor: 'Декор', catTourism: 'Медовый месяц',
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
        partnerBtn: '+ Стать партнером',
        promoBadge: 'Промо −5%', promoTitle: 'Промокод', promoPlaceholder: 'Введите промокод', promoApply: 'Применить',
        promoApplied: 'Промокод применён', promoInvalid: 'Промокод недействителен', promoRemove: 'Отменить',
        promoOnlyMarked: 'Скидка действует только на услуги с меткой «Промо».',
        promoNoEligible: 'Услуги в корзине не участвуют в промо.', promoSaved: 'Скидка',
        partnerContactHint: 'Для партнеров, подробности: +994 50 250 31 71',
        customerBtn: '+ Войти как клиент',
        myAccountBtn: '👤 Мой кабинет',
        partnerFormTitle: 'Регистрация партнера',
        partnerFormSub: 'Добавьте свою услугу — появится в каталоге после проверки',
        partnerName: 'Название услуги',
        partnerNamePh: 'Напр: Elux Event Hall',
        partnerCategory: 'Категория',
        partnerTags: 'Особенности (выберите подходящие)',
        partnerEventTypes: 'Подходит для мероприятий',
        partnerPrice: 'Цена (AZN)',
        partnerPricePh: 'Напр: 150',
        partnerUnit: 'Единица измерения',
        partnerAddress: 'Адрес',
        partnerAddressPh: 'Город, улица',
        partnerPhone: 'Контактный телефон',
        partnerDescription: 'Описание',
        partnerDescriptionPh: 'Краткая информация о вашей услуге',
        partnerCapacity: 'Вместимость (необязательно)',
        partnerCapacityPh: 'Напр: 200-500',
        partnerImageUrl: 'Фото',
        partnerImageUrlPh: 'https://...',
        partnerImagePick: '📷 Выбрать фото',
        partnerImageNeedTitle: 'Сначала укажите название услуги',
        partnerImageChange: 'Изменить',
        partnerSubmit: 'ОТПРАВИТЬ ЗАЯВКУ',
        partnerSubmitting: 'ОТПРАВКА...',
        partnerSuccessTitle: 'Заявка принята',
        partnerSuccessDesc: 'Ваша услуга появится в каталоге после проверки. Обычно это занимает 1-2 рабочих дня.',
        partnerRequired: 'Пожалуйста, заполните все обязательные поля',
        catVenuesShort: 'Зал', catArtistsShort: 'Артист', catMediaShort: 'Фото/Видео', catCarsShort: 'Кортеж',
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
        searchPlaceholder: 'Search venues, singers, photographers…',
        callBtn: 'Call', whatsappBtn: 'WhatsApp',
        whatsappMsg: 'Hello! I saw your service "{title}" on the Toy Olsun app. Could you tell me more?',
        shareLabel: 'Share', catAll: 'All', catVenues: 'Venues', catArtists: 'Artists', catDj: 'DJ',
        catMedia: 'Photo & Video', catCars: 'VIP Cortege',
        catWeddingDress: 'Wedding Dress', catFlowers: 'Flower Shop', catDecor: 'Decor', catTourism: 'Honeymoon',
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
        partnerBtn: '+ Become a partner',
        promoBadge: 'Promo −5%', promoTitle: 'Promo code', promoPlaceholder: 'Enter promo code', promoApply: 'Apply',
        promoApplied: 'Promo applied', promoInvalid: 'Invalid promo code', promoRemove: 'Remove',
        promoOnlyMarked: 'The discount applies only to services marked "Promo".',
        promoNoEligible: 'None of the services in your cart take part in the promo.', promoSaved: 'Discount',
        partnerContactHint: 'More info about becoming a partner: +994 50 250 31 71',
        customerBtn: '+ Sign in as Customer',
        myAccountBtn: '👤 My Account',
        partnerFormTitle: 'Partner Registration',
        partnerFormSub: 'Add your service — it will appear in the catalog after review',
        partnerName: 'Service name',
        partnerNamePh: 'E.g: Elux Event Hall',
        partnerCategory: 'Category',
        partnerTags: 'Features (select those that apply)',
        partnerEventTypes: 'Suitable for events',
        partnerPrice: 'Price (AZN)',
        partnerPricePh: 'E.g: 150',
        partnerUnit: 'Unit',
        partnerAddress: 'Address',
        partnerAddressPh: 'City, street',
        partnerPhone: 'Contact phone',
        partnerDescription: 'Description',
        partnerDescriptionPh: 'Brief information about your service',
        partnerCapacity: 'Capacity (optional)',
        partnerCapacityPh: 'E.g: 200-500',
        partnerImageUrl: 'Photo',
        partnerImageUrlPh: 'https://...',
        partnerImagePick: '📷 Pick a photo',
        partnerImageNeedTitle: 'Please enter the service name first',
        partnerImageChange: 'Change',
        partnerSubmit: 'SUBMIT REQUEST',
        partnerSubmitting: 'SUBMITTING...',
        partnerSuccessTitle: 'Request Received',
        partnerSuccessDesc: 'Your service will appear in the catalog after review. This usually takes 1-2 business days.',
        partnerRequired: 'Please fill in all required fields',
        catVenuesShort: 'Venue', catArtistsShort: 'Artist', catMediaShort: 'Photo/Video', catCarsShort: 'Cortege',
    }
};

const FONTS = {
    serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    sans: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
};

const CATEGORY_TAGS: Record<string, { az: string; ru: string; en: string }[]> = {
    venues: [
        { az: 'VIP Səviyyə', ru: 'VIP уровень', en: 'VIP Level' },
        { az: 'Dövlət Sarayı', ru: 'Дворец', en: 'Palace' },
        { az: 'Panoram', ru: 'Панорама', en: 'Panoramic View' },
        { az: 'Açıq Hava', ru: 'На улице', en: 'Outdoor' },
        { az: 'Premium Zal', ru: 'Премиум зал', en: 'Premium Hall' },
        { az: 'Yay Terrası', ru: 'Летняя терраса', en: 'Summer Terrace' },
        { az: 'Milli Üslub', ru: 'Нац. стиль', en: 'National Style' },
        { az: 'Restoran & Əyləncə', ru: 'Ресторан и развлечения', en: 'Restaurant & Fun' },
    ],
    artists: [
        { az: 'Pop Ulduzu', ru: 'Поп-звезда', en: 'Pop Star' },
        { az: 'Canlı Səs', ru: 'Живой вокал', en: 'Live Vocal' },
        { az: 'Solo Müğənni', ru: 'Солист', en: 'Solo Singer' },
        { az: 'Xalq Artisti', ru: 'Народный артист', en: 'People\'s Artist' },
        { az: 'DJ', ru: 'DJ', en: 'DJ' },
        { az: 'Toastmaster', ru: 'Тамада', en: 'Toastmaster' },
        { az: 'Canlı Orkestr', ru: 'Живой оркестр', en: 'Live Orchestra' },
        { az: 'Milli Ansambl', ru: 'Нац. ансамбль', en: 'National Ensemble' },
        { az: 'Tam Proqram', ru: 'Полная программа', en: 'Full Program' },
    ],
    media: [
        { az: 'Peşəkar Fotoqraf', ru: 'Профессиональный фотограф', en: 'Professional Photographer' },
        { az: '4K Kino', ru: '4K видео', en: '4K Video' },
        { az: 'Aerofoto', ru: 'Аэросъёмка', en: 'Drone Footage' },
        { az: 'Studiya Çəkilişi', ru: 'Студийная съёмка', en: 'Studio Shoot' },
        { az: 'Foto Albom', ru: 'Фотоальбом', en: 'Photo Album' },
        { az: 'Toy Çəkilişi', ru: 'Свадебная съёмка', en: 'Wedding Shoot' },
    ],
    cars: [
        { az: 'Rolls-Royce', ru: 'Rolls-Royce', en: 'Rolls-Royce' },
        { az: 'Şofer Daxil', ru: 'С водителем', en: 'With Driver' },
        { az: 'Bəzədilmiş Salon', ru: 'Украшенный салон', en: 'Decorated Interior' },
        { az: 'Ağ Rəng', ru: 'Белый цвет', en: 'White Color' },
        { az: 'Premium Marka', ru: 'Премиум марка', en: 'Premium Brand' },
    ],
};

const formatCurrency = (val: number | null | undefined): string => {
    const safeVal = typeof val === 'number' && !isNaN(val) ? val : 0;
    return safeVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// YYYY-MM-DD in the phone's local time (toISOString would use UTC and can
// land on the wrong day around midnight).
const localDateString = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Start the planner a month ahead, so it never opens on a past date.
const defaultEventDate = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return localDateString(d);
};

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
    const [failed, setFailed] = useState(false);
    return (
        <View style={{ width, aspectRatio: 4/5, borderRadius: 12, backgroundColor: '#EFECE6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
            {loading && !failed && (
                <ActivityIndicator size="large" color="#D4AF37" style={{ position: 'absolute' }} />
            )}
            {!failed && (
                <Image
                    source={{ uri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    onLoadEnd={() => setLoading(false)}
                    onError={() => { setLoading(false); setFailed(true); }}
                />
            )}
        </View>
    );
}

// How many catalog cards are mounted at a time (more are added on scroll).
const CARD_BATCH = 8;

// Swipeable, Instagram-style photo carousel shown directly on the catalog
// card — lets people flip through a listing's photos without opening the
// detail view. Falls back to the single cover image when there's no album.
function CardImageCarousel({ images, fallbackImg, children }: { images?: string[]; fallbackImg: string; children?: React.ReactNode }) {
    const [containerWidth, setContainerWidth] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    // Some partner listings have image URLs that were never actually
    // uploaded (e.g. an interrupted bulk upload) — drop those from view
    // instead of showing a blank tile or retrying a failing request.
    const [failedUris, setFailedUris] = useState<Set<string>>(new Set());
    const candidates = images && images.length > 0 ? images : [fallbackImg];
    const list = candidates.filter(uri => !failedUris.has(uri));
    const height = containerWidth * (5 / 4); // Instagram's 4:5 feed-photo ratio

    return (
        <View style={[styles.imageContainer, { height: height || undefined }]} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
            {containerWidth > 0 && (
                <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={list.length > 1}
                    onMomentumScrollEnd={(e) => {
                        const idx = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
                        setActiveIndex(idx);
                    }}
                >
                    {list.map((uri, idx) => (
                        // Only the visible photo and its neighbours are loaded;
                        // decoding every photo of every card at once froze Android.
                        Math.abs(idx - activeIndex) <= 1 ? (
                            <Image
                                key={idx}
                                source={{ uri }}
                                style={{ width: containerWidth, height }}
                                contentFit="cover"
                                onError={() => setFailedUris(prev => new Set(prev).add(uri))}
                            />
                        ) : (
                            <View key={idx} style={{ width: containerWidth, height, backgroundColor: '#EFECE6' }} />
                        )
                    ))}
                    {list.length === 0 && <View style={{ width: containerWidth, height, backgroundColor: '#EFECE6' }} />}
                </ScrollView>
            )}
            {list.length > 1 && (
                <View style={styles.carouselDots} pointerEvents="none">
                    {list.map((_, idx) => (
                        <View key={idx} style={[styles.carouselDot, idx === activeIndex && styles.carouselDotActive]} />
                    ))}
                </View>
            )}
            {children}
        </View>
    );
}

export default function LuxuryApp() {
    const insets = useSafeAreaInsets();
    const [lang, setLang] = useState<Language>('az');
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});
    const [loadingServices, setLoadingServices] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<boolean>(false);
    const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
    const [activeTab, setActiveTab] = useState<'catalog' | 'cart' | 'concierge'>('catalog');
    const [selectedCat, setSelectedCat] = useState<CategoryFilter>('all');
    const favorites = useFavorites();
    const [showFavorites, setShowFavorites] = useState(false);
    const favText = {
        az: { chip: 'Seçilmişlər', emptyTitle: 'Hələ seçilmiş yoxdur', emptySub: 'Bəyəndiyiniz xidmətin ürəyinə toxunun, burada saxlanacaq.' },
        ru: { chip: 'Избранное', emptyTitle: 'Пока пусто', emptySub: 'Нажмите на сердечко у понравившейся услуги, и она сохранится здесь.' },
        en: { chip: 'Saved', emptyTitle: 'Nothing saved yet', emptySub: 'Tap the heart on any service you like and it will be kept here.' },
    }[lang];
    const [guests, setGuests] = useState<string>('200');
    const [eventDate, setEventDate] = useState<string>(defaultEventDate);
    const [selectedDate, setSelectedDate] = useState<string>(defaultEventDate);
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
    const [exploreVisible, setExploreVisible] = useState<boolean>(false);
    const announcements = useAnnouncements();

    // --- Partner portal ---
    const [showPartnerPortal, setShowPartnerPortal] = useState<boolean>(false);
    const [showCustomerPortal, setShowCustomerPortal] = useState<boolean>(false);
    const [partnerLoggedIn, setPartnerLoggedIn] = useState<boolean>(false);
    const [customerLoggedIn, setCustomerLoggedIn] = useState<boolean>(false);

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

        const checkUserRole = async (session: any) => {
        if (!session) {
            setPartnerLoggedIn(false);
            setCustomerLoggedIn(false);
            return;
        }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        if (profile?.role === 'customer') {
            setCustomerLoggedIn(true);
            setPartnerLoggedIn(false);
        } else {
            setPartnerLoggedIn(true);
            setCustomerLoggedIn(false);
        }
    };

    // Registers the push token here only (not also in PartnerPortal/
    // CustomerPortal, which are always mounted alongside this screen) —
    // doing it from all three at once caused concurrent duplicate upserts
    // of the same token and intermittent RLS errors in the logs.
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            checkUserRole(data.session);
            registerPushTokenForUser(data.session?.user?.id ?? null);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
            checkUserRole(newSession);
            if (event === 'SIGNED_IN') {
                registerPushTokenForUser(newSession?.user?.id ?? null);
            }
        });
        return () => { listener.subscription.unsubscribe(); };
    }, []);

    // Re-sends any order notification that failed earlier (e.g. no signal at
    // checkout) when the app opens or comes back to the foreground.
    useEffect(() => {
        flushPendingOrderTelegrams();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') flushPendingOrderTelegrams();
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
    async function fetchServices() {
        try {
            setLoadingServices(true);
            const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('timeout')), 8000)
);
const { data, error } = await Promise.race([
    supabase.from('service').select('*').eq('status', 'approved'),
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

    // Review previews shown directly on catalog cards (comment count + the
    // latest comment with its like count) — fetched once, grouped
    // client-side by service_id, same pattern ServiceReviews itself uses.
    useEffect(() => {
        async function fetchReviewSummaries() {
            const { data: reviewRows } = await supabase
                .from('customer_reviews')
                .select('id, service_id, customer_name, comment, created_at')
                .order('created_at', { ascending: false });
            if (!reviewRows || reviewRows.length === 0) return;

            const latestByService = new Map<string, typeof reviewRows[number]>();
            const countByService = new Map<string, number>();
            for (const r of reviewRows) {
                countByService.set(r.service_id, (countByService.get(r.service_id) || 0) + 1);
                if (!latestByService.has(r.service_id)) latestByService.set(r.service_id, r);
            }

            const latestReviewIds = Array.from(latestByService.values()).map(r => r.id);
            const { data: likeRows } = await supabase.from('review_likes').select('review_id').in('review_id', latestReviewIds);
            const likeCountByReview = new Map<string, number>();
            for (const l of likeRows || []) {
                likeCountByReview.set(l.review_id, (likeCountByReview.get(l.review_id) || 0) + 1);
            }

            const summaries: Record<string, ReviewSummary> = {};
            for (const [serviceId, review] of latestByService.entries()) {
                summaries[serviceId] = {
                    count: countByService.get(serviceId) || 0,
                    latestAuthor: review.customer_name,
                    latestComment: review.comment,
                    latestLikes: likeCountByReview.get(review.id) || 0,
                };
            }
            setReviewSummaries(summaries);
        }
        fetchReviewSummaries();
    }, []);

    const daysLeft = useMemo(() => calculateDaysLeft(eventDate), [eventDate]);
    const formattedDate = useMemo(() => {
        if (!eventDate) return 'Tarix seçin';
        const parts = eventDate.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : eventDate;
    }, [eventDate]);

    const parsedGuests = useMemo(() => { const val = parseInt(guests, 10); return isNaN(val) || val < 0 ? 0 : val; }, [guests]);
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null);
    const [promoError, setPromoError] = useState(false);
    const [promoChecking, setPromoChecking] = useState(false);

    // The discount only applies to services whose partner switched the promo on.
    type PromoState = { code: string; percent: number };
    const promoPercentFor = (item: ServiceItem, promo: PromoState | null = appliedPromo) => (promo && item.promo_active ? promo.percent : 0);
    const lineBase = (item: ServiceItem) => (item.category === 'venues' ? item.price * parsedGuests : item.price);
    const lineFinal = (item: ServiceItem, promo: PromoState | null = appliedPromo) => {
        const p = promoPercentFor(item, promo);
        return p ? Math.round(lineBase(item) * (100 - p) / 100) : lineBase(item);
    };
    const totalEstimate = cart.reduce((sum, item) => sum + lineFinal(item), 0);
    const promoSavings = cart.reduce((sum, item) => sum + (lineBase(item) - lineFinal(item)), 0);
    const cartEligibleCount = cart.filter(item => item.promo_active).length;

    // Validates a code on the server; on success it becomes the applied promo.
    const checkPromo = async (raw: string): Promise<PromoState | null> => {
        const code = raw.trim();
        if (!code) return null;
        setPromoChecking(true);
        setPromoError(false);
        try {
            const { data, error } = await supabase.rpc('validate_promo', { p_code: code });
            const percent = typeof data === 'number' ? data : 0;
            if (!error && percent > 0) {
                const promo = { code: code.toUpperCase(), percent };
                setAppliedPromo(promo);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                return promo;
            }
        } catch {
            // falls through to the invalid state below
        } finally {
            setPromoChecking(false);
        }
        setAppliedPromo(null);
        setPromoError(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return null;
    };

    // The cart holds copies of services loaded when the app opened; re-read
    // which of them currently have the promo switched on.
    const refreshCartPromoFlags = async (): Promise<ServiceItem[]> => {
        const current = cart;
        if (current.length === 0) return current;
        try {
            const { data, error } = await supabase.from('service').select('id, promo_active').in('id', current.map(i => i.id));
            if (error || !data) return current;
            const flags = new Map<string, boolean>(data.map((r: any) => [String(r.id), !!r.promo_active]));
            const withFlag = (i: ServiceItem) => (flags.has(String(i.id)) ? { ...i, promo_active: flags.get(String(i.id)) } : i);
            setCart(prev => prev.map(withFlag));
            return current.map(withFlag);
        } catch {
            return current;
        }
    };

    const applyPromo = async () => {
        if (promoChecking) return;
        const promo = await checkPromo(promoInput);
        if (promo) await refreshCartPromoFlags();
    };
    const removePromo = () => { setAppliedPromo(null); setPromoInput(''); setPromoError(false); };

    useEffect(() => {
        if (activeTab === 'cart') refreshCartPromoFlags();
    }, [activeTab]);

    const [submitting, setSubmitting] = useState(false);

const sendToTelegram = async (promo: PromoState | null, items: ServiceItem[]): Promise<boolean> => {
        if (submitting) return false;
        setSubmitting(true);
        let telegramOk = false;
        const { data: userData } = await supabase.auth.getUser();
        const currentUserId = userData?.user?.id || null;
        try {
            telegramOk = await sendOrderToTelegram({
                fullName,
                phone,
                eventDate: formattedDate,
                guests: parsedGuests,
                cart: items.map(item => ({
                    id: item.id,
                    title: item.title,
                    category: item.category,
                    price: item.price,
                    telegram_chat_id: item.telegram_chat_id,
                })),
                totalEstimate: items.reduce((sum, item) => sum + lineFinal(item, promo), 0),
                lang,
                promoCode: promo?.code,
            });
        } catch (e) {
            console.error('Order submission (Telegram) error:', e);
        }

        // Always attempt to record one order row per cart item, so each partner sees their own orders
        // (independent of whether the Telegram function succeeded)
        let orderOk = false;
        try {
            const orderRows = items.map(item => {
                const itemPrice = lineFinal(item, promo);
                const itemPromo = promoPercentFor(item, promo);
                                return {
                    service_id: item.id,
                    service_owner_id: item.owner_id || null,
                    service_title: item.title,
                    customer_name: fullName,
                    customer_phone: phone,
                    event_date: formattedDate,
                    guests_count: parsedGuests,
                    item_price: itemPrice,
                    status: 'new',
                    lang,
                    customer_id: currentUserId,
                    promo_code: itemPromo ? promo!.code : null,
                    discount_percent: itemPromo,
                };
            });
            if (orderRows.length > 0) {
                const { error: orderError } = await supabase.from('orders').insert(orderRows);
                if (orderError) console.error('Order record insert error:', orderError);
                else orderOk = true;
            } else {
                orderOk = true;
            }
        } catch (orderErr) {
            console.error('Order record insert error:', orderErr);
        } finally {
            setSubmitting(false);
        }

        return telegramOk || orderOk;
    };

    const filteredServices = useMemo(() => {
        return services.filter(item => {
            if (selectedEventType && !item.event_type?.includes(selectedEventType)) return false;
            if (showFavorites) return favorites.ids.includes(String(item.id));
            if (!matchesCategory(item, selectedCat)) return false;
            const min = parseFloat(minPrice), max = parseFloat(maxPrice);
            if (!isNaN(min) && item.price < min) return false;
            if (!isNaN(max) && item.price > max) return false;
            return true;
        }).sort((a, b) => {
            if (sortBy === 'asc') return a.price - b.price;
            if (sortBy === 'desc') return b.price - a.price;
            return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
        });
    }, [services, selectedEventType, selectedCat, minPrice, maxPrice, sortBy, showFavorites, favorites.ids]);

    // Explore search covers every service for the chosen event type; it has
    // its own category chips and ignores the catalog's price filter.
    const exploreServices = useMemo(
        () => services.filter(item => !selectedEventType || item.event_type?.includes(selectedEventType)),
        [services, selectedEventType],
    );

    // Cards are added in batches as the user scrolls; mounting every card
    // (with all its photos) at once froze Android on the "All" tab.
    const [visibleCount, setVisibleCount] = useState(CARD_BATCH);
    useEffect(() => { setVisibleCount(CARD_BATCH); }, [filteredServices]);
    const handleCatalogScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - layoutMeasurement.height * 1.5) {
            setVisibleCount(c => (c < filteredServices.length ? c + CARD_BATCH : c));
        }
    }, [filteredServices.length]);

    // Latest cart for event reporting (state updaters must stay side-effect free).
    const cartRef = React.useRef(cart);
    useEffect(() => { cartRef.current = cart; }, [cart]);
    const toggleCart = useCallback((item: ServiceItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!cartRef.current.some(c => c.id === item.id)) metaEvents.addToEstimate(item);
        setCart(prev => prev.some(c => c.id === item.id) ? prev.filter(c => c.id !== item.id) : [...prev, item]);
    }, []);

    const openDetail = (item: ServiceItem) => {
        metaEvents.viewService(item);
        setSelectedItem(item);
        translateY.setValue(0);
        setDetailModalVisible(true);
    };

    // Welcome-screen card photos: the best-rated service photo for each event
    // type (our own catalog content), so the cards always show real venues.
    const liveEventCovers = useMemo(() => {
        const pick = (type: EventType, cats: CategoryFilter[]): string | undefined => {
            // A photo chosen by the team (Supabase app_announcements, style 'cover') wins.
            if (announcements.covers[type]) return announcements.covers[type];
            const pool = services
                .filter(s => s.event_type?.includes(type) && (s.images?.[0] || s.img))
                .sort((a, b) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'));
            for (const c of cats) {
                const best = pool.find(s => s.category === c);
                if (best) return best.images?.[0] || best.img;
            }
            return pool[0]?.images?.[0] || pool[0]?.img;
        };
        return {
            wedding: pick('wedding', ['venues', 'wedding_dress', 'media']),
            khyna: pick('khyna', ['decor', 'flowers', 'venues']),
            birthday: pick('birthday', ['venues', 'decor', 'artists']),
        } as Record<EventType, string | undefined>;
    }, [services, announcements.covers]);
    // Falls back to the last photos seen, so the cards keep pictures offline.
    const eventCovers = useRememberedCovers(liveEventCovers);

    // Actions behind in-app banners (Supabase app_announcements).
    const CATEGORY_IDS: CategoryFilter[] = ['venues', 'artists', 'dj', 'media', 'cars', 'wedding_dress', 'flowers', 'decor', 'tourism'];
    const announcementHandlers = {
        lang,
        onOpenService: (serviceId: string) => {
            const item = services.find(s => String(s.id) === String(serviceId));
            if (!item) return;
            setActiveTab('catalog');
            openDetail(item);
        },
        onSelectCategory: (category: string) => {
            if (!CATEGORY_IDS.includes(category as CategoryFilter)) return;
            setActiveTab('catalog');
            setExploreVisible(false);
            setSelectedCat(category as CategoryFilter);
        },
    };

    // ---- Estimate (smeta) screen ----
    const smetaText = SMETA_TEXT[lang];
    const smetaScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
    const smetaViewportH = React.useRef(0);
    const smetaContentH = React.useRef(0);
    const smetaOffsetY = React.useRef(0);
    // True once the bottom total card is on screen; the sticky bar then hides.
    const [smetaAtEnd, setSmetaAtEnd] = useState(false);
    const updateSmetaAtEnd = () => {
        const TOTAL_CARD_ZONE = 260;
        setSmetaAtEnd(smetaOffsetY.current + smetaViewportH.current >= smetaContentH.current - TOTAL_CARD_ZONE);
    };
    const categoryLabels: Record<PlanCategory, string> = {
        venues: t.catVenues, artists: t.catArtists, dj: t.catDj, media: t.catMedia, cars: t.catCars,
        wedding_dress: t.catWeddingDress, flowers: t.catFlowers, decor: t.catDecor, tourism: t.catTourism,
    };
    const planLabel = (step: PlanStep) => categoryLabels[step.category];
    const smetaSteps = planFor(selectedEventType);
    const eventTitle = selectedEventType
        ? { wedding: t.weddingTitle, khyna: t.khynaTitle, birthday: t.birthdayTitle }[selectedEventType]
        : t.defaultTitle;
    const perGuestText = parsedGuests > 0 && cart.length > 0 ? `${formatCurrency(Math.round(totalEstimate / parsedGuests))} AZN` : null;
    // Send checks: what is still missing before the estimate can go to the manager.
    // A full Azerbaijani number is 12 digits with the 994 prefix.
    const missingName = !fullName.trim();
    const missingPhone = phone.replace(/\D/g, '').length < 12;
    const missingConsent = !privacyAccepted;
    const [triedSend, setTriedSend] = useState(false); // highlight empty fields only after a send attempt
    const [smetaToast, setSmetaToast] = useState<ToastMessage | null>(null);
    const contactCardY = React.useRef(0);
    const warnMissingDetails = () => {
        setTriedSend(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setSmetaToast({
            id: Date.now(),
            title: smetaText.missingTitle,
            body: [missingName && smetaText.missingName, missingPhone && smetaText.missingPhone, missingConsent && smetaText.missingConsent]
                .filter(Boolean)
                .join(' · '),
        });
        smetaScrollRef.current?.scrollTo({ y: Math.max(contactCardY.current - 12, 0), animated: true });
    };
    const openCatalogCategory = (category: PlanCategory) => {
        setActiveTab('catalog');
        setExploreVisible(false);
        setShowFavorites(false);
        setSelectedCat(category);
    };

    const handleShare = async (item: ServiceItem) => {
        Haptics.selectionAsync();
        // WhatsApp (and most messengers) only auto-linkify standard http(s)
        // URLs — a bare toyolsun:// scheme link shows as plain, untappable
        // text. Store links are real https:// URLs so they're always
        // tappable; we can't know the recipient's platform from the
        // sender's device, so both are included and whoever taps the
        // matching one lands on the right store.
        const iosLink = 'https://apps.apple.com/app/id6808000909';
        const androidLink = 'https://play.google.com/store/apps/details?id=com.ibo96.ToyOlsun';
        try {
            await Share.share({
                message: `${item.title} — ${formatCurrency(item.price)} ${item.unit}\n\nToyOlsun tətbiqini yükləyin:\niPhone: ${iosLink}\nAndroid: ${androidLink}`,
            });
        } catch {
            // User cancelled or share sheet failed to open — nothing to do
        }
    };

    // Opens the shared item's detail view when the app is launched (or
    // brought to foreground) via a toyolsun://service?id=... link, including
    // from the web page behind shared links. The launch URL is handled once,
    // not again every time the service list reloads.
    const handledInitialUrl = React.useRef(false);
    useEffect(() => {
        const openFromUrl = (url: string | null) => {
            if (!url || services.length === 0) return;
            const { queryParams } = ExpoLinking.parse(url);
            const raw = queryParams?.id;
            const id = Array.isArray(raw) ? raw[0] : raw;
            if (!id) return;
            const item = services.find(s => String(s.id) === String(id));
            if (!item) return;
            // The detail sheet lives on the catalog screen, not the welcome screen.
            setSelectedEventType(prev => prev ?? 'wedding');
            setActiveTab('catalog');
            openDetail(item);
        };
        if (services.length > 0 && !handledInitialUrl.current) {
            handledInitialUrl.current = true;
            ExpoLinking.getInitialURL().then(openFromUrl);
        }
        const sub = ExpoLinking.addEventListener('url', ({ url }) => openFromUrl(url));
        return () => sub.remove();
    }, [services]);

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
                <ScrollView contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.langSelectorContainer}>
                    {(['az', 'ru', 'en'] as Language[]).map(l => (
                        <TouchableOpacity key={l} style={styles.langBtn} onPress={() => { Haptics.selectionAsync(); setLang(l); }} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                            <Text style={[styles.langBtnText, lang === l && styles.langBtnTextActive]} allowFontScaling={false} maxFontSizeMultiplier={1}>{l.toUpperCase()}</Text>
                            <View style={[styles.langUnderline, lang === l && styles.langUnderlineActive]} />
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.welcomeHeader}>
                    <Text style={styles.welcomeKicker} allowFontScaling={false} maxFontSizeMultiplier={1}>CONCIERGE & ATELIER</Text>
                    <Text style={styles.welcomeTitle} maxFontSizeMultiplier={1.1}>Toy Olsun</Text>
                    <View style={styles.ornament}>
                        <View style={styles.ornamentLine} />
                        <View style={styles.ornamentDiamond} />
                        <View style={styles.ornamentLine} />
                    </View>
                    <Text style={styles.welcomeSub} maxFontSizeMultiplier={1.1}>{t.welcomeSub}</Text>
                </View>
                <View style={styles.eventCardsContainer}>
                    {[
                        { type: 'wedding' as EventType, title: t.wedding, desc: t.weddingDesc },
                        { type: 'khyna' as EventType, title: t.khyna, desc: t.khynaDesc },
                        { type: 'birthday' as EventType, title: t.birthday, desc: t.birthdayDesc },
                    ].map((item, idx) => (
                        <TouchableOpacity key={item.type} style={styles.eventTypeCard} activeOpacity={0.88} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSelectedEventType(item.type); }}>
                            <Image
                                source={eventCovers[item.type] ? { uri: eventCovers[item.type] } : BUNDLED_COVERS[item.type]}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                                transition={400}
                                cachePolicy="memory-disk"
                            />
                            <LinearGradient
                                colors={['rgba(24,20,18,0.05)', 'rgba(24,20,18,0.55)', 'rgba(24,20,18,0.92)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0.9, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.eventTypeContent}>
                                <Text style={styles.eventTypeIndex} allowFontScaling={false}>{`0${idx + 1}`}</Text>
                                <Text style={styles.eventTypeName} numberOfLines={1} maxFontSizeMultiplier={1.1}>{item.title}</Text>
                                <Text style={styles.eventTypeDesc} numberOfLines={isShortScreen ? 1 : 2} maxFontSizeMultiplier={1.1}>{item.desc}</Text>
                            </View>
                            <View style={styles.eventTypeArrow}>
                                <Feather name="arrow-up-right" size={18} color="#1F1A17" />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
                                                {!customerLoggedIn && (
                    <TouchableOpacity style={partnerLoggedIn ? styles.myAccountBtnWelcome : styles.partnerLinkWelcome} onPress={() => setShowPartnerPortal(true)}>
                        <Text style={partnerLoggedIn ? styles.myAccountBtnWelcomeText : styles.partnerLinkWelcomeText}>{partnerLoggedIn ? t.myAccountBtn : t.partnerBtn}</Text>
                    </TouchableOpacity>
                )}
                {!partnerLoggedIn && (
                    <TouchableOpacity style={customerLoggedIn ? styles.myAccountBtnWelcome : styles.customerLinkWelcome} onPress={() => setShowCustomerPortal(true)}>
                        <Text style={customerLoggedIn ? styles.myAccountBtnWelcomeText : styles.customerLinkWelcomeText}>{customerLoggedIn ? t.myAccountBtn : t.customerBtn}</Text>
                    </TouchableOpacity>
                )}
                {!partnerLoggedIn && (
                    <Text style={styles.partnerContactHint} maxFontSizeMultiplier={1.15}>{t.partnerContactHint}</Text>
                )}
                </ScrollView>
                <PartnerPortal lang={lang} visible={showPartnerPortal} onClose={() => setShowPartnerPortal(false)} />
                <CustomerPortal lang={lang} visible={showCustomerPortal} onClose={() => setShowCustomerPortal(false)} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={Platform.OS === 'android' ? ['left', 'right'] : ['top', 'right', 'bottom', 'left']}>
            <StatusBar barStyle="dark-content" />
            <View style={[styles.topHeader, Platform.OS === 'android' && { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity style={[styles.changeEventBtn, Platform.OS === 'android' && { top: insets.top + 12 }]} onPress={() => setSelectedEventType(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.changeEventText}>{t.change}</Text>
                </TouchableOpacity>
                <Text style={styles.brandBadge} allowFontScaling={false} maxFontSizeMultiplier={1}>{getEventTitle()}</Text>
                <Text style={styles.brandTitle}>TOY OLSUN</Text>
                <View style={styles.headerDivider} />
            </View>

            {activeTab === 'catalog' && (
                <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleCatalogScroll} scrollEventThrottle={100}>
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

                    <AnnouncementStrip {...announcementHandlers} item={announcements.strip} onDone={announcements.markSeen} />

                    <Stories
                        lang={lang}
                        services={services as any}
                        announcements={announcements.storyItems}
                        onOpenService={announcementHandlers.onOpenService}
                        onSelectCategory={announcementHandlers.onSelectCategory}
                    />

                    <TouchableOpacity style={styles.searchPill} activeOpacity={0.8} onPress={() => { Haptics.selectionAsync(); setExploreVisible(true); }}>
                        <Feather name="search" size={17} color={Brand.textMuted} />
                        <Text style={styles.searchPillText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t.searchPlaceholder}</Text>
                    </TouchableOpacity>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                        <TouchableOpacity style={[styles.chip, styles.favChip, showFavorites && styles.activeChip]} onPress={() => { Haptics.selectionAsync(); setShowFavorites(v => !v); }}>
                            <Feather name="heart" size={13} color={showFavorites ? Brand.white : Brand.gold} />
                            <Text style={[styles.chipText, showFavorites && styles.activeChipText]} allowFontScaling={false} maxFontSizeMultiplier={1}>{favText.chip}{favorites.ids.length ? ` ${favorites.ids.length}` : ''}</Text>
                        </TouchableOpacity>
                        {[{ id: 'all', name: t.catAll }, { id: 'venues', name: t.catVenues }, { id: 'artists', name: t.catArtists }, { id: 'dj', name: t.catDj }, { id: 'media', name: t.catMedia }, { id: 'cars', name: t.catCars }, { id: 'wedding_dress', name: t.catWeddingDress }, { id: 'flowers', name: t.catFlowers }, { id: 'decor', name: t.catDecor }, { id: 'tourism', name: t.catTourism }].map(f => (
                            <TouchableOpacity key={f.id} style={[styles.chip, !showFavorites && selectedCat === f.id && styles.activeChip]} onPress={() => { Haptics.selectionAsync(); setShowFavorites(false); setSelectedCat(f.id as CategoryFilter); }}>
                                <Text style={[styles.chipText, !showFavorites && selectedCat === f.id && styles.activeChipText]} allowFontScaling={false} maxFontSizeMultiplier={1}>{f.name}</Text>
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
                            <Button
                                label="Yenidən cəhd et"
                                variant="primary"
                                style={{ marginTop: 16 }}
                                onPress={() => {
                                    setLoadingServices(true);
                                    setLoadError(false);
                                    supabase.from('service').select('*').eq('status', 'approved').then(({ data, error }) => {
                                        if (data && !error) {
                                            setServices(data as ServiceItem[]);
                                            setLoadError(false);
                                        } else {
                                            setLoadError(true);
                                        }
                                        setLoadingServices(false);
                                    });
                                }}
                            />
                        </View>
                    ) : filteredServices.length === 0 ? (
                        <View style={styles.emptyBox}>
                            {showFavorites && <Feather name="heart" size={28} color={Brand.gold} style={{ marginBottom: 10 }} />}
                            <Text style={styles.emptyTitle}>{showFavorites ? favText.emptyTitle : t.noResultsTitle}</Text>
                            <Text style={styles.emptySub}>{showFavorites ? favText.emptySub : t.noResultsDesc}</Text>
                        </View>
                    ) : filteredServices.slice(0, visibleCount).map(item => {
                        const inCart = cart.some(c => c.id === item.id);
                        return (
                            <View key={item.id} style={styles.card}>
                                <CardImageCarousel images={item.images} fallbackImg={item.img}>
                                    <View style={styles.ratingBadge}>
                                        <Feather name="star" size={11} color={Brand.gold} />
                                        <Text style={styles.cardRating}>{item.rating}</Text>
                                    </View>
                                    {item.promo_active && (
                                        <View style={styles.promoBadge} pointerEvents="none">
                                            <Feather name="tag" size={11} color="#2C2623" />
                                            <Text style={styles.promoBadgeText} maxFontSizeMultiplier={1.1}>{t.promoBadge}</Text>
                                        </View>
                                    )}
                                </CardImageCarousel>
                                <View style={styles.cardActionRow}>
                                    <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Feather name="send" size={16} color={Brand.ink} />
                                        <Text style={styles.shareBtnText} allowFontScaling={false} maxFontSizeMultiplier={1} numberOfLines={1}>{t.shareLabel}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.favBtn, favorites.isFavorite(item.id) && styles.favBtnActive]}
                                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); favorites.toggle(item.id); }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name={favorites.isFavorite(item.id) ? 'heart' : 'heart-outline'} size={18} color={favorites.isFavorite(item.id) ? '#C2453D' : Brand.ink} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.cardBody}>
                                    <Text style={styles.cardTitle}>{item.title}</Text>
                                    <View style={styles.tagRow}>
                                        {item.tags?.map((tTag, idx) => <View key={idx} style={styles.tagBadge}><Text style={styles.tagText}>{resolveTagLabel(tTag, lang)}</Text></View>)}
                                    </View>
                                    {reviewSummaries[item.id] && (
                                        <TouchableOpacity style={styles.reviewPreview} onPress={() => openDetail(item)}>
                                            <View style={styles.reviewPreviewMeta}>
                                                <Feather name="message-circle" size={13} color={Brand.textMuted} />
                                                <Text style={styles.reviewPreviewCount}>{reviewSummaries[item.id].count}</Text>
                                            </View>
                                            <Text style={styles.reviewPreviewText} numberOfLines={1}>
                                                <Text style={styles.reviewPreviewAuthor}>{reviewSummaries[item.id].latestAuthor}</Text>
                                                {'  '}{reviewSummaries[item.id].latestComment}
                                            </Text>
                                            {reviewSummaries[item.id].latestLikes > 0 && (
                                                <View style={styles.reviewPreviewMeta}>
                                                    <Feather name="heart" size={11} color={Brand.danger} />
                                                    <Text style={styles.reviewPreviewCount}>{reviewSummaries[item.id].latestLikes}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    <View style={styles.cardFooter}>
                                        <View>
                                            <Text style={styles.priceLabel}>{t.estPrice}</Text>
                                            <Text style={styles.priceValue}>{formatCurrency(item.price)} <Text style={styles.priceUnit}>{item.unit}</Text></Text>
                                        </View>
                                        <View style={{ flexDirection: 'column', gap: 6 }}>
                                            <TouchableOpacity style={styles.detailBtn} onPress={() => openDetail(item)}>
                                                <Text style={styles.detailBtnText}>{t.details}</Text>
                                            </TouchableOpacity>
                                            <Button
                                                label={inCart ? t.inCart : t.addToCart}
                                                variant={inCart ? 'secondary' : 'primary'}
                                                size="sm"
                                                onPress={() => toggleCart(item)}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {activeTab === 'cart' && (
                <View style={styles.scrollArea}>
                <ScrollView
                    ref={smetaScrollRef}
                    style={styles.scrollArea}
                    contentContainerStyle={[styles.scrollContent, cart.length > 0 && styles.smetaScrollContent]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    scrollEventThrottle={64}
                    onLayout={e => { smetaViewportH.current = e.nativeEvent.layout.height; updateSmetaAtEnd(); }}
                    onContentSizeChange={(_w, h) => { smetaContentH.current = h; updateSmetaAtEnd(); }}
                    onScroll={e => { smetaOffsetY.current = e.nativeEvent.contentOffset.y; updateSmetaAtEnd(); }}
                >
                    <SmetaHero lang={lang} eventTitle={eventTitle} date={formattedDate} guests={parsedGuests} daysLeft={daysLeft} />
                    {cart.length === 0 ? (
                        <SmetaEmpty lang={lang} steps={smetaSteps} labelFor={planLabel} onStart={openCatalogCategory} />
                    ) : (
                        <>
                            <SmetaPlan lang={lang} steps={smetaSteps} cart={cart} labelFor={planLabel} onAdd={openCatalogCategory} />
                            {cart.map(item => {
                                const itemPromo = promoPercentFor(item);
                                return (
                                    <SmetaLine
                                        key={item.id}
                                        photo={item.images?.[0] || item.img}
                                        category={categoryLabels[item.category as PlanCategory] ?? ''}
                                        title={item.title}
                                        detail={item.category === 'venues' ? `${item.price} AZN × ${parsedGuests} ${t.guestUnit}` : item.unit}
                                        promo={itemPromo > 0 ? `${appliedPromo?.code} −${itemPromo}%` : undefined}
                                        price={`${formatCurrency(lineFinal(item))} AZN`}
                                        onPress={() => openDetail(item)}
                                        onRemove={() => toggleCart(item)}
                                    />
                                );
                            })}
                            <View style={styles.contactCard} onLayout={e => { contactCardY.current = e.nativeEvent.layout.y; }}>
                                <Text style={styles.contactHeader}>{t.contactPhone}</Text>
                                <TextInput style={[styles.phoneInput, { marginBottom: 10 }, triedSend && missingPhone && styles.inputMissing]} placeholder="+994 (50) 000-00-00" placeholderTextColor="#A0968E" keyboardType="phone-pad" value={phone}
                                    onChangeText={(text) => { if (!text.startsWith('+994 ')) setPhone('+994 '); else setPhone(text); }} />
                                <TextInput style={[styles.phoneInput, triedSend && missingName && styles.inputMissing]} placeholder="Ad və Soyad" placeholderTextColor="#A0968E" value={fullName} onChangeText={setFullName} />
                            </View>
                            <View style={[styles.contactCard, { marginTop: 0 }]}>
                                <Text style={styles.contactHeader}>{t.promoTitle}</Text>
                                {appliedPromo ? (
                                    <>
                                        <View style={styles.promoAppliedRow}>
                                            <Feather name="check-circle" size={16} color={Brand.success} />
                                            <Text style={styles.promoAppliedText}>{t.promoApplied}: {appliedPromo.code} (−{appliedPromo.percent}%)</Text>
                                            <TouchableOpacity onPress={removePromo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                <Text style={styles.promoRemoveText}>{t.promoRemove}</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.promoHint}>
                                            {cartEligibleCount === 0 ? t.promoNoEligible : cartEligibleCount < cart.length ? t.promoOnlyMarked : ''}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <View style={styles.promoInputRow}>
                                            <TextInput
                                                style={[styles.phoneInput, { flex: 1 }]}
                                                placeholder={t.promoPlaceholder}
                                                placeholderTextColor="#A0968E"
                                                autoCapitalize="characters"
                                                autoCorrect={false}
                                                value={promoInput}
                                                onChangeText={(v) => { setPromoInput(v); if (promoError) setPromoError(false); }}
                                                onSubmitEditing={applyPromo}
                                            />
                                            <Button label={t.promoApply} variant="primary" size="sm" loading={promoChecking} onPress={applyPromo} />
                                        </View>
                                        {promoError && <Text style={styles.promoErrorText}>{t.promoInvalid}</Text>}
                                    </>
                                )}
                            </View>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 }}
                                onPress={() => setPrivacyAccepted(!privacyAccepted)}
                                activeOpacity={0.7}
                            >
                                <View style={{ 
                                    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, 
                                    borderColor: privacyAccepted ? '#D4AF37' : triedSend ? '#C2453D' : '#8A7E75', 
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
                                {perGuestText && (
                                    <Text style={styles.totalPerGuest}>{smetaText.perGuest} ≈ {perGuestText}</Text>
                                )}
                                {promoSavings > 0 && (
                                    <Text style={styles.totalSavings}>{t.promoSaved}: −{formatCurrency(promoSavings)} AZN</Text>
                                )}
                                <Button
                                    label={t.sendManager}
                                    variant="gold"
                                    fullWidth
                                    loading={submitting}
                                    style={{ marginTop: 6 }}
                                    onPress={async () => {
                                        if (missingName || missingPhone || missingConsent) {
                                            warnMissingDetails();
                                            return;
                                        }
                                        if (submitting || promoChecking) return;
                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        const items = await refreshCartPromoFlags();
                                        let promo = appliedPromo;
                                        // A code that was typed but never confirmed with "Apply" is applied now.
                                        if (!promo && promoInput.trim()) {
                                            promo = await checkPromo(promoInput);
                                            if (!promo) return; // invalid code: the error is shown, nothing is sent
                                        }
                                        const success = await sendToTelegram(promo, items);
                                        if (success) {
                                            metaEvents.submitOrder(items.reduce((sum, item) => sum + lineFinal(item, promo), 0), items.length);
                                            setCheckoutModalVisible(true);
                                        }
                                    }}
                                />
                            </View>
                        </>
                    )}
                </ScrollView>
                <SmetaStickyBar
                    lang={lang}
                    visible={cart.length > 0 && !smetaAtEnd}
                    total={`${formatCurrency(totalEstimate)} AZN`}
                    perGuest={perGuestText}
                    count={cart.length}
                    onPress={() => smetaScrollRef.current?.scrollToEnd({ animated: true })}
                />
                <Toast toast={smetaToast} onHide={() => setSmetaToast(null)} />
                </View>
            )}

            {activeTab === 'concierge' && (
                <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.conciergeCard}>
                        <Text style={styles.conciergeBadge}>{t.conciergeBadge}</Text>
                        <Text style={styles.conciergeTitle}>{t.conciergeTitle}</Text>
                        <Text style={styles.conciergeDesc}>{t.conciergeDesc}</Text>
                        <Button
                            label={t.writeWhatsapp}
                            variant="primary"
                            fullWidth
                            icon="message-circle"
                            style={[styles.whatsappBtn, { marginBottom: 10 }]}
                            onPress={() => Linking.openURL('https://wa.me/994502503171')}
                        />
                        <Button
                            label={t.callProducer}
                            variant="primary"
                            fullWidth
                            icon="phone"
                            onPress={() => Linking.openURL('tel:+994502503171')}
                        />
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

                        <View style={[styles.tabBar, Platform.OS === 'android' && { paddingBottom: insets.bottom + 10 }]}>
                <TouchableOpacity style={[styles.tabItem, activeTab === 'catalog' && styles.tabItemActive]} onPress={() => setActiveTab('catalog')}>
                    <Text style={[styles.tabText, activeTab === 'catalog' && styles.tabTextActive]} allowFontScaling={false} maxFontSizeMultiplier={1}>{t.tabCatalog}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabItem, activeTab === 'cart' && styles.tabItemActive]} onPress={() => setActiveTab('cart')}>
                    <Text style={[styles.tabText, activeTab === 'cart' && styles.tabTextActive]} allowFontScaling={false} maxFontSizeMultiplier={1}>{t.tabCart} {cart.length > 0 ? `(${cart.length})` : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabItem, activeTab === 'concierge' && styles.tabItemActive]} onPress={() => setActiveTab('concierge')}>
                    <Text style={[styles.tabText, activeTab === 'concierge' && styles.tabTextActive]} allowFontScaling={false} maxFontSizeMultiplier={1}>{t.tabConcierge}</Text>
                </TouchableOpacity>
            </View>

            {/* 'popup' banners now live in the Stories row above the catalog */}

            {/* INSTAGRAM-STYLE EXPLORE SEARCH (overlay; the detail modal opens on top of it) */}
            <ExploreSearch
                visible={exploreVisible}
                onClose={() => setExploreVisible(false)}
                services={exploreServices}
                lang={lang}
                onOpenService={openDetail}
                tagLabel={resolveTagLabel}
                formatPrice={formatCurrency}
                onSearch={metaEvents.search}
            />

            {/* DATE PICKER MODAL */}
            <Modal animationType="fade" onRequestClose={() => setShowDatePickerModal(false)} transparent visible={showDatePickerModal}>
                <TouchableOpacity activeOpacity={1} onPress={() => setShowDatePickerModal(false)} style={styles.modalOverlayCenter}>
                    <TouchableOpacity activeOpacity={1} style={styles.datePickerModalContent}>
                        <Calendar
                            current={eventDate}
                            minDate={localDateString(new Date())}
                            onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
                            markedDates={{ [selectedDate]: { selected: true, selectedColor: '#2C2623' } }}
                            theme={{ selectedDayBackgroundColor: '#2C2623', todayTextColor: '#2C2623', arrowColor: '#2C2623' }}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
                            <Button label={t.close} variant="secondary" onPress={() => setShowDatePickerModal(false)} style={{ flex: 1 }} />
                            <Button label={t.save} variant="primary" onPress={() => { setEventDate(selectedDate); setShowDatePickerModal(false); }} style={{ flex: 1 }} />
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* DETAIL MODAL */}
            <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayBottom}>
                    <Animated.View style={[styles.modalContentBottom, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
                        <IconButton icon="x" onPress={() => setDetailModalVisible(false)} style={styles.closeXBtn} />
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
                                {selectedItem.address && (
                                    <View style={styles.detailInfoRow}>
                                        <Feather name="map-pin" size={13} color={Brand.textMuted} style={styles.detailInfoIcon} />
                                        <Text style={styles.detailInfo}>{selectedItem.address}</Text>
                                    </View>
                                )}
                                {selectedItem.phone && (
                                    <View style={styles.detailInfoRow}>
                                        <Feather name="phone" size={13} color={Brand.textMuted} style={styles.detailInfoIcon} />
                                        <Text style={styles.detailInfo}>{selectedItem.phone}</Text>
                                    </View>
                                )}
                                {selectedItem.capacity && (
                                    <View style={styles.detailInfoRow}>
                                        <Feather name="users" size={13} color={Brand.textMuted} style={styles.detailInfoIcon} />
                                        <Text style={styles.detailInfo}>{selectedItem.capacity}</Text>
                                    </View>
                                )}
                                {(() => {
                                    const phone = normalizeAzPhone(selectedItem.phone);
                                    if (!phone) return null;
                                    const open = (url: string) => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        Linking.openURL(url).catch(() => {});
                                    };
                                    return (
                                        <View style={styles.contactRow}>
                                            <TouchableOpacity style={styles.contactBtn} activeOpacity={0.8} onPress={() => { metaEvents.contact(selectedItem, 'call'); open(telUrl(phone)); }}>
                                                <Feather name="phone" size={16} color={Brand.ink} />
                                                <Text style={styles.contactBtnText} numberOfLines={1} allowFontScaling={false}>{t.callBtn}</Text>
                                            </TouchableOpacity>
                                            {isAzMobile(phone) && (
                                                <TouchableOpacity
                                                    style={[styles.contactBtn, styles.contactWhatsappBtn]}
                                                    activeOpacity={0.8}
                                                    onPress={() => { metaEvents.contact(selectedItem, 'whatsapp'); open(whatsappUrl(phone, t.whatsappMsg.replace('{title}', selectedItem.title))); }}
                                                >
                                                    <FontAwesome name="whatsapp" size={17} color="#FFFFFF" />
                                                    <Text style={[styles.contactBtnText, { color: '#FFFFFF' }]} numberOfLines={1} allowFontScaling={false}>{t.whatsappBtn}</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })()}
                                <Button
                                    label={cart.some(c => c.id === selectedItem.id) ? t.inCart : t.addToCart}
                                    variant="primary"
                                    fullWidth
                                    style={{ marginTop: 20 }}
                                    onPress={() => { toggleCart(selectedItem); setDetailModalVisible(false); }}
                                />
                                <ServiceReviews serviceId={selectedItem.id} lang={lang} />
                                <Button label={t.close} variant="ghost" onPress={() => setDetailModalVisible(false)} style={{ marginTop: 6 }} />
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 10 }}>
                            <Button label={t.reset} variant="secondary" onPress={() => { setMinPrice(''); setMaxPrice(''); setSortBy('rating'); }} style={{ flex: 1 }} />
                            <Button label={t.apply} variant="primary" onPress={() => setFilterModalVisible(false)} style={{ flex: 1 }} />
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* CHECKOUT SUCCESS MODAL */}
            <Modal visible={checkoutModalVisible} transparent animationType="fade" onRequestClose={() => setCheckoutModalVisible(false)}>
                <TouchableOpacity activeOpacity={1} onPress={() => setCheckoutModalVisible(false)} style={styles.modalOverlayCenter}>
                    <View style={styles.checkoutSuccessContent}>
                        <View style={styles.checkoutSuccessIconWrap}>
                            <Feather name="check" size={22} color={Brand.white} />
                        </View>
                        <Text style={styles.checkoutSuccessTitle}>{t.modalSuccessTitle}</Text>
                        <Text style={styles.checkoutSuccessDesc}>{formatCurrency(totalEstimate)} {t.modalSuccessDesc}</Text>
                        <Button label={t.close} variant="primary" fullWidth onPress={() => setCheckoutModalVisible(false)} />
                    </View>
                </TouchableOpacity>
            </Modal>

            <PartnerPortal lang={lang} visible={showPartnerPortal} onClose={() => setShowPartnerPortal(false)} />
        </SafeAreaView>
    );
}

// New premium sections shrink on small phones; older parts keep their sizes.
const SCALED_STYLES = /^(welcome|lang|ornament|eventType|eventCards|partnerLinkWelcome|myAccountBtnWelcome|customerLinkWelcome|partnerContactHint|total|contact|phoneInput|smeta|fav)/;
const styles = StyleSheet.create(premiumStyles(scaled({
    container: { flex: 1, backgroundColor: '#FAF8F5' },
    welcomeContainer: { flex: 1, backgroundColor: '#F7F3EE' },
    welcomeScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: isShortScreen ? 10 : 24 },
    langSelectorContainer: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: isShortScreen ? 12 : 28 },
    langBtn: { alignItems: 'center', minWidth: 28 },
    langBtnActive: {},
    langBtnText: { fontSize: 12, fontWeight: '500', color: '#A39A92', letterSpacing: 1.5 },
    langUnderline: { marginTop: 5, height: 1.5, width: 14, backgroundColor: 'transparent' },
    langUnderlineActive: { backgroundColor: '#C9A44C' },
    langBtnTextActive: { color: '#1F1A17', fontWeight: '700' },
    welcomeHeader: { alignItems: 'center', marginBottom: isShortScreen ? 14 : 28 },
    welcomeKicker: { fontSize: 10, color: '#B08F3E', fontWeight: '600', letterSpacing: 4, marginBottom: 8 },
    welcomeTitle: { fontSize: isShortScreen ? 40 : 48, fontFamily: FONTS.serif, fontWeight: '600', color: '#1F1A17', letterSpacing: 0.5, lineHeight: isShortScreen ? 46 : 54 },
    ornament: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: isShortScreen ? 8 : 12 },
    ornamentLine: { width: 36, height: 1, backgroundColor: '#C9A44C' },
    ornamentDiamond: { width: 6, height: 6, backgroundColor: '#C9A44C', transform: [{ rotate: '45deg' }] },
    brandBadge: { fontSize: 11, color: '#8A7E75', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    brandTitle: { fontSize: 26, fontFamily: FONTS.serif, fontWeight: '700', color: '#2C2623', letterSpacing: 1 },
    headerDivider: { width: 40, height: 2, backgroundColor: '#D4AF37', marginVertical: 10 },
    welcomeSub: { fontSize: 11, letterSpacing: 2.5, color: '#7A6F67', fontWeight: '500' },
    eventCardsContainer: { flex: 1, gap: isShortScreen ? 10 : 14, justifyContent: 'center' },
    eventTypeCard: { flex: 1, minHeight: isShortScreen ? 84 : 120, maxHeight: 148, borderRadius: 22, overflow: 'hidden', backgroundColor: '#2A2421', justifyContent: 'flex-end', shadowColor: '#1F1A17', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 6 },
    eventTypeContent: { paddingHorizontal: 20, paddingBottom: isShortScreen ? 12 : 18, paddingRight: 72 },
    eventTypeIndex: { fontSize: 11, color: '#E3C77A', fontWeight: '600', letterSpacing: 2, marginBottom: 4 },
    eventTypeArrow: { position: 'absolute', right: 18, bottom: isShortScreen ? 14 : 20, width: 40, height: 40, borderRadius: 20, backgroundColor: '#E3C77A', alignItems: 'center', justifyContent: 'center' },
    eventTypeIcon: { fontSize: 28 },
    eventTypeName: { fontSize: isShortScreen ? 24 : 28, fontFamily: FONTS.serif, fontWeight: '600', color: '#FFFFFF', marginBottom: 2, lineHeight: isShortScreen ? 28 : 32 },
    eventTypeDesc: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 17 },
    topHeader: { alignItems: 'center', paddingTop: 10, paddingBottom: 12, backgroundColor: '#FAF8F5', borderBottomWidth: 1, borderBottomColor: '#EFECE6', position: 'relative' },
    changeEventBtn: { position: 'absolute', left: 16, top: 12, minWidth: 80 },
    changeEventText: { fontSize: 14, color: '#8A7E75', fontWeight: '600' },
    partnerBtn: { position: 'absolute', right: 16, top: 12, backgroundColor: '#2C2623', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14 },
    partnerBtnText: { fontSize: 12, color: '#D4AF37', fontWeight: '700' },
    partnerLinkWelcome: { alignSelf: 'stretch', marginTop: isShortScreen ? 14 : 24, paddingVertical: isShortScreen ? 12 : 14, borderRadius: 999, borderWidth: 1, borderColor: '#1F1A17', alignItems: 'center' },
    partnerLinkWelcomeText: { fontSize: 13, color: '#1F1A17', fontWeight: '600', letterSpacing: 0.5 },
    myAccountBtnWelcome: { alignSelf: 'stretch', marginTop: isShortScreen ? 14 : 24, backgroundColor: '#1F1A17', paddingVertical: isShortScreen ? 12 : 14, borderRadius: 999, alignItems: 'center' },
    myAccountBtnWelcomeText: { fontSize: 13, color: '#E3C77A', fontWeight: '700', letterSpacing: 0.5 },
    customerLinkWelcome: { alignSelf: 'stretch', marginTop: isShortScreen ? 8 : 10, paddingVertical: isShortScreen ? 12 : 14, borderRadius: 999, backgroundColor: '#1F1A17', alignItems: 'center' },
    customerLinkWelcomeText: { fontSize: 13, color: '#F7F3EE', fontWeight: '600', letterSpacing: 0.5 },
    partnerContactHint: { alignSelf: 'center', marginTop: isShortScreen ? 8 : 16, fontSize: 11, color: '#A39A92', textAlign: 'center', paddingHorizontal: 12, lineHeight: 16 },
    partnerFormSub: { fontSize: 12, color: '#8A7E75', marginBottom: 18, lineHeight: 17 },
    partnerLabel: { fontSize: 11, fontWeight: '700', color: '#6A625C', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    partnerInput: { backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#EFECE6', borderRadius: 8, padding: 12, fontSize: 14, color: '#2C2623' },
    partnerCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    partnerCatChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#EFECE6' },
    partnerCatChipActive: { backgroundColor: '#2C2623', borderColor: '#2C2623' },
    partnerCatChipText: { fontSize: 12, color: '#6A625C', fontWeight: '600' },
    partnerCatChipTextActive: { color: '#D4AF37' },
    partnerTagChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FAF8F5', borderWidth: 1, borderColor: '#EFECE6' },
    partnerTagChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
    partnerTagChipText: { fontSize: 11, color: '#6A625C', fontWeight: '600' },
    partnerTagChipTextActive: { color: '#2C2623' },
    partnerSuccessCheck: { fontSize: 40, color: '#D4AF37', fontWeight: '700', marginBottom: 10 },
    partnerImagePickBtn: { backgroundColor: '#FAF8F5', borderWidth: 1.5, borderColor: '#D4AF37', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
    partnerImagePickBtnText: { fontSize: 13, fontWeight: '700', color: '#2C2623' },
    partnerImagePreviewWrap: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
    partnerImagePreview: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#EFECE6' },
    partnerImageChangeBtn: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(44,38,35,0.85)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14 },
    partnerImageChangeBtnText: { color: '#D4AF37', fontSize: 11, fontWeight: '700' },
    partnerImageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    partnerImageGridItem: { width: '31%', aspectRatio: 4/5, borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: '#EFECE6' },
    partnerImageGridImg: { width: '100%', height: '100%' },
    partnerImageRemoveBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(44,38,35,0.85)', justifyContent: 'center', alignItems: 'center' },
    partnerImageRemoveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    partnerImageHint: { fontSize: 11, color: '#B0392C', marginTop: 6 },
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
    contactRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.white },
    contactWhatsappBtn: { backgroundColor: '#25D366', borderColor: '#25D366' },
    contactBtnText: { fontSize: 15, fontWeight: '700', color: Brand.ink },
    searchPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Brand.white, borderRadius: 14, borderWidth: 1, borderColor: Brand.border, paddingHorizontal: 14, height: 44, marginBottom: 14 },
    searchPillText: { flex: 1, fontSize: 14, color: Brand.textPlaceholder },
    chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFECE6', marginRight: 8, flexShrink: 0 },
    activeChip: { backgroundColor: '#2C2623', borderColor: '#2C2623' },
    chipText: { fontSize: 12, color: '#6A625C', fontWeight: '500' },
    activeChipText: { color: '#FFF' },
    segmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionHeading: { fontSize: 14, fontWeight: '700', letterSpacing: 1, color: '#2C2623' },
    filterBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFECE6' },
    filterBtnActive: { backgroundColor: '#D4AF37' },
    filterBtnText: { fontSize: 12, fontWeight: '600', color: '#2C2623' },
    card: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#EFECE6', marginBottom: 16, overflow: 'hidden' },
    imageContainer: { position: 'relative' },
    cardImg: { width: '100%', height: '100%' },
    ratingBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(44,38,35,0.85)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
    carouselDots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
    carouselDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    carouselDotActive: { backgroundColor: '#FFFFFF', width: 14 },
    cardRating: { color: '#D4AF37', fontSize: 12, fontWeight: '700' },
    cardBody: { padding: 14 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 8 },
    cardActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10 },
    favBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.white },
    favBtnActive: { borderColor: '#F0C9C5', backgroundColor: '#FDF1EF' },
    favChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.white },
    shareBtnText: { fontSize: 13, fontWeight: '600', color: Brand.ink },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    reviewPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    reviewPreviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    reviewPreviewCount: { fontSize: 11, color: '#8A7E75', fontWeight: '600' },
    reviewPreviewText: { flex: 1, fontSize: 12, color: '#6A625C' },
    reviewPreviewAuthor: { fontWeight: '700', color: '#2C2623' },
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
    cartItemPromo: { fontSize: 11, fontWeight: '700', color: '#8A6D1F', marginTop: 2 },
    promoBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: '#D4AF37', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
    promoBadgeText: { fontSize: 11, fontWeight: '700', color: '#2C2623' },
    promoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    promoAppliedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    promoAppliedText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#2F7D5C' },
    promoRemoveText: { fontSize: 12, color: '#8A7E75', textDecorationLine: 'underline' },
    promoHint: { fontSize: 11, color: '#8A7E75', marginTop: 6 },
    promoErrorText: { fontSize: 12, color: '#B0392C', marginTop: 6 },
    totalSavings: { color: '#E3C77A', fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
    cartItemPrice: { fontSize: 14, fontWeight: '700', color: '#2C2623', marginRight: 12 },
    removeBtn: { padding: 4 },
    contactCard: { backgroundColor: '#FFF', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#EDE6DC', marginTop: 8, marginBottom: 14 },
    contactHeader: { fontSize: 10.5, fontWeight: '600', color: '#A8893E', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.6 },
    phoneInput: { backgroundColor: '#FBF8F3', borderWidth: 1, borderColor: '#E6DFD5', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, fontSize: 15, color: '#1F1A17' },
    smetaScrollContent: { paddingBottom: 120 },
    inputMissing: { borderColor: '#C2453D', backgroundColor: '#FDF4F2' },
    totalPerGuest: { color: 'rgba(251,247,240,0.7)', fontSize: 12.5, marginBottom: 10 },
    totalCard: { backgroundColor: '#1F1A17', paddingVertical: 24, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center' },
    totalTitle: { color: 'rgba(251,247,240,0.6)', fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2 },
    totalAmount: { color: '#E3C77A', fontSize: 36, fontFamily: 'Georgia', fontWeight: '700', marginTop: 6, marginBottom: 4 },
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
    tabText: { fontSize: 11, fontWeight: '700', color: '#A0968E' },
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
    detailInfo: { fontSize: 12, color: '#8A7E75' },
    detailInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    detailInfoIcon: { marginRight: 6 },
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
    checkoutSuccessIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2C2623', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    checkoutSuccessTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 8 },
    checkoutSuccessDesc: { fontSize: 13, color: '#6A625C', textAlign: 'center', marginBottom: 16 },
    primaryBtn: { backgroundColor: '#2C2623', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    secondaryBtn: { backgroundColor: '#EFECE6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    secondaryBtnText: { color: '#2C2623', fontWeight: '600', fontSize: 13 },
}, key => SCALED_STYLES.test(key))));
