// Invoked by Cloudflare's cron trigger. The token stays in Worker secrets.
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
};

async function run(env) {
  if (!env.REMINDER_API_URL || !env.CRON_SECRET) throw new Error('Reminder scheduler is not configured');
  const url = new URL(env.REMINDER_API_URL);
  if (url.protocol !== 'https:' || url.hostname !== 'serviceconnect-api.vercel.app' || url.pathname !== '/notifications/reminders/run' || url.search || url.hash) throw new Error('Invalid reminder API URL');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` }, redirect: 'error' });
  if (!response.ok) throw new Error(`Reminder endpoint returned HTTP ${response.status}`);
}
