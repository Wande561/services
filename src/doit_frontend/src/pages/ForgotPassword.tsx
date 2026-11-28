import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/apiRequest';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const recovery = useQuery({ queryKey: ['password-reset-config'], queryFn: ({ signal }) => apiRequest<{ configured: boolean }>('/auth/password-reset/config', { signal }), retry: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await apiRequest<{ success: boolean; emailConfigured: boolean }>('/auth/password-reset/request', { method: 'POST', data: { email } });
      if (!result.emailConfigured) { await recovery.refetch(); setError('Password reset email is currently unavailable.'); }
      else setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not request a password reset.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-shell"><Link to="/signin" className="auth-back"><ArrowLeft aria-hidden="true" /> Back to sign in</Link><section className="auth-card mx-auto mt-8 max-w-xl rounded-2xl border border-home-line bg-home-surface"><p className="discovery-kicker">ACCOUNT RECOVERY</p><h2>Reset your password.</h2>
    {recovery.isPending && <p role="status" className="auth-card__intro">Checking recovery options…</p>}
    {recovery.isError && <div role="alert" className="recovery-notice"><p>We couldn’t check recovery options right now.</p><button type="button" onClick={() => void recovery.refetch()}>Try again</button></div>}
    {recovery.data?.configured && <>{sent ? <p role="status" className="recovery-notice">If an eligible account exists, a reset email will be sent. Please check your inbox and spam folder.</p> : <><p className="auth-card__intro">Enter your account email to request a secure reset link.</p><form onSubmit={submit} className="auth-form"><label>Email address<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>{error && <p role="alert" className="auth-error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight aria-hidden="true" /></button></form></>}</>}
    {recovery.data && !recovery.data.configured && <div className="recovery-notice" role="status"><LockKeyhole aria-hidden="true" /><div><strong>Email password recovery is not available yet.</strong><p>If you previously signed in with Google, use the same Google account to sign in. If you’re still signed in on another device and know your current password, you can change it in Settings.</p><p>Need help? Email <a href="mailto:sbusisiwemawande@gmail.com">sbusisiwemawande@gmail.com</a>. Please don’t send your password or one-time codes. Support will discuss available identity checks with you.</p><Link to="/signin">Return to sign in <ArrowRight aria-hidden="true" /></Link></div></div>}
  </section></div></main>;
}
