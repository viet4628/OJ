import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Thiếu cấu hình Supabase. Copy apps/web/.env.example thành .env.local và điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
