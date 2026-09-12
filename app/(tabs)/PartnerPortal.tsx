import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    ScrollView, Image, Modal, Platform, ActivityIndicator,
    KeyboardAvoidingView, Alert, Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';
import type { CategoryFilter, EventType, Language } from './index';

// ---------- Category tags (kept in sync with index.tsx) ----------
const CATEGORY_TAGS: Record<string, { id: string; az: string; ru: string; en: string }[]> = {
    venues: [
        { id: 'vip_level', az: 'VIP Səviyyə', ru: 'VIP уровень', en: 'VIP Level' },
        { id: 'palace', az: 'Dövlət Sarayı', ru: 'Дворец', en: 'Palace' },
        { id: 'panoramic', az: 'Panoram', ru: 'Панорама', en: 'Panoramic View' },
        { id: 'outdoor', az: 'Açıq Hava', ru: 'На улице', en: 'Outdoor' },
        { id: 'premium_hall', az: 'Premium Zal', ru: 'Премиум зал', en: 'Premium Hall' },
        { id: 'summer_terrace', az: 'Yay Terrası', ru: 'Летняя терраса', en: 'Summer Terrace' },
        { id: 'national_style', az: 'Milli Üslub', ru: 'Нац. стиль', en: 'National Style' },
        { id: 'restaurant_fun', az: 'Restoran & Əyləncə', ru: 'Ресторан и развлечения', en: 'Restaurant & Fun' },
    ],
    artists: [
        { id: 'pop_star', az: 'Pop Ulduzu', ru: 'Поп-звезда', en: 'Pop Star' },
        { id: 'live_vocal', az: 'Canlı Səs', ru: 'Живой вокал', en: 'Live Vocal' },
        { id: 'solo_singer', az: 'Solo Müğənni', ru: 'Солист', en: 'Solo Singer' },
        { id: 'peoples_artist', az: 'Xalq Artisti', ru: 'Народный артист', en: 'People\'s Artist' },
        { id: 'dj', az: 'DJ', ru: 'DJ', en: 'DJ' },
        { id: 'toastmaster', az: 'Toastmaster', ru: 'Тамада', en: 'Toastmaster' },
        { id: 'live_orchestra', az: 'Canlı Orkestr', ru: 'Живой оркестр', en: 'Live Orchestra' },
        { id: 'national_ensemble', az: 'Milli Ansambl', ru: 'Нац. ансамбль', en: 'National Ensemble' },
        { id: 'full_program', az: 'Tam Proqram', ru: 'Полная программа', en: 'Full Program' },
    ],
    media: [
        { id: 'pro_photographer', az: 'Peşəkar Fotoqraf', ru: 'Профессиональный фотограф', en: 'Professional Photographer' },
        { id: '4k_video', az: '4K Kino', ru: '4K видео', en: '4K Video' },
        { id: 'drone_footage', az: 'Aerofoto', ru: 'Аэросъёмка', en: 'Drone Footage' },
        { id: 'studio_shoot', az: 'Studiya Çəkilişi', ru: 'Студийная съёмка', en: 'Studio Shoot' },
        { id: 'photo_album', az: 'Foto Albom', ru: 'Фотоальбом', en: 'Photo Album' },
        { id: 'wedding_shoot', az: 'Toy Çəkilişi', ru: 'Свадебная съёмка', en: 'Wedding Shoot' },
    ],
    cars: [
        { id: 'rolls_royce', az: 'Rolls-Royce', ru: 'Rolls-Royce', en: 'Rolls-Royce' },
        { id: 'with_driver', az: 'Şofer Daxil', ru: 'С водителем', en: 'With Driver' },
        { id: 'decorated_interior', az: 'Bəzədilmiş Salon', ru: 'Украшенный салон', en: 'Decorated Interior' },
        { id: 'white_color', az: 'Ağ Rəng', ru: 'Белый цвет', en: 'White Color' },
        { id: 'premium_brand', az: 'Premium Marka', ru: 'Премиум марка', en: 'Premium Brand' },
    ],
    wedding_dress: [
        { id: 'rental', az: 'Kirayə', ru: 'Аренда', en: 'Rental' },
        { id: 'purchase', az: 'Alqı-satış', ru: 'Продажа', en: 'Purchase' },
        { id: 'designer_model', az: 'Dizayner Model', ru: 'Дизайнерская модель', en: 'Designer Model' },
        { id: 'custom_fitting', az: 'Ölçüyə Uyğunlaşdırma', ru: 'Подгонка по размеру', en: 'Custom Fitting' },
        { id: 'accessories_included', az: 'Aksessuarlar Daxil', ru: 'Аксессуары включены', en: 'Accessories Included' },
    ],
    flowers: [
        { id: 'bridal_bouquet', az: 'Gəlin Buketi', ru: 'Букет невесты', en: 'Bridal Bouquet' },
        { id: 'venue_decoration', az: 'Zal Bəzəyi', ru: 'Оформление зала', en: 'Venue Decoration' },
        { id: 'car_decoration', az: 'Maşın Bəzəyi', ru: 'Оформление авто', en: 'Car Decoration' },
        { id: 'fresh_flowers', az: 'Təzə Güllər', ru: 'Свежие цветы', en: 'Fresh Flowers' },
        { id: 'artificial_flowers', az: 'Süni Güllər', ru: 'Искусственные цветы', en: 'Artificial Flowers' },
    ],
    tourism: [
        { id: 'international', az: 'Xarici Ölkə', ru: 'За границей', en: 'International' },
        { id: 'local_tours', az: 'Yerli Turlar', ru: 'Местные туры', en: 'Local Tours' },
        { id: 'all_inclusive', az: 'All Inclusive', ru: 'Всё включено', en: 'All Inclusive' },
        { id: 'beach_vacation', az: 'Sahil İstirahəti', ru: 'Пляжный отдых', en: 'Beach Vacation' },
        { id: 'vip_package', az: 'VIP Paket', ru: 'VIP пакет', en: 'VIP Package' },
    ],
};

