import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, Eye, EyeOff, LockKeyhole, MapPin, ShieldCheck, Star, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AppContext';
import { ServiceCategoryEnum } from '../types';
import { accountHome } from '../utils/accountRoutes';
import { apiRequest } from '../utils/apiRequest';
import { categoryLabel } from '../utils/serviceUtils';
import { providerReviews } from '../utils/reviews';
import ProviderVerification from '../components/ProviderVerification';
import { myVerification, verificationKey } from '../utils/verification';

const field = 'account-input';

export default function Settings() {
  const { currentUser, updateProfile } = useAuth();
  const cache = useQueryClient();
  const { hash } = useLocation();
  const [section, setSection] = useState<'profile' | 'verification' | 'security'>(hash === '#verification-settings' ? 'verification' : hash === '#security-settings' ? 'security' : 'profile');
  useEffect(() => { if (hash === '#verification-settings') setSection('verification'); else if (hash === '#security-settings') setSection('security'); else if (hash === '#profile-settings') setSection('profile'); }, [hash]);
  const profile = currentUser!.profile!;
  const verification = useQuery({ ...myVerification(currentUser?.id ?? ''), enabled: profile.role !== 'admin' && !!currentUser?.id });
  const rating = useQuery(providerReviews(currentUser?.id ?? ''));
  const [name, setName] = useState(currentUser?.name ?? '');
  const [phone, setPhone] = useState(profile.phone);
  const [location, setLocation] = useState(profile.location);
  const [businessName, setBusinessName] = useState(profile.businessName ?? '');
  const [categories, setCategories] = useState(profile.serviceCategories);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');
    if (profile.role === 'provider' && categories.length === 0) {
      setProfileError('Choose at least one service category.');
      return;
    }
    setProfileBusy(true);
    try {
      await updateProfile({ name, phone, location, ...(profile.role === 'provider' && { businessName, serviceCategories: categories }) });
      await cache.invalidateQueries({ queryKey: verificationKey });
      setProfileMessage('Your profile has been saved.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally { setProfileBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return; }
    setPasswordBusy(true);
    try {
      await apiRequest('/auth/password', { method: 'POST', data: { currentPassword, newPassword } });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setPasswordMessage('Your password has been changed. Other sessions have been signed out.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change your password.');
    } finally { setPasswordBusy(false); }
  }

  const currentTier = verification.data?.tier ?? profile.verificationTier;
  const verified = currentTier !== 'Basic';
  const tabs = [
    { id: 'profile' as const, label: 'Personal details', caption: 'Your public & contact information', icon: UserRound },
    ...(profile.role !== 'admin' ? [{ id: 'verification' as const, label: 'Verification', caption: 'Your verification status', icon: ShieldCheck }] : []),
    { id: 'security' as const, label: 'Password & security', caption: 'Keep your account secure', icon: LockKeyhole },
  ];
  return <main className="account-page"><div className="account-shell">
    <Link to={accountHome(profile.role)} className="account-back"><ArrowLeft aria-hidden="true" /> Back to dashboard</Link>
    <header className="account-heading"><div><p className="account-kicker">YOUR ACCOUNT / SETTINGS</p><h1>Make it yours.</h1><p>Everything about your account, in one place.</p></div><div className="account-heading__mark"><UserRound aria-hidden="true" /></div></header>
    <div className="account-layout"><aside className="account-sidebar">
      <div className="account-person"><div className="account-avatar">{(currentUser?.name || 'A').trim().slice(0, 1).toUpperCase()}</div><div className="account-person__name"><strong>{profile.businessName || currentUser?.name || 'My account'}</strong><span>{profile.role === 'provider' ? 'Service provider' : profile.role === 'client' ? 'Client account' : 'Administrator'}</span></div></div>
      {profile.role !== 'admin' && <div className={`account-status ${verified ? 'is-verified' : ''}`}><BadgeCheck aria-hidden="true" /><span>{verified ? currentTier === 'BusinessVerified' ? 'Business verified' : 'Identity verified' : verification.data?.submission?.status === 'Pending' ? 'Verification in review' : 'Basic account'}</span></div>}
      <nav className="account-nav" aria-label="Account settings">{tabs.map(({ id, label, caption, icon: Icon }) => <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined} className={section === id ? 'is-active' : ''}><Icon aria-hidden="true" /><span><strong>{label}</strong><small>{caption}</small></span><ArrowRight className="account-nav__arrow" aria-hidden="true" /></button>)}</nav>
      <div className="account-sidebar__footer"><MapPin aria-hidden="true" /><span>{profile.location}</span>{profile.role !== 'admin' && <><Star aria-hidden="true" /><span>{rating.isPending ? 'Loading…' : rating.data?.reviewCount ? `${rating.data.averageRating?.toFixed(1)} · ${rating.data.reviewCount} reviews` : 'No ratings yet'}</span></>}</div>
    </aside>
    <div className="account-content">
      {section === 'profile' && <form id="profile-settings" onSubmit={saveProfile} className="account-card"><div className="account-card__head"><div><span className="account-section-label">01 / PROFILE</span><h2>Personal details</h2><p>Update the details associated with your account.</p></div><span className="account-card__icon"><UserRound aria-hidden="true" /></span></div>
        <div className="account-fields"><label>Full name<input className={field} required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label><label>Email address<input className={field} type="email" value={currentUser!.email} readOnly aria-describedby="email-help" /><small id="email-help">Email changes are not available yet.</small></label><label>Phone number<input className={field} type="tel" required maxLength={32} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label><label>City or town<input className={field} required maxLength={150} autoComplete="address-level2" value={location} onChange={e => setLocation(e.target.value)} /></label></div>
        {profile.role === 'provider' && <div className="account-business"><div className="account-section-title"><span>BUSINESS PROFILE</span><p>Help clients understand what you offer.</p></div><label>Business name<input className={field} required maxLength={120} autoComplete="organization" value={businessName} onChange={e => setBusinessName(e.target.value)} /></label><fieldset><legend>Service categories</legend><div className="account-categories">{Object.values(ServiceCategoryEnum).map(category => <label key={category} className={categories.includes(category) ? 'is-selected' : ''}><input type="checkbox" checked={categories.includes(category)} onChange={e => setCategories(previous => e.target.checked ? [...previous, category] : previous.filter(value => value !== category))} /><span>{categoryLabel(category)}</span>{categories.includes(category) && <Check aria-hidden="true" />}</label>)}</div></fieldset></div>}
        {verified && <p className="account-note">Changing your name, phone number{profile.role === 'provider' ? ' or business name' : ''} will require a new verification review.</p>}
        <div className="account-actions">{profileError && <p role="alert" className="account-error">{profileError}</p>}{profileMessage && <p role="status" className="account-success">{profileMessage}</p>}<button className="account-save" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save changes'} <ArrowRight aria-hidden="true" /></button></div>
      </form>}
      {section === 'verification' && profile.role !== 'admin' && <div id="verification-settings" className="account-verification"><ProviderVerification /></div>}
      {section === 'security' && <form id="security-settings" onSubmit={changePassword} className="account-card"><div className="account-card__head"><div><span className="account-section-label">03 / SECURITY</span><h2>Password & security</h2><p>Choose a strong password for your account.</p></div><span className="account-card__icon"><LockKeyhole aria-hidden="true" /></span></div><p className="account-note">If you sign in with Google, manage your password through your Google account.</p><div className="account-fields account-fields--security"><label>Current password<input className={field} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label><label>New password<input className={field} type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><label>Confirm new password<input className={field} type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label></div><button type="button" className="account-show" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{showPassword ? 'Hide passwords' : 'Show passwords'}</button><div className="account-actions">{passwordError && <p role="alert" className="account-error">{passwordError}</p>}{passwordMessage && <p role="status" className="account-success">{passwordMessage}</p>}<button className="account-save" disabled={passwordBusy}>{passwordBusy ? 'Changing…' : 'Update password'} <ArrowRight aria-hidden="true" /></button></div></form>}
    </div></div>
  </div></main>;
}
