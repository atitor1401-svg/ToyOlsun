import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { createOrderTelegramQueue } from './orderTelegramQueue';

const queue = createOrderTelegramQueue({
    storage: AsyncStorage,
    invoke: async (body) => {
        const { error } = await supabase.functions.invoke('submit-order', { body });
        if (error) throw error;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
});

export const sendOrderToTelegram = queue.sendOrderToTelegram;
export const flushPendingOrderTelegrams = queue.flushPending;
