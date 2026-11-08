// Wedding countdown + preparation checklist.
// Works for everyone: guests keep the date and ticks on the phone; signed-in
// customers also get them saved to the account (profiles.wedding_date and
// public.checklist_items), merged on sign-in so nothing is lost.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { CategoryFilter, Language } from '@/app/(tabs)/index';

const DATE_KEY = 'toyolsun.weddingDate';
const DONE_KEY = 'toyolsun.checklistDone';

export interface ChecklistItem {
    key: string;
    monthsBefore: number;            // when it should be done, counted back from the wedding (0.5 = two weeks, 0 = final week)
    category?: CategoryFilter;       // opens this catalogue section when tapped
    title: Record<Language, string>;
}

// Ordered by when to do it. Keys are stored in the database — never rename them.
export const CHECKLIST: ChecklistItem[] = [
    { key: 'budget',    monthsBefore: 6,  title: { az: 'Büdcəni müəyyən edin', ru: 'Определите бюджет', en: 'Set your budget' } },
    { key: 'guests',    monthsBefore: 5,  title: { az: 'Qonaq siyahısını hazırlayın', ru: 'Составьте список гостей', en: 'Draft the guest list' } },
    { key: 'venue',     monthsBefore: 5,  category: 'venues', title: { az: 'Şadlıq sarayını seçin', ru: 'Выберите зал', en: 'Book the venue' } },
    { key: 'artists',   monthsBefore: 4,  category: 'artists', title: { az: 'Müğənni və musiqiçiləri seçin', ru: 'Выберите артистов', en: 'Book singers and musicians' } },
    { key: 'media',     monthsBefore: 4,  category: 'media', title: { az: 'Foto və video çəkilişi', ru: 'Фото и видеосъёмка', en: 'Book photo and video' } },
    { key: 'dress',     monthsBefore: 3,  category: 'wedding_dress', title: { az: 'Gəlinlik seçin', ru: 'Выберите платье', en: 'Choose the dress' } },
    { key: 'dj',        monthsBefore: 3,  category: 'dj', title: { az: 'DJ seçin', ru: 'Выберите DJ', en: 'Book a DJ' } },
    { key: 'decor',     monthsBefore: 2,  category: 'decor', title: { az: 'Dekor və tərtibat', ru: 'Декор и оформление', en: 'Plan the decor' } },
    { key: 'tourism',   monthsBefore: 2,  category: 'tourism', title: { az: 'Bal ayı səfərini planlayın', ru: 'Спланируйте медовый месяц', en: 'Plan the honeymoon' } },
    { key: 'invites',   monthsBefore: 1,  title: { az: 'Dəvətnamələri göndərin', ru: 'Разошлите приглашения', en: 'Send the invitations' } },
    { key: 'cars',      monthsBefore: 1,  category: 'cars', title: { az: 'Toy maşınını sifariş edin', ru: 'Закажите свадебный кортеж', en: 'Book the wedding car' } },
    { key: 'flowers',   monthsBefore: 0.5, category: 'flowers', title: { az: 'Gəlin buketi və güllər', ru: 'Букет и цветы', en: 'Order bouquet and flowers' } },
    { key: 'final',     monthsBefore: 0,  title: { az: 'Son yoxlama: hamı ilə təsdiqləyin', ru: 'Финальная проверка со всеми', en: 'Final check-in with everyone' } },
];

export function daysUntil(day: string | null): number | null {
    if (!day) return null;
    const [y, m, d] = day.split('-').map(Number);
    if (!y || !m || !d) return null;
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Items whose time has come but are not done yet — shown first.
export function isDue(item: ChecklistItem, daysLeft: number | null): boolean {
    if (daysLeft == null) return false;
    return daysLeft <= item.monthsBefore * 30.4;
}

async function readLocal(): Promise<{ date: string | null; done: string[] }> {
    try {
        const [date, raw] = await Promise.all([AsyncStorage.getItem(DATE_KEY), AsyncStorage.getItem(DONE_KEY)]);
        const done = raw ? JSON.parse(raw) : [];
        return { date: date || null, done: Array.isArray(done) ? done.map(String) : [] };
    } catch {
        return { date: null, done: [] };
    }
}

export function useWeddingPlan() {
    const [weddingDate, setWeddingDateState] = useState<string | null>(null);
    const [done, setDone] = useState<string[]>([]);
    const [ready, setReady] = useState(false);
    const userIdRef = useRef<string | null>(null);

    useEffect(() => {
        let alive = true;
        const load = async (userId: string | null) => {
            userIdRef.current = userId;
            const local = await readLocal();
            let date = local.date;
            let doneKeys = local.done;

            if (userId) {
                const [{ data: profile }, { data: rows }] = await Promise.all([
                    supabase.from('profiles').select('wedding_date').eq('id', userId).maybeSingle(),
                    supabase.from('checklist_items').select('item_key').eq('user_id', userId),
                ]);
                const remoteDone = (rows || []).map(r => String(r.item_key));
                // Account date wins; if the account has none yet, keep the phone's and upload it.
                if (profile?.wedding_date) date = String(profile.wedding_date);
                else if (date) supabase.from('profiles').update({ wedding_date: date }).eq('id', userId).then(() => {}, () => {});
                const missing = doneKeys.filter(k => !remoteDone.includes(k));
                if (missing.length) {
                    supabase.from('checklist_items')
                        .upsert(missing.map(k => ({ user_id: userId, item_key: k })), { onConflict: 'user_id,item_key', ignoreDuplicates: true })
                        .then(() => {}, () => {});
                }
                doneKeys = Array.from(new Set([...doneKeys, ...remoteDone]));
            }
            if (!alive) return;
            setWeddingDateState(date);
            setDone(doneKeys);
            setReady(true);
            AsyncStorage.multiSet([[DATE_KEY, date ?? ''], [DONE_KEY, JSON.stringify(doneKeys)]]).catch(() => {});
        };

        supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null));
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') load(session?.user?.id ?? null);
            if (event === 'SIGNED_OUT' && userIdRef.current) {
                userIdRef.current = null;
                AsyncStorage.multiRemove([DATE_KEY, DONE_KEY]).catch(() => {});
                if (alive) { setWeddingDateState(null); setDone([]); }
            }
        });
        return () => { alive = false; sub.subscription.unsubscribe(); };
    }, []);

    const setWeddingDate = useCallback((day: string | null) => {
        setWeddingDateState(day);
        AsyncStorage.setItem(DATE_KEY, day ?? '').catch(() => {});
        const userId = userIdRef.current;
        if (userId) supabase.from('profiles').update({ wedding_date: day }).eq('id', userId).then(() => {}, () => {});
    }, []);

    const toggleItem = useCallback((key: string) => {
        setDone(prev => {
            const marking = !prev.includes(key);
            const next = marking ? [...prev, key] : prev.filter(k => k !== key);
            AsyncStorage.setItem(DONE_KEY, JSON.stringify(next)).catch(() => {});
            const userId = userIdRef.current;
            if (userId) {
                const req = marking
                    ? supabase.from('checklist_items').upsert({ user_id: userId, item_key: key }, { onConflict: 'user_id,item_key', ignoreDuplicates: true })
                    : supabase.from('checklist_items').delete().eq('user_id', userId).eq('item_key', key);
                req.then(() => {}, () => {});
            }
            return next;
        });
    }, []);

    return { ready, weddingDate, setWeddingDate, done, toggleItem, daysLeft: daysUntil(weddingDate) };
}
