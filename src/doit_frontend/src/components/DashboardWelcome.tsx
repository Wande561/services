import { ArrowUpRight, BadgeCheck, MapPin, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { myVerification, tierLabel } from '../utils/verification';

export default function DashboardWelcome({ role }: { role: 'client' | 'provider' }) {
  const { currentUser } = useAuth();
  const verification = useQuery(myVerification(currentUser?.id ?? ''));
  const tier = verification.data?.tier ?? currentUser?.profile?.verificationTier ?? 'Basic';
  const pending = verification.data?.submission?.status === 'Pending';
  const label = pending ? 'Verification in review' : tierLabel(tier);
  return <header className="dashboard-welcome">
    <div className="dashboard-welcome__intro"><span className="dashboard-welcome__eyebrow">{role === 'provider' ? 'YOUR BUSINESS AT A GLANCE' : 'YOUR SERVICECONNECT'}</span><h1>Welcome, <em>{role === 'provider' ? currentUser?.profile?.businessName || currentUser?.name || 'Provider' : currentUser?.name || 'Client'}</em></h1><p>{role === 'provider' ? 'Keep track of your requests, appointments and progress.' : 'Your services, quotes and appointments in one place.'}</p></div>
    <Link to="/settings#verification-settings" className="dashboard-welcome__status" aria-label={`Account status: ${label}. Open verification settings`}><span className="dashboard-welcome__status-icon">{tier === 'Basic' ? <ShieldCheck aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}</span><span className="dashboard-welcome__status-content"><span className="dashboard-welcome__status-label">ACCOUNT STATUS</span><strong>{label}</strong><span className="dashboard-welcome__location"><MapPin aria-hidden="true" />{currentUser?.profile?.location || 'Location not set'}</span></span><ArrowUpRight aria-hidden="true" className="dashboard-welcome__arrow" /></Link>
  </header>;
}
