// Customer actions reported to Meta, so ad campaigns can optimise for people
// who actually send orders (not just installs) and for retargeting.
// Never throws and never blocks the UI; does nothing in Expo Go / on web,
// where the native SDK is missing. Only uses non-personal data (ids,
// categories, amounts), never names or phone numbers.
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

const enabled = !isRunningInExpoGo() && Platform.OS !== 'web';

type Params = Record<string, string | number>;

function log(eventKey: string, valueToSum?: number, params?: Params) {
    if (!enabled) return;
    try {
        const { AppEventsLogger } = require('react-native-fbsdk-next');
        const name = AppEventsLogger.AppEvents?.[eventKey] ?? eventKey;
        if (typeof valueToSum === 'number' && params) AppEventsLogger.logEvent(name, valueToSum, params);
        else if (params) AppEventsLogger.logEvent(name, params);
        else AppEventsLogger.logEvent(name);
    } catch {
        // analytics must never break the app
    }
}

interface ServiceLike { id: string | number; category?: string; price?: number }

const contentParams = (s: ServiceLike): Params => ({
    fb_content_id: String(s.id),
    fb_content_type: s.category || 'service',
    fb_currency: 'AZN',
});

export const metaEvents = {
    viewService: (s: ServiceLike) => log('ViewedContent', s.price, contentParams(s)),
    addToEstimate: (s: ServiceLike) => log('AddedToCart', s.price, contentParams(s)),
    search: (term: string) => log('Searched', undefined, { fb_search_string: term.slice(0, 100) }),
    contact: (s: ServiceLike, channel: 'call' | 'whatsapp') =>
        log('Contact', undefined, { ...contentParams(s), channel }),
    // Sent once, when the e-mail code is confirmed and the account really exists.
    completeRegistration: (role: 'customer' | 'partner') =>
        log('CompletedRegistration', undefined, { fb_registration_method: 'email', role }),
    submitOrder: (total: number, itemCount: number) =>
        log('SubmitApplication', total, { fb_currency: 'AZN', fb_num_items: itemCount }),
};
