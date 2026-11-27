import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Image as ImageIcon, MapPin, Sparkles } from 'lucide-react';
import FavoriteButton from '../components/FavoriteButton';
import PresenceStatus from '../components/PresenceStatus';
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
  const { currentUser, isLoading: accountLoading } = useAuth();
  const cache = useQueryClient();
  const listing = useQuery(bookingListing(listingId));
  const [selected, setSelected] = useState(0);
  const service = !accountLoading && !(currentUser?.profile?.role === 'client' && listing.data?.providerId === currentUser.id) ? listing.data : undefined;
  const photos = service?.photos ?? [];
  const selectedIndex = Math.min(selected, Math.max(photos.length - 1, 0));
  useEffect(() => { if (currentUser?.profile?.role === 'client' && listing.isSuccess && listingId) { void apiRequest(`/client/discovery/views/${encodeURIComponent(listingId)}`, { method: 'POST' }).then(() => cache.invalidateQueries({ queryKey: discoveryKey })).catch(() => {}); } }, [currentUser?.id, currentUser?.profile?.role, listing.isSuccess, listingId, cache]);
  const imageUrl = (id: string) => `/api/services/photos/${encodeURIComponent(id)}`;
  return <main className="listing-detail min-h-screen bg-home-canvas"><div className="listing-detail__shell">
    <Link to="/services" className="listing-detail__back"><ArrowLeft aria-hidden="true" /> All services</Link>
    {listing.isPending && <p role="status" className="mt-6">Loading listing…</p>}
    {listing.isError && <p role="alert" className="mt-6 text-red-300">{listing.error.message}</p>}
    {!accountLoading && listing.data && !service && <p className="mt-6 text-emerald-300">Service not found.</p>}
    {service && <article className="listing-detail__layout">
      <section aria-label="Listing photos" className="listing-detail__gallery">
        {photos.length ? <>
          <div className="listing-detail__photo">
            <img src={imageUrl(photos[selectedIndex].id)} alt={`${service.title}, photo ${selectedIndex + 1} of ${photos.length}`} />
            {photos.length > 1 && <><span className="listing-detail__count" aria-live="polite">{selectedIndex + 1} / {photos.length}</span><div className="listing-detail__arrows"><button type="button" aria-label="Previous photo" disabled={selectedIndex === 0} onClick={() => setSelected(selectedIndex - 1)}><ChevronLeft /></button><button type="button" aria-label="Next photo" disabled={selectedIndex === photos.length - 1} onClick={() => setSelected(selectedIndex + 1)}><ChevronRight /></button></div></>}
          </div>
          {photos.length > 1 && <div className="listing-detail__thumbnails" aria-label="Choose a photo">{photos.map((photo, index) => <button key={photo.id} type="button" onClick={() => setSelected(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={index === selectedIndex}><img src={imageUrl(photo.id)} alt="" loading="lazy" /></button>)}</div>}
          {currentUser?.profile?.role !== 'provider' && currentUser?.profile?.role !== 'admin' && <Link to={bookingPath(service.id, photos[selectedIndex].id)} className="listing-detail__photo-link">Request a quote for this photo <ArrowRight aria-hidden="true" /></Link>}
        </> : <div className="listing-detail__empty"><ImageIcon aria-hidden="true" /><span>No photos yet</span></div>}
      </section>
      <div className="listing-detail__info">
        <div className="listing-detail__tags"><span>{categoryLabel(service.category)}</span><span><MapPin aria-hidden="true" /> {service.location}</span></div>
        <h1>{service.title}</h1>
        <div className="listing-detail__provider"><div className="listing-detail__provider-icon"><Sparkles aria-hidden="true" /></div><div><span>PROVIDED BY</span><Link to={`/providers/${encodeURIComponent(service.providerId)}`}>{service.providerName} <ArrowRight aria-hidden="true" /></Link><PresenceStatus userId={service.providerId} /></div></div>
        {service.verificationTier !== 'Basic' && <p className="listing-detail__verified">✓ {service.verificationTier === 'BusinessVerified' ? 'Business verified' : 'Identity verified'} provider</p>}
        {service.description && <div className="listing-detail__description"><h2>About this service</h2><p>{service.description}</p></div>}
        <div className="listing-detail__price"><span>ESTIMATED PRICE</span><strong>{formatListingPrice(service)}</strong></div>
        <div className="listing-detail__actions">{currentUser?.profile?.role !== 'provider' && currentUser?.profile?.role !== 'admin' && <Link className="listing-detail__primary" to={bookingPath(service.id)}>Request a quote <ArrowRight aria-hidden="true" /></Link>}<Link className="listing-detail__reviews" to={reviewsPath(service.id)}>View reviews <ArrowRight aria-hidden="true" /></Link></div>
        <div className="listing-detail__favorite"><FavoriteButton kind="listings" id={service.id} /></div>
      </div>
    </article>}
  </div></main>;
}
