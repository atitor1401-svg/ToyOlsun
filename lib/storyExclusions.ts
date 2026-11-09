// Services an admin has taken out of the automatic "Yeni"/"Top" stories
// (table public.story_exclusions). They stay in the catalogue.
// If the table can't be read, nothing is hidden and stories work as before.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useStoryExclusions(): Set<string> {
    const [ids, setIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        let alive = true;
        Promise.resolve(supabase.from('story_exclusions').select('service_id'))
            .then(({ data, error }) => {
                if (alive && !error && data) setIds(new Set(data.map(r => String(r.service_id))));
            })
            .catch(() => {});
        return () => { alive = false; };
    }, []);
    return ids;
}
