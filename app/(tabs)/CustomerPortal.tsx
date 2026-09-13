import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    ScrollView, Modal, Platform, ActivityIndicator,
    KeyboardAvoidingView, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import type { Language } from './index';

// ---------- Simple client-side profanity filter ----------
// The list is intentionally kept empty here; the user will supply the actual words.
const BANNED_WORDS: string[] = [
    // TODO: istifadəçi söyüş siyahısını buraya əlavə edəcək
];

const containsBannedWords = (text: string): boolean => {
    if (BANNED_WORDS.length === 0) return false;
    const lowerText = text.toLowerCase();
    return BANNED_WORDS.some(word => lowerText.includes(word.toLowerCase()));
};

const CUSTOMER_TEXT = {
    az: {
        login: 'Daxil ol', signup: 'Qeydiyyatdan keç', email: 'Email', password: 'Şifrə',
        loginBtn: 'DAXİL OL', signupBtn: 'QEYDİYYATDAN KEÇ',
        fullName: 'Ad Soyad', fullNamePh: 'Adınızı və soyadınızı yazın',
        phone: 'Telefon', phonePh: '+994 XX XXX XX XX',
        myOrders: 'Müraciətlərim', logout: 'Çıxış', accountSettings: 'Hesab Ayarları',
        noOrders: 'Hələ heç bir müraciətiniz yoxdur',
        noOrdersSub: 'Kataloqdan bir xidmət seçib sifariş verdikdə, burada görünəcək',
        orderNew: 'Gözləyir', orderContacted: 'Əlaqə saxlanıldı', orderCancelled: 'Ləğv edildi',
        orderGuests: 'qonaq', orderCancel: 'Sifarişi Ləğv Et', orderCancelConfirmTitle: 'Ləğv edilsin?',
        orderCancelConfirmMsg: 'Bu sifarişi ləğv etmək istədiyinizə əminsiniz?',
        orderCancelYes: 'Bəli, ləğv et', orderCancelNo: 'Xeyr',
        emailInvalid: 'Düzgün email daxil edin', passwordShort: 'Şifrə ən azı 6 simvol olmalıdır',
        nameRequired: 'Ad Soyad daxil edin', authError: 'Xəta baş verdi. Yenidən cəhd edin.',
        privacyAgreePrefix: 'Şəxsi məlumatlarımın işlənməsinə razıyam.', privacyPolicyLink: 'Məxfilik Siyasəti',
        privacyRequired: 'Davam etmək üçün Məxfilik Siyasətini qəbul edin',
        confirmSignupTitle: 'Emaili Təsdiqləyin', confirmSignupDesc: 'Email ünvanınıza göndərilən 6 rəqəmli kodu daxil edin.',
        confirmBtn: 'TƏSDİQLƏ', otpCode: 'Təsdiq Kodu', otpRequired: 'Kodu daxil edin',
        forgotPasswordLink: 'Şifrəni unutmusunuz?', forgotPasswordTitle: 'Şifrəni Bərpa Et',
        forgotPasswordDesc: 'Email ünvanınızı daxil edin, sizə təsdiq kodu göndərəcəyik.',
        sendResetCode: 'KOD GÖNDƏR', resetCodeSent: 'Kod email ünvanınıza göndərildi. Aşağıya daxil edin.',
        newPassword: 'Yeni Şifrə', resetPasswordBtn: 'ŞİFRƏNİ YENİLƏ', backToLogin: '‹ Girişə qayıt',
        deleteAccount: 'Hesabı Sil', deleteAccountDesc: 'Hesabınızı, müraciətlərinizi və rəylərinizi həmişəlik silər.',
        deleteAccountConfirmMsg: 'Hesabınızı silmək istədiyinizə əminsiniz? Bu geri qaytarıla bilməz.',
        deleteConfirmYes: 'Bəli, sil', deleteConfirmNo: 'Xeyr', cancel: 'Ləğv et',
        logoutConfirmTitle: 'Çıxış', logoutConfirmMsg: 'Hesabdan çıxmaq istədiyinizə əminsiniz?',
        logoutYes: 'Çıx', logoutNo: 'Ləğv et',
        writeReview: 'Rəy Yaz', reviewPlaceholder: 'Fikrinizi bölüşün...', reviewSubmit: 'GÖNDƏR',
        reviewDelete: 'Sil', reviewDeleteConfirm: 'Bu rəyi silmək istədiyinizə əminsiniz?',
        reviewBanned: 'Rəyinizdə uyğunsuz söz aşkarlandı, zəhmət olmasa düzəldin.',
        noReviews: 'Hələ heç bir rəy yoxdur. İlk rəyi siz yazın!',
        loginRequiredForReview: 'Rəy yazmaq üçün daxil olun',
    },
    ru: {
        login: 'Войти', signup: 'Регистрация', email: 'Email', password: 'Пароль',
        loginBtn: 'ВОЙТИ', signupBtn: 'ЗАРЕГИСТРИРОВАТЬСЯ',
        fullName: 'Имя Фамилия', fullNamePh: 'Введите имя и фамилию',
        phone: 'Телефон', phonePh: '+994 XX XXX XX XX',
        myOrders: 'Мои заявки', logout: 'Выйти', accountSettings: 'Настройки аккаунта',
        noOrders: 'У вас пока нет заявок',
        noOrdersSub: 'Когда вы выберете услугу и оформите заказ, он появится здесь',
        orderNew: 'Ожидает', orderContacted: 'Связались', orderCancelled: 'Отменено',
        orderGuests: 'гостей', orderCancel: 'Отменить заказ', orderCancelConfirmTitle: 'Отменить?',
        orderCancelConfirmMsg: 'Вы уверены, что хотите отменить этот заказ?',
        orderCancelYes: 'Да, отменить', orderCancelNo: 'Нет',
        emailInvalid: 'Введите корректный email', passwordShort: 'Пароль должен быть не менее 6 символов',
        nameRequired: 'Введите имя и фамилию', authError: 'Произошла ошибка. Попробуйте снова.',
        privacyAgreePrefix: 'Я согласен(на) на обработку персональных данных.', privacyPolicyLink: 'Политика конфиденциальности',
        privacyRequired: 'Для продолжения примите Политику конфиденциальности',
        confirmSignupTitle: 'Подтвердите Email', confirmSignupDesc: 'Введите 6-значный код, отправленный на ваш email.',
        confirmBtn: 'ПОДТВЕРДИТЬ', otpCode: 'Код подтверждения', otpRequired: 'Введите код',
        forgotPasswordLink: 'Забыли пароль?', forgotPasswordTitle: 'Восстановление пароля',
        forgotPasswordDesc: 'Введите email, мы отправим вам код подтверждения.',
        sendResetCode: 'ОТПРАВИТЬ КОД', resetCodeSent: 'Код отправлен на ваш email. Введите его ниже.',
        newPassword: 'Новый пароль', resetPasswordBtn: 'ОБНОВИТЬ ПАРОЛЬ', backToLogin: '‹ Назад ко входу',
        deleteAccount: 'Удалить аккаунт', deleteAccountDesc: 'Безвозвратно удалит аккаунт, заказы и отзывы.',
        deleteAccountConfirmMsg: 'Вы уверены, что хотите удалить аккаунт? Это нельзя отменить.',
        deleteConfirmYes: 'Да, удалить', deleteConfirmNo: 'Нет', cancel: 'Отмена',
        logoutConfirmTitle: 'Выход', logoutConfirmMsg: 'Вы уверены, что хотите выйти из аккаунта?',
        logoutYes: 'Выйти', logoutNo: 'Отмена',
        writeReview: 'Написать отзыв', reviewPlaceholder: 'Поделитесь мнением...', reviewSubmit: 'ОТПРАВИТЬ',
        reviewDelete: 'Удалить', reviewDeleteConfirm: 'Вы уверены, что хотите удалить этот отзыв?',
        reviewBanned: 'В вашем отзыве обнаружено недопустимое слово, пожалуйста исправьте.',
        noReviews: 'Пока нет отзывов. Будьте первым!',
        loginRequiredForReview: 'Войдите, чтобы оставить отзыв',
    },
    en: {
        login: 'Log In', signup: 'Sign Up', email: 'Email', password: 'Password',
        loginBtn: 'LOG IN', signupBtn: 'SIGN UP',
        fullName: 'Full Name', fullNamePh: 'Enter your full name',
        phone: 'Phone', phonePh: '+994 XX XXX XX XX',
        myOrders: 'My Orders', logout: 'Log Out', accountSettings: 'Account Settings',
        noOrders: "You don't have any orders yet",
        noOrdersSub: 'Once you choose a service and place an order, it will appear here',
        orderNew: 'Pending', orderContacted: 'Contacted', orderCancelled: 'Cancelled',
        orderGuests: 'guests', orderCancel: 'Cancel Order', orderCancelConfirmTitle: 'Cancel?',
        orderCancelConfirmMsg: 'Are you sure you want to cancel this order?',
        orderCancelYes: 'Yes, cancel', orderCancelNo: 'No',
        emailInvalid: 'Please enter a valid email', passwordShort: 'Password must be at least 6 characters',
        nameRequired: 'Please enter your full name', authError: 'An error occurred. Please try again.',
        privacyAgreePrefix: 'I agree to the processing of my personal data.', privacyPolicyLink: 'Privacy Policy',
        privacyRequired: 'Please accept the Privacy Policy to continue',
        confirmSignupTitle: 'Confirm Your Email', confirmSignupDesc: 'Enter the 6-digit code sent to your email.',
        confirmBtn: 'CONFIRM', otpCode: 'Verification Code', otpRequired: 'Please enter the code',
        forgotPasswordLink: 'Forgot password?', forgotPasswordTitle: 'Reset Password',
        forgotPasswordDesc: 'Enter your email, we will send you a verification code.',
        sendResetCode: 'SEND CODE', resetCodeSent: 'A code was sent to your email. Enter it below.',
        newPassword: 'New Password', resetPasswordBtn: 'UPDATE PASSWORD', backToLogin: '‹ Back to login',
        deleteAccount: 'Delete Account', deleteAccountDesc: 'Permanently deletes your account, orders, and reviews.',
        deleteAccountConfirmMsg: 'Are you sure you want to delete your account? This cannot be undone.',
        deleteConfirmYes: 'Yes, delete', deleteConfirmNo: 'No', cancel: 'Cancel',
        logoutConfirmTitle: 'Log Out', logoutConfirmMsg: 'Are you sure you want to log out?',
        logoutYes: 'Log Out', logoutNo: 'Cancel',
        writeReview: 'Write a Review', reviewPlaceholder: 'Share your thoughts...', reviewSubmit: 'SUBMIT',
        reviewDelete: 'Delete', reviewDeleteConfirm: 'Are you sure you want to delete this review?',
        reviewBanned: 'Your review contains inappropriate language, please revise it.',
        noReviews: 'No reviews yet. Be the first!',
        loginRequiredForReview: 'Log in to write a review',
    },
};

