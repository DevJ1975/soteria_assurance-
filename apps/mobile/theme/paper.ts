/**
 * React Native Paper (MD3) theme derived from the Soteria design tokens.
 *
 * Every color is sourced from {@link SoteriaTokens} (RULE 5). Paper components
 * used across the app (Button, TextInput, Chip, etc.) inherit this theme via
 * the root `PaperProvider`, so they match the brand without per-component hex.
 */
import { MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { colors } from './index';

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary[500],
    onPrimary: colors.surface,
    primaryContainer: colors.primary[50],
    onPrimaryContainer: colors.primary[800],
    secondary: colors.secondary[500],
    onSecondary: colors.surface,
    tertiary: colors.gold[500],
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.primary[50],
    onSurface: colors.textPrimary,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
    error: colors.majorNC,
    onError: colors.surface,
  },
};
