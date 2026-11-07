// Saved ("favourite") services, kept on the phone only (AsyncStorage).
// No account or database needed, so nothing server-side can break.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'toyolsun.favorites';

export function useFavorites() {
    const [ids, setIds] = useState<string[]>([]);

    useEffect(() => {
        AsyncStorage.getItem(KEY)
            .then(raw => { if (raw) { const v = JSON.parse(raw); if (Array.isArray(v)) setIds(v.map(String)); } })
            .catch(() => {});
    }, []);

    const toggle = useCallback((id: string | number) => {
        const key = String(id);
        setIds(prev => {
            const next = prev.includes(key) ? prev.filter(x => x !== key) : [key, ...prev];
            AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const isFavorite = useCallback((id: string | number) => ids.includes(String(id)), [ids]);

    return { ids, toggle, isFavorite };
}
