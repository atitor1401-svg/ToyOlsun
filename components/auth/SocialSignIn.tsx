// "Continue with Apple / Google" buttons shown under the e-mail form on both
// the customer and the partner sign-in screens.
// Custom-drawn (not the native Apple button) so the text follows the app's
// language instead of the phone's, while keeping to the brand rules:
// - Apple (HIG): black button, white Apple logo, "Continue with Apple",
//   same size as the other sign-in buttons and placed first.
// - Google (branding guidelines): white button, #747775 1px border,
//   full-colour "G" logo, #1F1F1F text, "Continue with Google".
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Language } from '@/app/(tabs)/index';
import {
    type AuthRole,
    isAppleSignInAvailable,
    isGoogleSignInAvailable,
    signInWithApple,
    signInWithGoogle,
} from '@/lib/socialAuth';

const PRIVACY_URL = 'https://atitor1401-svg.github.io/ToyOlsun/index.html';

const TEXT = {
    az: {
        or: 'və ya',
        apple: 'Apple ilə davam et',
        google: 'Google ilə davam et',
        consentPrefix: 'Davam etməklə ',
        consentLink: 'Məxfilik Siyasəti',
        consentSuffix: 'ni qəbul edirsiniz.',
        wrongRole: {
            customer: 'Bu hesab partnyor kimi qeydiyyatdan keçib. Müştəri girişi üçün başqa hesab istifadə edin.',
            partner: 'Bu hesab müştəri kimi qeydiyyatdan keçib. Partnyor girişi üçün başqa hesab istifadə edin.',
        },
        error: 'Giriş alınmadı. Yenidən cəhd edin.',
    },
    ru: {
        or: 'или',
        apple: 'Продолжить с Apple',
        google: 'Продолжить с Google',
        consentPrefix: 'Продолжая, вы принимаете ',
        consentLink: 'Политику конфиденциальности',
        consentSuffix: '.',
        wrongRole: {
            customer: 'Этот аккаунт зарегистрирован как партнёр. Для входа клиента используйте другой аккаунт.',
            partner: 'Этот аккаунт зарегистрирован как клиент. Для входа партнёра используйте другой аккаунт.',
        },
        error: 'Не удалось войти. Попробуйте снова.',
    },
    en: {
        or: 'or',
        apple: 'Continue with Apple',
        google: 'Continue with Google',
        consentPrefix: 'By continuing you accept our ',
        consentLink: 'Privacy Policy',
        consentSuffix: '.',
        wrongRole: {
            customer: 'This account is registered as a partner. Please use a different account to sign in as a customer.',
            partner: 'This account is registered as a customer. Please use a different account to sign in as a partner.',
        },
        error: 'Sign-in failed. Please try again.',
    },
};

type Props = {
    lang: Language;
    role: AuthRole;
    disabled?: boolean;
    onAuthed: () => void;
};

export default function SocialSignIn({ lang, role, disabled, onAuthed }: Props) {
    const t = TEXT[lang];
    const [appleAvailable, setAppleAvailable] = useState(false);
    const googleAvailable = isGoogleSignInAvailable();
    const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        isAppleSignInAvailable().then((ok) => { if (alive) setAppleAvailable(ok); });
        return () => { alive = false; };
    }, []);

    if (!appleAvailable && !googleAvailable) return null;

    const run = async (provider: 'apple' | 'google') => {
        if (busy || disabled) return;
        setError('');
        setBusy(provider);
        const result = provider === 'apple' ? await signInWithApple(role) : await signInWithGoogle(role);
        setBusy(null);
        if (result.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAuthed();
        } else if (!result.cancelled) {
            setError(result.reason === 'wrongRole' ? t.wrongRole[role] : t.error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const blocked = !!busy || !!disabled;

    return (
        <View style={styles.wrap}>
            <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.or}>{t.or}</Text>
                <View style={styles.line} />
            </View>

            {appleAvailable && (
                <TouchableOpacity
                    style={[styles.btn, styles.appleBtn, busy === 'google' && styles.dim]}
                    onPress={() => run('apple')}
                    disabled={blocked}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t.apple}
                >
                    {busy === 'apple' ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <>
                            <Image source={require('@/assets/images/auth/apple-logo.png')} style={styles.appleLogo} />
                            <Text style={[styles.label, styles.appleLabel]} numberOfLines={1}>{t.apple}</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}

            {googleAvailable && (
                <TouchableOpacity
                    style={[styles.btn, styles.googleBtn, appleAvailable && styles.gap, busy === 'apple' && styles.dim]}
                    onPress={() => run('google')}
                    disabled={blocked}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t.google}
                >
                    {busy === 'google' ? (
                        <ActivityIndicator color="#1F1F1F" />
                    ) : (
                        <>
                            <Image source={require('@/assets/images/auth/google-g.png')} style={styles.googleLogo} />
                            <Text style={[styles.label, styles.googleLabel]} numberOfLines={1}>{t.google}</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.consent}>
                {t.consentPrefix}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(PRIVACY_URL)}>{t.consentLink}</Text>
                {t.consentSuffix}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginTop: 22 },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#CFC5BB' },
    or: { marginHorizontal: 12, fontSize: 12.5, color: '#8A7E75' },
    btn: {
        width: '100%',
        height: 50,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    gap: { marginTop: 10 },
    dim: { opacity: 0.5 },
    appleBtn: { backgroundColor: '#000000' },
    googleBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#747775' },
    appleLogo: { width: 18, height: 18, marginRight: 10, marginTop: -2, resizeMode: 'contain' },
    googleLogo: { width: 18, height: 18, marginRight: 10, resizeMode: 'contain' },
    label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.1, flexShrink: 1 },
    appleLabel: { color: '#FFFFFF' },
    googleLabel: { color: '#1F1F1F', fontWeight: '500' },
    error: {
        color: '#A6372B', fontSize: 12.5, marginTop: 12, backgroundColor: '#FBEDEA',
        paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden',
    },
    consent: { fontSize: 11, color: '#8A7E75', textAlign: 'center', marginTop: 12, lineHeight: 15 },
    consentLink: { color: '#B8932F', textDecorationLine: 'underline' },
});
