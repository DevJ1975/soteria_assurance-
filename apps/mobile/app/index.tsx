/**
 * Root index — bounces into the app group. The {@link AuthProvider} then
 * redirects to `(auth)/login` or `(app)/dashboard` based on session state, so
 * this is just the initial entry target Expo Router needs.
 */
import type React from 'react';
import { Redirect } from 'expo-router';

export default function Index(): React.JSX.Element {
  return <Redirect href="/(app)/dashboard" />;
}
