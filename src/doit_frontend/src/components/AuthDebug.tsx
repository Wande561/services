import React from 'react';
import { useApp } from '../contexts/AppContext';

const AuthDebug: React.FC = () => {
  const { user, authClient, isLoading, error } = useApp();

  const handleClearSession = async () => {
    if (authClient) {
      await authClient.logout();
      window.location.reload();
    }
  };

  const handleTestAuth = () => {
    console.log('=== AUTHENTICATION DEBUG ===');
    console.log('User state:', {
      principal: user.principal?.toText(),
      isAuthenticated: user.isAuthenticated,
      userType: user.userType,
      hasIdentity: !!user.identity,
      isAnonymous: user.principal?.isAnonymous()
    });
    console.log('AuthClient state:', {
      hasAuthClient: !!authClient,
      isLoading
    });
    if (error) console.log('Error:', error);
    console.log('=== END DEBUG ===');
  };

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg text-sm z-50">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div className="space-y-1">
        <div>Principal: {user.principal?.toText() || 'None'}</div>
        <div>Authenticated: {user.isAuthenticated ? 'Yes' : 'No'}</div>
        <div>Anonymous: {user.principal?.isAnonymous() ? 'Yes' : 'No'}</div>
        <div>User Type: {user.userType || 'None'}</div>
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
        {error && <div className="text-red-400">Error: {error}</div>}
      </div>
      <div className="space-y-2 mt-3">
        <button 
          onClick={handleTestAuth}
          className="block w-full bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs"
        >
          Log Debug Info
        </button>
        <button 
          onClick={handleClearSession}
          className="block w-full bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs"
        >
          Clear Session
        </button>
      </div>
    </div>
  );
};

export default AuthDebug;