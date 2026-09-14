import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const isExpoGo = Constants.appOwnership === 'expo';

// On Android, merely IMPORTING expo-notifications throws inside Expo Go
// (remote push was removed there in SDK 53) — this previously crashed the
// entire app on load, since this module sits at the top of the import
// chain for both portals. So the native module is only ever required
// outside that specific combination; everywhere else it behaves as before.
const skipNativeModule = isExpoGo && Platform.OS === 'android';

let Notifications = null;
if (!skipNativeModule) {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve('__timeout__'), ms)),
]);

// Asks for permission and returns an Expo push token that can be sent to
// Expo's push API from a server. On Android in Expo Go this always
// returns a denied/no-token result (see skipNativeModule above — Expo
// removed remote push from Expo Go on Android in SDK 53). On iOS Expo Go
// and on any real dev/production build, a real token is fetched.
// Every native call is time-boxed: some Android/Expo Go combinations have
// been seen to never resolve the permission prompt, which previously froze
// the calling screen indefinitely.
export async function registerForPushNotificationsAsync() {
    if (!Notifications) {
        return { granted: false, token: null };
    }

    if (Platform.OS === 'android') {
        await withTimeout(
            Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.DEFAULT,
            }),
            5000
        );
    }

    const existing = await withTimeout(Notifications.getPermissionsAsync(), 5000);
    if (existing === '__timeout__') return { granted: false, token: null, timedOut: true };
    let finalStatus = existing.status;

    if (finalStatus !== 'granted') {
        const requested = await withTimeout(Notifications.requestPermissionsAsync(), 15000);
        if (requested === '__timeout__') return { granted: false, token: null, timedOut: true };
        finalStatus = requested.status;
    }
    if (finalStatus !== 'granted') {
        return { granted: false, token: null };
    }

    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const result = await withTimeout(Notifications.getExpoPushTokenAsync({ projectId }), 8000);
        if (result === '__timeout__') return { granted: true, token: null, timedOut: true };
        return { granted: true, token: result.data };
    } catch (e) {
        console.error('Push token registration error:', e);
        return { granted: true, token: null };
    }
}

// Silently asks for permission and saves the push token, linked to userId
// when known. Called both on app load (userId may be null — no one is
// logged in yet, e.g. someone just browsing the catalog) and right after
// login (userId set). Re-registering the same device token later with a
// real userId re-links that same row (token has a unique constraint), it
// doesn't create a duplicate. Never throws — a denied prompt or an Expo Go
// limitation just means no token gets saved.
export async function registerPushTokenForUser(userId = null) {
    try {
        const { granted, token } = await registerForPushNotificationsAsync();
        if (granted && token) {
            await supabase.from('push_tokens').upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'token' });
        }
    } catch (e) {
        console.error('registerPushTokenForUser error:', e);
    }
}

// Reads the CURRENT OS-level permission without prompting. Screens use this
// on mount to show the real state instead of always starting from "not
// enabled" — local UI state (e.g. after a screen remounts on navigation)
// otherwise drifts out of sync with the actual, already-granted permission.
export async function getNotificationPermissionStatus() {
    if (!Notifications) return 'undetermined';
    try {
        const result = await withTimeout(Notifications.getPermissionsAsync(), 5000);
        if (result === '__timeout__') return 'undetermined';
        return result.status;
    } catch (e) {
        console.error('getNotificationPermissionStatus error:', e);
        return 'undetermined';
    }
}

export async function sendLocalTestNotification() {
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'ToyOlsun',
            body: 'Bildirişlər aktivdir ✅',
        },
        trigger: null,
    });
}
