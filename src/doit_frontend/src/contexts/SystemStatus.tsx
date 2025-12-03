import React from 'react';
import { useApp } from './AppContext';

export const SystemStatus: React.FC = () => {
  const {
    isConnected,
    isLoading,
    error,
    systemInfo,
    user,
    availableServices,
    supportedLocations,
    supportedCategories,
    connectToBackend,
    disconnect,
    loginWithII,
    logout,
    refreshSystemInfo,
    clearError,
    formatCurrency,
    validateSAId,
    formatPhone
  } = useApp();

  const handleTestFunctions = async () => {
    try {

      const currency = await formatCurrency(150.75);
      const isValidId = await validateSAId('8001015009087');
      const formattedPhone = await formatPhone('0823456789');
      
      console.log('Currency format:', currency);
      console.log('Valid SA ID:', isValidId);
      console.log('Formatted phone:', formattedPhone);
    } catch (err) {
      console.error('Test functions error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-blue-700">Connecting to DoIt Services...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-red-700">Error: {error}</span>
          <div className="flex space-x-2">
            <button
              onClick={clearError}
              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Clear
            </button>
            <button
              onClick={connectToBackend}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-orange-600">DoIt Services - System Status</h2>
      
      {/* Connection Status */}
      <div className="mb-4 p-3 rounded-lg bg-gray-50">
        <h3 className="font-semibold mb-2">Connection Status</h3>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 rounded-full text-sm ${
            isConnected 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {isConnected ? '✓ Connected' : '✗ Disconnected'}
          </span>
          <button
            onClick={isConnected ? disconnect : connectToBackend}
            className={`px-4 py-2 rounded font-medium ${
              isConnected
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>

      {/* System Information */}
      {systemInfo && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">System Information</h3>
            <button
              onClick={refreshSystemInfo}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              🔄 Refresh
            </button>
          </div>
          <div className="text-sm space-y-1">
            <p><strong>Version:</strong> {systemInfo.version}</p>
            <p><strong>Status:</strong> {systemInfo.status}</p>
            <p><strong>Deployed:</strong> {new Date(Number(systemInfo.deployedAt / 1000000n)).toLocaleString()}</p>
            <p><strong>Current Time:</strong> {new Date(Number(systemInfo.currentTime / 1000000n)).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* User Status */}
      <div className="mb-4 p-3 rounded-lg bg-gray-50">
        <h3 className="font-semibold mb-2">User Status</h3>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 rounded-full text-sm ${
            user.isAuthenticated 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            {user.isAuthenticated ? `✓ Logged in as ${user.userType}` : '○ Not logged in'}
          </span>
          {!user.isAuthenticated ? (
            <div className="space-x-2">
              <button
                onClick={() => loginWithII()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Login as Client
              </button>
              <button
                onClick={() => loginWithII()}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Login as Provider
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Service Information */}
      {isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-blue-50">
            <h4 className="font-semibold text-blue-800 mb-2">Available Services ({availableServices.length})</h4>
            <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {availableServices.map((service, index) => (
                <div key={index} className="text-blue-700">• {service}</div>
              ))}
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-green-50">
            <h4 className="font-semibold text-green-800 mb-2">Supported Locations ({supportedLocations.length})</h4>
            <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {supportedLocations.map((location, index) => (
                <div key={index} className="text-green-700">• {location}</div>
              ))}
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-purple-50">
            <h4 className="font-semibold text-purple-800 mb-2">Service Categories ({supportedCategories.length})</h4>
            <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {supportedCategories.map((category, index) => (
                <div key={index} className="text-purple-700">• {category}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test Utility Functions */}
      {isConnected && (
        <div className="p-3 rounded-lg bg-yellow-50">
          <h4 className="font-semibold text-yellow-800 mb-2">Utility Functions</h4>
          <button
            onClick={handleTestFunctions}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
          >
            Test Utility Functions (Check Console)
          </button>
          <p className="text-xs text-yellow-700 mt-2">
            Tests currency formatting, SA ID validation, and phone number formatting
          </p>
        </div>
      )}
    </div>
  );
};
