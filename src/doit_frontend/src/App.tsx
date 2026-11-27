import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AppContext';
import { PresenceProvider } from './contexts/PresenceContext';
import Home from './pages/Home';
import SiteNavbar from './components/SiteNavbar';
import FormFeedback from './components/FormFeedback';
import SignIn from './pages/SignIn';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';
import Services from './pages/Services';
import ListingDetail from './pages/ListingDetail';
import QuoteRequest from './pages/QuoteRequest';
import Quotes from './pages/Quotes';
import Bookings from './pages/Bookings';
import WorkingHours from './pages/WorkingHours';
import ProviderProfile from './pages/ProviderProfile';
import About from './pages/About';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import ProviderDashboard from './pages/ProviderDashboard';
import ManageListings from './pages/ManageListings';
import ListingReviews from './pages/ListingReviews';
import Dashboard from './pages/Dashboard';
import VerificationReview from './pages/VerificationReview';
import AdminDashboard from './pages/AdminDashboard';
import Complaints from './pages/Complaints';
import Reliability from './pages/Reliability';
import ReliabilityReview from './pages/ReliabilityReview';
import type { AccountRole } from './types';
import { accountDestination, accountHome } from './utils/accountRoutes';

const queryClient = new QueryClient();

function RequireProfile({ role }: { role?: AccountRole }) {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <p role="status" className="bg-gray-900 min-h-screen p-8 text-white">Loading your account…</p>;
  }
  const listingId = location.pathname === '/book' ? new URLSearchParams(location.search).get('service') : null;
  const params = new URLSearchParams();
  if (listingId) { params.set('book', listingId); const photo = new URLSearchParams(location.search).get('photo'); if (photo) params.set('photo', photo); }
  if (!currentUser) return <Navigate to={params.size ? `/signin?${params}` : '/signin'} replace />;
  if (currentUser.profile?.role === 'admin' && !location.pathname.startsWith('/admin') && !['/verification-review', '/settings'].includes(location.pathname)) return <Navigate to="/admin" replace />;
  if (!currentUser.profile) return <Navigate to={accountDestination(undefined, params)} replace />;
  // Dashboard data follows the selected mode, so a dual-role account must switch
  // modes before opening the other dashboard.
  if (role && currentUser.profile.role !== role) {
    return <Navigate to={accountHome(currentUser.profile.role)} replace />;
  }
  return <Outlet />;
}

function AppRoutes() {
  const { pathname } = useLocation();
  const page = pathname === '/' ? 'home' : pathname === '/provider-dashboard/hours' ? 'hours' : pathname === '/settings' ? 'settings' : pathname.split('/').filter(Boolean)[0] || 'home';
  return <FormFeedback><div className={pathname === '/' ? undefined : 'app-theme'}>{pathname !== '/' && <SiteNavbar />}<div className={`page-stage min-w-0 ${pathname === '/' ? '' : 'md:pl-64'}`} data-page={page}><Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/about" element={<About />} />
            <Route path="/provider-login" element={<Navigate to="/signin?role=provider" replace />} />
            <Route path="/client-login" element={<Navigate to="/signin?role=client" replace />} />
            <Route element={<RequireProfile />}>
              <Route path="/services" element={<Services />} />
              <Route path="/services/:listingId" element={<ListingDetail />} />
              <Route path="/providers/:providerId" element={<ProviderProfile />} />
              <Route path="/providers/:providerId/work" element={<ProviderProfile />} />
              <Route path="/services/:listingId/reviews" element={<ListingReviews />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/reliability" element={<Reliability />} />
              <Route path="/admin/reliability" element={<ReliabilityReview />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/verification-review" element={<VerificationReview />} />
            </Route>
            <Route element={<RequireProfile role="client" />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/book" element={<QuoteRequest />} />
            </Route>
            <Route element={<RequireProfile role="provider" />}>
              <Route path="/provider-dashboard" element={<ProviderDashboard />} />
              <Route path="/provider-dashboard/listings" element={<ManageListings />} />
              <Route path="/provider-dashboard/work" element={<Navigate to="/provider-dashboard" replace />} />
              <Route path="/provider-dashboard/hours" element={<WorkingHours />} />
              <Route path="/provider-dashboard/availability" element={<Navigate to="/provider-dashboard/hours" replace />} />
            </Route>
          </Routes></div></div></FormFeedback>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PresenceProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        </PresenceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
