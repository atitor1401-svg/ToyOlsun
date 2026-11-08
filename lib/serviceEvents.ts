// Anonymous activity counters for partner statistics (views, calls, ...).
// Fire-and-forget: never throws, never blocks the UI. Only the service id and
// the kind of action are stored — no user id, no personal data.
import { supabase } from './supabase';

export type ServiceEventKind = 'view' | 'call' | 'whatsapp' | 'favorite' | 'share' | 'message' | 'order';

// A service opened several times in one app session counts as one view.
const viewedThisSession = new Set<string>();

export function logServiceEvent(serviceId: string | number, kind: ServiceEventKind): void {
    const id = Number(serviceId);
    if (!Number.isFinite(id)) return;
    if (kind === 'view') {
        const key = String(id);
        if (viewedThisSession.has(key)) return;
        viewedThisSession.add(key);
    }
    supabase
        .rpc('log_service_event', { p_service_id: id, p_kind: kind })
        .then(() => {}, () => {});
}
