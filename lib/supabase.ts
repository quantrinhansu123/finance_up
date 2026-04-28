import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseAnonKey, readSupabaseUrl } from './supabase-env';

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (client) return client;
    const url = readSupabaseUrl();
    const key = readSupabaseAnonKey();
    if (!url || !key) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
        );
    }
    client = createClient(url, key);
    return client;
}

/** Lazily creates the client on first use so importing this module never throws when env is unset (e.g. build). */
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        const c = getSupabase();
        const value = Reflect.get(c, prop, c);
        if (typeof value === 'function') {
            return value.bind(c);
        }
        return value;
    },
});
