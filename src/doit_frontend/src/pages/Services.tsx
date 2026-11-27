import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ServiceListingCard from '../components/ServiceListingCard';
import { useAuth } from '../contexts/AppContext';
import { ServiceCategoryEnum } from '../types';
import { catalogListings } from '../utils/serviceListings';
import { categoryLabel } from '../utils/serviceUtils';

const filterClass = 'discovery-filter__input';

export default function Services() {
  const { currentUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data, isPending, isError, error, refetch } = useQuery(catalogListings(params));
  const page = Number(params.get('page') ?? 1);
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const filters = new URLSearchParams();
    for (const name of ['search', 'category', 'location', 'sort']) {
      const value = String(fields.get(name) ?? '').trim();
      if (value && !(name === 'sort' && value === 'newest')) filters.set(name, value);
    }
    setParams(filters);
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
  }

  return <main className="discovery-page"><div className="discovery-shell">
    <div className="discovery-intro"><div><Link to="/" className="discovery-back">← Back home</Link><p className="discovery-kicker">THE SERVICE DIRECTORY / EXPLORE</p><h1>Find your <em>kind of help.</em></h1><p>Discover skilled people and services in your neighbourhood.</p></div><div className="discovery-intro__stamp" aria-hidden="true"><MapPin /><span>LOCAL<br />CONNECTIONS</span></div></div>
    <div className="discovery-layout"><aside className="discovery-filters"><div className="discovery-filter__heading"><span><SlidersHorizontal aria-hidden="true" /> REFINE YOUR SEARCH</span>{params.size > 0 && <button type="button" onClick={() => setParams({})}>Clear all</button>}</div>
      <form key={params.toString()} onSubmit={search} className="discovery-filter"><label>What are you looking for?<input name="search" type="search" maxLength={120} defaultValue={params.get('search') ?? ''} placeholder="Service or provider" className={filterClass} /></label><label>Category<select name="category" defaultValue={params.get('category') ?? ''} className={filterClass}><option value="">All categories</option>{Object.values(ServiceCategoryEnum).map(category => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select></label><label>Location<input name="location" maxLength={150} defaultValue={params.get('location') ?? ''} placeholder="City or town" className={filterClass} /></label><label>Sort results<select name="sort" defaultValue={params.get('sort') ?? 'newest'} className={filterClass}><option value="newest">Newest first</option><option value="price_asc">Lowest starting price</option><option value="price_desc">Highest starting price</option><option value="rating">Most reviewed</option><option value="verified">Verified providers first</option></select></label><p className="-mt-3 text-xs text-emerald-300/70">Starting prices may use different units, such as per hour or per project.</p><button type="submit" className="discovery-filter__button"><Search aria-hidden="true" /> Find services <ArrowRight aria-hidden="true" /></button></form>
      <div className="discovery-filter__note"><span>01 / FIND</span><p>Good work starts with the right connection.</p><span>LOCAL SERVICES, MADE SIMPLE</span></div>
    </aside><section className="discovery-results"><div className="discovery-results__head"><div><p className="discovery-kicker">BROWSE SERVICES</p><h2>Explore the directory</h2></div><div>{data && <span role="status">{data.total} {data.total === 1 ? 'SERVICE' : 'SERVICES'} FOUND</span>}{currentUser?.profile?.role === 'provider' && <Link to="/provider-dashboard/listings">Manage listings ↗</Link>}</div></div>
      {isPending && <p role="status" className="discovery-empty">Loading services…</p>}{isError && <div role="alert" className="discovery-empty"><p>{error.message}</p><button type="button" onClick={() => refetch()}>Try again</button></div>}
      {!isError && data && <>{data.listings.length === 0 && <p className="discovery-empty">{data.total > 0 ? 'There are no services on this page.' : params.size > 0 ? 'No services match your search. Try clearing the filters.' : 'No services have been published yet.'}</p>}<div className="discovery-results__grid">{data.listings.map(listing => <ServiceListingCard key={listing.id} listing={listing} bookable={currentUser?.profile?.role !== 'provider' && currentUser?.profile?.role !== 'admin'} />)}</div>{(page > 1 || page < totalPages) && <nav aria-label="Search result pages" className="mt-6 flex flex-wrap items-center gap-3">{page > 1 && <button className="btn-secondary" onClick={() => changePage(Math.min(page - 1, totalPages || 1))}>Previous</button>}{page <= totalPages && <span className="text-sm text-emerald-300">Page {page} of {totalPages}</span>}{page < totalPages && <button className="btn-secondary" onClick={() => changePage(page + 1)}>Next</button>}</nav>}</>}
    </section></div>
  </div></main>;
}
