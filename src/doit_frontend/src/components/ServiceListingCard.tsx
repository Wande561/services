import { ArrowUpRight, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import FavoriteButton from './FavoriteButton';
import PresenceStatus from './PresenceStatus';
import { useAuth } from '../contexts/AppContext';
import type { ServiceListing } from '../types';
import { bookingPath } from '../utils/accountRoutes';
import { reviewsPath } from '../utils/reviews';
import { formatListingPrice } from '../utils/serviceListings';
import { categoryLabel } from '../utils/serviceUtils';

export default function ServiceListingCard({ listing, bookable = false, appearance = 'default', children }: {
  listing: ServiceListing; bookable?: boolean; appearance?: 'default' | 'home'; children?: ReactNode;
}) {
  const { currentUser } = useAuth();
  if (currentUser?.profile?.role === 'client' && listing.providerId === currentUser.id) return null;
  const href = `/services/${encodeURIComponent(listing.id)}`;
  const image = listing.photos?.[0];
  const photoUrl = image ? `/api/services/photos/${encodeURIComponent(image.id)}` : '';
  const cover = image ? <><img className="listing-card__backdrop" src={photoUrl} alt="" aria-hidden="true" loading="lazy" /><img className="listing-card__image" src={photoUrl} alt={`${listing.title} service`} loading="lazy" /></> : <span className="listing-card__placeholder"><Sparkles aria-hidden="true" /><span>ServiceConnect</span><small>LOCAL SERVICES, CONNECTED</small></span>;
  return <article className={`listing-card listing-card--${appearance}`}>
    {listing.isPublished ? <Link to={href} className="listing-card__cover" aria-label={`View ${listing.title}`}>{cover}{listing.photos?.length > 1 && <span className="listing-card__photos">+ {listing.photos.length - 1} photos</span>}</Link> : <div className="listing-card__cover">{cover}</div>}
    <div className="listing-card__body"><div className="listing-card__meta"><span>{categoryLabel(listing.category)}</span><span><MapPin aria-hidden="true" />{listing.location}</span></div>
      <div className="listing-card__title-row"><h3>{listing.isPublished ? <Link to={href}>{listing.title}</Link> : listing.title}</h3>{listing.isPublished && <Link to={href} aria-label={`View ${listing.title}`} className="listing-card__arrow"><ArrowUpRight aria-hidden="true" /></Link>}</div>
      <p className="listing-card__provider">by {listing.isPublished ? <Link to={`/providers/${encodeURIComponent(listing.providerId)}`}>{listing.providerName}</Link> : listing.providerName}</p>
      {listing.isPublished && <PresenceStatus userId={listing.providerId} />}
      {listing.verificationTier && listing.verificationTier !== 'Basic' && <span className="listing-card__verified"><ShieldCheck aria-hidden="true" />{listing.verificationTier === 'IdentityVerified' ? 'Identity verified' : 'Business verified'}</span>}
      {listing.averageRating != null && <p className="mt-2 text-sm text-emerald-300">★ {listing.averageRating.toFixed(1)} <span className="text-emerald-300/70">average rating · {listing.reviewCount} {listing.reviewCount === 1 ? 'review' : 'reviews'}</span></p>}
      {listing.isPublished && listing.averageRating == null && <p className="mt-2 text-sm text-emerald-300/70">New provider · no reviews yet</p>}
      {listing.description && <p className="listing-card__description">{listing.description}</p>}
      <div className="listing-card__price"><span>STARTING FROM</span><strong>{formatListingPrice(listing)}</strong></div>
      {(bookable || listing.isPublished) && <div className="listing-card__actions">{bookable && <Link to={bookingPath(listing.id)} className="listing-card__quote">Request a quote <ArrowUpRight aria-hidden="true" /></Link>}{listing.isPublished && <Link to={reviewsPath(listing.id)} className="listing-card__reviews">{listing.reviewCount ? `${listing.reviewCount} ${listing.reviewCount === 1 ? 'review' : 'reviews'}` : 'Reviews'}</Link>}</div>}
      {listing.isPublished && <div className="listing-card__favorite"><FavoriteButton kind="listings" id={listing.id} /></div>}
      {children && <div className="listing-card__manage">{children}</div>}
    </div>
  </article>;
}
