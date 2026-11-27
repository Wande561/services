/** Reject insecure or non-origin frontend URLs before a production API starts. */
export function assertSecureFrontendOrigin(frontendUrl = process.env.FRONTEND_URL, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv !== 'production') return;
  let parsed: URL;
  try {
    parsed = new URL(frontendUrl ?? '');
  } catch {
    throw new Error('FRONTEND_URL must be set to an HTTPS origin in production.');
  }
  if (parsed.protocol !== 'https:' || parsed.origin !== frontendUrl || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('FRONTEND_URL must be set to an HTTPS origin in production.');
  }
}
