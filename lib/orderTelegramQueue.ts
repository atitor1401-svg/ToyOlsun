export interface OrderTelegramPayload {
    fullName: string;
    phone: string;
    eventDate: string;
    guests: number;
    cart: { id?: string | number; title: string; category: string; price: number; telegram_chat_id?: string }[];
    totalEstimate: number;
    lang: string;
    promoCode?: string;
}

interface QueueItem {
    ref: string;
    payload: OrderTelegramPayload;
    createdAt: number;
}

export interface QueueDeps {
    storage: {
        getItem: (key: string) => Promise<string | null>;
        setItem: (key: string, value: string) => Promise<void>;
    };
    // Must throw when delivery failed.
    invoke: (body: OrderTelegramPayload & { orderRef: string }) => Promise<void>;
    sleep: (ms: number) => Promise<void>;
    now: () => number;
}

const QUEUE_KEY = 'pending_order_telegram_v1';
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 12000;
const MAX_QUEUE = 20;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Every order is written to local storage BEFORE it is sent and only removed
// after the server confirms delivery, so a failed/killed request is retried
// on the next app open instead of being lost silently.
export function createOrderTelegramQueue(deps: QueueDeps) {
    const { storage, invoke, sleep, now } = deps;
    const inFlight = new Set<string>();
    let chain: Promise<unknown> = Promise.resolve();
    let flushing = false;

    const readQueue = async (): Promise<QueueItem[]> => {
        try {
            const raw = await storage.getItem(QUEUE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    // Serialised read-modify-write so concurrent send/flush can't clobber each other.
    const mutate = (fn: (q: QueueItem[]) => QueueItem[]) => {
        chain = chain
            .then(async () => {
                const next = fn(await readQueue());
                await storage.setItem(QUEUE_KEY, JSON.stringify(next));
            })
            .catch(() => {});
        return chain;
    };

    const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), ATTEMPT_TIMEOUT_MS);
            p.then(
                (v) => { clearTimeout(timer); resolve(v); },
                (e) => { clearTimeout(timer); reject(e); },
            );
        });

    const removeFromQueue = (ref: string) => mutate((q) => q.filter((x) => x.ref !== ref));

    async function sendOrderToTelegram(payload: OrderTelegramPayload): Promise<boolean> {
        const ref = `${now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        await mutate((q) => [...q, { ref, payload, createdAt: now() }].slice(-MAX_QUEUE));
        inFlight.add(ref);
        try {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    await withTimeout(invoke({ ...payload, orderRef: ref }));
                    await removeFromQueue(ref);
                    return true;
                } catch {
                    if (attempt < MAX_ATTEMPTS) await sleep(800 * attempt);
                }
            }
            return false; // stays queued; flushPending() retries it later
        } finally {
            inFlight.delete(ref);
        }
    }

    async function flushPending(): Promise<void> {
        if (flushing) return;
        flushing = true;
        try {
            const all = await readQueue();
            const fresh = all.filter((x) => now() - x.createdAt <= MAX_AGE_MS);
            if (fresh.length !== all.length) {
                const keep = new Set(fresh.map((x) => x.ref));
                await mutate((q) => q.filter((x) => keep.has(x.ref)));
            }
            for (const item of fresh) {
                if (inFlight.has(item.ref)) continue;
                inFlight.add(item.ref);
                try {
                    await withTimeout(invoke({ ...item.payload, orderRef: item.ref }));
                    await removeFromQueue(item.ref);
                } catch {
                    // keep it queued for the next flush
                } finally {
                    inFlight.delete(item.ref);
                }
            }
        } finally {
            flushing = false;
        }
    }

    return { sendOrderToTelegram, flushPending };
}
