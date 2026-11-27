import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import PresenceStatus from '../components/PresenceStatus';
import AppointmentFields, { appointmentValue } from '../components/AppointmentFields';
import { apiRequest } from '../utils/apiRequest';
import { quoteMessagePath } from '../utils/inbox';
import { formatRand, parseRandCents } from '../utils/money';
import { quotes, quoteKey, quoteTime, sastTime, sastInputTime, durationInHours, type QuoteRequest, type QuoteVersion } from '../utils/quotes';

const field = 'mt-1 w-full rounded-lg border border-home-control bg-home-canvas p-3 text-white';
const statuses: Record<QuoteRequest['status'], string> = { Pending: 'Awaiting quotation', Quoted: 'Quotation received', Accepted: 'Quote accepted', Declined: 'Quote declined', RevisionRequested: 'Changes requested', DepositPending: 'Deposit pending', SlotUnavailable: 'Appointment unavailable' };
function QuoteProgress({ request }: { request: QuoteRequest }) {
  const closed = request.status === 'Declined' || request.status === 'SlotUnavailable';
  const quoteSent = request.status !== 'Pending';
  const accepted = request.status === 'Accepted' || request.status === 'DepositPending' || Boolean(request.booking);
  const steps = [
    { label: 'Request sent', complete: true },
    { label: 'Quotation received', complete: quoteSent },
    { label: 'Quote accepted', complete: accepted },
    { label: 'Booking created', complete: Boolean(request.booking) },
  ];
  return <div className="mt-4 rounded-xl border border-home-line bg-home-canvas/60 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Quote to booking</p><ol className="mt-3 grid gap-3 sm:grid-cols-4">{steps.map((step, index) => <li key={step.label} className="flex items-center gap-2 text-sm"><span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${step.complete ? 'border-emerald-300 bg-emerald-300 text-home-canvas' : 'border-home-line text-emerald-300/70'}`}>{step.complete ? '✓' : index + 1}</span><span className={step.complete ? 'text-home-text' : 'text-emerald-300/70'}>{step.label}</span></li>)}</ol>{request.status === 'RevisionRequested' && <p role="status" className="mt-3 text-sm text-amber-200">The client requested changes. The provider can send a revised quotation.</p>}{request.status === 'DepositPending' && <p role="status" className="mt-3 text-sm text-amber-200">The client accepted the quote. Confirm the deposit to finish setting up the booking.</p>}{closed && <p role="status" className="mt-3 text-sm text-amber-200">{request.status === 'Declined' ? 'This quotation was declined.' : 'The requested appointment time is unavailable.'}</p>}</div>;
}
function QuoteDetails({ version }: { version: QuoteVersion }) {
  return <div className="space-y-1 text-sm text-emerald-300">{version.serviceDescription && <p className="whitespace-pre-wrap font-editorial text-xl text-white">{version.serviceDescription}</p>}
    <p>Labour: {formatRand(version.labourCents)} · Materials: {formatRand(version.materialsCents)} · Travel: {formatRand(version.travelCents)}</p>
    <p className="font-editorial text-xl font-bold text-white">Total: {formatRand(version.totalCents)}</p>
    {version.depositRequired && version.depositCents != null ? <div className="space-y-1 rounded-lg border border-home-line p-3"><p className="font-semibold text-emerald-300">Deposit required (25%): {formatRand(version.depositCents)}</p><p>Remaining balance: {formatRand(version.totalCents - version.depositCents)}</p><p>Bank: {version.bankName}</p><p>Account number: {version.accountNumber}</p><p>Payment reference: {version.paymentReference}</p></div> : <p>No deposit required.</p>}
    <p className="text-white">Estimated duration: {durationInHours(version.durationMinutes)}</p>
    <p className="text-white">Proposed appointment: {quoteTime(version.appointmentAt)}</p><p className="text-white">Valid until: {quoteTime(version.expiresAt)}</p>
    {version.notes && <p className="whitespace-pre-wrap text-white">Notes: {version.notes}</p>}</div>;
}
function OfferForm({ request, refresh }: { request: QuoteRequest; refresh: () => Promise<unknown> }) {
  const [error, setError] = useState(''); const [labour, setLabour] = useState(''); const [materials, setMaterials] = useState(''); const [travel, setTravel] = useState(''); const [depositRequired, setDepositRequired] = useState(false);
  const amounts = [labour, materials || '0', travel || '0'].map(parseRandCents); const total = amounts.reduce((a,b) => a+b,0);
  const send = useMutation({ mutationFn: (data: object) => apiRequest(`/quotes/${request.id}/offer`, { method: 'POST', data }), onSuccess: refresh });
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setError(''); const form = new FormData(e.currentTarget);
    if (amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0) || !Number.isSafeInteger(total)) { setError('Enter valid rand amounts with up to two decimal places.'); return; }
    const hours = Number(form.get('duration'));
    const durationMinutes = Math.round(hours * 60);
    if (!Number.isFinite(hours) || durationMinutes < 1 || durationMinutes > 10080) { setError('Enter a duration between 0.01 and 168 hours.'); return; }
    const appointment = appointmentValue(form, 'appointment');
    if (new Date(sastTime(appointment)).getTime() <= Date.now()) { setError('Please choose a future appointment.'); return; }
    send.mutate({ serviceDescription: form.get('serviceDescription'), labourCents: amounts[0], materialsCents: amounts[1], travelCents: amounts[2], durationMinutes, appointmentAt: sastTime(appointment), notes: form.get('notes'), validHours: Number(form.get('validHours')), depositRequired, ...(depositRequired ? { bankDetails: { bankName: form.get('bankName'), accountNumber: form.get('accountNumber'), paymentReference: form.get('paymentReference') } } : {}) }); }
  return <form onSubmit={submit} className="mt-4 space-y-3 border-t border-home-line pt-4">
    <h3 className="font-semibold text-home-text">{request.status === 'RevisionRequested' ? 'Send revised quotation' : 'Prepare quotation'}</h3>
    <div className="grid gap-3 sm:grid-cols-3">{[{label:'Labour (R)',value:labour,set:setLabour,required:true},{label:'Materials (R)',value:materials,set:setMaterials},{label:'Travel (R)',value:travel,set:setTravel}].map(item => <label key={item.label}>{item.label}<input className={field} inputMode="decimal" required={item.required} value={item.value} onChange={e => item.set(e.target.value)} /></label>)}</div>
    <p className="font-semibold text-home-text">Total: {Number.isSafeInteger(total) ? formatRand(total) : 'Enter valid amounts'}</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={depositRequired} onChange={e => setDepositRequired(e.target.checked)} />Require a 25% deposit</label>
    {depositRequired && <div className="space-y-3 rounded-lg border border-home-line p-4">
      <p className="text-sm text-emerald-300">Deposit: {Number.isSafeInteger(total) ? formatRand(Math.floor((total + 2) / 4)) : 'Enter valid amounts'} · Remaining balance: {Number.isSafeInteger(total) ? formatRand(total - Math.floor((total + 2) / 4)) : 'Enter valid amounts'}</p>
      <label className="block">Bank name<input className={field} name="bankName" maxLength={100} required /></label>
      <label className="block">Account number<input className={field} name="accountNumber" inputMode="numeric" pattern="[0-9]{4,20}" maxLength={20} required /></label>
      <label className="block">Payment reference<input className={field} name="paymentReference" maxLength={100} required /></label>
    </div>}
    <label className="block">Estimated duration (hours)<input className={field} type="number" name="duration" min="0.01" max="168" step="0.01" placeholder="e.g. 1.5" aria-describedby="duration-help" required /></label>
    <p id="duration-help" className="text-sm text-emerald-300">For example, 1.5 hours means 1 hour and 30 minutes. Durations are rounded to the nearest minute.</p>
    <AppointmentFields prefix="appointment" minDate={sastInputTime(new Date()).slice(0, 10)} defaultValue={request.preferredAt} />
    <p className="text-sm text-emerald-300">The client's preferred time is filled in. Change it if needed.</p>
    <details className="quote-optional"><summary>More quote details <span>Optional</span></summary><div className="quote-optional__body"><label className="block">Service description<textarea name="serviceDescription" className={field} rows={3} maxLength={2000} /></label><label className="block">Additional notes<textarea className={field} name="notes" maxLength={2000} rows={2} /></label><label className="block">Quote valid for<select className={field} name="validHours" defaultValue="5">{[1,3,5,12,24,48].map(n => <option key={n} value={n}>{n} {n === 1 ? 'hour' : 'hours'}</option>)}</select></label></div></details>
    {(error || send.isError) && <p role="alert" className="text-red-300">{error || send.error?.message}</p>}<button disabled={send.isPending} className="btn-primary disabled:opacity-50">{send.isPending ? 'Sending…' : 'Send quotation'}</button>
  </form>;
}
function ResponseForm({ request, refresh }: { request: QuoteRequest; refresh: () => Promise<unknown> }) {
  const [changes, setChanges] = useState(''); const [asking, setAsking] = useState(false);
  const send = useMutation({ mutationFn: (data: object) => apiRequest(`/quotes/${request.id}/response`, { method: 'POST', data }), onSuccess: refresh });
  const expired = new Date(request.versions[0].expiresAt).getTime() <= Date.now();
  if (expired) return <p className="mt-3 text-sm text-red-300">This quotation has expired.</p>;
  return <div className="mt-4 space-y-3"><p className="text-sm text-emerald-300">{request.versions[0].depositRequired ? 'The provider requires a 25% deposit. After acceptance, pay by immediate EFT and the provider will confirm receipt before the booking is created. The time is not guaranteed until confirmation.' : 'No deposit is required. Accepting creates a confirmed booking if the appointment is available.'}</p>
    <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={send.isPending} onClick={() => send.mutate({ action: 'accept' })}>Accept quotation</button>
    <button type="button" className="btn-secondary" disabled={send.isPending} onClick={() => send.mutate({ action: 'decline' })}>Decline</button>
    <button type="button" className="btn-secondary" onClick={() => setAsking(!asking)}>Request changes</button></div>
    {asking && <form onSubmit={e => { e.preventDefault(); send.mutate({ action: 'changes', changeRequest: changes }); }}><label className="block">What would you like changed?<textarea className={field} required maxLength={1000} value={changes} onChange={e => setChanges(e.target.value)} /></label><button className="btn-primary mt-2" disabled={send.isPending}>Send changes</button></form>}
    {send.isError && <p role="alert" className="text-red-300">{send.error.message}</p>}</div>;
}
function DepositDetails({ request, role, refresh }: { request: QuoteRequest; role: 'client' | 'provider'; refresh: () => Promise<unknown> }) {
  const [bankName, setBankName] = useState(request.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(request.accountNumber ?? '');
  const [paymentReference, setPaymentReference] = useState(request.paymentReference ?? '');
  const save = useMutation({ mutationFn: (data: object) => apiRequest(`/quotes/${request.id}/bank-details`, { method: 'POST', data }), onSuccess: refresh });
  const confirm = useMutation({ mutationFn: () => apiRequest(`/quotes/${request.id}/confirm-deposit`, { method: 'POST' }), onSuccess: refresh });
  const latest = request.versions[0];
  const detailsAvailable = !!(request.bankName && request.accountNumber && request.paymentReference);
  return <section className="mt-4 space-y-3 rounded-lg border border-home-control bg-home-canvas p-4 text-sm">
    <h3 className="font-semibold text-home-text">Deposit pending</h3>
    <p className="text-emerald-300">Deposit: {formatRand(request.depositCents ?? 0)} · Remaining balance: {formatRand(latest.totalCents - (request.depositCents ?? 0))}</p>
    <p className="text-emerald-300">The appointment is not guaranteed until the provider confirms the immediate EFT was received. Another client may secure it first.</p>
    {role === 'client' && (detailsAvailable ? <div className="space-y-1 text-home-text"><p>Bank: {request.bankName}</p><p>Account number: {request.accountNumber}</p><p>Payment reference: {request.paymentReference}</p><p className="pt-2 text-emerald-300">Pay by immediate EFT using your banking app. The provider must confirm receipt here; this website does not process the payment.</p></div> : <p className="text-emerald-300">Waiting for the provider to supply bank details.</p>)}
    {role === 'provider' && <>
      {!detailsAvailable && <form onSubmit={e => { e.preventDefault(); save.mutate({ bankName, accountNumber, paymentReference }); }} className="space-y-3">
        <label className="block">Bank name<input className={field} value={bankName} onChange={e => setBankName(e.target.value)} maxLength={100} required /></label>
        <label className="block">Account number<input className={field} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} inputMode="numeric" pattern="[0-9]{4,20}" maxLength={20} required /></label>
        <label className="block">Payment reference<input className={field} value={paymentReference} onChange={e => setPaymentReference(e.target.value)} maxLength={100} required /></label>
        <button className="btn-secondary disabled:opacity-50" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Send bank details'}</button>
      </form>}
      {detailsAvailable && <p className="text-emerald-300">The bank details from your quotation have been supplied to the client.</p>}
      {save.isError && <p role="alert" className="text-red-300">{save.error.message}</p>}
      {detailsAvailable && <div className="border-t border-home-line pt-3"><p className="mb-2 text-emerald-300">Only confirm after you have verified receipt of the deposit in your bank account.</p><button type="button" className="btn-primary disabled:opacity-50" disabled={confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? 'Confirming…' : 'Confirm deposit received'}</button></div>}
      {confirm.isError && <p role="alert" className="text-red-300">{confirm.error.message}</p>}
    </>}
  </section>;
}
export default function Quotes() {
  const { currentUser } = useAuth(); const role = currentUser?.profile?.role; const query = useQuery(quotes(currentUser?.id ?? '')); const client = useQueryClient();
  const [params] = useSearchParams(); const selected = params.get('request'); const location = useLocation();
  const refresh = () => client.invalidateQueries({ queryKey: quoteKey });
  return <main className="min-h-screen px-5 py-12"><div className="mx-auto max-w-4xl"><div className="workspace-heading"><p>YOUR WORKSPACE / QUOTATIONS</p><h1>{role === 'provider' ? 'Quote requests' : 'My quotes'}</h1><span>{role === 'provider' ? 'Review requests and prepare thoughtful quotations.' : 'Follow your requests and review quotations from providers.'}</span></div>
    {location.state?.sent && <p role="status" className="mt-3 text-emerald-300">Your quote request was sent.</p>}
    {selected && <Link to="/quotes" className="mt-3 inline-block text-sm text-emerald-300 underline">← All quotes</Link>}
    {query.isPending && <p className="mt-5">Loading quotes…</p>}{query.isError && <p role="alert" className="mt-5 text-red-300">{query.error.message}</p>}
    {query.data?.filter(request => !selected || request.id === selected).length === 0 && <p className="mt-5 text-emerald-300">{selected ? 'Quote request not found.' : 'No quote requests yet.'}</p>}
    <div className="mt-5 space-y-5">{query.data?.filter(request => !selected || request.id === selected).map(request => <article key={request.id} className="quote-request-card rounded-xl border border-home-line bg-home-surface p-6">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="text-2xl !text-emerald-300">{request.listing.title}</h2><span className="text-sm text-emerald-300">{statuses[request.status]}</span></div>
      <p className="mt-2 text-sm text-emerald-300">{role === 'provider' ? `Client: ${request.client.user.name || 'Client'}` : `Provider: ${request.provider.businessName || 'Provider'}`}</p>
      {role && role !== 'admin' && <PresenceStatus userId={role === 'provider' ? request.clientId : request.providerId} />}
      {role && role !== 'admin' && <Link to={quoteMessagePath(request.id)} className="btn-secondary mt-3 inline-block">Message {role === 'provider' ? 'client' : 'provider'}</Link>}
      <QuoteProgress request={request} />
      {role === 'client' && request.provider.verificationTier !== 'Basic' && <p className="mt-1 text-sm font-semibold text-emerald-300">{request.provider.verificationTier === 'IdentityVerified' ? '✓ Identity verified' : '✓ Business verified'}</p>}
      {role === 'provider' && request.client.verificationTier === 'IdentityVerified' && <p className="mt-1 text-sm font-semibold text-emerald-300">✓ Identity verified client</p>}
      {role === 'provider' && request.clientRating && <p className="mt-1 text-sm text-emerald-300">Client rating: {request.clientRating.reviewCount ? `${request.clientRating.averageRating?.toFixed(1)} out of 5 · ${request.clientRating.reviewCount} ${request.clientRating.reviewCount === 1 ? 'review' : 'reviews'}` : 'No ratings yet'}</p>}
      <p className="mt-3 whitespace-pre-wrap font-editorial text-xl text-white">{request.description}</p><p className="mt-2 text-sm text-emerald-300">Preferred: {quoteTime(request.preferredAt)} · Location: {request.location}</p>
      {request.additionalInfo && <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-300">Additional information: {request.additionalInfo}</p>}
      {request.photos.length > 0 && <div className="mt-4 flex flex-wrap gap-4">{request.photos.map((photo, index) => <a key={photo.id} href={`/api/quotes/${request.id}/photos/${photo.id}`} target="_blank" rel="noreferrer" className="w-36 text-sm text-emerald-300 underline"><img src={`/api/quotes/${request.id}/photos/${photo.id}`} alt={photo.isListingReference ? 'Listing photo chosen as reference' : `Client photo ${index + 1}`} className="mb-1 h-28 w-full rounded-lg object-cover" />{photo.isListingReference ? 'Listing photo reference' : 'Client-uploaded photo'}</a>)}</div>}
      {request.changeRequest && <p className="mt-3 whitespace-pre-wrap text-sm text-emerald-300">Requested changes: {request.changeRequest}</p>}
      {request.versions.map((version, index) => <details key={version.id} open={index === 0} className="mt-4 border-t border-home-line pt-4"><summary className="cursor-pointer font-editorial text-xl text-white">Quotation {version.version}{index === 0 ? ' · Latest' : ''}</summary><div className="mt-3"><QuoteDetails version={version} /></div></details>)}
      {role === 'provider' && (request.status === 'Pending' || request.status === 'RevisionRequested') && <OfferForm request={request} refresh={refresh} />}
      {role === 'client' && request.status === 'Quoted' && request.versions[0] && <ResponseForm request={request} refresh={refresh} />}
      {request.status === 'DepositPending' && request.versions[0] && role && role !== 'admin' && <DepositDetails request={request} role={role} refresh={refresh} />}
      {request.status === 'SlotUnavailable' && <p className="mt-4 text-sm text-red-300">This appointment is no longer available. Please contact the other party about a new time or any payment made.</p>}
      {request.status === 'Accepted' && <p className="mt-4 text-sm text-emerald-300">The quotation has been accepted. {request.booking ? <Link to={`/bookings?booking=${encodeURIComponent(request.booking.id)}`} className="underline">View booking</Link> : 'This quote was accepted before booking creation was enabled.'}</p>}
    </article>)}</div>
  </div></main>;
}
