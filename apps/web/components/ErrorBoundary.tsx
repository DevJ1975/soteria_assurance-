'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SoteriaStrings } from '@soteria/core';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional override for the fallback heading. */
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  /**
   * `true` when the caught error is a missing-config error (e.g. the public
   * Firebase env vars were not supplied to this build). These are not
   * user-recoverable — a Retry would just throw the same error again — so the
   * fallback drops the Retry action and explains the fix to whoever deployed
   * the app, rather than white-screening with an opaque client exception.
   */
  isConfigError: boolean;
}

/** Name set by `FirebaseConfigError` in `@soteria/firebase`. */
const CONFIG_ERROR_NAME = 'FirebaseConfigError';

/**
 * Class-based error boundary (RULE 8 — every major screen is wrapped so an
 * audit in progress never white-screens). On error it renders a recoverable
 * fallback with a Retry action that resets the boundary.
 *
 * A missing-config error (thrown when the public Firebase env vars are absent
 * from the build) is treated specially: it is not user-recoverable, so the
 * fallback shows a deployment-oriented message and omits Retry.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '', isConfigError: false };
  }

  public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const isConfigError = error instanceof Error && error.name === CONFIG_ERROR_NAME;
    const message = isConfigError
      ? SoteriaStrings.errors.configError
      : error instanceof Error
        ? error.message
        : SoteriaStrings.errors.generic;
    return { hasError: true, message, isConfigError };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced to the browser console only; this is a legitimate debug path for
    // a caught render error (not a stray log). No remote logging on the client.
    // The original error message (e.g. the exact missing env var names) is
    // preserved here so a deployer can diagnose a config error from the console.
    // eslint-disable-next-line no-console
    console.error('[Soteria] Screen error boundary caught:', error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false, message: '', isConfigError: false });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const heading = this.state.isConfigError
        ? SoteriaStrings.errors.configErrorTitle
        : (this.props.title ?? SoteriaStrings.errors.generic);
      return (
        <div
          role="alert"
          className="flex min-h-64 flex-col items-center justify-center gap-md p-xl text-center"
        >
          <h2 className="font-display text-xl font-semibold text-text-primary">{heading}</h2>
          <p className="max-w-md text-sm text-text-secondary">{this.state.message}</p>
          {!this.state.isConfigError && (
            <Button variant="outline" onClick={this.handleRetry}>
              {SoteriaStrings.common.retry}
            </Button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
