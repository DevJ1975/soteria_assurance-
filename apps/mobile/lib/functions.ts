/**
 * Calls a Supabase Edge Function.
 *
 * Replaces the Firebase `httpsCallable` wrapper. The session token is attached
 * by the Supabase client, and each function re-checks the caller's profile and
 * role server-side — a valid JWT proves who someone is, not what they may do.
 */
import { supabase } from './supabase';

export async function invokeFunction<TResult>(
  name: string,
  body: Record<string, unknown>,
): Promise<TResult> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as TResult;
}
