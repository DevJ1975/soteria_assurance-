/**
 * Auth route-group layout. A plain headerless stack for the login / register
 * screens; the redirect to/from `(app)` is owned by {@link AuthProvider}.
 */
import { Stack } from 'expo-router';

export default function AuthLayout(): JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
