import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill it in, then restart the dev server.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // localStorage is the default in a browser, and it is what survives the
    // app being launched from the iOS home screen as a standalone PWA.
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
