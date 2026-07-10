#!/usr/bin/env node
/**
 * =============================================================================
 * Soteria Assurance — first-admin claims bootstrap
 * =============================================================================
 * Mints the initial tenant custom claims for a user, breaking the
 * chicken-and-egg gate in the `setTenantClaims` callable (which requires the
 * CALLER to already hold tenant_admin/super_admin claims — impossible for the
 * very first account).
 *
 * Runs with Firebase Admin credentials, NOT user auth:
 *   1. Create a service-account key (Firebase console → Project settings →
 *      Service accounts → Generate new private key), or use `gcloud auth
 *      application-default login`.
 *   2. export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   3. pnpm install   (once — the script reuses the functions workspace deps)
 *   4. node scripts/bootstrap-admin.mjs \
 *        --email jamil@trainovations.com \
 *        --tenant-id trainovate --tenant-type consultancy [--role super_admin]
 *
 * The target signs out/in (or force-refreshes their ID token) afterwards to
 * pick up the new claims. Subsequent users are provisioned in-app via the
 * `setTenantClaims` callable by this bootstrapped admin.
 * =============================================================================
 */
import { createRequire } from 'node:module';
import process from 'node:process';

// Resolve firebase-admin from the functions workspace and the RBAC matrix from
// @soteria/core's built output, so this script needs no dependencies of its own.
const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const requireFromRoot = createRequire(new URL('../package.json', import.meta.url));

function loadCoreRolePermissions() {
  try {
    const core = requireFromRoot('./packages/core/dist/index.js');
    return core.ROLE_PERMISSIONS;
  } catch {
    console.error(
      'Could not load packages/core/dist — run `pnpm --filter @soteria/core build` first.',
    );
    process.exit(1);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith('--')) continue;
    const key = flag.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

const VALID_TENANT_TYPES = ['cb', 'consultancy', 'enterprise'];
const VALID_ROLES = ['super_admin', 'tenant_admin', 'lead_auditor', 'auditor', 'auditee', 'viewer'];

const args = parseArgs(process.argv.slice(2));
const email = typeof args.email === 'string' ? args.email : undefined;
const uid = typeof args.uid === 'string' ? args.uid : undefined;
const tenantId = typeof args['tenant-id'] === 'string' ? args['tenant-id'] : undefined;
const tenantType = typeof args['tenant-type'] === 'string' ? args['tenant-type'] : 'enterprise';
const role = typeof args.role === 'string' ? args.role : 'super_admin';

if ((email === undefined && uid === undefined) || tenantId === undefined) {
  console.error(
    'Usage: node scripts/bootstrap-admin.mjs (--email <email> | --uid <uid>) ' +
      '--tenant-id <id> [--tenant-type cb|consultancy|enterprise] [--role <role>]',
  );
  process.exit(1);
}
if (!VALID_TENANT_TYPES.includes(tenantType)) {
  console.error(`Invalid --tenant-type "${tenantType}" (expected ${VALID_TENANT_TYPES.join('|')}).`);
  process.exit(1);
}
if (!VALID_ROLES.includes(role)) {
  console.error(`Invalid --role "${role}" (expected ${VALID_ROLES.join('|')}).`);
  process.exit(1);
}

const ROLE_PERMISSIONS = loadCoreRolePermissions();
const { initializeApp, applicationDefault } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');

initializeApp({ credential: applicationDefault() });
const auth = getAuth();

const user = uid !== undefined ? await auth.getUser(uid) : await auth.getUserByEmail(email);

const claims = {
  tenantId,
  tenantType,
  role,
  permissions: [...ROLE_PERMISSIONS[role]],
};

await auth.setCustomUserClaims(user.uid, claims);

console.log(`Claims set for ${user.email ?? user.uid} (uid ${user.uid}):`);
console.log(JSON.stringify(claims, null, 2));
console.log(
  '\nThe user must sign out and back in (or force-refresh their ID token) for the claims to apply.',
);
