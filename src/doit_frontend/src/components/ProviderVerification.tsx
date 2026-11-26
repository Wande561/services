import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AppContext';
import { apiRequest } from '../utils/apiRequest';
import { myVerification, tierLabel, verificationKey } from '../utils/verification';

const field = 'mt-1 block w-full rounded-lg border border-home-control bg-home-canvas p-3 text-white';
function read(file: File): Promise<string> { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Could not read the file')); r.readAsDataURL(file); }); }
export default function ProviderVerification() {
  const { currentUser } = useAuth(); const state = useQuery(myVerification(currentUser?.id ?? '')); const cache = useQueryClient();
  const isClient = currentUser?.profile?.role === 'client';
  const [kind, setKind] = useState<'Individual' | 'Business'>('Individual'); const [error, setError] = useState('');
  const submit = useMutation({ mutationFn: (data: object) => apiRequest('/verification', { method: 'POST', data }), onSuccess: () => cache.invalidateQueries({ queryKey: verificationKey }) });
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget);
    const photo = form.get('profilePhoto');
    const names = kind === 'Individual' ? ['identityDocument', ...(!isClient || (photo instanceof File && photo.size > 0) ? ['profilePhoto'] : [])] : ['businessDocument'];
    const files = names.map(name => form.get(name));
    if (files.some(file => !(file instanceof File) || !file.size || file.size > 1048576 || !['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)) || (kind === 'Individual' && files[1] instanceof File && files[1].type === 'application/pdf')) { setError('Choose the required files, each no larger than 1 MB. The profile photograph must be an image.'); return; }
    try {
      const uploads = await Promise.all(files.map(file => read(file as File)));
      await submit.mutateAsync({ kind, legalName: form.get('legalName'), businessName: form.get('businessName'), registrationNumber: form.get('registrationNumber'), ...Object.fromEntries(names.map((name, i) => [name, uploads[i]])) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit your request.'); }
  }
  return <section className="mt-6 rounded-2xl border border-home-line bg-home-surface p-6 sm:p-8"><div className="account-card__head"><div><span className="account-section-label">02 / VERIFICATION</span><h2>{isClient ? 'Identity verification' : 'Provider verification'}</h2><p>Manage your verification and build trust on ServiceConnect.</p></div><span className="account-card__icon"><ShieldCheck aria-hidden="true" /></span></div>
    {state.isPending && <p className="mt-2">Loading verification status…</p>}{state.isError && <p role="alert" className="mt-2 text-red-300">{state.error.message}</p>}
    {state.data && <><div className="verification-status"><span><BadgeCheck aria-hidden="true" /></span><div><small>YOUR CURRENT STATUS</small><strong>{tierLabel(state.data.tier)}</strong></div></div>
      {state.data.submission && <p className="mt-2 text-sm text-emerald-300">Latest submission: {state.data.submission.status === 'Pending' ? 'Awaiting administrator review' : state.data.submission.status}{state.data.submission.reviewNote ? ` · ${state.data.submission.reviewNote}` : ''}</p>}
      {state.data.tier !== 'Basic' && <p className="mt-4 text-sm text-emerald-300">Your account is verified. No further application is needed.</p>}
      {state.data.tier === 'Basic' && state.data.submission?.status !== 'Pending' && <form onSubmit={send} className="mt-4 space-y-4 border-t border-home-line pt-4">
        <p className="text-sm text-emerald-300">An administrator reviews your documents and independently checks the required contact details. Your documents are accessible only to authorized verification administrators. Submitting does not automatically award a badge. Changing your account name, phone, or business name removes an existing badge until you are reviewed again.</p>
        {!isClient && <label className="block">Verification type<select className={field} value={kind} onChange={e => setKind(e.target.value as 'Individual' | 'Business')}><option value="Individual">Individual · Identity verification</option><option value="Business">Registered business verification</option></select></label>}
        {kind === 'Individual' ? <><label className="block">Full legal name<input className={field} name="legalName" maxLength={100} defaultValue={currentUser?.name ?? ''} required /></label><label className="block">Identity document (PDF or image, max 1 MB)<input className={field} type="file" name="identityDocument" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label><label className="block">Profile photograph {isClient ? '(optional; image, max 1 MB)' : '(image, max 1 MB)'}<input className={field} type="file" name="profilePhoto" accept="image/jpeg,image/png,image/webp" required={!isClient} /></label></> : <><label className="block">Registered business name<input className={field} name="businessName" maxLength={120} defaultValue={currentUser?.profile?.businessName ?? ''} required /></label><label className="block">Business registration number (if applicable)<input className={field} name="registrationNumber" maxLength={100} /></label><label className="block">Business registration document (PDF or image, max 1 MB)<input className={field} type="file" name="businessDocument" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label></>}
        <p className="text-sm text-emerald-300">Your account name{kind === 'Business' ? ' and profile business name' : ''}, phone and email are included for review. Update your profile above if they are incorrect. The {kind === 'Individual' ? 'legal name must match your account name' : 'registered name must match your profile business name'}.</p>
        {error && <p role="alert" className="text-red-300">{error}</p>}<button className="btn-primary disabled:opacity-50" disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit for review'}</button>
      </form>}
    </>}
  </section>;
}
