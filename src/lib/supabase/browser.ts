import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

type BrowserClient = SupabaseClient<any, 'public', any>;

let cachedClient: BrowserClient | null = null;

export function createSupabaseBrowserClient(): BrowserClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) return null;

  if (!cachedClient) {
    cachedClient = createBrowserClient(url, anonKey);
  }

  return cachedClient;
}
