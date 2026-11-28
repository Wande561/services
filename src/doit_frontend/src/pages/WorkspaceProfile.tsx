import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BadgeCheck, MapPin, ShieldCheck, Star, Users } from 'lucide-react';
import ServiceListingCard from '../components/ServiceListingCard';
import { useAuth } from '../contexts/AppContext';
import { publicWorkspace } from '../utils/workspaces';

function when(value: string) {
  return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium' }).format(new Date(value));
}

export default function WorkspaceProfile() {
  const { workspaceId = '' } = useParams();
  const { currentUser } = useAuth();
  const query = useQuery(publicWorkspace(workspaceId));
  if (query.isPending) return <main className="workspace-public"><div className="workspace-public__shell"><p className="workspace-empty">Loading business…</p></div></main>;
  if (query.isError) return <main className="workspace-public"><div className="workspace-public__shell"><p className="workspace-error" role="alert">{query.error.message}</p><Link className="workspace-primary" to="/services">Back to services</Link></div></main>;
  const data = query.data!;
  const bookable = currentUser?.profile?.role === 'client';
  return <main className="workspace-public"><div className="workspace-public__shell">
    <Link to="/services" className="workspace-public__back"><ArrowLeft size={15} /> Back to services</Link>
    <header className="workspace-public__hero">
      <div className="workspace-public__brand"><span className="workspace-public__avatar">{(data.workspace.name || 'W').trim().charAt(0).toUpperCase()}</span><div><p className="workspace-kicker">LOCAL BUSINESS</p><h1>{data.workspace.name}</h1><p><MapPin size={14} /> {data.workspace.location || 'Service area not set'}</p></div></div>
      <div className="workspace-public__badges">
        {data.workspace.verificationTier !== 'Basic' && <span><BadgeCheck size={15} /> Verified business</span>}
        {!data.workspace.isPublished && <span className="workspace-public__draft">Draft preview</span>}
        {data.viewerRole && <Link to={`/workspace?workspace=${data.workspace.id}`} className="workspace-secondary">Manage workspace <ArrowUpRight size={14} /></Link>}
      </div>
    </header>
    <p className="workspace-public__about">{data.workspace.publicDescription || data.workspace.description || 'This business has not added a public description yet.'}</p>
    <div className="workspace-public__stats">
      <div><strong>{data.stats.listingCount}</strong><span>Services</span></div>
      <div><strong>{data.stats.completedBookings}</strong><span>Completed bookings</span></div>
      <div><strong>{data.stats.activeMembers}</strong><span>Team members</span></div>
      <div><strong>{data.reviews.averageRating != null ? data.reviews.averageRating.toFixed(1) : '—'}</strong><span>{data.reviews.count ? `${data.reviews.count} reviews` : 'No reviews yet'}</span></div>
    </div>
    <section className="workspace-public__section"><div className="workspace-public__head"><div><p className="workspace-kicker">WHAT WE DO</p><h2>Services</h2></div><span>{data.stats.listingCount} published</span></div>
      {!data.listings.length && <p className="workspace-empty">No services have been published yet.</p>}
      <div className="workspace-public__listings">{data.listings.map(listing => <ServiceListingCard key={listing.id} listing={listing} bookable={bookable} />)}</div>
    </section>
    <div className="workspace-columns">
      <section className="workspace-card"><div className="workspace-card__head"><div><p className="workspace-kicker">THE TEAM</p><h2>Who you may meet</h2></div><Users size={19} /></div>{!data.team.length && <p className="workspace-empty">No team members listed.</p>}<div className="workspace-team-preview">{data.team.map((member, index) => <div key={`${member.name}-${index}`} className="workspace-person"><span className="workspace-avatar">{(member.name || 'T').charAt(0).toUpperCase()}</span><span><strong>{member.name || 'Team member'}</strong><small>{member.role}</small></span></div>)}</div></section>
      <section className="workspace-card"><div className="workspace-card__head"><div><p className="workspace-kicker">CLIENT FEEDBACK</p><h2>Reviews</h2></div><Star size={19} /></div>
        {data.reviews.averageRating != null && <p className="workspace-public__rating"><Star size={17} /> {data.reviews.averageRating.toFixed(1)} <small>from {data.reviews.count} {data.reviews.count === 1 ? 'review' : 'reviews'}</small></p>}
        {!data.reviews.items.length && <p className="workspace-empty">No reviews yet.</p>}
        <div className="workspace-public__reviews">{data.reviews.items.map((review, index) => <article key={index}><div><strong>{review.clientName}</strong><small>{when(review.createdAt)}</small></div><p className="workspace-public__stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>{review.comment && <p>{review.comment}</p>}</article>)}</div>
      </section>
    </div>
    <p className="workspace-public__note"><ShieldCheck size={14} /> Business verification and account safety are managed by the ServiceConnect provider account. Reviews come from completed bookings.</p>
  </div></main>;
}
