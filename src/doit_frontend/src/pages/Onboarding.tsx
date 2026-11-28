import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { ServiceCategoryEnum, type AccountRole } from '../types';
import { accountDestination } from '../utils/accountRoutes';
import { serviceCategoryToString } from '../utils/serviceUtils';
import FilterSelect from '../components/FilterSelect';
import { ArrowRight, BriefcaseBusiness, Sparkles, UserRound } from 'lucide-react';

const inputClass = 'mt-1 w-full rounded-lg border border-white/20 bg-gray-900 p-3 text-white focus:border-orange-400';
const roles = [
  { value: 'client', label: 'Client', description: 'Find and book services' },
  { value: 'provider', label: 'Provider', description: 'Offer services to clients' },
] as const;
const countries = [
  { value: '+27', label: '🇿🇦 South Africa · +27', compactLabel: '🇿🇦 +27' },
  { value: '+267', label: '🇧🇼 Botswana · +267', compactLabel: '🇧🇼 +267' },
  { value: '+268', label: '🇸🇿 Eswatini · +268', compactLabel: '🇸🇿 +268' },
  { value: '+266', label: '🇱🇸 Lesotho · +266', compactLabel: '🇱🇸 +266' },
  { value: '+258', label: '🇲🇿 Mozambique · +258', compactLabel: '🇲🇿 +258' },
  { value: '+264', label: '🇳🇦 Namibia · +264', compactLabel: '🇳🇦 +264' },
  { value: '+263', label: '🇿🇼 Zimbabwe · +263', compactLabel: '🇿🇼 +263' },
  { value: '+44', label: '🇬🇧 United Kingdom · +44', compactLabel: '🇬🇧 +44' },
  { value: '+1', label: '🇺🇸 United States / Canada · +1', compactLabel: '🇺🇸 +1' },
  { value: 'other', label: '🌍 Other country', compactLabel: '🌍 Other' },
];

