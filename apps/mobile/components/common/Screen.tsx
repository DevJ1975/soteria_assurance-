/**
 * Screen — the standard screen scaffold every route renders inside.
 *
 * Combines the safe-area inset, the brand background, and (RULE 8) an
 * {@link AuditErrorBoundary} so a render error in any screen degrades to the
 * recovery UI rather than a white screen. Pass `scroll` for scrollable content.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { AuditErrorBoundary } from './AuditErrorBoundary';

interface ScreenProps {
  /** Name used by the error boundary checkpoint + recovery copy. */
  name: string;
  children: ReactNode;
  scroll?: boolean;
  /** Extra padding/style for the content container. */
  contentStyle?: ViewStyle;
}

export function Screen({ name, children, scroll = false, contentStyle }: ScreenProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const padded: ViewStyle = {
    paddingBottom: insets.bottom + spacing.md,
    ...contentStyle,
  };

  return (
    <AuditErrorBoundary screenName={name}>
      <View style={styles.root}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, padded]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex, padded]}>{children}</View>
        )}
      </View>
    </AuditErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
});
