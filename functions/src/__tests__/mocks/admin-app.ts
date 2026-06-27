/** Test double for `firebase-admin/app`. */

export interface App {
  name: string;
}

const apps: App[] = [];

export function getApps(): App[] {
  return apps;
}

export function initializeApp(): App {
  const app: App = { name: '[DEFAULT]' };
  apps.push(app);
  return app;
}

/** Test helper: reset the in-memory app registry. */
export function __resetApps(): void {
  apps.length = 0;
}
