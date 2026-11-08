// One-tap customer sign-in with Apple (iOS) and Google (iOS + Android).
// Both give us an ID token that Supabase turns into a normal session, so the
// rest of the app treats these users like e-mail users.
// The native modules are loaded lazily: Expo Go and older store builds don't
// have them, and a top-level import would crash the whole screen there.
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { supabase } from './supabase';
import { metaEvents } from './metaEvents';

// OAuth client IDs from Google Cloud project "toyolsun" (public, not secrets).
// The web ID is what Supabase checks the token against; the iOS ID is the
// native iOS client. Android needs no ID here: Google matches the app by its
// package name + signing fingerprint (Play key and EAS upload key are both registered).
const GOOGLE_WEB_CLIENT_ID = '236877306922-v5fjf07t0v0634i3agohri742036ek72.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '236877306922-88831vlm7gjsemd8fv545pp7d7lv052c.apps.googleusercontent.com';

export type SocialResult =
    | { ok: true }
    | { ok: false; cancelled: true }
    | { ok: false; cancelled?: false; reason: 'wrongRole' | 'error'; message?: string };

function loadApple(): typeof import('expo-apple-authentication') | null {
    if (Platform.OS !== 'ios') return null;
    try { return require('expo-apple-authentication'); } catch { return null; }
}

function loadGoogle(): typeof import('@react-native-google-signin/google-signin') | null {
    if (Platform.OS === 'web' || isRunningInExpoGo()) return null;
    try { return require('@react-native-google-signin/google-signin'); } catch { return null; }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
    const Apple = loadApple();
    if (!Apple) return false;
    try { return await Apple.isAvailableAsync(); } catch { return false; }
}

export function isGoogleSignInAvailable(): boolean {
    return loadGoogle() !== null;
}

let googleConfigured = false;

export type AuthRole = 'customer' | 'partner';

// After a social sign-in: keep customer and partner accounts apart (same rule
// as e-mail login), create the profile with the right role the first time,
// and report the sign-up to Meta.
async function finishSignIn(role: AuthRole, fullName: string, method: 'apple' | 'google'): Promise<SocialResult> {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return { ok: false, reason: 'error' };

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
    if (profile && profile.role !== role) {
        await supabase.auth.signOut();
        return { ok: false, reason: 'wrongRole' };
    }
    if (!profile) {
        const { error } = await supabase.from('profiles').insert({
            id: uid,
            role,
            full_name: fullName || null,
        });
        if (error) return { ok: false, reason: 'error', message: error.message };
        metaEvents.completeRegistration(role, method);
        // The home screen checked the role before this row existed; a token
        // refresh makes it look again and show the right account.
        await supabase.auth.refreshSession();
    }
    return { ok: true };
}

export async function signInWithApple(role: AuthRole): Promise<SocialResult> {
    const Apple = loadApple();
    if (!Apple) return { ok: false, reason: 'error' };
    try {
        const credential = await Apple.signInAsync({
            requestedScopes: [
                Apple.AppleAuthenticationScope.FULL_NAME,
                Apple.AppleAuthenticationScope.EMAIL,
            ],
        });
        if (!credential.identityToken) return { ok: false, reason: 'error' };
        const { error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
        });
        if (error) return { ok: false, reason: 'error', message: error.message };
        // Apple sends the name only on the very first sign-in.
        const name = [credential.fullName?.givenName, credential.fullName?.familyName]
            .filter(Boolean).join(' ');
        return await finishSignIn(role, name, 'apple');
    } catch (e: any) {
        if (e?.code === 'ERR_REQUEST_CANCELED') return { ok: false, cancelled: true };
        return { ok: false, reason: 'error', message: e?.message };
    }
}

export async function signInWithGoogle(role: AuthRole): Promise<SocialResult> {
    const G = loadGoogle();
    if (!G) return { ok: false, reason: 'error' };
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = G;
    try {
        if (!googleConfigured) {
            GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
            googleConfigured = true;
        }
        if (Platform.OS === 'android') await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return { ok: false, cancelled: true };
        const idToken = response.data.idToken;
        if (!idToken) return { ok: false, reason: 'error' };
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
        if (error) return { ok: false, reason: 'error', message: error.message };
        return await finishSignIn(role, response.data.user.name ?? '', 'google');
    } catch (e: any) {
        if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
            return { ok: false, cancelled: true };
        }
        return { ok: false, reason: 'error', message: e?.message };
    }
}

// Account deletion for Apple users: Apple wants the app's access revoked.
// A fresh authorization code is needed for that, so we ask Apple once more.
// Returns: { code } to send to the delete function, { skip } for non-Apple
// users (or when Apple isn't available here), { cancelled } if they backed out.
export async function getAppleCodeForDeletion(): Promise<{ code?: string; skip?: true; cancelled?: true }> {
    const { data } = await supabase.auth.getUser();
    const usesApple = data?.user?.identities?.some((i) => i.provider === 'apple');
    const Apple = loadApple();
    if (!usesApple || !Apple) return { skip: true };
    try {
        const credential = await Apple.signInAsync({ requestedScopes: [] });
        return credential.authorizationCode ? { code: credential.authorizationCode } : { skip: true };
    } catch (e: any) {
        if (e?.code === 'ERR_REQUEST_CANCELED') return { cancelled: true };
        return { skip: true };
    }
}

// Called on log-out so the next Google sign-in lets the user pick an account.
export async function signOutGoogle(): Promise<void> {
    const G = loadGoogle();
    if (!G || !googleConfigured) return;
    try { await G.GoogleSignin.signOut(); } catch { /* not signed in with Google */ }
}
