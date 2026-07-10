/**
 * Cross-platform Firebase deployment constants.
 *
 * Both the Cloud Functions runtime (`setGlobalOptions`) and every client
 * (`getFunctions(app, REGION)`) import this SINGLE region value, so the
 * deployed region and the region clients call can never drift apart. Changing
 * the region is a coordinated act: redeploy functions AND ship new clients.
 */
export const FIREBASE_FUNCTIONS_REGION = 'us-central1';
