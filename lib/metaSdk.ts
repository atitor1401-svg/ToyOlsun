import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { AppState, Platform } from 'react-native';

// Meta (Facebook) SDK is only used to report installs/app opens so Meta Ads
// (Instagram app-install campaigns) can measure and optimise. Nothing here
// may ever break the app: the native module doesn't exist in Expo Go or on
// web, so it is only required in real builds, and every call is guarded.
// Constants.appOwnership is deprecated and no longer reliable on SDK 58.
const isExpoGo = isRunningInExpoGo() || Constants.appOwnership === 'expo';
const skipMeta = isExpoGo || Platform.OS === 'web';

let started = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// iOS silently drops the tracking prompt if another system dialog (e.g. the
// notification permission asked on app open) is showing at the same time,
// so wait until the app is back in the foreground before asking.
async function waitUntilActive(timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (AppState.currentState !== 'active' && Date.now() < deadline) {
        await sleep(500);
    }
    return AppState.currentState === 'active';
}

async function requestIosTracking(): Promise<boolean> {
    try {
        const Tracking = require('expo-tracking-transparency');
        const current = await Tracking.getTrackingPermissionsAsync();
        if (current.granted) return true;
        if (!current.canAskAgain) return false;
        await sleep(1500);
        if (!(await waitUntilActive(60000))) return false;
        const result = await Tracking.requestTrackingPermissionsAsync();
        return !!result.granted;
    } catch (e) {
        console.warn('Meta: tracking permission check failed', e);
        return false;
    }
}

export async function initMetaSdk() {
    if (skipMeta || started) return;
    started = true;
    try {
        const { Settings } = require('react-native-fbsdk-next');
        if (Platform.OS === 'ios') {
            const allowed = await requestIosTracking();
            await Settings.setAdvertiserTrackingEnabled(allowed);
        }
        // Auto-init is off in app.json so this only happens after the iOS
        // tracking answer is known; auto app events (install / app open)
        // are logged by the SDK from here on.
        Settings.initializeSDK();
    } catch (e) {
        console.warn('Meta SDK init failed', e);
    }
}
