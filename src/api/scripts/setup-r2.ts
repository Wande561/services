import 'dotenv/config';

/**
 * Creates (or verifies) the private R2 bucket used by the API.
 * Requires a Cloudflare API token with R2 admin permission for the account.
 * Runtime uploads use the S3-compatible credentials (R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY), which are created separately in the dashboard.
 */
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const bucket = process.env.R2_BUCKET_NAME?.trim();

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!token || !accountId || !bucket) {
  fail('Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and R2_BUCKET_NAME before running storage:setup.');
}
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
  fail('R2_BUCKET_NAME must be 3–63 characters of lowercase letters, numbers and hyphens.');
}

async function main() {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId!)}/r2/buckets/${encodeURIComponent(bucket!)}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await response.json().catch(() => ({})) as {
    success?: boolean;
    errors?: Array<{ code?: number; message?: string }>;
  };
  const alreadyExists = body.errors?.some(error => error.code === 10004 || /already exists/i.test(error.message ?? ''));
  if (!response.ok && !alreadyExists) {
    const detail = body.errors?.map(error => error.message).filter(Boolean).join('; ');
    fail(`Cloudflare returned ${response.status}${detail ? `: ${detail}` : '.'}`);
  }
  console.log(`R2 bucket "${bucket}" is ready.`);
  console.log('Create an R2 API token with Object Read & Write for this bucket, then set:');
  console.log('  R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
}

main().catch(error => fail(error instanceof Error ? error.message : 'Could not create the R2 bucket.'));
