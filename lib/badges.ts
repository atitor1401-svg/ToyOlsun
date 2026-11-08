// "Verified" badges (table public.service_badges, written only by admins).
// Loaded once per app start; small table.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

let cache: Set<string> | null = null;
let inflight: Promise<Set<string>> | null = null;

function load(): Promise<Set<string>> {
    if (cache) return Promise.resolve(cache);
    if (!inflight) {
        inflight = Promise.resolve(
            supabase.from('service_badges').select('service_id').eq('verified', true),
        ).then(({ data, error }) => {
            cache = error ? new Set<string>() : new Set((data || []).map(r => String(r.service_id)));
            return cache;
        }).catch(() => new Set<string>()).finally(() => { inflight = null; });
    }
    return inflight;
}

export function useVerifiedServices(): Set<string> {
    const [ids, setIds] = useState<Set<string>>(cache ?? new Set());
    useEffect(() => {
        let alive = true;
        load().then(s => { if (alive) setIds(s); });
        return () => { alive = false; };
    }, []);
    return ids;
}
