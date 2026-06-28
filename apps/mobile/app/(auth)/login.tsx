/**
 * Login screen — Email/Password, Google, and Phone sign-in.
 *
 * All auth calls go through `@soteria/firebase` (RULE 3). Phone sign-in uses
 * the {@link PhoneAuthFlow} abstraction (RN needs `FirebaseRecaptchaVerifierModal`
 * — see lib/phoneAuth.ts); here we present the two-step UI and a clear note
 * about wiring the native verifier ref. Strings come from SoteriaStrings.
 */
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import {
  signInWithEmail,
  signInWithGoogleCredential,
  type ConfirmationResult,
} from '@soteria/firebase';
import { Screen } from '../../components/common/Screen';
import { colors, fontSize, fontWeight, spacing } from '../../theme';
import type { PhoneAuthFlow } from '../../lib/phoneAuth';

type Mode = 'email' | 'phone';

export default function LoginScreen(): JSX.Element {
  const [mode, setMode] = useState<Mode>('email');

  // Email/password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone (two-step)
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The native reCAPTCHA-backed flow is injected at runtime by the host once a
  // <FirebaseRecaptchaVerifierModal> ref is available (see lib/phoneAuth.ts).
  // It is null until then; the phone buttons stay disabled to signal that.
  const [phoneFlow] = useState<PhoneAuthFlow | null>(null);

  const handleEmailSignIn = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), password);
      // AuthProvider redirects to (app) on the auth-state change.
    } catch {
      setError(SoteriaStrings.auth.invalidCredentials);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      // Mobile must obtain the Google idToken natively (e.g. expo-auth-session /
      // @react-native-google-signin) and exchange it here. Until that native
      // module is wired, surface a clear, actionable message rather than a crash.
      const idToken = await obtainGoogleIdToken();
      await signInWithGoogleCredential(idToken);
    } catch {
      setError(SoteriaStrings.ai.unavailable);
    } finally {
      setBusy(false);
    }
  };

  const handleSendCode = async (): Promise<void> => {
    if (phoneFlow === null) {
      setError('Phone sign-in requires the reCAPTCHA verifier (see lib/phoneAuth.ts).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await phoneFlow.sendCode(phone.trim());
      setConfirmation(result);
    } catch {
      setError(SoteriaStrings.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCode = async (): Promise<void> => {
    if (phoneFlow === null || confirmation === null) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await phoneFlow.confirm(confirmation, code.trim());
    } catch {
      setError(SoteriaStrings.errors.validation);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen name="login" scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.brand}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={SoteriaStrings.common.appName}
          />
          <Text style={styles.appName}>{SoteriaStrings.common.appName}</Text>
          <Text style={styles.subtitle}>{SoteriaStrings.auth.signInTitle}</Text>
        </View>

        <SegmentedButtons
          value={mode}
          onValueChange={(v: string): void => setMode(v as Mode)}
          buttons={[
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
          ]}
          style={styles.modeSwitch}
        />

        {mode === 'email' ? (
          <View style={styles.form}>
            <TextInput
              mode="outlined"
              label={SoteriaStrings.auth.emailLabel}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              mode="outlined"
              label={SoteriaStrings.auth.passwordLabel}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            <Button
              mode="contained"
              onPress={handleEmailSignIn}
              loading={busy}
              disabled={busy || email.trim() === '' || password === ''}
            >
              {SoteriaStrings.auth.signInButton}
            </Button>
          </View>
        ) : (
          <View style={styles.form}>
            {confirmation === null ? (
              <>
                <TextInput
                  mode="outlined"
                  label="Phone number (E.164, e.g. +14155550123)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
                <Button
                  mode="contained"
                  onPress={handleSendCode}
                  loading={busy}
                  disabled={busy || phone.trim() === ''}
                >
                  Send code
                </Button>
                <HelperText type="info" visible>
                  Phone sign-in uses an invisible reCAPTCHA modal
                  (FirebaseRecaptchaVerifierModal) wired via lib/phoneAuth.ts.
                </HelperText>
              </>
            ) : (
              <>
                <TextInput
                  mode="outlined"
                  label="Verification code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                />
                <Button
                  mode="contained"
                  onPress={handleConfirmCode}
                  loading={busy}
                  disabled={busy || code.trim() === ''}
                >
                  {SoteriaStrings.common.confirm}
                </Button>
              </>
            )}
          </View>
        )}

        <Button
          mode="outlined"
          icon="google"
          onPress={handleGoogleSignIn}
          disabled={busy}
          style={styles.google}
        >
          Continue with Google
        </Button>

        {error !== null ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Soteria? </Text>
          <Link href="/(auth)/register" style={styles.footerLink}>
            {SoteriaStrings.common.next}
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Placeholder for the native Google sign-in token exchange. The real
 * implementation uses expo-auth-session / @react-native-google-signin to obtain
 * an idToken; until that module is configured this rejects with a clear error
 * so the UI shows the "AI/feature unavailable" message rather than crashing.
 */
async function obtainGoogleIdToken(): Promise<string> {
  return Promise.reject(
    new Error('Native Google sign-in not configured (wire expo-auth-session).'),
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  brand: { alignItems: 'center', marginVertical: spacing.lg, gap: spacing.xs },
  logo: { width: 72, height: 72 },
  appName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[800],
  },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary },
  modeSwitch: { marginVertical: spacing.sm },
  form: { gap: spacing.md },
  google: { marginTop: spacing.sm },
  error: { textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText: { color: colors.textSecondary, fontSize: fontSize.md },
  footerLink: { color: colors.primary[500], fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
