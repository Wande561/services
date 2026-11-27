import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { bookingListing } from '../utils/bookings';
import PresenceStatus from '../components/PresenceStatus';
import { useAuth } from '../contexts/AppContext';
import { apiRequest } from '../utils/apiRequest';
import { quoteKey, sastTime, parsePreferredTime } from '../utils/quotes';

const field = 'mt-1 w-full rounded-lg border border-home-control bg-home-canvas p-3 text-white';
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read a photo')); reader.readAsDataURL(file); });
}
export default function QuoteRequestPage() {
  const [params] = useSearchParams(); const listingId = params.get('service') ?? '';
  const { currentUser } = useAuth();
  const listing = useQuery(bookingListing(listingId)); const navigate = useNavigate(); const client = useQueryClient();
  const [referencePhotoId, setReferencePhotoId] = useState(params.get('photo') ?? '');
  const [files, setFiles] = useState<File[]>([]); const [error, setError] = useState('');
  const send = useMutation({ mutationFn: (data: object) => apiRequest('/quotes', { method: 'POST', data }), onSuccess: async () => { await client.invalidateQueries({ queryKey: quoteKey }); navigate('/quotes', { state: { sent: true } }); } });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const data = new FormData(event.currentTarget);
    const preferredTime = parsePreferredTime(String(data.get('preferredTime') ?? ''));
    if (!preferredTime) { setError('Enter a valid preferred time, such as 09:30 or 2:30 PM.'); return; }
    if (files.length > 3 || files.some(file => file.size > 1048576 || !['image/jpeg','image/png','image/webp'].includes(file.type))) { setError('Choose up to three JPEG, PNG or WebP photos, each at most 1 MB.'); return; }
    try { const images = await Promise.all(files.map(readPhoto)); await send.mutateAsync({ listingId, description: data.get('description'), preferredAt: sastTime(`${String(data.get('preferredDate'))}T${preferredTime}`), location: data.get('location'), additionalInfo: data.get('additionalInfo'), referencePhotoId: referencePhotoId || null, photos: images }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not send your request.'); }
  }
  return <main className="request-page"><div className="request-shell"><div className="request-intro"><Link to="/services" className="discovery-back">← Back to services</Link><p className="discovery-kicker">LET'S GET STARTED / 01</p><h1>Tell us what<br /><em>you have in mind.</em></h1><p>Share a few details and the provider can put together a quotation for you.</p><div className="request-intro__note"><span>HOW IT WORKS</span><p>01 &nbsp; Send your request</p><p>02 &nbsp; Review your quotation</p><p>03 &nbsp; Agree on your appointment</p></div></div><div className="request-content">
    {!listingId ? <p className="mt-5 text-emerald-300">Choose a service first.</p> : listing.isPending ? <p className="mt-5">Loading service…</p> : listing.isError ? <p role="alert" className="mt-5 text-red-300">{listing.error.message}</p> : listing.data.providerId === currentUser?.id ? <p className="mt-5 text-emerald-300">Service not found.</p> : <form onSubmit={submit} className="request-form"><div className="request-form__head"><p className="discovery-kicker">THE DETAILS</p><h2>Request a quote</h2><p>Tell your provider what you need.</p></div>
      <p className="text-emerald-300">Service: <strong className="text-home-text">{listing.data.title}</strong> · {listing.data.providerName}</p>
      <PresenceStatus userId={listing.data.providerId} />
      {listing.data.verificationTier !== 'Basic' && <p className="text-sm font-semibold text-emerald-300">✓ {listing.data.verificationTier === 'BusinessVerified' ? 'Business verified' : 'Identity verified'} provider</p>}
      {listing.data.photos.length > 0 && <fieldset><legend className="font-semibold text-home-text">Use a listing photo as a reference? (optional)</legend><p className="mt-1 text-sm text-emerald-300">Choose a photo or continue without one. You can also upload your own photos below.</p><label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" name="referencePhoto" checked={!referencePhotoId} onChange={() => setReferencePhotoId('')} /> No listing photo</label><div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">{listing.data.photos.map((photo, index) => <label key={photo.id} className={`cursor-pointer rounded-lg border-2 p-1 ${referencePhotoId === photo.id ? 'border-emerald-300' : 'border-transparent'}`}><input type="radio" className="sr-only" name="referencePhoto" value={photo.id} checked={referencePhotoId === photo.id} onChange={() => setReferencePhotoId(photo.id)} /><img src={`/api/services/photos/${encodeURIComponent(photo.id)}`} alt={`Listing photo ${index + 1}`} className="aspect-square w-full rounded object-cover" /><span className="block py-1 text-center text-xs text-emerald-300">Photo {index + 1}{referencePhotoId === photo.id ? ' ✓' : ''}</span></label>)}</div></fieldset>}
      {referencePhotoId && !listing.data.photos.some(photo => photo.id === referencePhotoId) && <p role="alert" className="text-sm text-red-300">The selected photo is no longer available. Choose another photo or select no listing photo.</p>}
      <label className="block">Describe what you need<textarea className={field} name="description" required maxLength={2000} rows={4} /></label>
      <label className="block">Preferred date<input className={field} name="preferredDate" type="date" required /></label>
      <label className="block">Preferred appointment time (South African time)<input className={field} name="preferredTime" type="text" placeholder="e.g. 09:30 or 2:30 PM" aria-describedby="preferred-time-help" maxLength={10} required /></label>
      <p id="preferred-time-help" className="text-sm text-emerald-300">Type a time in 12-hour or 24-hour format.</p>
      <label className="block">Service location<input className={field} name="location" required maxLength={300} /></label>
      <label className="block">Your own photos (optional; up to 3, 1 MB each)<input className={field} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files ?? []))} /></label>
      <label className="block">Additional information (optional)<textarea className={field} name="additionalInfo" maxLength={1000} rows={3} /></label>
      <p className="text-sm text-emerald-300">This sends a quote request. It does not create or confirm a booking.</p>
      {error && <p role="alert" className="text-red-300">{error}</p>}<button className="btn-primary disabled:opacity-50" disabled={send.isPending}>{send.isPending ? 'Sending…' : 'Send quote request'}</button>
    </form>}
  </div></div></main>;
}
