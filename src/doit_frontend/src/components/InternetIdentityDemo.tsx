import React from 'react';
import { useApp } from '../contexts/AppContext';
import { motion } from 'framer-motion';

const InternetIdentityDemo: React.FC = () => {
  const { 
    user, 
    loginWithII, 
    logout, 
    isLoading, 
    error, 
    isConnected,
    systemInfo 
  } = useApp();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6"
    >
      <h3 className="text-xl font-bold text-white mb-4 flex items-center">
        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Internet Identity Demo
      </h3>

      {/* Connection Status */}
      <div className="mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
          isConnected 
            ? 'bg-green-500/20 text-green-300' 
            : 'bg-red-500/20 text-red-300'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isConnected ? 'bg-green-400' : 'bg-red-400'
          }`} />
          Backend {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        {systemInfo && (
          <p className="text-gray-300 text-sm mt-1">
            Version: {systemInfo.version} | Status: {systemInfo.status}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Authentication Status */}
      <div className="mb-4 p-4 bg-gray-900/50 rounded-lg">
        <h4 className="font-semibold text-white mb-2">Authentication Status</h4>
        
        {user.isAuthenticated ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-green-300 font-medium">✓ Authenticated with Internet Identity</p>
                <p className="text-gray-300 text-sm capitalize">Role: {user.userType}</p>
              </div>
            </div>
            
            <div className="bg-gray-800/50 rounded p-3 mt-3">
              <p className="text-gray-400 text-xs">Principal ID:</p>
              <p className="text-orange-300 font-mono text-sm break-all">
                {user.principal?.toText()}
              </p>
            </div>

            <button
              onClick={logout}
              disabled={isLoading}
              className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              {isLoading ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-300 text-sm">
              Experience secure, passwordless authentication with Internet Computer's Internet Identity.
            </p>
            
            <div className="space-y-2">
              <button
                onClick={() => loginWithII()}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Sign In as Client
                  </>
                )}
              </button>

              <button
                onClick={() => loginWithII()}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2V6z" />
                    </svg>
                    Sign In as Provider
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="text-sm text-gray-300">
        <h4 className="font-medium text-white mb-2">Internet Identity Features:</h4>
        <ul className="space-y-1">
          <li className="flex items-center">
            <svg className="w-3 h-3 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            No passwords required
          </li>
          <li className="flex items-center">
            <svg className="w-3 h-3 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Cryptographic security
          </li>
          <li className="flex items-center">
            <svg className="w-3 h-3 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Privacy-focused
          </li>
          <li className="flex items-center">
            <svg className="w-3 h-3 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Works across devices
          </li>
        </ul>
      </div>
    </motion.div>
  );
};

export default InternetIdentityDemo;
