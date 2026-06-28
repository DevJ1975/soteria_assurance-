/**
 * Network connectivity state via `@react-native-community/netinfo`.
 *
 * The offline-first sync layer (§11) and the header sync indicator both need to
 * know whether the device currently has a usable internet connection. This
 * module exposes a tiny, typed wrapper plus a subscription helper.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/** Whether the device currently has a usable internet connection. */
export interface ConnectionState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

function toConnectionState(state: NetInfoState): ConnectionState {
  return {
    isConnected: state.isConnected === true,
    // `isInternetReachable` can be null while NetInfo probes; treat as reachable
    // only when explicitly true to avoid pushing into a captive portal.
    isInternetReachable: state.isInternetReachable === true,
  };
}

/** One-shot read of the current connection state. */
export async function getConnectionState(): Promise<ConnectionState> {
  const state = await NetInfo.fetch();
  return toConnectionState(state);
}

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function.
 */
export function subscribeToConnection(
  listener: (state: ConnectionState) => void,
): () => void {
  return NetInfo.addEventListener((state) => listener(toConnectionState(state)));
}

/** True when the device can currently reach the internet. */
export async function isOnline(): Promise<boolean> {
  const state = await getConnectionState();
  return state.isConnected && state.isInternetReachable;
}
