import React from 'react';
import { useApp } from '../contexts/AppContext';
import { motion } from 'framer-motion';

const AuthStatus: React.FC = () => {
  const { user, logout, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400"></div>
        <span className="text-white text-sm">Connecting...</span>
      </div>
    );
  }

  if (!user.isAuthenticated) {
    return (
      <motion.a
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        href="/signin"
        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
      >
        Sign In
      </motion.a>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center space-x-3"
    >
      {/* User Info */}
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="text-white">
          <div className="text-sm font-medium capitalize">{user.userType}</div>
          <div className="text-xs text-gray-300">Account</div>
        </div>
      </div>
      
      {/* Logout Button */}
      <button
        onClick={logout}
        className="text-gray-300 hover:text-white px-3 py-1 rounded text-sm transition-colors duration-200"
      >
        Logout
      </button>
    </motion.div>
  );
};

export default AuthStatus;
