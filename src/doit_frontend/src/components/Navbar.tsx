import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, MessageCircle, Settings, Menu, X, User, Calendar } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import AuthStatus from './AuthStatus';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const { user } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (user.isAuthenticated && user.principal) {
      const checkUnreadData = () => {
        // Backend-only data checking
        // TODO: Replace with actual backend calls for unread messages/notifications
        setHasUnreadMessages(false);
        setHasUnreadNotifications(false);
      };
      
      checkUnreadData();
      const interval = setInterval(checkUnreadData, 30000);

      return () => {
        clearInterval(interval);
      };
    } else {
      setHasUnreadMessages(false);
      setHasUnreadNotifications(false);
    }
  }, [user.isAuthenticated, user.principal]);
  const createTestNotifications = () => {
    if (user.principal) {
      const testNotifications = [
        {
          id: Date.now(),
          title: 'New Service Request',
          message: 'You have a new booking request for plumbing services',
          time: new Date().toISOString(),
          read: false,
          type: 'booking'
        },
        {
          id: Date.now() + 1,
          title: 'Payment Received',
          message: 'Payment of $150 has been received for your recent service',
          time: new Date(Date.now() - 3600000).toISOString(),
          read: false,
          type: 'payment'
        }
      ];
      
      // Test notifications now managed through backend only
      // TODO: Add backend call to create test notifications
      console.log('Test notifications would be created:', testNotifications);
      setHasUnreadNotifications(true);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'N' && user.isAuthenticated) {
        createTestNotifications();
        console.log('Test notifications added!');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [user.isAuthenticated, user.principal]);

  const navItems = [
    { name: 'Home', href: getHomeRoute() },
    { name: 'Services', href: '/services' },
    { name: 'About', href: '/about' }
  ];

  function getHomeRoute() {
    if (!user.isAuthenticated) {
      return '/';
    } else if (user.userType === 'client') {
      return '/dashboard';
    } else if (user.userType === 'provider') {
      return '/provider-dashboard';
    } else {
      return '/';
    }
  }

  const handleBookNow = () => {
    if (!user.isAuthenticated) {
      navigate('/signin');
      return;
    }
    navigate('/book');
  };

  const handleProfileAccess = (path: string) => {
    if (!user.isAuthenticated) {
      navigate('/signin');
      return;
    }
    navigate(path);
  };

  const handleAuthenticatedNavigation = (path: string) => {
    if (!user.isAuthenticated) {
      navigate('/signin');
    } else {
      if (path === '/messages') {
        setHasUnreadMessages(false);
        // TODO: Mark messages as read via backend API
        console.log('Messages marked as read (backend integration needed)');
      } else if (path === '/notifications') {
        setHasUnreadNotifications(false);
        // TODO: Mark notifications as read via backend API
        console.log('Notifications marked as read (backend integration needed)');
      }
      navigate(path);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center"
          >
            <div className="text-2xl font-bold">
              <span className="text-white">Service</span>
              <span className="text-orange-500">Connect</span>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {navItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className="text-gray-300 hover:text-orange-500 px-3 py-2 text-sm font-medium transition-colors duration-200"
                >
                  {item.name}
                </button>
              ))}
              
              {/* Book Now Button */}
              <motion.button
                onClick={handleBookNow}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Book Now
              </motion.button>
            </div>
          </div>

          {/* Right Side Icons */}
          <div className="flex items-center space-x-4">
            {/* Notifications - Only show if authenticated */}
            {user.isAuthenticated && (
              <motion.button
                onClick={() => handleAuthenticatedNavigation('/notifications')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative p-2 text-gray-400 hover:text-orange-500 transition-colors"
              >
                <Bell className="w-6 h-6" />
                {hasUnreadNotifications && (
                  <span className="absolute -top-0.5 -right-0.5 bg-orange-500 rounded-full w-3 h-3 animate-pulse"></span>
                )}
              </motion.button>
            )}

            {/* Messages - Only show if authenticated */}
            {user.isAuthenticated && (
              <motion.button
                onClick={() => handleAuthenticatedNavigation('/messages')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative p-2 text-gray-400 hover:text-orange-500 transition-colors"
              >
                <MessageCircle className="w-6 h-6" />
                {hasUnreadMessages && (
                  <span className="absolute -top-0.5 -right-0.5 bg-orange-500 rounded-full w-3 h-3 animate-pulse"></span>
                )}
              </motion.button>
            )}

            {/* Settings - Protected */}
            <motion.button
              onClick={() => handleProfileAccess('/settings')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
              title={!user.isAuthenticated ? "Sign in to access settings" : "Settings"}
            >
              <Settings className="w-6 h-6" />
            </motion.button>

            {/* Authentication Status */}
            <AuthStatus />

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="md:hidden bg-gray-700 border-t border-gray-600"
        >
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.href);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left text-gray-300 hover:text-orange-500 block px-3 py-2 text-base font-medium transition-colors"
              >
                {item.name}
              </button>
            ))}
            
            {/* Mobile Book Now Button */}
            <motion.button
              onClick={() => {
                handleBookNow();
                setIsMenuOpen(false);
              }}
              className="w-full text-left bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 text-base font-medium transition-colors rounded-lg mt-2 flex items-center"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Now
            </motion.button>
          </div>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;