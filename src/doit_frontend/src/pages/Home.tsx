import { ArrowRight, ArrowUpRight, CalendarCheck, MessageCircle, Search, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { accountDestination, accountHome } from '../utils/accountRoutes';

const steps = [
  { icon: Search, number: '01', title: 'Find your fit', text: 'Explore local services and find someone who understands what you need.' },
  { icon: MessageCircle, number: '02', title: 'Start a conversation', text: 'Request a quotation, share the details and chat directly with your provider.' },
  { icon: CalendarCheck, number: '03', title: 'Make it happen', text: 'Agree on the details, confirm your booking and keep everything in one place.' },
];
export default function Home() {
  const { currentUser, isLoading } = useAuth();
  const [pendingQuote] = useState(() => sessionStorage.getItem('pendingQuote'));
  useEffect(() => { if (currentUser && pendingQuote) sessionStorage.removeItem('pendingQuote'); }, [currentUser, pendingQuote]);
  if (isLoading) return <main className="landing-loading" role="status">Loading ServiceConnect…</main>;
  if (currentUser) return <Navigate to={currentUser.isVerificationAdmin && currentUser.profile ? '/admin' : pendingQuote ? accountDestination(currentUser.profile?.role, new URLSearchParams(pendingQuote)) : accountHome(currentUser.profile?.role)} replace />;
  return <div className="landing-page"><header className="landing-nav"><Link to="/" className="landing-nav__brand"><img src="/serviceconnect-monogram.png" alt="" /><span>Service<em>Connect</em></span></Link><nav aria-label="Welcome navigation" className="landing-nav__links"><Link to="/about" className="landing-nav__about">About</Link><Link to="/signin" className="landing-nav__signin">Sign in</Link><Link to="/signin?role=client" className="landing-nav__join">Get started <ArrowRight size={15} aria-hidden="true" /></Link></nav></header><main className="landing-wrap">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__copy"><p className="landing-eyebrow"><span /> PEOPLE. SERVICES. CONNECTION.</p><h1 id="landing-title">Good people.<br /><em>Great work.</em></h1><p className="landing-lead">From the little things to the big projects, find local people ready to help you get things done.</p><div className="landing-actions"><Link className="landing-primary" to="/signin?role=client">Find a service <ArrowRight size={17} /></Link><Link className="landing-text-link" to="/signin?role=provider">Offer your services <ArrowUpRight size={16} /></Link></div><p className="landing-footnote"><Sparkles size={15} /> Your neighbourhood, connected.</p></div>
      <div className="landing-art" aria-hidden="true"><div className="landing-art__rings" /><div className="landing-art__badge"><Sparkles size={20} /><span>GOOD WORK<br />STARTS HERE</span></div><div className="landing-art__content"><span>THE SERVICECONNECT WAY</span><strong>A little connection<br /><em>goes a long way.</em></strong><div><span>01 / FIND</span><span>02 / CONNECT</span><span>03 / BOOK</span></div></div></div>
    </section>
    <section className="landing-how" aria-labelledby="how-title"><div className="landing-heading"><div><p className="landing-eyebrow">A SIMPLER WAY TO GET THINGS DONE</p><h2 id="how-title">From hello to <em>all done.</em></h2></div><p>Everything you need to find the right person and move forward with confidence.</p></div><div className="landing-steps">{steps.map(({ icon: Icon, number, title, text }) => <article className="landing-step" key={number}><div className="landing-step__top"><span><Icon size={20} /></span><small>{number} / 03</small></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="landing-provider"><div className="landing-provider__icon"><Users size={27} /></div><div><p className="landing-eyebrow">FOR SERVICE PROVIDERS</p><h2>Your skills deserve<br /><em>to be discovered.</em></h2><p>Showcase your work, connect with clients and manage requests in one place.</p></div><Link className="landing-primary" to="/signin?role=provider">Join as a provider <ArrowUpRight size={17} /></Link></section>
    <section className="landing-end"><p className="landing-eyebrow">READY WHEN YOU ARE</p><h2>Let's make things <em>happen.</em></h2><p>Create your account and find the help you've been looking for.</p><Link className="landing-primary" to="/signin?role=client">Get started <ArrowRight size={17} /></Link></section>
  </main><footer className="landing-footer"><span>ServiceConnect</span><p>Connecting people to good work.</p><Link to="/about">About us <ArrowUpRight size={14} /></Link></footer></div>;
}
