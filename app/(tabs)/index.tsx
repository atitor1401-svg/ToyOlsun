import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
        ScrollView, StatusBar, Modal, Platform, Linking,
    PanResponder, Animated, KeyboardAvoidingView, AppState, Share
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ExpoLinking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { registerPushTokenForUser } from '../../lib/notifications';
import { sendOrderToTelegram, flushPendingOrderTelegrams } from '../../lib/orderTelegram';
import { useWindowDimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Calendar } from 'react-native-calendars';
import PartnerPortal from './PartnerPortal';
import CustomerPortal, { ServiceReviews } from './CustomerPortal';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Colors as Brand } from '@/constants/brand';

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
export type CategoryFilter = 'all' | 'venues' | 'artists' | 'media' | 'cars' | 'wedding_dress' | 'flowers' | 'tourism';
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
        catAll: 'Hamısı', catVenues: 'Zallar', catArtists: 'Artistlər',
        catMedia: 'Foto & Video', catCars: 'VIP Kortej',
        catWeddingDress: 'Gəlinlik', catFlowers: 'Gül Dükanı', catTourism: 'Bal Ayı',
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
        catAll: 'Все', catVenues: 'Залы', catArtists: 'Артисты',
        catMedia: 'Фото и Видео', catCars: 'VIP Кортеж',
        catWeddingDress: 'Свадебное платье', catFlowers: 'Цветочный магазин', catTourism: 'Медовый месяц',
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
        catAll: 'All', catVenues: 'Venues', catArtists: 'Artists',
        catMedia: 'Photo & Video', catCars: 'VIP Cortege',
        catWeddingDress: 'Wedding Dress', catFlowers: 'Flower Shop', catTourism: 'Honeymoon',
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
                        <Image
                            key={idx}
                            source={{ uri }}
                            style={{ width: containerWidth, height }}
                            contentFit="cover"
                            onError={() => setFailedUris(prev => new Set(prev).add(uri))}
                        />
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
    // brought to foreground) via a toyolsun://service?id=... deep link.
    useEffect(() => {
        const openFromUrl = (url: string | null) => {
            if (!url || services.length === 0) return;
            const { queryParams } = ExpoLinking.parse(url);
            const id = queryParams?.id;
            if (!id) return;
            const item = services.find(s => s.id === id);
            if (item) openDetail(item);
        };
        ExpoLinking.getInitialURL().then(openFromUrl);
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
                <View style={styles.langSelectorContainer}>
                    {(['az', 'ru', 'en'] as Language[]).map(l => (
                        <TouchableOpacity key={l} style={[styles.langBtn, lang === l && styles.langBtnActive]} onPress={() => { Haptics.selectionAsync(); setLang(l); }}>
                            <Text style={[styles.langBtnText, lang === l && styles.langBtnTextActive]} allowFontScaling={false} maxFontSizeMultiplier={1}>{l.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.welcomeHeader}>
                    <Text style={styles.brandBadge} allowFontScaling={false} maxFontSizeMultiplier={1}>CONCIERGE & ATELIER</Text>
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
                        {[{ id: 'all', name: t.catAll }, { id: 'venues', name: t.catVenues }, { id: 'artists', name: t.catArtists }, { id: 'media', name: t.catMedia }, { id: 'cars', name: t.catCars }, { id: 'wedding_dress', name: t.catWeddingDress }, { id: 'flowers', name: t.catFlowers }, { id: 'tourism', name: t.catTourism }].map(f => (
                            <TouchableOpacity key={f.id} style={[styles.chip, selectedCat === f.id && styles.activeChip]} onPress={() => { Haptics.selectionAsync(); setSelectedCat(f.id as CategoryFilter); }}>
                                <Text style={[styles.chipText, selectedCat === f.id && styles.activeChipText]} allowFontScaling={false} maxFontSizeMultiplier={1}>{f.name}</Text>
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
                            <Text style={styles.emptyTitle}>{t.noResultsTitle}</Text>
                            <Text style={styles.emptySub}>{t.noResultsDesc}</Text>
                        </View>
                    ) : filteredServices.map(item => {
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
                                    <TouchableOpacity onPress={() => handleShare(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Feather name="send" size={18} color={Brand.textMuted} />
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
                                const itemTotal = lineFinal(item);
                                const itemPromo = promoPercentFor(item);
                                return (
                                    <View key={item.id} style={styles.cartItem}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cartItemTitle}>{item.title}</Text>
                                            <Text style={styles.cartItemSub}>{item.category === 'venues' ? `${item.price} AZN × ${parsedGuests} ${t.guestUnit}` : item.unit}</Text>
                                            {itemPromo > 0 && <Text style={styles.cartItemPromo}>{appliedPromo?.code} −{itemPromo}%</Text>}
                                        </View>
                                        <Text style={styles.cartItemPrice}>{formatCurrency(itemTotal)} AZN</Text>
                                        <IconButton icon="x" size={28} onPress={() => toggleCart(item)} style={styles.removeBtn} />
                                    </View>
                                );
                            })}
                            <View style={styles.contactCard}>
                                <Text style={styles.contactHeader}>{t.contactPhone}</Text>
                                <TextInput style={[styles.phoneInput, { marginBottom: 10 }]} placeholder="+994 (50) 000-00-00" placeholderTextColor="#A0968E" keyboardType="phone-pad" value={phone}
                                    onChangeText={(text) => { if (!text.startsWith('+994 ')) setPhone('+994 '); else setPhone(text); }} />
                                <TextInput style={styles.phoneInput} placeholder="Ad və Soyad" placeholderTextColor="#A0968E" value={fullName} onChangeText={setFullName} />
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
                                        if (!fullName.trim() || phone.trim() === '+994' || !privacyAccepted) {
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
                                            setCheckoutModalVisible(true);
                                        }
                                    }}
                                />
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF8F5' },
    welcomeContainer: { flex: 1, backgroundColor: '#FAF8F5', justifyContent: 'center', paddingHorizontal: 20 },
    langSelectorContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
    langBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#EFECE6', minWidth: 50, alignItems: 'center', justifyContent: 'center' },
    langBtnActive: { backgroundColor: '#2C2623' },
    langBtnText: { fontSize: 12, fontWeight: '700', color: '#6A625C' },
    langBtnTextActive: { color: '#FFF' },
    welcomeHeader: { alignItems: 'center', marginBottom: 30 },
    brandBadge: { fontSize: 11, color: '#8A7E75', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    brandTitle: { fontSize: 26, fontFamily: FONTS.serif, fontWeight: '700', color: '#2C2623', letterSpacing: 1 },
    headerDivider: { width: 40, height: 2, backgroundColor: '#D4AF37', marginVertical: 10 },
    welcomeSub: { fontSize: 12, letterSpacing: 1.5, color: '#6A625C', fontWeight: '600' },
    eventCardsContainer: { gap: 14 },
    eventTypeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#EFECE6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    eventTypeIcon: { fontSize: 28, marginRight: 16 },
    eventTypeName: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 4 },
    eventTypeDesc: { fontSize: 12, color: '#8A7E75' },
    topHeader: { alignItems: 'center', paddingTop: 10, paddingBottom: 12, backgroundColor: '#FAF8F5', borderBottomWidth: 1, borderBottomColor: '#EFECE6', position: 'relative' },
    changeEventBtn: { position: 'absolute', left: 16, top: 12, minWidth: 80 },
    changeEventText: { fontSize: 14, color: '#8A7E75', fontWeight: '600' },
    partnerBtn: { position: 'absolute', right: 16, top: 12, backgroundColor: '#2C2623', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14 },
    partnerBtnText: { fontSize: 12, color: '#D4AF37', fontWeight: '700' },
    partnerLinkWelcome: { alignSelf: 'center', marginTop: 22, paddingVertical: 8, paddingHorizontal: 6 },
    partnerLinkWelcomeText: { fontSize: 13, color: '#8A7E75', fontWeight: '600', textDecorationLine: 'underline' },
        myAccountBtnWelcome: { alignSelf: 'center', marginTop: 22, backgroundColor: '#2C2623', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
    myAccountBtnWelcomeText: { fontSize: 13, color: '#D4AF37', fontWeight: '700' },
    customerLinkWelcome: { alignSelf: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 6 },
    customerLinkWelcomeText: { fontSize: 13, color: '#8A7E75', fontWeight: '600', textDecorationLine: 'underline' },
    partnerContactHint: { alignSelf: 'center', marginTop: 10, fontSize: 11, color: '#B8AEA5', textAlign: 'center', paddingHorizontal: 12 },
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
    cardActionRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10 },
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
    totalSavings: { color: '#D4AF37', fontSize: 12, fontWeight: '600', marginBottom: 6 },
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
});