const PORTAL_TEXT = {
    az: {
        login: 'Daxil ol', signup: 'Qeydiyyatdan keç', email: 'Email', password: 'Şifrə',
        loginBtn: 'DAXİL OL', signupBtn: 'QEYDİYYATDAN KEÇ', switchToSignup: 'Hesabın yoxdur? Qeydiyyatdan keç',
        switchToLogin: 'Artıq hesabın var? Daxil ol', logout: 'Çıxış', myServices: 'Xidmətlərim',
        myOrders: 'Müraciətlər', noOrders: 'Hələ heç bir müraciət yoxdur',
        noOrdersSub: 'Xidmətiniz təsdiqləndikdən sonra müştəri müraciətləri burada görünəcək',
        orderNew: 'Yeni', orderSeen: 'Baxıldı', orderContacted: 'Əlaqə saxlanıldı', orderCompleted: 'Tamamlandı',
        orderGuests: 'qonaq', orderMarkContacted: 'Əlaqə saxlanıldı işarələ', orderCustomer: 'Müştəri',
        addNew: '+ Yeni xidmət əlavə et', edit: 'Redaktə et', delete: 'Sil', save: 'SAXLA',
        cancel: 'Ləğv et', deleteConfirmTitle: 'Silinsin?', deleteConfirmMsg: 'Bu xidməti silmək istədiyinizə əminsiniz? Bu geri qaytarıla bilməz.',
        deleteConfirmYes: 'Bəli, sil', deleteConfirmNo: 'Xeyr', statusPending: 'Gözləyir', statusApproved: 'Təsdiqləndi', statusRejected: 'Rədd edildi',
        noServices: 'Hələ heç bir xidmətiniz yoxdur', noServicesSub: 'Aşağıdakı düymə ilə ilk xidmətinizi əlavə edin',
        authError: 'Xəta baş verdi. Yenidən cəhd edin.', emailInvalid: 'Düzgün email daxil edin',
        passwordShort: 'Şifrə ən azı 6 simvol olmalıdır', accountSettings: 'Hesab Ayarları',
        forgotPasswordLink: 'Şifrəni unutmusunuz?', forgotPasswordTitle: 'Şifrəni Bərpa Et',
        privacyAgreePrefix: 'Şəxsi məlumatlarımın işlənməsinə razıyam.', privacyPolicyLink: 'Məxfilik Siyasəti',
        privacyRequired: 'Davam etmək üçün Məxfilik Siyasətini qəbul edin',
        confirmSignupTitle: 'Emaili Təsdiqləyin', confirmSignupDesc: 'Email ünvanınıza göndərilən 6 rəqəmli kodu daxil edin.',
        confirmBtn: 'TƏSDİQLƏ',
        forgotPasswordDesc: 'Email ünvanınızı daxil edin, sizə təsdiq kodu göndərəcəyik.',
        sendResetCode: 'KOD GÖNDƏR', resetCodeSent: 'Kod email ünvanınıza göndərildi. Aşağıya daxil edin.',
        otpCode: 'Təsdiq Kodu', otpRequired: 'Kodu daxil edin', newPassword: 'Yeni Şifrə',
        resetPasswordBtn: 'ŞİFRƏNİ YENİLƏ', backToLogin: '‹ Girişə qayıt',
        deleteAccount: 'Hesabı Sil', deleteAccountDesc: 'Hesabınızı və bütün xidmətlərinizi həmişəlik silər.',
        deleteAccountConfirmMsg: 'Hesabınızı silmək istədiyinizə əminsiniz? Bütün xidmətləriniz həmişəlik silinəcək. Bu geri qaytarıla bilməz.',
        back: '‹ Geri', partnerName: 'Xidmətin adı', partnerNamePh: 'Məs: Elux Event Hall',
        partnerCategory: 'Kateqoriya', partnerPrice: 'Qiymət (AZN)', partnerPricePh: 'Məs: 150',
        partnerUnit: 'Ölçü vahidi', partnerAddress: 'Ünvan', partnerAddressPh: 'Şəhər, küçə',
        partnerPhone: 'Əlaqə telefonu', partnerDescription: 'Təsvir', partnerDescriptionPh: 'Xidmətiniz haqqında qısa məlumat',
        partnerCapacity: 'Tutum (istəyə bağlı)', partnerCapacityPh: 'Məs: 200-500', partnerImageUrl: 'Şəkillər',
        partnerImagePick: '📷 Şəkil seç', partnerImageNeedTitle: 'Şəkil əlavə etməzdən əvvəl xidmətin adını yazın',
        partnerTags: 'Xüsusiyyətlər', partnerEventTypes: 'Hansı tədbirlərə uyğundur', partnerSubmit: 'GÖNDƏR',
        partnerSubmitting: 'GÖNDƏRİLİR...', catVenuesShort: 'Zal', catArtistsShort: 'Artist', catMediaShort: 'Foto/Video', catCarsShort: 'Kortej',
        catWeddingDressShort: 'Gəlinlik', catFlowersShort: 'Gül', catTourismShort: 'Bal Ayı',
        wedding: 'Toy', khyna: 'Xına', birthday: 'Ad günü', savedNeedsReview: 'Dəyişiklikləriniz saxlanıldı, yenidən yoxlanışa göndərildi.',
    },
    ru: {
        login: 'Войти', signup: 'Регистрация', email: 'Email', password: 'Пароль',
        loginBtn: 'ВОЙТИ', signupBtn: 'ЗАРЕГИСТРИРОВАТЬСЯ', switchToSignup: 'Нет аккаунта? Зарегистрироваться',
        switchToLogin: 'Уже есть аккаунт? Войти', logout: 'Выйти', myServices: 'Услуги',
        myOrders: 'Заявки', noOrders: 'Пока нет заявок',
        noOrdersSub: 'После одобрения услуги здесь появятся заявки клиентов',
        orderNew: 'Новая', orderSeen: 'Просмотрено', orderContacted: 'Связались', orderCompleted: 'Завершено',
        orderGuests: 'гостей', orderMarkContacted: 'Отметить как связались', orderCustomer: 'Клиент',
        addNew: '+ Добавить новую услугу', edit: 'Редактировать', delete: 'Удалить', save: 'СОХРАНИТЬ',
        cancel: 'Отмена', deleteConfirmTitle: 'Удалить?', deleteConfirmMsg: 'Вы уверены, что хотите удалить эту услугу? Это нельзя отменить.',
        deleteConfirmYes: 'Да, удалить', deleteConfirmNo: 'Нет', statusPending: 'На проверке', statusApproved: 'Одобрено', statusRejected: 'Отклонено',
        noServices: 'У вас пока нет услуг', noServicesSub: 'Добавьте первую услугу с помощью кнопки ниже',
        authError: 'Произошла ошибка. Попробуйте снова.', emailInvalid: 'Введите корректный email',
        passwordShort: 'Пароль должен быть не менее 6 символов', accountSettings: 'Настройки аккаунта',
        forgotPasswordLink: 'Забыли пароль?', forgotPasswordTitle: 'Восстановление пароля',
        privacyAgreePrefix: 'Я согласен(на) на обработку персональных данных.', privacyPolicyLink: 'Политика конфиденциальности',
        privacyRequired: 'Для продолжения примите Политику конфиденциальности',
        confirmSignupTitle: 'Подтвердите Email', confirmSignupDesc: 'Введите 6-значный код, отправленный на ваш email.',
        confirmBtn: 'ПОДТВЕРДИТЬ',
        forgotPasswordDesc: 'Введите email, мы отправим вам код подтверждения.',
        sendResetCode: 'ОТПРАВИТЬ КОД', resetCodeSent: 'Код отправлен на ваш email. Введите его ниже.',
        otpCode: 'Код подтверждения', otpRequired: 'Введите код', newPassword: 'Новый пароль',
        resetPasswordBtn: 'ОБНОВИТЬ ПАРОЛЬ', backToLogin: '‹ Назад ко входу',
        deleteAccount: 'Удалить аккаунт', deleteAccountDesc: 'Безвозвратно удалит аккаунт и все ваши услуги.',
        deleteAccountConfirmMsg: 'Вы уверены, что хотите удалить аккаунт? Все ваши услуги будут удалены безвозвратно. Это нельзя отменить.',
        back: '‹ Назад', partnerName: 'Название услуги', partnerNamePh: 'Напр: Elux Event Hall',
        partnerCategory: 'Категория', partnerPrice: 'Цена (AZN)', partnerPricePh: 'Напр: 150',
        partnerUnit: 'Единица измерения', partnerAddress: 'Адрес', partnerAddressPh: 'Город, улица',
        partnerPhone: 'Контактный телефон', partnerDescription: 'Описание', partnerDescriptionPh: 'Краткая информация о вашей услуге',
        partnerCapacity: 'Вместимость (необязательно)', partnerCapacityPh: 'Напр: 200-500', partnerImageUrl: 'Фото',
        partnerImagePick: '📷 Выбрать фото', partnerImageNeedTitle: 'Сначала укажите название услуги',
        partnerTags: 'Особенности', partnerEventTypes: 'Подходит для мероприятий', partnerSubmit: 'ОТПРАВИТЬ',
        partnerSubmitting: 'ОТПРАВКА...', catVenuesShort: 'Зал', catArtistsShort: 'Артист', catMediaShort: 'Фото/Видео', catCarsShort: 'Кортеж',
        catWeddingDressShort: 'Платье', catFlowersShort: 'Цветы', catTourismShort: 'Медовый месяц',
        wedding: 'Свадьба', khyna: 'Хна', birthday: 'День рождения', savedNeedsReview: 'Изменения сохранены и отправлены на повторную проверку.',
    },
    en: {
        login: 'Log In', signup: 'Sign Up', email: 'Email', password: 'Password',
        loginBtn: 'LOG IN', signupBtn: 'SIGN UP', switchToSignup: "Don't have an account? Sign up",
        switchToLogin: 'Already have an account? Log in', logout: 'Log Out', myServices: 'Services',
        myOrders: 'Orders', noOrders: 'No orders yet',
        noOrdersSub: 'Once your service is approved, customer orders will appear here',
        orderNew: 'New', orderSeen: 'Seen', orderContacted: 'Contacted', orderCompleted: 'Completed',
        orderGuests: 'guests', orderMarkContacted: 'Mark as contacted', orderCustomer: 'Customer',
        addNew: '+ Add new service', edit: 'Edit', delete: 'Delete', save: 'SAVE',
        cancel: 'Cancel', deleteConfirmTitle: 'Delete?', deleteConfirmMsg: 'Are you sure you want to delete this service? This cannot be undone.',
        deleteConfirmYes: 'Yes, delete', deleteConfirmNo: 'No', statusPending: 'Pending', statusApproved: 'Approved', statusRejected: 'Rejected',
        noServices: "You don't have any services yet", noServicesSub: 'Add your first service using the button below',
        authError: 'An error occurred. Please try again.', emailInvalid: 'Please enter a valid email',
        passwordShort: 'Password must be at least 6 characters', accountSettings: 'Account Settings',
        forgotPasswordLink: 'Forgot password?', forgotPasswordTitle: 'Reset Password',
        privacyAgreePrefix: 'I agree to the processing of my personal data.', privacyPolicyLink: 'Privacy Policy',
        privacyRequired: 'Please accept the Privacy Policy to continue',
        confirmSignupTitle: 'Confirm Your Email', confirmSignupDesc: 'Enter the 6-digit code sent to your email.',
        confirmBtn: 'CONFIRM',
        forgotPasswordDesc: 'Enter your email, we will send you a verification code.',
        sendResetCode: 'SEND CODE', resetCodeSent: 'A code was sent to your email. Enter it below.',
        otpCode: 'Verification Code', otpRequired: 'Please enter the code', newPassword: 'New Password',
        resetPasswordBtn: 'UPDATE PASSWORD', backToLogin: '‹ Back to login',
        deleteAccount: 'Delete Account', deleteAccountDesc: 'Permanently deletes your account and all your services.',
        deleteAccountConfirmMsg: 'Are you sure you want to delete your account? All your services will be permanently deleted. This cannot be undone.',
        back: '‹ Back', partnerName: 'Service name', partnerNamePh: 'E.g: Elux Event Hall',
        partnerCategory: 'Category', partnerPrice: 'Price (AZN)', partnerPricePh: 'E.g: 150',
        partnerUnit: 'Unit', partnerAddress: 'Address', partnerAddressPh: 'City, street',
        partnerPhone: 'Contact phone', partnerDescription: 'Description', partnerDescriptionPh: 'Brief information about your service',
        partnerCapacity: 'Capacity (optional)', partnerCapacityPh: 'E.g: 200-500', partnerImageUrl: 'Photos',
        partnerImagePick: '📷 Pick a photo', partnerImageNeedTitle: 'Please enter the service name first',
        partnerTags: 'Features', partnerEventTypes: 'Suitable for events', partnerSubmit: 'SUBMIT',
        partnerSubmitting: 'SUBMITTING...', catVenuesShort: 'Venue', catArtistsShort: 'Artist', catMediaShort: 'Photo/Video', catCarsShort: 'Cortege',
        catWeddingDressShort: 'Dress', catFlowersShort: 'Flowers', catTourismShort: 'Honeymoon',
        wedding: 'Wedding', khyna: 'Khyna', birthday: 'Birthday', savedNeedsReview: 'Your changes were saved and sent for re-review.',
    },
};

