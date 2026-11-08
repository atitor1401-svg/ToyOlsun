// Statistics for the signed-in partner's own services (RPC get_my_service_stats).
import { supabase } from './supabase';

export interface ServiceStats {
    service_id: number;
    title: string;
    views: number;
    calls: number;
    whatsapp: number;
    favorites: number;
    shares: number;
    messages: number;
    orders: number;
}

export type StatsPeriod = 7 | 30 | 90;

export async function getMyServiceStats(days: StatsPeriod): Promise<ServiceStats[]> {
    const { data, error } = await supabase.rpc('get_my_service_stats', { p_days: days });
    if (error) throw error;
    return ((data || []) as any[]).map(r => ({
        service_id: Number(r.service_id),
        title: r.title ?? '',
        views: Number(r.views) || 0,
        calls: Number(r.calls) || 0,
        whatsapp: Number(r.whatsapp) || 0,
        favorites: Number(r.favorites) || 0,
        shares: Number(r.shares) || 0,
        messages: Number(r.messages) || 0,
        orders: Number(r.orders) || 0,
    }));
}

export function totalsOf(rows: ServiceStats[]): Omit<ServiceStats, 'service_id' | 'title'> {
    return rows.reduce(
        (t, r) => ({
            views: t.views + r.views,
            calls: t.calls + r.calls,
            whatsapp: t.whatsapp + r.whatsapp,
            favorites: t.favorites + r.favorites,
            shares: t.shares + r.shares,
            messages: t.messages + r.messages,
            orders: t.orders + r.orders,
        }),
        { views: 0, calls: 0, whatsapp: 0, favorites: 0, shares: 0, messages: 0, orders: 0 },
    );
}
