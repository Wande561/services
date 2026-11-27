import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/apiRequest';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await apiRequest<{ success: boolean; emailConfigured: boolean }>('/auth/password-reset/request', { method: 'POST', data: { email } }); setEmailConfigured(result.emailConfigured); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not request a password reset.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-shell"><Link to="/signin" className="auth-back"><ArrowLeft aria-hidden="true" /> Back to sign in</Link><section className="auth-card mx-auto mt-8 max-w-xl rounded-2xl border border-home-line bg-home-surface"><p className="discovery-kicker">ACCOUNT RECOVERY</p><h2>Reset your password.</h2><p className="auth-card__intro">Enter your account email and we’ll send a secure reset link if a password account exists.</p>{sent ? <p role="status" className="mt-5 text-sm text-emerald-300">{emailConfigured ? 'If an account with that email can reset its password, a link is on the way. Check your inbox.' : 'Password reset email is not enabled on this site yet. Please contact support to regain access.'}</p> : <form onSubmit={submit} className="auth-form"><label>Email address<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>{error && <p role="alert" className="auth-error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight aria-hidden="true" /></button></form>}</section></div></main>;
}
