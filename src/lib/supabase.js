import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasPlaceholder = (value) => /tu-id|tu_clave|your-project|your-supabase|placeholder/i.test(value ?? '');
const isValidSupabaseUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl
  && supabaseKey
  && !hasPlaceholder(supabaseUrl)
  && !hasPlaceholder(supabaseKey)
  && isValidSupabaseUrl(supabaseUrl)
);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;
