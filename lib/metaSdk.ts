import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { AppState, NativeModules, Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

// Meta (Facebook) SDK reports installs and app opens so Meta Ads (Instagram
// app-install campaigns) can measure and optimise.
//
// The SDK now starts natively when the app launches (isAutoInitEnabled in
// app.json), so installs are counted even if this JS code never runs. This
// file only handles the iOS tracking prompt and reports problems to Sentry,
// because a broken Meta SDK fails silently: in 1.1.7 nothing reached Meta for
// days and the only symptom was "0 installs" in Ads Manager.
//
// Nothing here may ever break the app: the native module doesn't exist in
// Expo Go or on web, so it is only required in real builds, and every call is
// guarded.
const isExpoGo = isRunningInExpoGo() || Constants.appOwnership === 'expo';
const skipMeta = isExpoGo || Platform.OS === 'web';

let started = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function report(problem: string, error?: unknown) {
    console.warn(`Meta SDK: ${problem}`, error);
    try {
        Sentry.captureMessage(`Meta SDK: ${problem}`, {
            level: 'warning',
            tags: { area: 'meta-sdk' },
            extra: { error: error ? String(error) : undefined, platform: Platform.OS },
        });
    } catch {
        // reporting must never break the app either
    }
}

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
        report('tracking permission check failed', e);
        return false;
    }
}

export async function initMetaSdk() {
    if (skipMeta || started) return;
    started = true;

    // Without the native module no event can ever reach Meta.
    if (!NativeModules.FBSettings || !NativeModules.FBAppEventsLogger) {
        report('native module missing');
        return;
    }

    let fb: any;
    try {
        fb = require('react-native-fbsdk-next');
        // Safe to call again after the native auto-init; makes sure the SDK
        // is running before any event below is logged.
        fb.Settings.initializeSDK();
    } catch (e) {
        report('initialize failed', e);
        return;
    }

    if (Platform.OS === 'ios') {
        // The answer only changes how Meta may use events; installs and opens
        // are sent either way (Apple's SKAdNetwork / Meta AEM when declined).
        const allowed = await requestIosTracking();
        try {
            await fb.Settings.setAdvertiserTrackingEnabled(allowed);
        } catch (e) {
            report('setting tracking status failed', e);
        }
    }

    try {
        fb.AppEventsLogger.flush();
    } catch (e) {
        report('flush failed', e);
    }
}
