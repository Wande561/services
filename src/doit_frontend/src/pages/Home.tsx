import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, GraduationCap, Leaf, Scissors, Sparkles, Wrench, Zap } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ServiceListingCard from '../components/ServiceListingCard';
import { useAuth } from '../contexts/AppContext';
import { ServiceCategoryEnum } from '../types';
import { accountDestination, accountHome } from '../utils/accountRoutes';
import { catalogListings } from '../utils/serviceListings';
import { categoryLabel } from '../utils/serviceUtils';

const categories = [
  { category: ServiceCategoryEnum.Plumbing, icon: Wrench, accent: 'text-sky-300', iconBackground: 'bg-sky-300/10' },
  { category: ServiceCategoryEnum.HouseCleaning, icon: Sparkles, accent: 'text-teal-300', iconBackground: 'bg-teal-300/10' },
  { category: ServiceCategoryEnum.Electrical, icon: Zap, accent: 'text-amber-300', iconBackground: 'bg-amber-300/10' },
  { category: ServiceCategoryEnum.Gardening, icon: Leaf, accent: 'text-lime-300', iconBackground: 'bg-lime-300/10' },
  { category: ServiceCategoryEnum.HairStyling, icon: Scissors, accent: 'text-pink-300', iconBackground: 'bg-pink-300/10' },
  { category: ServiceCategoryEnum.Tutoring, icon: GraduationCap, accent: 'text-violet-200', iconBackground: 'bg-violet-200/10' },
];

const pageWidth = 'mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12';
const outlineButton = 'min-h-10 items-center justify-center gap-2 rounded-lg border border-home-control px-4 text-sm font-semibold text-emerald-300 transition-colors hover:bg-home-raised hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-accent';

interface HomeProps {
  onClientLogin?: () => void;
  onProviderLogin?: () => void;
}

export default function Home({ onClientLogin, onProviderLogin }: HomeProps) {
  const navigate = useNavigate();
  const { currentUser, isLoading } = useAuth();
  const catalog = useQuery({ ...catalogListings(), enabled: !isLoading && !currentUser });
  const [pendingQuote] = useState(() => sessionStorage.getItem('pendingQuote'));
  useEffect(() => { if (currentUser && pendingQuote) sessionStorage.removeItem('pendingQuote'); }, [currentUser, pendingQuote]);

  if (currentUser) {
    return <Navigate to={currentUser.isVerificationAdmin && currentUser.profile ? '/admin' : pendingQuote ? accountDestination(currentUser.profile?.role, new URLSearchParams(pendingQuote)) : accountHome(currentUser.profile?.role)} replace />;
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get('search') ?? '').trim();
    navigate(term ? `/services?${new URLSearchParams({ search: term })}` : '/services');
  }

  const joinAsClient = onClientLogin ?? (() => navigate('/client-login'));
  const joinAsProvider = onProviderLogin ?? (() => navigate('/provider-login'));

  return (
    <div className="min-h-screen bg-home-canvas font-home text-home-text [color-scheme:dark]">
      <main className={pageWidth}>
        <section aria-labelledby="home-heading" className="home-hero">
          <div className="home-hero__copy"><p className="home-hero__eyebrow"><span /> THE LOCAL SERVICE MARKETPLACE</p><h1 id="home-heading"><span>Good help,</span><em>close to home.</em></h1><p className="home-hero__description">Find local professionals for repairs, cleaning, and everyday jobs. Compare services, request a quote, and book with confidence.</p>
            <form onSubmit={search} role="search" className="home-hero__search"><label><span className="sr-only">Search services or providers</span><input name="search" type="search" maxLength={120} placeholder="What can we help you find?" /></label><button type="submit">Search <ArrowRight aria-hidden="true" /></button></form><Link to="/services" className="home-hero__browse">Explore all services <ArrowUpRight aria-hidden="true" /></Link>
          </div>
          <div className="home-hero__visual" aria-hidden="true"><div className="home-hero__orbit home-hero__orbit--outer" /><div className="home-hero__orbit home-hero__orbit--inner" /><div className="home-hero__seal"><Sparkles /><span>GOOD PEOPLE.<br />GOOD WORK.</span></div><div className="home-hero__note"><span>MADE FOR YOUR NEIGHBOURHOOD</span><strong>Find the right<br /><em>people for the job.</em></strong><span>01 / CONNECT LOCALLY</span></div></div>
        </section>

        <section aria-labelledby="category-heading" className="home-categories border-t border-home-line/80 pb-12 pt-8 sm:pb-14 sm:pt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <h2 id="category-heading" className="font-editorial text-[2.5rem] leading-none sm:text-5xl">Browse by category</h2>
            <Link to="/services" className="home-link inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-300">
              All categories <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
            {categories.map(({ category, icon: Icon, accent, iconBackground }) => (
              <Link
                key={category}
                to={`/services?${new URLSearchParams({ category })}`}
                className={`group flex min-h-[108px] flex-col justify-between gap-3 rounded-2xl border border-home-line bg-home-surface p-3.5 transition-colors hover:border-home-control hover:bg-home-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-home-accent sm:p-4 ${accent}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconBackground}`}>
                    <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </span>
                  <ArrowUpRight aria-hidden="true" className="mt-1 h-4 w-4 opacity-75 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="text-sm font-semibold text-emerald-300">{categoryLabel(category)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="listings-heading" className="home-listings pb-12 sm:pb-16">
          <h2 id="listings-heading" className="mb-5 font-editorial text-[2.5rem] leading-none sm:text-5xl">Recently listed</h2>
          {catalog.isPending && <p role="status" className="text-sm text-emerald-300">Loading services…</p>}
          {catalog.isError && <p role="alert" className="text-sm text-emerald-300">Could not load the latest services.</p>}
          {catalog.data?.listings.length === 0 && (
            <p className="rounded-2xl border border-home-line bg-home-surface p-5 text-sm text-emerald-300">
              No services have been published yet.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.data?.listings.slice(0, 6).map(listing => (
              <ServiceListingCard key={listing.id} listing={listing} appearance="home" bookable />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-home-line bg-home-surface">
        <div className={`${pageWidth} flex flex-wrap items-center justify-between gap-4 py-8 sm:py-10`}>
          <h2 className="font-editorial text-4xl leading-none sm:text-[2.75rem]">Join ServiceConnect</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={joinAsClient} className="btn-home min-h-10 bg-white text-green-700 hover:bg-gray-100">Join as a client</button>
            <button type="button" onClick={joinAsProvider} className={`inline-flex ${outlineButton}`}>
              Become a provider <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
