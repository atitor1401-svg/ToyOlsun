console.log('SUPABASE.JS: Starting to load...');

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

console.log('SUPABASE.JS: Imports loaded successfully');

const SUPABASE_URL = 'https://xokarxcpcjvmassjheka.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AqCQzEaXNamJ_2VH8UdM3Q_cyF5yFmn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

console.log('SUPABASE.JS: Client created successfully');