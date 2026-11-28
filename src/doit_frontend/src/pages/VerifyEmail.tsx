import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../utils/apiRequest';

export default function VerifyEmail() {
  const [params, setParams] = useSearchParams();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError(''); setBusy(true);
    try {
      await apiRequest('/auth/register/complete', { method: 'POST', data: { token, password } });
      setDone(true); setParams({}, { replace: true }); setPassword(''); setConfirm('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not confirm your email.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-shell"><Link to="/signin" className="auth-back"><ArrowLeft aria-hidden="true" /> Back to sign in</Link><section className="auth-card mx-auto mt-8 max-w-xl rounded-2xl border border-home-line bg-home-surface"><p className="discovery-kicker">ONE LAST STEP</p><h2>Welcome to ServiceConnect.</h2>{done ? <p role="status" className="mt-5 text-sm text-emerald-300">Your email is confirmed. You can now sign in.</p> : !token ? <p role="alert" className="mt-5 text-sm text-red-300">This link is missing or invalid. Please request another from the sign-up page.</p> : <><p className="auth-card__intro">Confirm your email by choosing a password.</p><form onSubmit={submit} className="auth-form"><label>Password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><label>Confirm password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>{error && <p role="alert" className="auth-error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? 'Confirming…' : 'Confirm and create account'} <ArrowRight aria-hidden="true" /></button></form></>}{(done || !token) && <Link to="/signin" className="mt-5 inline-block text-sm text-emerald-300 underline">Go to sign in</Link>}</section></div></main>;
}
