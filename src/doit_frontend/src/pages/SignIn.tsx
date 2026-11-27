import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { accountDestination } from '../utils/accountRoutes';

export default function SignIn() {
  const { login, register, googleLogin, currentUser, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = searchParams.get('role');
  const hasRoleHint = role === 'client' || role === 'provider';
  const [creating, setCreating] = useState(hasRoleHint);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const messages: Record<string, string> = {
      not_configured: 'Google sign-in is not configured right now. You can sign in with your email and password.',
      invalid_state: 'Google sign-in could not be verified. Please try again.',
      cancelled: 'Google sign-in was cancelled.',
      existing_account: 'An account already uses this email. Sign in with your email and password.',
      suspended: 'This account is suspended. Please contact support.',
      invalid_response: 'Google did not return a valid sign-in response. Please try again.',
      unavailable: 'Google sign-in is temporarily unavailable. Please try again or use your password.',
    };
    const code = searchParams.get('google_error');
    if (!code) return;
    setError(messages[code] || 'Google sign-in could not be completed. Please try again.');
    const next = new URLSearchParams(searchParams);
    next.delete('google_error');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (creating) await register(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally { setBusy(false); }
  }

  if (isLoading) {
    return <p role="status" className="bg-gray-900 min-h-screen p-8 text-white">Loading your account…</p>;
  }
  if (currentUser) {
    return <Navigate to={currentUser.isVerificationAdmin && currentUser.profile ? '/admin' : accountDestination(currentUser.profile?.role, searchParams)} replace />;
  }

  return <main className="auth-page"><div className="auth-shell"><Link to="/" className="auth-back"><ArrowLeft aria-hidden="true" /> Back to home</Link><div className="auth-layout"><div className="auth-story"><p className="discovery-kicker">GOOD PEOPLE. GOOD WORK.</p><h1>Good things<br /><em>start here.</em></h1><p>Connect with local people and find the right help for the work that matters to you.</p><div className="auth-story__mark"><Sparkles aria-hidden="true" /><span>LOCAL SERVICES<br />MADE SIMPLE</span></div><span className="auth-story__foot">SERVICECONNECT / YOUR COMMUNITY</span></div>
    <section className="auth-card"><p className="discovery-kicker">{creating ? 'JOIN OUR COMMUNITY' : 'YOUR ACCOUNT'}</p><h2>{creating ? 'Create your account.' : 'Welcome back.'}</h2><p className="auth-card__intro">{creating ? 'A few details and you’re ready to get started.' : 'Sign in to continue where you left off.'}</p>
      <form onSubmit={submit} className="auth-form">
        {creating && <label>Name<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Your name" /></label>}
        <label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></label>
        <label>Password<span className="auth-password"><input required type={showPassword ? 'text' : 'password'} minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword(visible => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span></label>
        {error && <p role="alert" className="auth-error">{error}</p>}<button disabled={busy} className="auth-submit">{busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'} <ArrowRight aria-hidden="true" /></button>
      </form>{!creating && <Link className="mt-3 inline-block text-sm text-emerald-300 underline" to="/forgot-password">Forgot your password?</Link>}<div className="auth-divider"><span />or<span /></div><button type="button" onClick={() => { if (searchParams.get('book')) sessionStorage.setItem('pendingQuote', searchParams.toString()); else sessionStorage.removeItem('pendingQuote'); googleLogin(); }} className="auth-google">Continue with Google <ArrowRight aria-hidden="true" /></button><p className="auth-switch">{creating ? 'Already have an account?' : 'New to ServiceConnect?'} <button type="button" onClick={() => { setCreating(!creating); setError(''); }}>{creating ? 'Sign in' : 'Create an account'}</button></p>
    </section></div></div></main>;
}
