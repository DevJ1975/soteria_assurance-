/**
 * AuditErrorBoundary (RULE 8 / DESIGN_DOC §12).
 *
 * An audit in progress must NEVER white-screen. This class boundary catches a
 * render error from any wrapped screen, checkpoints diagnostic context to
 * AsyncStorage (so support / the next launch can recover), and renders a
 * branded recovery screen with a "Try again" action instead of a blank view.
 *
 * The underlying field data is safe regardless: it lives in WatermelonDB, not
 * in React state, so a recovered screen re-reads the same offline records.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

const CHECKPOINT_KEY = 'soteria-error-checkpoint';

interface Props {
  /** Label of the screen being guarded (for the checkpoint + recovery copy). */
  screenName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/** Serialisable checkpoint persisted on crash for post-mortem recovery. */
export interface ErrorCheckpoint {
  screenName: string;
  message: string;
  stack: string | null;
  at: number;
}

export class AuditErrorBoundary extends Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    const checkpoint: ErrorCheckpoint = {
      screenName: this.props.screenName,
      message: error.message,
      stack: info.componentStack ?? null,
      at: Date.now(),
    };
    // Best-effort persist; never throw out of the boundary itself.
    void AsyncStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint)).catch(() => {
      /* swallow — recovery UI is already shown */
    });
    // eslint-disable-next-line no-console -- intentional crash-path diagnostic
    console.error(`[AuditErrorBoundary:${this.props.screenName}]`, error);
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false, message: null });
  };

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{SoteriaStrings.errors.generic}</Text>
        <Text style={styles.body}>{SoteriaStrings.errors.network}</Text>
        {this.state.message !== null ? (
          <Text style={styles.detail}>{this.state.message}</Text>
        ) : null}
        <Button mode="contained" onPress={this.handleRetry} style={styles.button}>
          {SoteriaStrings.common.retry}
        </Button>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  detail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    marginTop: spacing.md,
  },
});
