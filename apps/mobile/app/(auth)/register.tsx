/**
 * Register screen — Email/Password account creation via `@soteria/firebase`
 * `registerWithEmail` (RULE 3), which also sets the display name and sends a
 * verification email. Tenant claims are provisioned server-side
 * (`setTenantClaims`) after sign-up; the AuthProvider refreshes them.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { registerWithEmail } from '@soteria/firebase';
import { Screen } from '../../components/common/Screen';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function RegisterScreen(): JSX.Element {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleRegister = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await registerWithEmail(email.trim(), password, displayName.trim());
      setDone(true);
    } catch {
      setError(SoteriaStrings.errors.validation);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen name="register" scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Text style={styles.title}>Create your account</Text>

        {done ? (
          <View style={styles.form}>
            <Text style={styles.body}>
              Account created. A verification email is on its way — verify, then
              sign in.
            </Text>
            <Button mode="contained" onPress={(): void => router.replace('/(auth)/login')}>
              {SoteriaStrings.auth.signInButton}
            </Button>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              mode="outlined"
              label="Full name"
              value={displayName}
              onChangeText={setDisplayName}
              autoComplete="name"
            />
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
              autoComplete="password-new"
            />
            <HelperText type="info" visible>
              Use at least 8 characters.
            </HelperText>
            <Button
              mode="contained"
              onPress={handleRegister}
              loading={busy}
              disabled={
                busy ||
                displayName.trim() === '' ||
                email.trim() === '' ||
                password.length < 8
              }
            >
              {SoteriaStrings.common.confirm}
            </Button>
            {error !== null ? (
              <HelperText type="error" visible style={styles.errorText}>
                {error}
              </HelperText>
            ) : null}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" style={styles.footerLink}>
            {SoteriaStrings.auth.signInButton}
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingTop: spacing.lg },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[800],
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  form: { gap: spacing.sm },
  body: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.md },
  errorText: { textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText: { color: colors.textSecondary, fontSize: fontSize.md },
  footerLink: { color: colors.primary[500], fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
