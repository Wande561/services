import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { ServiceCategoryEnum, type AccountRole } from '../types';
import { accountDestination } from '../utils/accountRoutes';
import { serviceCategoryToString } from '../utils/serviceUtils';

const inputClass = 'mt-1 w-full rounded-lg border border-white/20 bg-gray-900 p-3 text-white focus:border-orange-400';
const roles = [
  { value: 'client', label: 'Client', description: 'Find and book services' },
  { value: 'provider', label: 'Provider', description: 'Offer services to clients' },
] as const;

function ProfileForm({ account }: { account: NonNullable<ReturnType<typeof useAuth>['currentUser']> }) {
  const { completeOnboarding, switchRole, logout, error: signOutError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleHint = searchParams.get('role');
  const [role, setRole] = useState<AccountRole>(roleHint === 'provider' ? 'provider' : 'client');
  const [fullName, setFullName] = useState(account.name ?? '');
  const [phone, setPhone] = useState(account.profile?.phone ?? '');
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
    const contact = { name: fullName, phone, location };
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
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-orange-900 px-4 py-12 text-white">
      <div className="onboarding-shell mx-auto max-w-lg">
        <div className="workspace-heading"><p>YOUR ACCOUNT / GETTING STARTED</p><h1>Let’s get to know you.</h1><span>Set up your profile to start connecting.</span></div>
        <form onSubmit={submit} className="onboarding-form rounded-xl bg-white/10 p-6">
          <fieldset disabled={busy} className="space-y-5">
            <fieldset>
              <legend className="mb-2 font-medium">Account type</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {roles.map(option => (
                  <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${role === option.value ? 'border-orange-400 bg-orange-500/10' : 'border-white/20'}`}>
                    <input type="radio" name="role" value={option.value} checked={role === option.value}
                      onChange={() => { setRole(option.value); setError(''); }} className="mt-1 accent-orange-500" />
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
            <label className="block">
              Phone number
              <input className={inputClass} type="tel" required maxLength={32} autoComplete="tel"
                value={phone} onChange={event => setPhone(event.target.value)} />
            </label>
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
            <button type="submit" className="w-full rounded-lg bg-orange-500 p-3 font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </fieldset>
        </form>
        <button type="button" disabled={busy} onClick={logout} className="mt-4 text-sm text-orange-300">Sign out</button>
        {signOutError && <p role="alert" className="mt-2 text-sm text-red-300">{signOutError}</p>}
      </div>
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
