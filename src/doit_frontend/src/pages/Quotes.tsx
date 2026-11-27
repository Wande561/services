import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import PresenceStatus from '../components/PresenceStatus';
import HistoryCard from '../components/HistoryCard';
import AppointmentFields, { appointmentValue } from '../components/AppointmentFields';
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Image, WalletCards, CircleHelp, X } from 'lucide-react';
import { apiRequest } from '../utils/apiRequest';
import { useViewedUpdates } from '../utils/useViewedUpdates';
import { inboxKey, quoteMessagePath } from '../utils/inbox';
import { formatRand, parseRandCents } from '../utils/money';
import { quotes, quoteKey, quoteTime, sastTime, sastInputTime, durationInHours, type QuoteRequest, type QuoteVersion } from '../utils/quotes';

const field = 'mt-1 w-full rounded-lg border border-home-control bg-home-canvas p-3 text-white';
const statuses: Record<QuoteRequest['status'], string> = { Pending: 'Awaiting quotation', Quoted: 'Quotation received', Accepted: 'Quote accepted', Declined: 'Quote declined', RevisionRequested: 'Changes requested', DepositPending: 'Deposit pending', SlotUnavailable: 'Appointment unavailable' };
const withdrawn = (request: QuoteRequest) => request.status === 'Declined' && request.versions.length === 0;
function QuoteProgress({ request }: { request: QuoteRequest }) {
  const closed = request.status === 'Declined' || request.status === 'SlotUnavailable';
  const quoteSent = request.versions.length > 0;
  const accepted = request.status === 'Accepted' || request.status === 'DepositPending' || Boolean(request.booking);
  const steps = [
    { label: 'Request sent', complete: true },
    { label: 'Quotation received', complete: quoteSent },
    { label: 'Quote accepted', complete: accepted },
    { label: 'Booking created', complete: Boolean(request.booking) },
  ];
  return <div className="quote-progress mt-4 rounded-xl border border-home-line bg-home-canvas/60 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Quote to booking</p><ol className="mt-3 grid gap-3 sm:grid-cols-4">{steps.map((step, index) => <li key={step.label} className="flex items-center gap-2 text-sm"><span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${step.complete ? 'border-emerald-300 bg-emerald-300 text-home-canvas' : 'border-home-line text-emerald-300/70'}`}>{step.complete ? '✓' : index + 1}</span><span className={step.complete ? 'text-home-text' : 'text-emerald-300/70'}>{step.label}</span></li>)}</ol>{request.status === 'RevisionRequested' && <p role="status" className="mt-3 text-sm text-amber-200">The client requested changes. The provider can send a revised quotation.</p>}{request.status === 'DepositPending' && <p role="status" className="mt-3 text-sm text-amber-200">The client accepted the quote. Confirm the deposit to finish setting up the booking.</p>}{closed && !withdrawn(request) && <p role="status" className="mt-3 text-sm text-amber-200">{request.status === 'Declined' ? 'This quotation was declined.' : 'The requested appointment time is unavailable.'}</p>}</div>;
}
function WithdrawRequest({ request }: { request: QuoteRequest }) {
  const cache = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const withdraw = useMutation({ mutationFn: () => apiRequest(`/quotes/${encodeURIComponent(request.id)}/withdraw`, { method: 'POST' }), onSuccess: () => dialog.current?.close(), onSettled: () => Promise.all([cache.invalidateQueries({ queryKey: quoteKey }), cache.invalidateQueries({ queryKey: inboxKey })]) });
  return <div className="mt-4"><button type="button" className="btn-secondary disabled:opacity-50" disabled={withdraw.isPending} onClick={() => { withdraw.reset(); dialog.current?.showModal(); }}>Withdraw request</button>
    <dialog ref={dialog} className="withdraw-dialog" aria-labelledby={`withdraw-title-${request.id}`} aria-describedby={`withdraw-description-${request.id}`} onCancel={event => { if (withdraw.isPending) event.preventDefault(); }}>
      <div className="withdraw-dialog__top"><span className="withdraw-dialog__icon"><CircleHelp aria-hidden="true" /></span><button type="button" className="withdraw-dialog__close" aria-label="Close" disabled={withdraw.isPending} onClick={() => dialog.current?.close()}><X size={19} aria-hidden="true" /></button></div>
      <p className="withdraw-dialog__eyebrow">QUOTE REQUEST</p><h2 id={`withdraw-title-${request.id}`}>Withdraw this request?</h2><p id={`withdraw-description-${request.id}`} className="withdraw-dialog__description">The provider will be notified that you no longer need this quotation.</p>
      <div className="withdraw-dialog__service"><span>YOUR REQUEST</span><strong>{request.listing.title}</strong></div>
      {withdraw.isError && <p role="alert" className="withdraw-dialog__error">{withdraw.error.message}</p>}
      <div className="withdraw-dialog__actions"><button type="button" className="withdraw-dialog__keep" autoFocus disabled={withdraw.isPending} onClick={() => dialog.current?.close()}>Keep request</button><button type="button" className="withdraw-dialog__confirm" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>{withdraw.isPending ? 'Withdrawing…' : 'Withdraw request'}</button></div>
    </dialog></div>;
}
function QuoteDetails({ version, request, role, refresh, latest }: { version: QuoteVersion; request: QuoteRequest; role: 'client' | 'provider' | undefined; refresh: () => Promise<unknown>; latest: boolean }) {
  const pending = latest && request.status === 'DepositPending';
  const bankName = pending ? request.bankName : version.bankName;
  const accountNumber = pending ? request.accountNumber : version.accountNumber;
  const paymentReference = pending ? request.paymentReference : version.paymentReference;
  const bankAvailable = !!(bankName && accountNumber && paymentReference);
  return <div className="quote-summary">
    {version.serviceDescription && <p className="quote-summary__description">{version.serviceDescription}</p>}
    <div className="quote-summary__total"><span>Quotation total</span><strong>{formatRand(version.totalCents)}</strong></div>
    {version.depositRequired && version.depositCents != null ? <section className="quote-deposit" aria-label="Deposit required">
      <div className="quote-deposit__header"><span className="quote-deposit__icon"><WalletCards size={20} aria-hidden="true" /></span><div><span className="quote-deposit__label">25% DEPOSIT REQUIRED</span><strong>{formatRand(version.depositCents)}</strong></div>{pending && <span className="quote-deposit__status">Pending</span>}</div>
      <p>Remaining after deposit <b>{formatRand(version.totalCents - version.depositCents)}</b></p>
      {pending && <div className="quote-deposit__notice">{role === 'client' && <strong>Pay by immediate EFT using your banking app.</strong>}<span>The appointment is not guaranteed until the provider confirms the immediate EFT was received. Another client may secure it first.</span></div>}
      {bankAvailable ? <details className="quote-deposit__bank" open={pending}><summary>Payment details</summary><dl><div><dt>Bank</dt><dd>{bankName}</dd></div><div><dt>Account number</dt><dd>{accountNumber}</dd></div><div><dt>Payment reference</dt><dd>{paymentReference}</dd></div></dl></details> : pending && role === 'client' && <p>Waiting for the provider's payment details.</p>}
      {pending && role === 'provider' && <DepositActions request={request} refresh={refresh} />}
    </section> : <p className="quote-summary__no-deposit">✓ No deposit required</p>}
    <div className="quote-summary__appointments"><div><CalendarDays size={18} aria-hidden="true" /><span><small>Appointment</small><strong>{quoteTime(version.appointmentAt)}</strong></span></div><div><Clock3 size={18} aria-hidden="true" /><span><small>Estimated time</small><strong>{durationInHours(version.durationMinutes)}</strong></span></div></div>
    <p className="quote-summary__valid">Quote valid until {quoteTime(version.expiresAt)}</p>
    <details className="quote-summary__breakdown"><summary>View price breakdown</summary><dl><div><dt>Labour</dt><dd>{formatRand(version.labourCents)}</dd></div><div><dt>Materials</dt><dd>{formatRand(version.materialsCents)}</dd></div><div><dt>Travel</dt><dd>{formatRand(version.travelCents)}</dd></div></dl></details>
    {version.notes && <p className="quote-summary__notes">{version.notes}</p>}
  </div>;
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
  const send = useMutation({ mutationFn: (data: object) => apiRequest(`/quotes/${request.id}/response`, { method: 'POST', data }), onSuccess: refresh });
  const expired = new Date(request.versions[0].expiresAt).getTime() <= Date.now();
  if (expired) return <p className="mt-3 text-sm text-red-300">This quotation has expired.</p>;
  return <div className="mt-4 space-y-3"><p className="text-sm text-emerald-300">{request.versions[0].depositRequired ? 'After accepting, pay the deposit by immediate EFT. Your booking is confirmed once the provider confirms payment; until then, the time may be taken.' : 'Accept to confirm your booking, subject to availability.'}</p>
    <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={send.isPending} onClick={() => send.mutate({ action: 'accept' })}>Accept quotation</button>
    <button type="button" className="btn-secondary" disabled={send.isPending} onClick={() => send.mutate({ action: 'decline' })}>Decline</button></div>
    {send.isError && <p role="alert" className="text-red-300">{send.error.message}</p>}</div>;
}
function DepositActions({ request, refresh }: { request: QuoteRequest; refresh: () => Promise<unknown> }) {
  const [bankName, setBankName] = useState(request.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(request.accountNumber ?? '');
  const [paymentReference, setPaymentReference] = useState(request.paymentReference ?? '');
  const save = useMutation({ mutationFn: (data: object) => apiRequest(`/quotes/${request.id}/bank-details`, { method: 'POST', data }), onSuccess: refresh });
  const confirm = useMutation({ mutationFn: () => apiRequest(`/quotes/${request.id}/confirm-deposit`, { method: 'POST' }), onSuccess: refresh });
  const detailsAvailable = !!(request.bankName && request.accountNumber && request.paymentReference);
  return <div className="quote-deposit__actions space-y-3 text-sm">
      {!detailsAvailable && <form onSubmit={e => { e.preventDefault(); save.mutate({ bankName, accountNumber, paymentReference }); }} className="space-y-3">
        <label className="block">Bank name<input className={field} value={bankName} onChange={e => setBankName(e.target.value)} maxLength={100} required /></label>
        <label className="block">Account number<input className={field} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} inputMode="numeric" pattern="[0-9]{4,20}" maxLength={20} required /></label>
        <label className="block">Payment reference<input className={field} value={paymentReference} onChange={e => setPaymentReference(e.target.value)} maxLength={100} required /></label>
        <button className="btn-secondary disabled:opacity-50" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Send bank details'}</button>
      </form>}
      {save.isError && <p role="alert" className="text-red-300">{save.error.message}</p>}
      {detailsAvailable && <div><p className="mb-2">Confirm only after checking your bank account.</p><button type="button" className="btn-primary disabled:opacity-50" disabled={confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? 'Confirming…' : 'Confirm deposit received'}</button></div>}
      {confirm.isError && <p role="alert" className="text-red-300">{confirm.error.message}</p>}
  </div>;
}
export default function Quotes() {
  const { currentUser } = useAuth(); const role = currentUser?.profile?.role; const query = useQuery(quotes(currentUser?.id ?? '')); const client = useQueryClient();
  const [params] = useSearchParams(); const selected = params.get('request'); const location = useLocation();
  const viewed = query.data?.filter(request => !selected || request.id === selected) ?? [];
  useViewedUpdates(currentUser?.id ?? '', 'quotes', viewed.map(request => request.id), viewed.flatMap(request => request.booking ? [request.booking.id] : []), query.dataUpdatedAt);
  const refresh = () => client.invalidateQueries({ queryKey: quoteKey });
  return <main className="quotes-page min-h-screen px-5 py-12"><div className="quotes-shell mx-auto max-w-4xl"><div className="workspace-heading quotes-heading"><p>YOUR WORKSPACE / QUOTATIONS</p><h1>{role === 'provider' ? 'Quote requests' : 'My quotes'}</h1><span>{role === 'provider' ? 'Review requests and prepare thoughtful quotations.' : 'Follow your requests and review quotations from providers.'}</span></div>
    {location.state?.sent && <div role="status" className="quote-sent"><span><CheckCircle2 aria-hidden="true" /></span><div><strong>Request sent!</strong><p>Your quote request was sent to the provider.</p></div></div>}
    {selected && <Link to="/quotes" className="mt-3 inline-block text-sm text-emerald-300 underline">← All quotes</Link>}
    {query.isPending && <p className="mt-5">Loading quotes…</p>}{query.isError && <p role="alert" className="mt-5 text-red-300">{query.error.message}</p>}
    {query.data?.filter(request => !selected || request.id === selected).length === 0 && <p className="mt-5 text-emerald-300">{selected ? 'Quote request not found.' : 'No quote requests yet.'}</p>}
    <div className="mt-5 space-y-5">{query.data?.filter(request => !selected || request.id === selected).map(request => <HistoryCard key={request.id} collapsed={request.status === 'Accepted' || request.status === 'Declined'} title={request.listing.title} subtitle={role === 'provider' ? request.client.user.name || 'Client' : request.provider.businessName || 'Provider'} status={request.booking ? 'Booking created' : withdrawn(request) ? 'Request withdrawn' : statuses[request.status]} initiallyOpen={!!selected}><article className="quote-request-card quotation-card rounded-xl border border-home-line bg-home-surface p-6">
      <div className="quotation-card__title"><div><p className="quotation-card__eyebrow">QUOTATION REQUEST</p><h2>{request.listing.title}</h2></div>{request.status !== 'DepositPending' && <span className="quotation-card__status">{withdrawn(request) ? 'Request withdrawn' : statuses[request.status]}</span>}</div>
      <p className="mt-2 text-sm text-emerald-300">{role === 'provider' ? `Client: ${request.client.user.name || 'Client'}` : `Provider: ${request.provider.businessName || 'Provider'}`}</p>
      {role && role !== 'admin' && <div className="quote-contact"><PresenceStatus userId={role === 'provider' ? request.clientId : request.providerId} /><Link to={quoteMessagePath(request.id)} className="btn-secondary">Message {role === 'provider' ? 'client' : 'provider'}</Link></div>}
      <QuoteProgress request={request} />
      {role === 'client' && request.provider.verificationTier !== 'Basic' && <p className="mt-1 text-sm font-semibold text-emerald-300">{request.provider.verificationTier === 'IdentityVerified' ? '✓ Identity verified' : '✓ Business verified'}</p>}
      {role === 'provider' && request.client.verificationTier === 'IdentityVerified' && <p className="mt-1 text-sm font-semibold text-emerald-300">✓ Identity verified client</p>}
      {role === 'provider' && request.clientRating && <p className="mt-1 text-sm text-emerald-300">Client rating: {request.clientRating.reviewCount ? `${request.clientRating.averageRating?.toFixed(1)} out of 5 · ${request.clientRating.reviewCount} ${request.clientRating.reviewCount === 1 ? 'review' : 'reviews'}` : 'No ratings yet'}</p>}
      <p className="mt-3 whitespace-pre-wrap font-editorial text-xl text-white">{request.description}</p><p className="mt-2 text-sm text-emerald-300">Preferred: {quoteTime(request.preferredAt)} · Location: {request.location}</p>
      {request.additionalInfo && <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-300">Additional information: {request.additionalInfo}</p>}
      {request.photos.length > 0 && <div className="quote-photos">{request.photos.map((photo, index) => <a key={photo.id} href={`/api/quotes/${request.id}/photos/${photo.id}`} target="_blank" rel="noreferrer" className="quote-photo"><img src={`/api/quotes/${request.id}/photos/${photo.id}`} alt={photo.isListingReference ? 'Listing photo chosen as reference' : `Client photo ${index + 1}`} /><span><Image size={14} aria-hidden="true" />{photo.isListingReference ? 'Listing reference' : 'Client photo'}<ArrowUpRight size={14} aria-hidden="true" /></span></a>)}</div>}
      {request.changeRequest && <p className="mt-3 whitespace-pre-wrap text-sm text-emerald-300">Requested changes: {request.changeRequest}</p>}
      {request.versions.map((version, index) => <details key={version.id} open={index === 0} className="mt-4 border-t border-home-line pt-4"><summary className="cursor-pointer font-editorial text-xl text-white">Quotation {version.version}{index === 0 ? ' · Latest' : ''}</summary><div className="mt-3"><QuoteDetails version={version} request={request} role={role === 'client' || role === 'provider' ? role : undefined} refresh={refresh} latest={index === 0} /></div></details>)}
      {role === 'provider' && (request.status === 'Pending' || request.status === 'RevisionRequested') && <OfferForm request={request} refresh={refresh} />}
      {role === 'client' && request.status === 'Pending' && request.versions.length === 0 && <WithdrawRequest request={request} />}
      {role === 'client' && request.status === 'Quoted' && request.versions[0] && <ResponseForm request={request} refresh={refresh} />}
      {request.status === 'SlotUnavailable' && <p className="mt-4 text-sm text-red-300">This appointment is no longer available. Please contact the other party about a new time or any payment made.</p>}
      {request.status === 'Accepted' && <div className="quote-booked"><span><CheckCircle2 size={18} aria-hidden="true" /> Quotation accepted</span>{request.booking ? <Link className="dashboard-view-link" to={`/bookings?booking=${encodeURIComponent(request.booking.id)}`}>View booking <ArrowUpRight size={15} aria-hidden="true" /></Link> : <p>This quote was accepted before booking creation was enabled.</p>}</div>}
    </article></HistoryCard>)}</div>
  </div></main>;
}
