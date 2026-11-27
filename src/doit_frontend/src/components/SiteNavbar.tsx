import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Briefcase, CalendarDays, CircleHelp, ClipboardList, FileText, Home, LayoutDashboard, LogOut, Menu, Scale, MessageSquare, Settings, ShieldCheck, Store, LifeBuoy, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import type { OnboardingInput } from '../types';
import { accountHome } from '../utils/accountRoutes';
import { inboxUnread } from '../utils/inbox';
import { reliabilityUnread } from '../utils/reliability';
import { quoteAlerts } from '../utils/quotes';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';
export default function SiteNavbar() {
  const { currentUser, isLoading, logout, switchRole, error } = useAuth();
  const [open, setOpen] = useState(false);
  const [roleError, setRoleError] = useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const profileRole = currentUser?.profile?.role;
  const canBeProvider = currentUser?.profile?.providerEnabled ?? profileRole === 'provider';
  const role = profileRole === 'admin' ? undefined : profileRole;
  const { data: unread } = useQuery(inboxUnread(role ? currentUser!.id : ''));
  const { data: quoteNotices } = useQuery(quoteAlerts(role ? currentUser!.id : ''));
  const { data: reliability } = useQuery(reliabilityUnread(role ? currentUser!.id : ''));
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { if (!open) return; const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [open]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
  const adminMode = !!currentUser?.isVerificationAdmin && (profileRole === 'admin' || pathname.startsWith('/admin') || pathname.startsWith('/verification-review'));
  async function selectRole(next: 'client' | 'provider') {
    if (!currentUser?.profile) return;
    if (next === 'provider' && !canBeProvider) {
      setOpen(false);
      navigate('/onboarding?role=provider&addRole=1');
      return;
    }
    try {
      setRoleError('');
      const details: OnboardingInput = next === 'client'
        ? { role: 'client', name: currentUser.name || 'My account', phone: currentUser.profile.phone, location: currentUser.profile.location }
        : { role: 'provider', name: currentUser.name || 'My account', phone: currentUser.profile.phone, location: currentUser.profile.location, businessName: currentUser.profile.businessName || '', serviceCategories: currentUser.profile.serviceCategories, otherService: currentUser.profile.otherService ?? '' };
      await switchRole(details);
      setOpen(false);
      navigate(accountHome(next));
    } catch (err) { setRoleError(err instanceof Error ? err.message : 'Could not switch account mode'); }
  }
  const links: { to: string; label: string; icon: typeof Home; end?: boolean; count?: number }[] = adminMode ? [
    { to: '/admin', label: 'Control centre', icon: LayoutDashboard, end: true },
    { to: '/verification-review', label: 'Verification review', icon: ShieldCheck },
    { to: '/admin/reliability', label: 'Reliability review', icon: Scale },
    { to: '/settings', label: 'Account settings', icon: Settings },
  ] : [
    ...(role ? [{ to: accountHome(role), label: 'Dashboard', icon: LayoutDashboard, end: true }] : [{ to: '/', label: 'Home', icon: Home, end: true }]),
    { to: '/services', label: 'Services', icon: Briefcase },
    ...(role ? [
      { to: '/quotes', label: 'Quotes', icon: FileText },
      { to: '/bookings', label: 'Bookings', icon: ClipboardList },
      { to: '/messages', label: 'Messages', icon: MessageSquare, count: unread?.messages ?? 0 },
      { to: '/notifications', label: 'Notifications', icon: Bell, count: (unread?.notifications ?? 0) + (quoteNotices?.filter(alert => !alert.readAt).length ?? 0) + (reliability?.count ?? 0) },
      ...(role === 'provider' ? [{ to: '/provider-dashboard/listings', label: 'My listings', icon: Store }, { to: '/provider-dashboard/hours', label: 'Working hours', icon: CalendarDays }] : []),
      { to: '/reliability', label: 'Reliability & credits', icon: Scale },
      { to: '/complaints', label: 'Complaints & support', icon: LifeBuoy },
      { to: '/settings', label: 'Settings', icon: Settings },
      ...(currentUser?.isVerificationAdmin ? [{ to: '/admin', label: 'Admin centre', icon: ShieldCheck }] : []),
    ] : []),
    { to: '/about', label: 'About', icon: CircleHelp },
  ];
  const panel = <div className="flex h-full flex-col bg-home-surface">
    <Link to={adminMode ? '/admin' : role ? accountHome(role) : '/'} onClick={() => setOpen(false)} className={`flex items-center gap-3 border-b border-home-line px-5 py-6 ${focus}`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><Home aria-hidden="true" className="h-5 w-5" /></span>
      <span className="font-semibold tracking-tight text-home-text">ServiceConnect</span>
    </Link>
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-5">
      <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-300/60">{adminMode ? 'Administration' : 'Navigation'}</p>
      <div className="space-y-1">{links.map(({ to, label, icon: Icon, end, count }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${focus} ${isActive ? 'bg-emerald-300/10 text-emerald-200' : 'text-emerald-300/80 hover:bg-home-raised hover:text-emerald-200'}`}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} /><span className="flex-1">{label}</span>{!!count && <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-xs text-green-900">{count > 99 ? '99+' : count}</span>}
      </NavLink>)}</div>
    </nav>
    <div className="border-t border-home-line p-4">
      {!isLoading && (currentUser ? <>
        <p className="truncate text-sm font-semibold text-home-text">{currentUser.name || 'My account'}</p>
        <p className="mt-1 truncate text-xs text-emerald-300/70">{currentUser.email}</p>
        {currentUser.profile && profileRole !== 'admin' && <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-300/60">Switch account mode</p>
          {profileRole === 'provider'
            ? <button type="button" onClick={() => void selectRole('client')} className={`rounded-lg bg-home-raised px-3 py-2 text-xs font-semibold text-home-text ${focus}`}>Become a client</button>
            : <button type="button" onClick={() => void selectRole('provider')} className={`rounded-lg bg-home-raised px-3 py-2 text-xs font-semibold text-home-text ${focus}`}>Become a provider</button>}
        </div>}
        <button type="button" onClick={() => { setOpen(false); void logout(); }} className={`mt-4 flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 ${focus}`}><LogOut aria-hidden="true" className="h-4 w-4" />Sign out</button>
      </> : <div className="space-y-3"><Link to="/signin" className={`block text-sm font-semibold text-emerald-300 ${focus}`}>Sign in</Link><Link to="/provider-login" className={`block text-sm font-semibold text-emerald-300 ${focus}`}>List a service</Link></div>)}
      {roleError && <p role="alert" className="mt-2 text-sm text-red-300">{roleError}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  </div>;
  return <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-home-line md:block">{panel}</aside>
    <div className="mobile-site-header flex h-16 items-center justify-between border-b border-home-line bg-home-canvas px-5 md:hidden"><Link to={adminMode ? '/admin' : role ? accountHome(role) : '/'} className="font-semibold text-home-text">ServiceConnect</Link><button type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" className={`rounded-lg p-2 text-emerald-300 ${focus}`}><Menu aria-hidden="true" /></button></div>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} /><aside id="mobile-navigation" className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] shadow-2xl">{panel}<button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className={`absolute right-3 top-5 rounded-lg p-2 text-emerald-300 ${focus}`}><X aria-hidden="true" className="h-5 w-5" /></button></aside></div>}
  </>;
}
