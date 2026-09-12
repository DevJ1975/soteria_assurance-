/**
 * Phone sign-in flow.
 *
 * Supabase sends the one-time code and verifies it server-side, so unlike the
 * Firebase implementation this needs no reCAPTCHA verifier and no native
 * module. The flow object carries the number between requesting a code and
 * verifying it.
 */
export interface PhoneAuthFlow {
  /** The number the code was sent to, in E.164 form. */
  readonly phone: string;
  /** Requests a one-time code for `phone`. */
  sendCode(phone: string): Promise<void>;
  /** Verifies the code the auditor received. */
  confirm(code: string): Promise<void>;
}
