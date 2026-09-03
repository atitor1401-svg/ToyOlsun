import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xokarxcpcjvmassjheka.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AqCQzEaXNamJ_2VH8UdM3Q_cyF5yFmn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);