function ProfileForm({ account }: { account: NonNullable<ReturnType<typeof useAuth>['currentUser']> }) {
  const { completeOnboarding, switchRole, logout, error: signOutError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleHint = searchParams.get('role');
  const [role, setRole] = useState<AccountRole>(roleHint === 'provider' ? 'provider' : 'client');
  const [fullName, setFullName] = useState(account.name ?? '');
  const [phone, setPhone] = useState(account.profile?.phone ?? '');
  const [dialCode, setDialCode] = useState('+27');
  const [customDialCode, setCustomDialCode] = useState('');
  const [location, setLocation] = useState(account.profile?.location ?? '');
  const [businessName, setBusinessName] = useState(account.profile?.businessName ?? '');
  const [serviceCategories, setServiceCategories] = useState<ServiceCategoryEnum[]>(account.profile?.serviceCategories ?? []);
  const [otherService, setOtherService] = useState(account.profile?.otherService ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === 'provider' && serviceCategories.length === 0) {
      setError('Choose at least one service category.');
      return;
    }

    setBusy(true);
    setError('');
    const number = phone.replace(/[\s().-]/g, '');
    const code = dialCode === 'other' ? customDialCode.trim() : dialCode;
    if (!account.profile && (!/^\+\d{1,4}$/.test(code) || !/^\d{6,14}$/.test(number) || code.length - 1 + number.length > 15)) { setError('Choose a country code and enter a valid phone number.'); setBusy(false); return; }
    const contact = { name: fullName, phone: account.profile ? phone : `${code}${code === '+27' ? number.replace(/^0/, '') : number}`, location };
    try {
      const input = role === 'client' ? { ...contact, role } as const : { ...contact, role, businessName, serviceCategories, otherService } as const;
      if (account.profile) await switchRole(input);
      else await completeOnboarding(input);
      navigate(role === 'provider' ? '/provider-dashboard' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setBusy(false);
    }
  }

  function toggleCategory(category: ServiceCategoryEnum, checked: boolean) {
    setServiceCategories(selected => checked
      ? [...selected, category]
      : selected.filter(value => value !== category));
  }

  return (
    <main className="onboarding-page min-h-screen text-white">
      <header className="onboarding-header"><a href="/" className="onboarding-brand"><img src="/serviceconnect-logo.png" alt="" /><span>Service<em>Connect</em></span></a><button type="button" disabled={busy} onClick={logout}>Sign out <ArrowRight size={15} aria-hidden="true" /></button></header>
      <div className="onboarding-layout"><aside className="onboarding-story"><span className="onboarding-story__icon"><Sparkles size={19} aria-hidden="true" /></span><p>A LITTLE ABOUT YOU</p><h1>Good things start with <em>connection.</em></h1><span>Set up your space and find the people who make things happen.</span><div className="onboarding-story__foot">GOOD PEOPLE. GOOD WORK.</div></aside>
      <div className="onboarding-shell">
        <div className="onboarding-intro"><p>YOUR ACCOUNT / GETTING STARTED</p><h2>Let’s get to know you.</h2><span>A few details and you’re ready to get started.</span></div>
        <form onSubmit={submit} className="onboarding-form">
          <fieldset disabled={busy} className="space-y-5">
            <fieldset>
              <legend className="mb-2 font-medium">I’m here to</legend>
              <div className="onboarding-roles">
                {roles.map(option => (
                  <label key={option.value} className={`onboarding-role ${role === option.value ? 'is-selected' : ''}`}>
                    <input type="radio" name="role" value={option.value} checked={role === option.value}
                      onChange={() => { setRole(option.value); setError(''); }} />
                    <span className="onboarding-role__icon">{option.value === 'client' ? <UserRound size={18} /> : <BriefcaseBusiness size={18} />}</span>
                    <span>
                      <span className="block font-semibold">{option.label}</span>
                      <span className="text-sm text-gray-300">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block">
              Full name
              <input className={inputClass} required maxLength={100} autoComplete="name"
                value={fullName} onChange={event => setFullName(event.target.value)} />
            </label>
            {account.profile ? <label className="block">Phone number<input className={inputClass} type="tel" required maxLength={32} value={phone} onChange={event => setPhone(event.target.value)} /></label> : <fieldset><legend className="block">Phone number</legend><div className="phone-fields"><FilterSelect compact label="Country code" name="countryCode" options={countries} defaultValue="+27" onChange={setDialCode} />{dialCode === 'other' && <label className="phone-fields__custom"><span className="sr-only">International calling code</span><input className={inputClass} type="tel" required placeholder="e.g. +254" value={customDialCode} onChange={event => setCustomDialCode(event.target.value)} /></label>}<label className="phone-fields__number"><span className="sr-only">Phone number</span><input className={inputClass} type="tel" required maxLength={20} autoComplete="tel-national" placeholder="Phone number" value={phone} onChange={event => setPhone(event.target.value)} /></label></div></fieldset>}
            <label className="block">
              City or town
              <input className={inputClass} required maxLength={150} autoComplete="address-level2"
                value={location} onChange={event => setLocation(event.target.value)} />
            </label>

            {role === 'provider' && (
              <>
                <label className="block">
                  Business name
                  <input className={inputClass} required maxLength={120} autoComplete="organization"
                    value={businessName} onChange={event => setBusinessName(event.target.value)} />
                </label>
                <fieldset>
                  <legend className="mb-2 font-medium">Service categories</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.values(ServiceCategoryEnum).map(category => (
                      <label key={category} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={serviceCategories.includes(category)}
                          className="accent-orange-500"
                          onChange={event => toggleCategory(category, event.target.checked)} />
                        {serviceCategoryToString({ [category]: null })}
                      </label>
                    ))}
                  </div>
                  {serviceCategories.includes(ServiceCategoryEnum.Other) && <label className="mt-3 block">What service do you provide?
                    <input className={inputClass} required maxLength={150} value={otherService} onChange={event => setOtherService(event.target.value)} />
                  </label>}
                </fieldset>
              </>
            )}

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button type="submit" className="onboarding-submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'} <ArrowRight size={17} aria-hidden="true" />
            </button>
          </fieldset>
        </form>
        {signOutError && <p role="alert" className="mt-2 text-sm text-red-300">{signOutError}</p>}
      </div></div>
    </main>
  );
}

export default function Onboarding() {
  const { currentUser, isLoading } = useAuth();
  const [params] = useSearchParams();
  if (isLoading) {
    return <p role="status" className="bg-gray-900 min-h-screen p-8 text-white">Loading your account…</p>;
  }
  if (!currentUser) return <Navigate to={params.size ? `/signin?${params}` : '/signin'} replace />;
  if (currentUser.profile && params.get('addRole') !== '1') return <Navigate to={accountDestination(currentUser.profile.role, params)} replace />;
  return <ProfileForm key={currentUser.id} account={currentUser} />;
}
