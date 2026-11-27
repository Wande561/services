import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import FavoriteButton from '../components/FavoriteButton';
import PresenceStatus from '../components/PresenceStatus';
import ServiceListingCard from '../components/ServiceListingCard';
import { useAuth } from '../contexts/AppContext';
import { days, providerProfile } from '../utils/providers';
import { categoryLabel } from '../utils/serviceUtils';

export default function ProviderProfile() {
  const { providerId = '' } = useParams(); const query = useQuery(providerProfile(providerId)); const { currentUser, isLoading } = useAuth(); const hidden = currentUser?.profile?.role === 'client' && currentUser.id === providerId; const profile = !isLoading && !hidden ? query.data : undefined;
  return <main className="provider-profile min-h-screen px-5 py-12"><div className="mx-auto max-w-6xl"><Link to="/services" className="text-sm text-emerald-300 underline">← Services</Link>
    {query.isPending && <p className="mt-5">Loading provider profile…</p>}{query.isError && <p role="alert" className="mt-5 text-red-300">{query.error.message}</p>}
    {hidden && <p className="mt-5 text-emerald-300">Provider not found.</p>}
    {profile && <><header className="provider-profile__hero mt-5 rounded-2xl border border-home-line bg-home-surface p-7"><p className="text-sm uppercase tracking-widest text-emerald-300">Service provider</p><h1 className="mt-2 text-4xl">{profile.name}</h1><PresenceStatus userId={profile.id} /><p className="mt-2 text-home-text">{profile.location}</p>{profile.verificationTier !== 'Basic' && <p className="mt-2 font-semibold text-emerald-300">✓ {profile.verificationTier === 'BusinessVerified' ? 'Business verified' : 'Identity verified'}</p>}<p className="mt-2 text-emerald-300">{profile.reviewCount ? `${profile.averageRating?.toFixed(1)} out of 5 · ${profile.reviewCount} ${profile.reviewCount === 1 ? 'review' : 'reviews'}` : 'No ratings yet'}</p><p className="mt-3 text-sm text-emerald-300">{profile.serviceCategories.map(category => category === 'Other' && profile.otherService ? profile.otherService : categoryLabel(category)).join(' · ')}</p><div className="mt-4"><FavoriteButton kind="providers" id={profile.id} /></div></header>
      <section className="provider-profile__hours mt-6 rounded-2xl border border-home-line bg-home-surface p-6"><h2 className="text-2xl">Working hours</h2><p className="mt-1 text-sm text-emerald-300">South African time · appointments are agreed with the provider</p>{profile.workingHours ? <dl className="mt-4 grid gap-2 sm:grid-cols-2">{profile.workingHours.map(row => <div key={row.day} className="flex justify-between gap-4 text-sm"><dt>{days[row.day]}</dt><dd className="text-home-text">{row.closed ? 'Closed' : `${row.open} – ${row.close}`}</dd></div>)}</dl> : <p className="mt-3 text-sm text-emerald-300">Working hours have not been added yet.</p>}</section>
      <section className="mt-8"><h2 className="text-3xl">Services</h2><p className="mt-2 text-sm text-emerald-300">Choose a service to request a quote.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{profile.listings.map(listing => <ServiceListingCard key={listing.id} listing={listing} bookable={currentUser?.profile?.role !== 'provider' && currentUser?.profile?.role !== 'admin'} />)}</div></section></>}
  </div></main>;
}
