// Remembers the welcome-card photos on the phone, so the cards keep their
// pictures when the server or the internet is down. The photo files are
// already kept by expo-image's disk cache; this keeps their addresses.
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'toyolsun.welcomeCovers';

type Covers = Record<string, string | undefined>;

export function useRememberedCovers(live: Covers): Covers {
    const [saved, setSaved] = useState<Covers>({});

    useEffect(() => {
        AsyncStorage.getItem(KEY)
            .then(raw => {
                const value = raw ? JSON.parse(raw) : null;
                if (value && typeof value === 'object') setSaved(value);
            })
            .catch(() => {});
    }, []);

    // Save whenever fresh photos arrive; events without a fresh photo keep the old one.
    useEffect(() => {
        const fresh = Object.fromEntries(Object.entries(live).filter(([, url]) => !!url));
        if (Object.keys(fresh).length === 0) return;
        setSaved(prev => {
            const next = { ...prev, ...fresh };
            if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
            AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, [live]);

    return useMemo(() => {
        const out: Covers = { ...saved };
        for (const [event, url] of Object.entries(live)) if (url) out[event] = url;
        return out;
    }, [saved, live]);
}
