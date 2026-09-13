console.log('SUPABASE.JS: Starting to load...');

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

console.log('SUPABASE.JS: Imports loaded successfully');

const SUPABASE_URL = 'https://xokarxcpcjvmassjheka.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AqCQzEaXNamJ_2VH8UdM3Q_cyF5yFmn';

// On the web platform, expo-router also renders this module during
// server-side rendering (Node), where `window` doesn't exist yet.
// AsyncStorage's web implementation assumes a browser and crashes the
// whole dev/prod server in that case, so fall back to a no-op storage
// there — sessions don't need to persist across a stateless SSR pass.
const noopStorage = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
};
const authStorage = (Platform.OS === 'web' && typeof window === 'undefined') ? noopStorage : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

console.log('SUPABASE.JS: Client created successfully');