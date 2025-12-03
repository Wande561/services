import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, AuthProvider, useApp } from './contexts/AppContext';
import Navbar from './components/Navbar';
import AuthDebug from './components/AuthDebug';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import Services from './pages/Services';
import BookNow from './pages/BookNow';
import About from './pages/About';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import ProviderDashboard from './pages/ProviderDashboard';
import Dashboard from './pages/Dashboard';
import ProviderLogin from './pages/ProviderLogin';
import ClientLogin from './pages/ClientLogin';

// const AuthNavigationHandler = () => {
//   const { user } = useApp();
//   const navigate = useNavigate();
//   const location = useLocation();

//   useEffect(() => {
//     // Define public pages that anyone can access without a profile
//     const publicPages = ['/', '/about', '/services'];
    
//     // Define auth pages where users can create profiles
//     const authPages = ['/signin', '/client-login', '/provider-login'];
    
//     // Define protected pages that require a complete profile
//     const protectedPages = ['/dashboard', '/provider-dashboard', '/settings', '/notifications', '/messages', '/book'];

//     if (user.isAuthenticated && user.principal && user.userType === null) {

//       if (protectedPages.includes(location.pathname)) {
//         console.log('User authenticated but no profile found - redirecting from protected page to signin');
//         navigate('/signin');
//       }
//     } else if (user.isAuthenticated && user.userType) {
//       if (authPages.includes(location.pathname)) {
//         console.log(`User with ${user.userType} profile found on auth page - redirecting to dashboard`);
//         if (user.userType === 'provider') {
//           navigate('/provider-dashboard');
//         } else if (user.userType === 'client') {
//           navigate('/dashboard');
//         }
//       }
//     }
//   }, [user.isAuthenticated, user.userType, user.principal, navigate, location.pathname]);

//   return null;
// };
const queryClient = new QueryClient();

const App = () => {
  return (
   <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/services" element={<Services />} />
          <Route path="/book" element={<BookNow />} />
          <Route path="/about" element={<About />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/provider-dashboard" element={<ProviderDashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/provider-login" element={<ProviderLogin />} />
          <Route path="/client-login" element={<ClientLogin />} />
        </Routes>
      </BrowserRouter>  
    </AuthProvider>
  </QueryClientProvider>
};