interface PartnerService {
    id: string;
    title: string;
    category: CategoryFilter;
    price: number;
    unit: string;
    address: string;
    phone: string;
    description: string;
    capacity: string | null;
    img: string | null;
    images: string[];
    tags: string[];
    event_type: EventType[];
    status: 'pending' | 'approved' | 'rejected';
    owner_id: string;
}

interface PartnerOrder {
    id: string;
    created_at: string;
    service_title: string;
    customer_name: string;
    customer_phone: string;
    event_date: string;
    guests_count: number;
    item_price: number;
    status: 'new' | 'seen' | 'contacted' | 'completed';
}

const slugify = (input: string) => {
    return (input.trim() || 'partner')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ə/g, 'e').replace(/ö/g, 'o').replace(/ü/g, 'u')
        .replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ı/g, 'i')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'partner';
};
function NewPasswordScreen({ lang, onDone }: { lang: Language; onDone: () => void }) {
    const t = PORTAL_TEXT[lang];
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleUpdate = async () => {
        setErrorMsg('');
        if (newPassword.length < 6) {
            setErrorMsg(t.passwordShort);
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDone();
        } catch (e: any) {
            setErrorMsg(e?.message || t.authError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
                <Text style={styles.authTitle}>{t.newPassword}</Text>
                <Text style={styles.authSubtext}>{t.forgotPasswordDesc}</Text>
                <TextInput
                    style={styles.partnerInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="••••••••"
                    placeholderTextColor="#A0968E"
                />
                {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}
                <TouchableOpacity style={[styles.checkoutBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleUpdate}>
                    {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.checkoutBtnText}>{t.resetPasswordBtn}</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function AuthScreen({ lang, onAuthed }: { lang: Language; onAuthed: () => void }) {
    const t = PORTAL_TEXT[lang];
    const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset' | 'confirm'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [confirmCode, setConfirmCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [infoMsg, setInfoMsg] = useState('');
    const [privacyAccepted, setPrivacyAccepted] = useState(false);

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    const handleSubmit = async () => {
        setErrorMsg('');
        if (!emailValid) {
            setErrorMsg(t.emailInvalid);
            return;
        }
        if (password.length < 6) {
            setErrorMsg(t.passwordShort);
            return;
        }
        if (mode === 'signup' && !privacyAccepted) {
            setErrorMsg(t.privacyRequired);
            return;
        }
        setLoading(true);
        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({ email: email.trim(), password });
                if (error) throw error;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setMode('confirm');
                setLoading(false);
                return;
                        } else {
                const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;

                // Rol yoxlaması: müştəri hesabı, partnyor portalına girə bilməz
                const { data: userData } = await supabase.auth.getUser();
                const uid = userData?.user?.id;
                if (uid) {
                    const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
                    if (profile?.role === 'customer') {
                        await supabase.auth.signOut();
                        setErrorMsg('Bu hesab, müştəri kimi qeydiyyatdan keçib. Partnyor girişi üçün, ayrı hesab yaradın.');
                        setLoading(false);
                        return;
                    }
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAuthed();
        } catch (e: any) {
            setErrorMsg(e?.message || t.authError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySignup = async () => {
        setErrorMsg('');
        if (!confirmCode.trim()) {
            setErrorMsg(t.otpRequired);
            return;
        }
        setLoading(true);
        try {
                        const { error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: confirmCode.trim(),
                type: 'signup',
            });
            if (error) throw error;

            const { data: userData } = await supabase.auth.getUser();
            const uid = userData?.user?.id;
            if (uid) {
                await supabase.from('profiles').upsert({ id: uid, role: 'partner' });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAuthed();
        } catch (e: any) {
            setErrorMsg(e?.message || t.authError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendResetCode = async () => {
        setErrorMsg('');
        setInfoMsg('');
        if (!emailValid) {
            setErrorMsg(t.emailInvalid);
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
            if (error) throw error;
            setMode('reset');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e: any) {
            setErrorMsg(e?.message || t.authError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndReset = async () => {
        setErrorMsg('');
        if (!otpCode.trim()) {
            setErrorMsg(t.otpRequired);
            return;
        }
        if (newPassword.length < 6) {
            setErrorMsg(t.passwordShort);
            return;
        }
        setLoading(true);
        try {
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: otpCode.trim(),
                type: 'recovery',
            });
            if (verifyError) throw verifyError;

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAuthed();
        } catch (e: any) {
            setErrorMsg(e?.message || t.authError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'confirm') {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
                    <Text style={styles.authTitle}>{t.confirmSignupTitle}</Text>
                    <Text style={styles.authSubtext}>{t.confirmSignupDesc}</Text>
                    <Text style={styles.partnerLabel}>{t.otpCode}</Text>
                    <TextInput
                        style={styles.partnerInput}
                        value={confirmCode}
                        onChangeText={setConfirmCode}
                        keyboardType="number-pad"
                        placeholder="123456"
                        placeholderTextColor="#A0968E"
                    />
                    {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}
                    <TouchableOpacity style={[styles.checkoutBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleVerifySignup}>
                        {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.checkoutBtnText}>{t.confirmBtn}</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    if (mode === 'forgot' || mode === 'reset') {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
                    <Text style={styles.authTitle}>{t.forgotPasswordTitle}</Text>

                    {mode === 'forgot' ? (
                        <>
                            <Text style={styles.authSubtext}>{t.forgotPasswordDesc}</Text>
                            <Text style={styles.partnerLabel}>{t.email}</Text>
                            <TextInput
                                style={styles.partnerInput}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                placeholder="name@example.com"
                                placeholderTextColor="#A0968E"
                            />
                            {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}
                            <TouchableOpacity style={[styles.checkoutBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleSendResetCode}>
                                {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.checkoutBtnText}>{t.sendResetCode}</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.authSubtext}>{t.resetCodeSent}</Text>
                            <Text style={styles.partnerLabel}>{t.otpCode}</Text>
                            <TextInput
                                style={styles.partnerInput}
                                value={otpCode}
                                onChangeText={setOtpCode}
                                keyboardType="number-pad"
                                placeholder="123456"
                                placeholderTextColor="#A0968E"
                            />
                            <Text style={styles.partnerLabel}>{t.newPassword}</Text>
                            <TextInput
                                style={styles.partnerInput}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                placeholder="••••••••"
                                placeholderTextColor="#A0968E"
                            />
                            {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}
                            <TouchableOpacity style={[styles.checkoutBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleVerifyAndReset}>
                                {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.checkoutBtnText}>{t.resetPasswordBtn}</Text>}
                            </TouchableOpacity>
                        </>
                    )}

                    <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => { setMode('login'); setErrorMsg(''); setInfoMsg(''); }}>
                        <Text style={styles.authSwitchText}>{t.backToLogin}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.authModeSwitcher}>
                    <TouchableOpacity
                        style={[styles.authModeTab, mode === 'login' && styles.authModeTabActive]}
                        onPress={() => { setMode('login'); setErrorMsg(''); }}
                    >
                        <Text style={[styles.authModeTabText, mode === 'login' && styles.authModeTabTextActive]}>{t.login}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.authModeTab, mode === 'signup' && styles.authModeTabActive]}
                        onPress={() => { setMode('signup'); setErrorMsg(''); }}
                    >
                        <Text style={[styles.authModeTabText, mode === 'signup' && styles.authModeTabTextActive]}>{t.signup}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.partnerLabel}>{t.email}</Text>
                <TextInput
                    style={styles.partnerInput}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="name@example.com"
                    placeholderTextColor="#A0968E"
                />

                <Text style={styles.partnerLabel}>{t.password}</Text>
                <TextInput
                    style={styles.partnerInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="••••••••"
                    placeholderTextColor="#A0968E"
                />

                {mode === 'login' && (
                    <TouchableOpacity style={{ marginTop: 8, alignItems: 'flex-end' }} onPress={() => { setMode('forgot'); setErrorMsg(''); }}>
                        <Text style={styles.authForgotText}>{t.forgotPasswordLink}</Text>
                    </TouchableOpacity>
                )}

                {mode === 'signup' && (
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}
                        onPress={() => setPrivacyAccepted(!privacyAccepted)}
                        activeOpacity={0.7}
                    >
                        <View style={{
                            width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                            borderColor: privacyAccepted ? '#D4AF37' : '#8A7E75',
                            backgroundColor: privacyAccepted ? '#D4AF37' : 'transparent',
                            justifyContent: 'center', alignItems: 'center', marginRight: 8,
                        }}>
                            {privacyAccepted && <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                        </View>
                        <Text style={{ fontSize: 12, color: '#6A625C', flex: 1 }}>
                            {t.privacyAgreePrefix}{' '}
                            <Text
                                style={{ color: '#D4AF37', textDecorationLine: 'underline' }}
                                onPress={() => Linking.openURL('https://atitor1401-svg.github.io/ToyOlsun/index.html')}
                            >
                                {t.privacyPolicyLink}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                )}

                {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}

                <TouchableOpacity style={[styles.checkoutBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleSubmit}>
                    {loading ? <ActivityIndicator color="#2C2623" /> : (
                        <Text style={styles.checkoutBtnText}>{mode === 'login' ? t.loginBtn : t.signupBtn}</Text>
                    )}
                </TouchableOpacity>

                <AdBanner />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function AdBanner() {
    const [banner, setBanner] = useState<{ id: string; image_url: string; link_url: string | null } | null>(null);

    useEffect(() => {
        let mounted = true;
        supabase
            .from('banners')
            .select('id, image_url, link_url')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .limit(1)
            .then(({ data }) => {
                if (mounted && data && data.length > 0) setBanner(data[0]);
            });
        return () => { mounted = false; };
    }, []);

    if (!banner) return null;

    const content = (
        <Image source={{ uri: banner.image_url }} style={styles.adBannerImage} resizeMode="cover" />
    );

    return (
        <View style={styles.adBannerWrap}>
            {banner.link_url ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(banner.link_url!)}>
                    {content}
                </TouchableOpacity>
            ) : content}
        </View>
    );
}

function ServiceForm({
    lang, initial, onSaved, onCancel,
}: {
    lang: Language;
    initial: Partial<PartnerService> | null;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const t = PORTAL_TEXT[lang];
    const [title, setTitle] = useState(initial?.title || '');
    const [category, setCategory] = useState<CategoryFilter>((initial?.category as CategoryFilter) || 'venues');
    const [price, setPrice] = useState(initial?.price ? String(initial.price) : '');
    const [unit, setUnit] = useState(initial?.unit || 'AZN / nəfər');
    const [address, setAddress] = useState(initial?.address || '');
    const [phone, setPhone] = useState(initial?.phone || '+994 ');
    const [description, setDescription] = useState(initial?.description || '');
    const [capacity, setCapacity] = useState(initial?.capacity || '');
    const [images, setImages] = useState<string[]>(initial?.images || []);
    const legacyTagToId = (tagText: string): string | null => {
        for (const catTags of Object.values(CATEGORY_TAGS)) {
            const match = catTags.find(t => t.az === tagText || t.ru === tagText || t.en === tagText);
            if (match) return match.id;
        }
        return null;
    };

    const normalizeInitialTags = (rawTags: string[] | undefined): string[] => {
        if (!rawTags) return [];
        return rawTags
            .map(t => legacyTagToId(t) || t) // convert legacy text tags to id; keep unknown as-is
            .filter((t, idx, arr) => arr.indexOf(t) === idx); // de-duplicate
    };

    const [tags, setTags] = useState<string[]>(normalizeInitialTags(initial?.tags));
    const [eventTypes, setEventTypes] = useState<EventType[]>(initial?.event_type?.length ? initial.event_type : ['wedding']);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const toggleTag = (tag: string) => setTags(prev => prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]);
    const toggleEvt = (evt: EventType) => setEventTypes(prev => {
        if (prev.includes(evt)) {
            if (prev.length === 1) return prev;
            return prev.filter(e => e !== evt);
        }
        return [...prev, evt];
    });
    const changeCategory = (cat: CategoryFilter) => { setCategory(cat); setTags([]); };

    const pickImages = async () => {
        if (!title.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }
        if (images.length >= 6) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
        const remaining = 6 - images.length;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            aspect: [4, 5],
        });
        if (result.canceled || !result.assets || result.assets.length === 0) return;

        setUploading(true);
        try {
            const folderSlug = slugify(title);
            const uploaded: string[] = [];
            for (const asset of result.assets) {
                const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
                const fileName = `partners/${folderSlug}/${Date.now()}-${Math.floor(Math.random() * 100000)}.${fileExt}`;
                const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
                const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
                const { error } = await supabase.storage.from('images').upload(fileName, decode(base64), { contentType, upsert: false });
                if (error) throw error;
                const { data } = supabase.storage.from('images').getPublicUrl(fileName);
                if (data?.publicUrl) uploaded.push(data.publicUrl);
            }
            setImages(prev => [...prev, ...uploaded].slice(0, 6));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error('Image upload error:', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (url: string) => {
        setImages(prev => prev.filter(u => u !== url));
        // Best-effort: also delete the file from Storage so it doesn't take up space
        try {
            const marker = '/object/public/images/';
            const idx = url.indexOf(marker);
            if (idx !== -1) {
                const path = url.slice(idx + marker.length);
                supabase.storage.from('images').remove([path]).catch(() => {});
            }
        } catch {
            // Non-fatal: image is removed from the form either way
        }
    };

    const handleSave = async () => {
        if (!title.trim() || !price.trim() || !address.trim() || phone.trim() === '+994' || !description.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }
        setSaving(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const ownerId = userData?.user?.id;
            const priceNum = parseFloat(price.replace(/[^0-9.]/g, ''));

            const payload: any = {
                title: title.trim(),
                category,
                price: isNaN(priceNum) ? 0 : priceNum,
                unit,
                address: address.trim(),
                phone: phone.trim(),
                description: description.trim(),
                capacity: capacity.trim() || null,
                img: images.length > 0 ? images[0] : null,
                images,
                tags,
                event_type: eventTypes,
                owner_id: ownerId,
            };
            if (!initial?.id) {
                payload.rating = '0';
                payload.status = 'pending';
            }

            if (initial?.id) {
                const { error } = await supabase.from('service').update(payload).eq('id', initial.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('service').insert(payload);
                if (error) throw error;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSaved();
        } catch (e) {
            console.error('Save service error:', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.partnerLabel}>{t.partnerName}</Text>
            <TextInput style={styles.partnerInput} value={title} onChangeText={setTitle} placeholder={t.partnerNamePh} placeholderTextColor="#A0968E" />

            <Text style={styles.partnerLabel}>{t.partnerCategory}</Text>
            <View style={styles.partnerCatRow}>
                {([
                    { id: 'venues', label: t.catVenuesShort },
                    { id: 'artists', label: t.catArtistsShort },
                    { id: 'media', label: t.catMediaShort },
                    { id: 'cars', label: t.catCarsShort },
                    { id: 'wedding_dress', label: t.catWeddingDressShort },
                    { id: 'flowers', label: t.catFlowersShort },
                    { id: 'tourism', label: t.catTourismShort },
                ] as { id: CategoryFilter; label: string }[]).map(c => (
                    <TouchableOpacity key={c.id} style={[styles.partnerCatChip, category === c.id && styles.partnerCatChipActive]} onPress={() => changeCategory(c.id)}>
                        <Text style={[styles.partnerCatChipText, category === c.id && styles.partnerCatChipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {CATEGORY_TAGS[category] && (
                <>
                    <Text style={styles.partnerLabel}>{t.partnerTags}</Text>
                    <View style={styles.partnerCatRow}>
                        {CATEGORY_TAGS[category].map((tagObj) => {
                            const tagLabel = (tagObj as any)[lang];
                            const selected = tags.includes(tagObj.id);
                            return (
                                <TouchableOpacity key={tagObj.id} style={[styles.partnerTagChip, selected && styles.partnerTagChipActive]} onPress={() => toggleTag(tagObj.id)}>
                                    <Text style={[styles.partnerTagChipText, selected && styles.partnerTagChipTextActive]}>{selected ? '✓ ' : ''}{tagLabel}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </>
            )}

            <Text style={styles.partnerLabel}>{t.partnerEventTypes}</Text>
            <View style={styles.partnerCatRow}>
                {([
                    { id: 'wedding', label: t.wedding },
                    { id: 'khyna', label: t.khyna },
                    { id: 'birthday', label: t.birthday },
                ] as { id: EventType; label: string }[]).map(evt => {
                    const selected = eventTypes.includes(evt.id);
                    return (
                        <TouchableOpacity key={evt.id} style={[styles.partnerTagChip, selected && styles.partnerTagChipActive]} onPress={() => toggleEvt(evt.id)}>
                            <Text style={[styles.partnerTagChipText, selected && styles.partnerTagChipTextActive]}>{selected ? '✓ ' : ''}{evt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.partnerLabel}>{t.partnerPrice}</Text>
                    <TextInput style={styles.partnerInput} value={price} onChangeText={setPrice} placeholder={t.partnerPricePh} keyboardType="numeric" placeholderTextColor="#A0968E" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.partnerLabel}>{t.partnerUnit}</Text>
                    <TextInput style={styles.partnerInput} value={unit} onChangeText={setUnit} placeholderTextColor="#A0968E" />
                </View>
            </View>

            <Text style={styles.partnerLabel}>{t.partnerAddress}</Text>
            <TextInput style={styles.partnerInput} value={address} onChangeText={setAddress} placeholder={t.partnerAddressPh} placeholderTextColor="#A0968E" />

            <Text style={styles.partnerLabel}>{t.partnerPhone}</Text>
            <TextInput style={styles.partnerInput} value={phone} onChangeText={(text) => { if (!text.startsWith('+994 ')) setPhone('+994 '); else setPhone(text); }} keyboardType="phone-pad" placeholderTextColor="#A0968E" />

            <Text style={styles.partnerLabel}>{t.partnerDescription}</Text>
            <TextInput style={[styles.partnerInput, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder={t.partnerDescriptionPh} multiline placeholderTextColor="#A0968E" />

            <Text style={styles.partnerLabel}>{t.partnerCapacity}</Text>
            <TextInput style={styles.partnerInput} value={capacity} onChangeText={setCapacity} placeholder={t.partnerCapacityPh} placeholderTextColor="#A0968E" />

            <Text style={styles.partnerLabel}>{t.partnerImageUrl} ({images.length}/6)</Text>
            {images.length > 0 && (
                <View style={styles.partnerImageGrid}>
                    {images.map((url, idx) => (
                        <View key={idx} style={styles.partnerImageGridItem}>
                            <Image source={{ uri: url }} style={styles.partnerImageGridImg} resizeMode="cover" />
                            <TouchableOpacity style={styles.partnerImageRemoveBtn} onPress={() => removeImage(url)}>
                                <Text style={styles.partnerImageRemoveBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
            {images.length < 6 && (
                <TouchableOpacity style={styles.partnerImagePickBtn} onPress={pickImages} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#D4AF37" /> : <Text style={styles.partnerImagePickBtnText}>{t.partnerImagePick}</Text>}
                </TouchableOpacity>
            )}
            {!title.trim() && <Text style={styles.partnerImageHint}>{t.partnerImageNeedTitle}</Text>}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, alignItems: 'center' }]} onPress={onCancel}>
                    <Text style={styles.secondaryBtnText}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.checkoutBtn, { flex: 1 }, saving && { opacity: 0.6 }]} disabled={saving} onPress={handleSave}>
                    {saving ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.checkoutBtnText}>{t.save}</Text>}
                </TouchableOpacity>
            </View>
            <View style={{ height: 30 }} />
        </ScrollView>
    );
}

function Dashboard({ lang, onLogout, onClose }: { lang: Language; onLogout: () => void; onClose: () => void }) {
    const t = PORTAL_TEXT[lang];
    const [activeTab, setActiveTab] = useState<'services' | 'orders'>('services');
    const [services, setServices] = useState<PartnerService[]>([]);
    const [orders, setOrders] = useState<PartnerOrder[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<PartnerService | null | 'new'>(null);
    const [deleteTarget, setDeleteTarget] = useState<PartnerService | null>(null);
    const [showAccountSettings, setShowAccountSettings] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    const loadServices = useCallback(async () => {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) { setServices([]); setLoading(false); return; }
        const { data, error } = await supabase.from('service').select('*').eq('owner_id', uid).order('created_at', { ascending: false });
        if (!error && data) setServices(data as PartnerService[]);
        setLoading(false);
    }, []);

    const loadOrders = useCallback(async () => {
        setOrdersLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) { setOrders([]); setOrdersLoading(false); return; }
        const { data, error } = await supabase.from('orders').select('*').eq('service_owner_id', uid).order('created_at', { ascending: false });
        if (!error && data) setOrders(data as PartnerOrder[]);
        setOrdersLoading(false);
    }, []);

    useEffect(() => { loadServices(); loadOrders(); }, [loadServices, loadOrders]);

    const markOrderContacted = async (orderId: string) => {
        const { error } = await supabase.from('orders').update({ status: 'contacted' }).eq('id', orderId);
        if (!error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'contacted' } : o));
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const { error } = await supabase.from('service').delete().eq('id', deleteTarget.id);
        if (!error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setServices(prev => prev.filter(s => s.id !== deleteTarget.id));
            // Best-effort: also remove this service's images from Storage
            try {
                const marker = '/object/public/images/';
                const paths = (deleteTarget.images || [])
                    .map(url => {
                        const idx = url.indexOf(marker);
                        return idx !== -1 ? url.slice(idx + marker.length) : null;
                    })
                    .filter((p): p is string => !!p);
                console.log('Deleting storage paths:', JSON.stringify(paths));
                if (paths.length > 0) {
                    const { data: removeData, error: removeError } = await supabase.storage.from('images').remove(paths);
                    console.log('Storage remove result:', JSON.stringify({ removeData, removeError }));
                }
            } catch (storageErr) {
                console.error('Storage cleanup error:', storageErr);
            }
        } else {
            console.error('Delete service error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setDeleteTarget(null);
    };

    const handleDeleteAccount = async () => {
        setDeletingAccount(true);
        try {
            const { data, error } = await supabase.functions.invoke('smooth-responder');
            console.log('Delete account response:', JSON.stringify({ data, error }, null, 2));
            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await supabase.auth.signOut();
            onLogout();
        } catch (e: any) {
            console.error('Delete account error:', e);
            if (e?.context) {
                try {
                    const body = await e.context.json();
                    console.error('Delete account error body:', JSON.stringify(body));
                } catch (parseErr) {
                    console.error('Could not parse error body:', parseErr);
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setDeletingAccount(false);
        }
    };

    if (editing) {
        return (
            <View style={{ flex: 1, padding: 16 }}>
                <TouchableOpacity onPress={() => setEditing(null)} style={{ marginBottom: 10 }}>
                    <Text style={styles.authSwitchText}>{t.back}</Text>
                </TouchableOpacity>
                <ServiceForm
                    lang={lang}
                    initial={editing === 'new' ? null : editing}
                    onCancel={() => setEditing(null)}
                    onSaved={() => { setEditing(null); loadServices(); }}
                />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.dashHeader}>
                <Text style={styles.dashTitle}>{activeTab === 'services' ? t.myServices : t.myOrders}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={styles.dashIconBtn} onPress={() => setShowAccountSettings(true)}>
                        <Text style={styles.dashIconBtnText}>⚙️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dashIconBtn} onPress={async () => { await supabase.auth.signOut(); onLogout(); }}>
                        <Text style={styles.dashIconBtnText}>⎋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dashIconBtn} onPress={onClose}>
                        <Text style={styles.dashIconBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.dashTabRow}>
                <TouchableOpacity style={[styles.dashTab, activeTab === 'services' && styles.dashTabActive]} onPress={() => setActiveTab('services')}>
                    <Text style={[styles.dashTabText, activeTab === 'services' && styles.dashTabTextActive]}>{t.myServices}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dashTab, activeTab === 'orders' && styles.dashTabActive]} onPress={() => setActiveTab('orders')}>
                    <Text style={[styles.dashTabText, activeTab === 'orders' && styles.dashTabTextActive]}>
                        {t.myOrders}{orders.filter(o => o.status === 'new').length > 0 ? ` (${orders.filter(o => o.status === 'new').length})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'services' ? (
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    {loading ? (
                        <ActivityIndicator color="#D4AF37" style={{ marginTop: 30 }} />
                    ) : services.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>{t.noServices}</Text>
                            <Text style={styles.emptySub}>{t.noServicesSub}</Text>
                        </View>
                    ) : (
                        services.map(s => (
                            <View key={s.id} style={styles.dashCard}>
                                {s.img ? <Image source={{ uri: s.img }} style={styles.dashCardImg} resizeMode="cover" /> : <View style={[styles.dashCardImg, { backgroundColor: '#EFECE6' }]} />}
                                <View style={{ flex: 1, padding: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Text style={styles.dashCardTitle}>{s.title}</Text>
                                        <View style={[
                                            styles.statusBadge,
                                            s.status === 'approved' && styles.statusBadgeApproved,
                                            s.status === 'rejected' && styles.statusBadgeRejected,
                                        ]}>
                                            <Text style={styles.statusBadgeText}>
                                                {s.status === 'approved' ? t.statusApproved : s.status === 'rejected' ? t.statusRejected : t.statusPending}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.dashCardPrice}>{s.price} {s.unit}</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                        <TouchableOpacity style={styles.dashEditBtn} onPress={() => setEditing(s)}>
                                            <Text style={styles.dashEditBtnText}>{t.edit}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.dashDeleteBtn} onPress={() => setDeleteTarget(s)}>
                                            <Text style={styles.dashDeleteBtnText}>{t.delete}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    {ordersLoading ? (
                        <ActivityIndicator color="#D4AF37" style={{ marginTop: 30 }} />
                    ) : orders.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyTitle}>{t.noOrders}</Text>
                            <Text style={styles.emptySub}>{t.noOrdersSub}</Text>
                        </View>
                    ) : (
                        orders.map(o => (
                            <View key={o.id} style={styles.orderCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Text style={styles.orderServiceTitle}>{o.service_title}</Text>
                                    <View style={[
                                        styles.statusBadge,
                                        o.status === 'new' && styles.statusBadgeNew,
                                        o.status === 'contacted' && styles.statusBadgeApproved,
                                        o.status === 'completed' && styles.statusBadgeApproved,
                                    ]}>
                                        <Text style={styles.statusBadgeText}>
                                            {o.status === 'new' ? t.orderNew : o.status === 'contacted' ? t.orderContacted : o.status === 'completed' ? t.orderCompleted : t.orderSeen}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.orderCustomerLabel}>{t.orderCustomer}</Text>
                                <Text style={styles.orderCustomerName}>{o.customer_name}</Text>
                                <Text style={styles.orderDetail}>📞 {o.customer_phone}</Text>
                                <Text style={styles.orderDetail}>📅 {o.event_date} · {o.guests_count} {t.orderGuests}</Text>
                                <Text style={styles.orderPrice}>{o.item_price} AZN</Text>
                                {o.status === 'new' && (
                                    <TouchableOpacity style={styles.orderContactBtn} onPress={() => markOrderContacted(o.id)}>
                                        <Text style={styles.orderContactBtnText}>{t.orderMarkContacted}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {activeTab === 'services' && (
                <TouchableOpacity style={styles.fabAddBtn} onPress={() => setEditing('new')}>
                    <Text style={styles.fabAddBtnText}>{t.addNew}</Text>
                </TouchableOpacity>
            )}

            <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.confirmBox}>
                        <Text style={styles.confirmTitle}>{t.deleteConfirmTitle}</Text>
                        <Text style={styles.confirmMsg}>{t.deleteConfirmMsg}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, alignItems: 'center' }]} onPress={() => setDeleteTarget(null)}>
                                <Text style={styles.secondaryBtnText}>{t.deleteConfirmNo}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dangerBtn, { flex: 1, alignItems: 'center' }]} onPress={handleDelete}>
                                <Text style={styles.dangerBtnText}>{t.deleteConfirmYes}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showAccountSettings} transparent animationType="fade" onRequestClose={() => setShowAccountSettings(false)}>
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.confirmBox}>
                        <Text style={styles.confirmTitle}>{t.accountSettings}</Text>
                        <Text style={styles.confirmMsg}>{t.deleteAccountDesc}</Text>
                        <TouchableOpacity
                            style={[styles.dangerBtn, { marginTop: 16, alignItems: 'center' }, deletingAccount && { opacity: 0.6 }]}
                            disabled={deletingAccount}
                            onPress={() => {
                                Alert.alert(t.deleteConfirmTitle, t.deleteAccountConfirmMsg, [
                                    { text: t.deleteConfirmNo, style: 'cancel' },
                                    { text: t.deleteConfirmYes, style: 'destructive', onPress: handleDeleteAccount },
                                ]);
                            }}
                        >
                            {deletingAccount ? <ActivityIndicator color="#FFF" /> : <Text style={styles.dangerBtnText}>{t.deleteAccount}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10, alignItems: 'center' }]} onPress={() => setShowAccountSettings(false)}>
                            <Text style={styles.secondaryBtnText}>{t.cancel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

export default function PartnerPortal({ lang, visible, onClose }: { lang: Language; visible: boolean; onClose: () => void }) {
    const [session, setSession] = useState<any>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setChecking(false);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
        });
        return () => { listener.subscription.unsubscribe(); };
    }, []);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: '#FAF8F5', paddingTop: Platform.OS === 'ios' ? 50 : 20 }}>
                {(!session || checking) && (
                    <TouchableOpacity onPress={onClose} style={styles.rootCloseBtn}>
                        <Text style={styles.rootCloseBtnText}>✕</Text>
                    </TouchableOpacity>
                )}
                {checking ? (
                    <ActivityIndicator color="#D4AF37" style={{ marginTop: 60 }} />
                ) : session ? (
                    <Dashboard lang={lang} onLogout={() => setSession(null)} onClose={onClose} />
                ) : (
                    <AuthScreen lang={lang} onAuthed={() => { /* session listener updates state */ }} />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    authContainer: { padding: 20, paddingTop: 40 },
    authTitle: { fontSize: 22, fontWeight: '700', color: '#2C2623', marginBottom: 24, textAlign: 'center' },
    authError: { color: '#B0392C', fontSize: 12, marginTop: 10 },
    authSwitchText: { fontSize: 13, color: '#8A7E75', fontWeight: '600', textAlign: 'center' },
    authSubtext: { fontSize: 13, color: '#6A625C', marginBottom: 16, lineHeight: 18 },
    authForgotText: { fontSize: 12, color: '#8A7E75', fontWeight: '600' },
    adBannerWrap: { marginTop: 24, borderRadius: 14, overflow: 'hidden', backgroundColor: '#EFECE6' },
    adBannerImage: { width: '100%', aspectRatio: 16 / 9 },
    partnerSuccessCheck: { fontSize: 40, color: '#D4AF37', fontWeight: '700', marginBottom: 10 },
    authModeSwitcher: { flexDirection: 'row', backgroundColor: '#EFECE6', borderRadius: 10, padding: 4, marginBottom: 10 },
    authModeTab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    authModeTabActive: { backgroundColor: '#2C2623' },
    authModeTabText: { fontSize: 13, fontWeight: '700', color: '#8A7E75' },
    authModeTabTextActive: { color: '#D4AF37' },
    partnerLabel: { fontSize: 11, fontWeight: '700', color: '#6A625C', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    partnerInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFECE6', borderRadius: 8, padding: 12, fontSize: 14, color: '#2C2623' },
    partnerCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    partnerCatChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFECE6' },
    partnerCatChipActive: { backgroundColor: '#2C2623', borderColor: '#2C2623' },
    partnerCatChipText: { fontSize: 12, color: '#6A625C', fontWeight: '600' },
    partnerCatChipTextActive: { color: '#D4AF37' },
    partnerTagChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFECE6' },
    partnerTagChipActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
    partnerTagChipText: { fontSize: 11, color: '#6A625C', fontWeight: '600' },
    partnerTagChipTextActive: { color: '#2C2623' },
    partnerImageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    partnerImageGridItem: { width: '31%', aspectRatio: 4 / 5, borderRadius: 10, overflow: 'hidden', position: 'relative', backgroundColor: '#EFECE6' },
    partnerImageGridImg: { width: '100%', height: '100%' },
    partnerImageRemoveBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(44,38,35,0.85)', justifyContent: 'center', alignItems: 'center' },
    partnerImageRemoveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    partnerImageHint: { fontSize: 11, color: '#B0392C', marginTop: 6 },
    partnerImagePickBtn: { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#D4AF37', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
    partnerImagePickBtnText: { fontSize: 13, fontWeight: '700', color: '#2C2623' },
    checkoutBtn: { backgroundColor: '#D4AF37', paddingVertical: 12, width: '100%', borderRadius: 8, alignItems: 'center' },
    checkoutBtnText: { color: '#2C2623', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
    secondaryBtn: { backgroundColor: '#EFECE6', paddingVertical: 12, borderRadius: 8 },
    secondaryBtnText: { color: '#2C2623', fontWeight: '600', fontSize: 13 },
    dangerBtn: { backgroundColor: '#B0392C', paddingVertical: 12, borderRadius: 8 },
    dangerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    dashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EFECE6' },
    dashTitle: { fontSize: 18, fontWeight: '700', color: '#2C2623' },
    dashIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFECE6', justifyContent: 'center', alignItems: 'center' },
    dashIconBtnText: { fontSize: 14, color: '#2C2623' },
    rootCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 24, right: 16, zIndex: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFECE6', justifyContent: 'center', alignItems: 'center' },
    rootCloseBtnText: { fontSize: 16, color: '#8A7E75' },
    dashCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EFECE6', marginBottom: 14, overflow: 'hidden' },
    dashCardImg: { width: 90, height: 110 },
    dashCardTitle: { fontSize: 14, fontWeight: '700', color: '#2C2623', flex: 1, marginRight: 8 },
    dashCardPrice: { fontSize: 12, color: '#8A7E75', marginTop: 4 },
    statusBadge: { backgroundColor: '#F0E4C0', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
    statusBadgeApproved: { backgroundColor: '#DCEEDC' },
    statusBadgeRejected: { backgroundColor: '#F5DCD9' },
    statusBadgeNew: { backgroundColor: '#D4AF37' },
    dashTabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
    dashTab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#EFECE6', alignItems: 'center' },
    dashTabActive: { backgroundColor: '#2C2623' },
    dashTabText: { fontSize: 12, fontWeight: '700', color: '#6A625C' },
    dashTabTextActive: { color: '#D4AF37' },
    orderCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EFECE6', padding: 14, marginBottom: 14 },
    orderServiceTitle: { fontSize: 14, fontWeight: '700', color: '#2C2623', flex: 1, marginRight: 8 },
    orderCustomerLabel: { fontSize: 10, color: '#A0968E', textTransform: 'uppercase', marginTop: 10 },
    orderCustomerName: { fontSize: 14, fontWeight: '700', color: '#2C2623', marginTop: 2 },
    orderDetail: { fontSize: 12, color: '#8A7E75', marginTop: 4 },
    orderPrice: { fontSize: 14, fontWeight: '700', color: '#D4AF37', marginTop: 8 },
    orderContactBtn: { backgroundColor: '#2C2623', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    orderContactBtnText: { color: '#D4AF37', fontSize: 12, fontWeight: '700' },
    statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#6A5A2A' },
    dashEditBtn: { backgroundColor: '#2C2623', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
    dashEditBtnText: { color: '#D4AF37', fontSize: 11, fontWeight: '700' },
    dashDeleteBtn: { backgroundColor: '#F5DCD9', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
    dashDeleteBtnText: { color: '#B0392C', fontSize: 11, fontWeight: '700' },
    emptyBox: { backgroundColor: '#FFF', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EFECE6', marginTop: 20 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 6 },
    emptySub: { fontSize: 12, color: '#8A7E75', textAlign: 'center' },
    fabAddBtn: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#D4AF37', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    fabAddBtnText: { color: '#2C2623', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    confirmBox: { width: '100%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
    confirmTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 8 },
    confirmMsg: { fontSize: 13, color: '#6A625C', lineHeight: 18 },
});
