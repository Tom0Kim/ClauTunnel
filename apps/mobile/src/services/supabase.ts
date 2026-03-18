import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// SecureStore adapter for Supabase auth
const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail on web
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail on web
    }
  },
};

// Instrumented storage adapter that logs SecureStore reads/writes for session debugging.
// Remove this wrapper once issue #54 is diagnosed.
const DebugSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const value = await SecureStoreAdapter.getItem(key);
    if (key.includes('auth')) {
      if (value) {
        try {
          const parsed = JSON.parse(value);
          const expiresAt = parsed?.expires_at;
          const refreshSnippet = parsed?.refresh_token?.slice(0, 8);
          const now = Math.floor(Date.now() / 1000);
          console.log(
            `[AuthDebug] SecureStore.get("${key}"): expires_at=${expiresAt} (${expiresAt ? (expiresAt > now ? `valid, ${expiresAt - now}s left` : `EXPIRED ${now - expiresAt}s ago`) : 'N/A'}), refresh=${refreshSnippet}...`
          );
        } catch {
          console.log(`[AuthDebug] SecureStore.get("${key}"): non-JSON value`);
        }
      } else {
        console.log(`[AuthDebug] SecureStore.get("${key}"): null (no session)`);
      }
    }
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (key.includes('auth')) {
      try {
        const parsed = JSON.parse(value);
        const expiresAt = parsed?.expires_at;
        const refreshSnippet = parsed?.refresh_token?.slice(0, 8);
        console.log(
          `[AuthDebug] SecureStore.set("${key}"): expires_at=${expiresAt}, refresh=${refreshSnippet}...`
        );
      } catch {
        console.log(`[AuthDebug] SecureStore.set("${key}"): non-JSON value`);
      }
    }
    return SecureStoreAdapter.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (key.includes('auth')) {
      console.log(`[AuthDebug] SecureStore.remove("${key}")`);
    }
    return SecureStoreAdapter.removeItem(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: DebugSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    debug: (...args: unknown[]) => console.log('[SupabaseAuth]', ...args),
  },
});

// Export for testing
export { SecureStoreAdapter };
