// Saved ("favourite") services.
// Always kept on the phone (AsyncStorage) so they work without an account.
// When a user is signed in they are also stored in public.favorites, so they
// follow the user to a new phone. On sign-in the phone list and the account
// list are merged (nothing is ever lost), then kept in step.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { logServiceEvent } from './serviceEvents';

const KEY = 'toyolsun.favorites';

async function readLocal(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v.map(String) : [];
    } catch {
        return [];
    }
}

function writeLocal(ids: string[]) {
    AsyncStorage.setItem(KEY, JSON.stringify(ids)).catch(() => {});
}

// Merge phone + account lists and upload whatever the account is missing.
async function syncWithAccount(userId: string, local: string[]): Promise<string[]> {
    const { data, error } = await supabase.from('favorites').select('service_id').eq('user_id', userId);
    if (error) return local;
    const remote = (data || []).map(r => String(r.service_id));
    const missing = local.filter(id => !remote.includes(id));
    if (missing.length) {
        await supabase
            .from('favorites')
            .upsert(missing.map(id => ({ user_id: userId, service_id: Number(id) })), { onConflict: 'user_id,service_id', ignoreDuplicates: true });
    }
    // Keep the phone's order first, then anything only the account had.
    return [...local, ...remote.filter(id => !local.includes(id))];
}

export function useFavorites() {
    const [ids, setIds] = useState<string[]>([]);
    const userIdRef = useRef<string | null>(null);

    useEffect(() => {
        let alive = true;

        const load = async (userId: string | null) => {
            userIdRef.current = userId;
            const local = await readLocal();
            if (alive) setIds(local);
            if (!userId) return;
            const merged = await syncWithAccount(userId, local);
            if (!alive) return;
            setIds(merged);
            writeLocal(merged);
        };

        supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null));
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') load(session?.user?.id ?? null);
            if (event === 'SIGNED_OUT' && userIdRef.current) {
                // The list is safe in the account; clear the phone copy so the
                // next person signing in on this phone doesn't inherit it.
                userIdRef.current = null;
                writeLocal([]);
                if (alive) setIds([]);
            }
        });
        return () => { alive = false; sub.subscription.unsubscribe(); };
    }, []);

    const toggle = useCallback((id: string | number) => {
        const key = String(id);
        setIds(prev => {
            const adding = !prev.includes(key);
            const next = adding ? [key, ...prev] : prev.filter(x => x !== key);
            writeLocal(next);

            const userId = userIdRef.current;
            if (userId) {
                const req = adding
                    ? supabase.from('favorites').upsert({ user_id: userId, service_id: Number(key) }, { onConflict: 'user_id,service_id', ignoreDuplicates: true })
                    : supabase.from('favorites').delete().eq('user_id', userId).eq('service_id', Number(key));
                req.then(() => {}, () => {});
            }
            if (adding) logServiceEvent(key, 'favorite');
            return next;
        });
    }, []);

    const isFavorite = useCallback((id: string | number) => ids.includes(String(id)), [ids]);

    return { ids, toggle, isFavorite };
}
