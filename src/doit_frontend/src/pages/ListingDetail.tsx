import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import FavoriteButton from '../components/FavoriteButton';
import { apiRequest } from '../utils/apiRequest';
import { discoveryKey } from '../utils/discovery';
import { useAuth } from '../contexts/AppContext';
import { bookingPath } from '../utils/accountRoutes';
import { bookingListing } from '../utils/bookings';
import { formatListingPrice } from '../utils/serviceListings';
import { categoryLabel } from '../utils/serviceUtils';
import { reviewsPath } from '../utils/reviews';

export default function ListingDetail() {
  const { listingId = '' } = useParams();
  const { currentUser } = useAuth();
  const cache = useQueryClient();
  const listing = useQuery(bookingListing(listingId));
  const [selected, setSelected] = useState(0);
  const service = listing.data;
  const photos = service?.photos ?? [];
  const selectedIndex = Math.min(selected, Math.max(photos.length - 1, 0));
  useEffect(() => { if (currentUser?.profile?.role === 'client' && listing.isSuccess && listingId) { void apiRequest(`/client/discovery/views/${encodeURIComponent(listingId)}`, { method: 'POST' }).then(() => cache.invalidateQueries({ queryKey: discoveryKey })).catch(() => {}); } }, [currentUser?.id, currentUser?.profile?.role, listing.isSuccess, listingId, cache]);
  const imageUrl = (id: string) => `/api/services/photos/${encodeURIComponent(id)}`;
  return <main className="listing-detail min-h-screen bg-home-canvas px-4 py-10 sm:px-6"><div className="mx-auto max-w-5xl">
    <Link to="/services" className="text-sm text-emerald-300 hover:underline">← All services</Link>
    {listing.isPending && <p role="status" className="mt-6">Loading listing…</p>}
    {listing.isError && <p role="alert" className="mt-6 text-red-300">{listing.error.message}</p>}
    {service && <article className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section aria-label="Listing photos" className="listing-detail__gallery min-w-0">
        {photos.length ? <>
          <img src={imageUrl(photos[selectedIndex].id)} alt={`${service.title}, photo ${selectedIndex + 1} of ${photos.length}`} className="aspect-[4/3] w-full rounded-2xl bg-home-surface object-contain" />
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-emerald-300"><button className="btn-secondary disabled:opacity-40" type="button" disabled={selectedIndex === 0} onClick={() => setSelected(selectedIndex - 1)}>Previous</button><span aria-live="polite">Photo {selectedIndex + 1} of {photos.length}</span><button className="btn-secondary disabled:opacity-40" type="button" disabled={selectedIndex === photos.length - 1} onClick={() => setSelected(selectedIndex + 1)}>Next</button></div>
          {currentUser?.profile?.role !== 'provider' && currentUser?.profile?.role !== 'admin' && <Link to={bookingPath(service.id, photos[selectedIndex].id)} className="btn-secondary mt-4 inline-flex">Request a quote for this photo</Link>}
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">{photos.map((photo, index) => <button key={photo.id} type="button" onClick={() => setSelected(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={index === selectedIndex} className={`overflow-hidden rounded-lg border-2 ${index === selectedIndex ? 'border-emerald-300' : 'border-transparent'}`}><img src={imageUrl(photo.id)} alt="" className="aspect-square w-full object-cover" loading="lazy" /></button>)}</div>
        </> : <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-home-line bg-home-surface text-sm text-emerald-300">No listing photos yet</div>}
      </section>
      <div className="listing-detail__info rounded-2xl border border-home-line bg-home-surface p-6 sm:p-8">
        <p className="text-sm font-semibold text-emerald-300">{categoryLabel(service.category)} · {service.location}</p>
        <h1 className="mt-3 break-words text-4xl">{service.title}</h1>
        <p className="mt-3 text-home-text"><Link className="underline hover:text-emerald-300" to={`/providers/${encodeURIComponent(service.providerId)}`}>{service.providerName}</Link></p>
        {service.verificationTier !== 'Basic' && <p className="mt-2 text-sm font-semibold text-emerald-300">✓ {service.verificationTier === 'BusinessVerified' ? 'Business verified' : 'Identity verified'} provider</p>}
        {service.description && <p className="mt-5 whitespace-pre-line text-home-text">{service.description}</p>}
        <div className="mt-4"><FavoriteButton kind="listings" id={service.id} /></div>
        <p className="mt-6 text-xl font-semibold text-home-text">{formatListingPrice(service)}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">{currentUser?.profile?.role !== 'provider' && currentUser?.profile?.role !== 'admin' && <Link className="btn-primary" to={bookingPath(service.id)}>Request a quote</Link>}<Link className="text-sm text-emerald-300 underline" to={reviewsPath(service.id)}>View reviews</Link></div>
      </div>
    </article>}
  </div></main>;
}