interface CustomerOrder {
    id: string;
    created_at: string;
    service_title: string;
    event_date: string;
    guests_count: number;
    item_price: number;
    status: 'new' | 'contacted' | 'cancelled';
}

// ============================================================
// AUTH SCREEN (signup with OTP, login, forgot password with OTP)
// ============================================================
function CustomerAuthScreen({ lang, onAuthed }: { lang: Language; onAuthed: () => void }) {
    const t = CUSTOMER_TEXT[lang];
    const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset' | 'confirm'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('+994 ');
    const [otpCode, setOtpCode] = useState('');
    const [confirmCode, setConfirmCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [privacyAccepted, setPrivacyAccepted] = useState(false);

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    const handleSubmit = async () => {
        setErrorMsg('');
        if (!emailValid) { setErrorMsg(t.emailInvalid); return; }
        if (password.length < 6) { setErrorMsg(t.passwordShort); return; }
        if (mode === 'signup') {
            if (!fullName.trim()) { setErrorMsg(t.nameRequired); return; }
            if (!privacyAccepted) { setErrorMsg(t.privacyRequired); return; }
        }
        setLoading(true);
        try {
            if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
                if (error) throw error;
                // Save profile info; will be inserted fully once the session exists (after OTP confirm)
                setLoading(false);
                setMode('confirm');
                return;
            } else {
                                const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;

                const { data: userData } = await supabase.auth.getUser();
                const uid = userData?.user?.id;
                if (uid) {
                    const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
                    if (profile?.role === 'partner') {
                        await supabase.auth.signOut();
                        setErrorMsg('Bu hesab, partnyor kimi qeydiyyatdan keçib. Müştəri girişi üçün, ayrı hesab yaradın.');
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
        if (!confirmCode.trim()) { setErrorMsg(t.otpRequired); return; }
        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token: confirmCode.trim(),
                type: 'signup',
            });
            if (error) throw error;

            // Now that we have a session, create the profile row
            const { data: userData } = await supabase.auth.getUser();
            const uid = userData?.user?.id;
            if (uid) {
                await supabase.from('profiles').insert({
                    id: uid,
                    role: 'customer',
                    full_name: fullName.trim(),
                    phone: phone.trim(),
                });
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
        if (!emailValid) { setErrorMsg(t.emailInvalid); return; }
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
        if (!otpCode.trim()) { setErrorMsg(t.otpRequired); return; }
        if (newPassword.length < 6) { setErrorMsg(t.passwordShort); return; }
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
                    <Text style={styles.inputLabel}>{t.otpCode}</Text>
                    <TextInput style={styles.input} value={confirmCode} onChangeText={setConfirmCode} keyboardType="number-pad" placeholder="123456" placeholderTextColor="#A0968E" />
                    {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}
                    <TouchableOpacity style={[styles.primaryBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleVerifySignup}>
                        {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.primaryBtnText}>{t.confirmBtn}</Text>}
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
                            <Text style={styles.inputLabel}>{t.email}</Text>
                            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor="#A0968E" />
                            {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}
                            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleSendResetCode}>
                                {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.primaryBtnText}>{t.sendResetCode}</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.authSubtext}>{t.resetCodeSent}</Text>
                            <Text style={styles.inputLabel}>{t.otpCode}</Text>
                            <TextInput style={styles.input} value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" placeholder="123456" placeholderTextColor="#A0968E" />
                            <Text style={styles.inputLabel}>{t.newPassword}</Text>
                            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor="#A0968E" />
                            {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}
                            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleVerifyAndReset}>
                                {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.primaryBtnText}>{t.resetPasswordBtn}</Text>}
                            </TouchableOpacity>
                        </>
                    )}
                    <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => { setMode('login'); setErrorMsg(''); }}>
                        <Text style={styles.switchText}>{t.backToLogin}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.modeSwitcher}>
                    <TouchableOpacity style={[styles.modeTab, mode === 'login' && styles.modeTabActive]} onPress={() => { setMode('login'); setErrorMsg(''); }}>
                        <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>{t.login}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]} onPress={() => { setMode('signup'); setErrorMsg(''); }}>
                        <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>{t.signup}</Text>
                    </TouchableOpacity>
                </View>

                {mode === 'signup' && (
                    <>
                        <Text style={styles.inputLabel}>{t.fullName}</Text>
                        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder={t.fullNamePh} placeholderTextColor="#A0968E" />
                        <Text style={styles.inputLabel}>{t.phone}</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={(text) => { if (!text.startsWith('+994 ')) setPhone('+994 '); else setPhone(text); }}
                            keyboardType="phone-pad"
                            placeholder={t.phonePh}
                            placeholderTextColor="#A0968E"
                        />
                    </>
                )}

                <Text style={styles.inputLabel}>{t.email}</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor="#A0968E" />

                <Text style={styles.inputLabel}>{t.password}</Text>
                <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="••••••••" placeholderTextColor="#A0968E" />

                {mode === 'login' && (
                    <TouchableOpacity style={{ marginTop: 8, alignItems: 'flex-end' }} onPress={() => { setMode('forgot'); setErrorMsg(''); }}>
                        <Text style={styles.forgotText}>{t.forgotPasswordLink}</Text>
                    </TouchableOpacity>
                )}

                {mode === 'signup' && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }} onPress={() => setPrivacyAccepted(!privacyAccepted)} activeOpacity={0.7}>
                        <View style={{
                            width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                            borderColor: privacyAccepted ? '#D4AF37' : '#8A7E75',
                            backgroundColor: privacyAccepted ? '#D4AF37' : 'transparent',
                            justifyContent: 'center', alignItems: 'center', marginRight: 8,
                        }}>
                            {privacyAccepted && <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                        </View>
                        <Text style={{ fontSize: 12, color: '#6A625C', flex: 1 }}>{t.privacyAgreePrefix}</Text>
                    </TouchableOpacity>
                )}

                {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}

                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 18 }, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleSubmit}>
                    {loading ? <ActivityIndicator color="#2C2623" /> : <Text style={styles.primaryBtnText}>{mode === 'login' ? t.loginBtn : t.signupBtn}</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ============================================================
// CUSTOMER DASHBOARD (My Orders with cancel + Account Settings)
// ============================================================
function CustomerDashboard({ lang, onLogout, onClose }: { lang: Language; onLogout: () => void; onClose: () => void }) {
    const t = CUSTOMER_TEXT[lang];
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<CustomerOrder | null>(null);
    const [deletingAccount, setDeletingAccount] = useState(false);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) { setOrders([]); setLoading(false); return; }
        const { data, error } = await supabase.from('orders').select('*').eq('customer_id', uid).order('created_at', { ascending: false });
        if (!error && data) setOrders(data as CustomerOrder[]);
        setLoading(false);
    }, []);

    useEffect(() => { loadOrders(); }, [loadOrders]);

    const handleCancelOrder = async () => {
        if (!cancelTarget) return;
        const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', cancelTarget.id);
        if (!error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setOrders(prev => prev.map(o => o.id === cancelTarget.id ? { ...o, status: 'cancelled' } : o));
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setCancelTarget(null);
    };

    const handleDeleteAccount = async () => {
        setDeletingAccount(true);
        try {
            const { data, error } = await supabase.functions.invoke('smooth-responder');
            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await supabase.auth.signOut();
            onLogout();
        } catch (e) {
            console.error('Delete account error:', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setDeletingAccount(false);
        }
    };

    const handleLogoutPress = () => {
        Alert.alert(t.logoutConfirmTitle, t.logoutConfirmMsg, [
            { text: t.logoutNo, style: 'cancel' },
            { text: t.logoutYes, style: 'destructive', onPress: async () => { await supabase.auth.signOut(); onLogout(); } },
        ]);
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.dashHeader}>
                <Text style={styles.dashTitle}>{t.myOrders}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}>
                        <Text style={styles.iconBtnText}>⚙️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleLogoutPress}>
                        <Text style={styles.iconBtnText}>⎋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                        <Text style={styles.iconBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {loading ? (
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
                                <Text style={styles.orderTitle}>{o.service_title}</Text>
                                <View style={[
                                    styles.statusBadge,
                                    o.status === 'new' && styles.statusBadgeNew,
                                    o.status === 'contacted' && styles.statusBadgeApproved,
                                    o.status === 'cancelled' && styles.statusBadgeRejected,
                                ]}>
                                    <Text style={styles.statusBadgeText}>
                                        {o.status === 'new' ? t.orderNew : o.status === 'contacted' ? t.orderContacted : t.orderCancelled}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.orderDetail}>📅 {o.event_date} · {o.guests_count} {t.orderGuests}</Text>
                            <Text style={styles.orderPrice}>{o.item_price} AZN</Text>
                            {o.status === 'new' && (
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelTarget(o)}>
                                    <Text style={styles.cancelBtnText}>{t.orderCancel}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            <Modal visible={!!cancelTarget} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmBox}>
                        <Text style={styles.confirmTitle}>{t.orderCancelConfirmTitle}</Text>
                        <Text style={styles.confirmMsg}>{t.orderCancelConfirmMsg}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <TouchableOpacity style={[styles.secondaryBtn, { flex: 1, alignItems: 'center' }]} onPress={() => setCancelTarget(null)}>
                                <Text style={styles.secondaryBtnText}>{t.orderCancelNo}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dangerBtn, { flex: 1, alignItems: 'center' }]} onPress={handleCancelOrder}>
                                <Text style={styles.dangerBtnText}>{t.orderCancelYes}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmBox}>
                        <Text style={styles.confirmTitle}>{t.accountSettings}</Text>
                        <Text style={styles.confirmMsg}>{t.deleteAccountDesc}</Text>
                        <TouchableOpacity
                            style={[styles.dangerBtn, { marginTop: 16, alignItems: 'center' }, deletingAccount && { opacity: 0.6 }]}
                            disabled={deletingAccount}
                            onPress={() => {
                                Alert.alert(t.deleteAccount, t.deleteAccountConfirmMsg, [
                                    { text: t.deleteConfirmNo, style: 'cancel' },
                                    { text: t.deleteConfirmYes, style: 'destructive', onPress: handleDeleteAccount },
                                ]);
                            }}
                        >
                            {deletingAccount ? <ActivityIndicator color="#FFF" /> : <Text style={styles.dangerBtnText}>{t.deleteAccount}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10, alignItems: 'center' }]} onPress={() => setShowSettings(false)}>
                            <Text style={styles.secondaryBtnText}>{t.cancel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ============================================================
// REVIEW SECTION — used inside the service detail modal in index.tsx
// Exported so index.tsx can render it under a service's photos/description.
// ============================================================
interface ReviewItem {
    id: string;
    customer_id: string;
    customer_name: string;
    comment: string;
    created_at: string;
    like_count: number;
    liked_by_me: boolean;
}

export function ServiceReviews({ serviceId, lang }: { serviceId: string | number; lang: Language }) {
    const t = CUSTOMER_TEXT[lang];
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const loadReviews = useCallback(async () => {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id || null;
        setUserId(uid);

        const { data: reviewRows } = await supabase
            .from('customer_reviews')
            .select('id, customer_id, customer_name, comment, created_at')
            .eq('service_id', serviceId)
            .order('created_at', { ascending: false });

        if (!reviewRows) { setReviews([]); setLoading(false); return; }

        const { data: likeRows } = await supabase
            .from('review_likes')
            .select('review_id, customer_id')
            .in('review_id', reviewRows.map(r => r.id));

        const withLikes: ReviewItem[] = reviewRows.map(r => {
            const likesForThis = (likeRows || []).filter(l => l.review_id === r.id);
            return {
                ...r,
                like_count: likesForThis.length,
                liked_by_me: uid ? likesForThis.some(l => l.customer_id === uid) : false,
            };
        });
        setReviews(withLikes);
        setLoading(false);
    }, [serviceId]);

    useEffect(() => { loadReviews(); }, [loadReviews]);

    const handleSubmitReview = async () => {
        setErrorMsg('');
        if (!userId) { setErrorMsg(t.loginRequiredForReview); return; }
        if (!newComment.trim()) return;
        if (containsBannedWords(newComment)) { setErrorMsg(t.reviewBanned); return; }

        setSubmitting(true);
        try {
            const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
            const { error } = await supabase.from('customer_reviews').insert({
                service_id: serviceId,
                customer_id: userId,
                customer_name: profileData?.full_name || 'İstifadəçi',
                comment: newComment.trim(),
            });
            if (error) throw error;
            setNewComment('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadReviews();
        } catch (e) {
            console.error('Review submit error:', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteReview = (reviewId: string) => {
        Alert.alert('', t.reviewDeleteConfirm, [
            { text: t.deleteConfirmNo, style: 'cancel' },
            {
                text: t.deleteConfirmYes, style: 'destructive', onPress: async () => {
                    const { error } = await supabase.from('customer_reviews').delete().eq('id', reviewId);
                    if (!error) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setReviews(prev => prev.filter(r => r.id !== reviewId));
                    }
                },
            },
        ]);
    };

    const handleToggleLike = async (review: ReviewItem) => {
        if (!userId) return;
        if (review.liked_by_me) {
            await supabase.from('review_likes').delete().eq('review_id', review.id).eq('customer_id', userId);
            setReviews(prev => prev.map(r => r.id === review.id ? { ...r, liked_by_me: false, like_count: r.like_count - 1 } : r));
        } else {
            await supabase.from('review_likes').insert({ review_id: review.id, customer_id: userId });
            setReviews(prev => prev.map(r => r.id === review.id ? { ...r, liked_by_me: true, like_count: r.like_count + 1 } : r));
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    return (
        <View style={{ marginTop: 20 }}>
            <Text style={styles.reviewsSectionTitle}>{t.writeReview}</Text>

            <View style={styles.reviewInputRow}>
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newComment}
                    onChangeText={setNewComment}
                    placeholder={t.reviewPlaceholder}
                    placeholderTextColor="#A0968E"
                    multiline
                />
                <TouchableOpacity style={[styles.reviewSubmitBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={handleSubmitReview}>
                    {submitting ? <ActivityIndicator color="#2C2623" size="small" /> : <Text style={styles.reviewSubmitBtnText}>{t.reviewSubmit}</Text>}
                </TouchableOpacity>
            </View>
            {errorMsg ? <Text style={styles.authError}>{errorMsg}</Text> : null}

            {loading ? (
                <ActivityIndicator color="#D4AF37" style={{ marginTop: 16 }} />
            ) : reviews.length === 0 ? (
                <Text style={styles.noReviewsText}>{t.noReviews}</Text>
            ) : (
                reviews.map(r => (
                    <View key={r.id} style={styles.reviewCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.reviewAuthor}>{r.customer_name}</Text>
                            {userId === r.customer_id && (
                                <TouchableOpacity onPress={() => handleDeleteReview(r.id)}>
                                    <Text style={styles.reviewDeleteText}>{t.reviewDelete}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={styles.reviewComment}>{r.comment}</Text>
                        <TouchableOpacity style={styles.likeRow} onPress={() => handleToggleLike(r)} disabled={!userId}>
                            <Text style={[styles.likeIcon, r.liked_by_me && styles.likeIconActive]}>{r.liked_by_me ? '❤️' : '🤍'}</Text>
                            <Text style={styles.likeCount}>{r.like_count}</Text>
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>
    );
}

// ============================================================
// ROOT EXPORT — modal wrapper (mirrors PartnerPortal's pattern)
// ============================================================
export default function CustomerPortal({ lang, visible, onClose }: { lang: Language; visible: boolean; onClose: () => void }) {
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
                    <CustomerDashboard lang={lang} onLogout={() => setSession(null)} onClose={onClose} />
                ) : (
                    <CustomerAuthScreen lang={lang} onAuthed={() => { /* session listener updates state */ }} />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    authContainer: { padding: 20, paddingTop: 40 },
    authTitle: { fontSize: 22, fontWeight: '700', color: '#2C2623', marginBottom: 24, textAlign: 'center' },
    authSubtext: { fontSize: 13, color: '#6A625C', marginBottom: 16, lineHeight: 18 },
    authError: { color: '#B0392C', fontSize: 12, marginTop: 10 },
    switchText: { fontSize: 13, color: '#8A7E75', fontWeight: '600', textAlign: 'center' },
    forgotText: { fontSize: 12, color: '#8A7E75', fontWeight: '600' },
    modeSwitcher: { flexDirection: 'row', backgroundColor: '#EFECE6', borderRadius: 10, padding: 4, marginBottom: 10 },
    modeTab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    modeTabActive: { backgroundColor: '#2C2623' },
    modeTabText: { fontSize: 13, fontWeight: '700', color: '#8A7E75' },
    modeTabTextActive: { color: '#D4AF37' },
    inputLabel: { fontSize: 11, fontWeight: '700', color: '#6A625C', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EFECE6', borderRadius: 8, padding: 12, fontSize: 14, color: '#2C2623' },
    primaryBtn: { backgroundColor: '#D4AF37', paddingVertical: 12, width: '100%', borderRadius: 8, alignItems: 'center' },
    primaryBtnText: { color: '#2C2623', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
    secondaryBtn: { backgroundColor: '#EFECE6', paddingVertical: 12, borderRadius: 8 },
    secondaryBtnText: { color: '#2C2623', fontWeight: '600', fontSize: 13 },
    dangerBtn: { backgroundColor: '#B0392C', paddingVertical: 12, borderRadius: 8 },
    dangerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    dashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EFECE6' },
    dashTitle: { fontSize: 18, fontWeight: '700', color: '#2C2623' },
    iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFECE6', justifyContent: 'center', alignItems: 'center' },
    iconBtnText: { fontSize: 14, color: '#2C2623' },
    rootCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 24, right: 16, zIndex: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFECE6', justifyContent: 'center', alignItems: 'center' },
    rootCloseBtnText: { fontSize: 16, color: '#8A7E75' },
    orderCard: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EFECE6', padding: 14, marginBottom: 14 },
    orderTitle: { fontSize: 14, fontWeight: '700', color: '#2C2623', flex: 1, marginRight: 8 },
    orderDetail: { fontSize: 12, color: '#8A7E75', marginTop: 6 },
    orderPrice: { fontSize: 14, fontWeight: '700', color: '#D4AF37', marginTop: 6 },
    statusBadge: { backgroundColor: '#F0E4C0', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
    statusBadgeApproved: { backgroundColor: '#DCEEDC' },
    statusBadgeRejected: { backgroundColor: '#F5DCD9' },
    statusBadgeNew: { backgroundColor: '#D4AF37' },
    statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#6A5A2A' },
    cancelBtn: { backgroundColor: '#F5DCD9', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    cancelBtnText: { color: '#B0392C', fontSize: 12, fontWeight: '700' },
    emptyBox: { backgroundColor: '#FFF', padding: 30, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EFECE6', marginTop: 20 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 6 },
    emptySub: { fontSize: 12, color: '#8A7E75', textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    confirmBox: { width: '100%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
    confirmTitle: { fontSize: 16, fontWeight: '700', color: '#2C2623', marginBottom: 8 },
    confirmMsg: { fontSize: 13, color: '#6A625C', lineHeight: 18 },
    reviewsSectionTitle: { fontSize: 14, fontWeight: '700', color: '#2C2623', marginBottom: 10 },
    reviewInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
    reviewSubmitBtn: { backgroundColor: '#D4AF37', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
    reviewSubmitBtnText: { color: '#2C2623', fontWeight: '700', fontSize: 12 },
    noReviewsText: { fontSize: 12, color: '#8A7E75', marginTop: 12, textAlign: 'center' },
    reviewCard: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EFECE6', padding: 12, marginTop: 10 },
    reviewAuthor: { fontSize: 13, fontWeight: '700', color: '#2C2623' },
    reviewDeleteText: { fontSize: 11, color: '#B0392C', fontWeight: '600' },
    reviewComment: { fontSize: 13, color: '#6A625C', marginTop: 4, lineHeight: 18 },
    likeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
    likeIcon: { fontSize: 14 },
    likeIconActive: {},
    likeCount: { fontSize: 12, color: '#8A7E75', fontWeight: '600' },
});
