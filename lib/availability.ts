// Partner "busy days" calendar (table public.service_busy_dates).
// Partners mark the days a service is already booked; customers see those
// days as taken and can filter the catalogue by their wedding date.
// Dates are plain 'YYYY-MM-DD' strings (no time zone involved).
import { supabase } from './supabase';

export function toDayString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export async function fetchBusyDates(serviceId: string | number, fromDay: string, toDay: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('service_busy_dates')
        .select('day')
        .eq('service_id', Number(serviceId))
        .gte('day', fromDay)
        .lte('day', toDay);
    if (error) return [];
    return (data || []).map(r => String(r.day));
}

// Only the service owner can do this (enforced by RLS).
export async function setBusyDate(serviceId: string | number, day: string, busy: boolean): Promise<void> {
    const id = Number(serviceId);
    const { error } = busy
        ? await supabase.from('service_busy_dates').upsert({ service_id: id, day }, { onConflict: 'service_id,day', ignoreDuplicates: true })
        : await supabase.from('service_busy_dates').delete().eq('service_id', id).eq('day', day);
    if (error) throw error;
}

// Ids of services that are booked on a given day (for the catalogue filter).
export async function fetchServicesBusyOn(day: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('service_busy_dates').select('service_id').eq('day', day);
    if (error) return new Set();
    return new Set((data || []).map(r => String(r.service_id)));
}
