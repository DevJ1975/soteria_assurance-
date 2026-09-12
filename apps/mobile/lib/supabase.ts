/**
 * Supabase client for the field app.
 *
 * Sessions persist in AsyncStorage because an auditor may be offline for a
 * whole site visit and must not be signed out when the app is backgrounded.
 * `detectSessionInUrl` is off: that is a browser concern and there is no URL
 * to read a session from here.
 *
 * `react-native-url-polyfill` is imported for its side effect — the Supabase
 * client builds request URLs with the WHATWG URL API, which React Native's
 * runtime does not fully implement.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.local.',
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
