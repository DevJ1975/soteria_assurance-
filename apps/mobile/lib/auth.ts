/**
 * Email and phone sign-in.
 *
 * Replaces the `@soteria/firebase` auth helpers. Registration deliberately
 * does NOT create a profile: `handle_invited_user` writes one on the server
 * when the address matches a pending invitation, so an uninvited sign-up
 * lands with no tenant and the app shows the organization-pending state
 * rather than inventing a tenant for them.
 */
import { supabase } from './supabase';
import type { PhoneAuthFlow } from './phoneAuth';

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
}

/**
 * Starts a phone sign-in.
 *
 * Supabase sends and verifies the code server-side, so unlike the Firebase
 * flow there is no reCAPTCHA verifier and no native module — the returned
 * object just carries the number between the two steps.
 */
export function createPhoneAuthFlow(): PhoneAuthFlow {
  let requested = '';
  return {
    get phone() {
      return requested;
    },
    async sendCode(phone: string): Promise<void> {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      requested = phone;
    },
    async confirm(code: string): Promise<void> {
      const { error } = await supabase.auth.verifyOtp({
        phone: requested,
        token: code,
        type: 'sms',
      });
      if (error) throw error;
    },
  };
}

/** Matches the Firebase-era name the login screen imports. */
export type ConfirmationResult = PhoneAuthFlow;
