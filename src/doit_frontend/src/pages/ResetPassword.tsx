import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../utils/apiRequest';

export default function ResetPassword() {
  const [params, setParams] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { await apiRequest('/auth/password-reset/complete', { method: 'POST', data: { token, newPassword: password } }); setDone(true); setParams({}, { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : 'This reset link is invalid or has expired.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-shell"><Link to="/signin" className="auth-back"><ArrowLeft aria-hidden="true" /> Back to sign in</Link><section className="auth-card mx-auto mt-8 max-w-xl rounded-2xl border border-home-line bg-home-surface"><p className="discovery-kicker">ACCOUNT RECOVERY</p><h2>Choose a new password.</h2>{done ? <p role="status" className="mt-5 text-sm text-emerald-300">Your password has been updated. Please sign in again.</p> : !token ? <p role="alert" className="mt-5 text-sm text-red-300">This reset link is missing or invalid. Request a new one.</p> : <form onSubmit={submit} className="auth-form"><label>New password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><label>Confirm new password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>{error && <p role="alert" className="auth-error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight aria-hidden="true" /></button></form>}{(done || !token) && <Link to={done ? '/signin' : '/forgot-password'} className="mt-5 inline-block text-sm text-emerald-300 underline">{done ? 'Go to sign in' : 'Request a new reset link'}</Link>}</section></div></main>;
}
