import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import InternetIdentityLogin from '../components/InternetIdentityLogin';
import { useApp } from '../contexts/AppContext';

const SignIn = () => {
  const { user } = useApp();

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-orange-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Back to Home Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <button
            onClick={handleGoHome}
            className="inline-flex items-center text-orange-400 hover:text-orange-300 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </button>
          
          {!user.isAuthenticated && (
            <>
              <h1 className="text-3xl font-bold text-white mb-4">
                Welcome to Service<span className="text-orange-500">Connect</span>
              </h1>
              <p className="text-gray-300 text-lg mb-6">
                Secure authentication powered by Internet Identity
              </p>
            </>
          )}
        </motion.div>

        {/* Internet Identity Login */}
        <InternetIdentityLogin />
      </div>
    </div>
  );
};

export default SignIn;
