import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';

const ServiceManagementDemo: React.FC = () => {
  const { 
    user, 
    isLoading, 
    isConnected, 
    services,
    activeServices,
    supportedCategories,
    createService,
    getAllServices,
    getActiveServices,
    getServicesByCategory,
    searchServices,
    refreshServices
  } = useApp();

  const navigate = useNavigate();
  const [demoResults, setDemoResults] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !user.isAuthenticated) {
      navigate('/signin');
    }
  }, [user.isAuthenticated, isLoading, navigate]);

  const testGetAllServices = async () => {
    try {
      const result = await getAllServices();
      setDemoResults(prev => [...prev, {
        action: 'Get All Services',
        result: `Found ${result.length} services`,
        data: result.slice(0, 3) // Show first 3
      }]);
    } catch (error) {
      setDemoResults(prev => [...prev, {
        action: 'Get All Services',
        result: 'Error: ' + error,
        data: null
      }]);
    }
  };

  const testGetActiveServices = async () => {
    try {
      const result = await getActiveServices();
      setDemoResults(prev => [...prev, {
        action: 'Get Active Services',
        result: `Found ${result.length} active services`,
        data: result.slice(0, 3)
      }]);
    } catch (error) {
      setDemoResults(prev => [...prev, {
        action: 'Get Active Services',
        result: 'Error: ' + error,
        data: null
      }]);
    }
  };

  const testSearchServices = async () => {
    try {
      const result = await searchServices('professional', selectedCategory || undefined);
      setDemoResults(prev => [...prev, {
        action: `Search Services: "professional" ${selectedCategory ? 'in ' + selectedCategory : ''}`,
        result: `Found ${result.length} matching services`,
        data: result.slice(0, 3)
      }]);
    } catch (error) {
      setDemoResults(prev => [...prev, {
        action: 'Search Services',
        result: 'Error: ' + error,
        data: null
      }]);
    }
  };

  const testGetServicesByCategory = async () => {
    if (!selectedCategory) return;
    try {
      const result = await getServicesByCategory(selectedCategory);
      setDemoResults(prev => [...prev, {
        action: `Get Services by Category: ${selectedCategory}`,
        result: `Found ${result.length} services in ${selectedCategory}`,
        data: result.slice(0, 3)
      }]);
    } catch (error) {
      setDemoResults(prev => [...prev, {
        action: 'Get Services by Category',
        result: 'Error: ' + error,
        data: null
      }]);
    }
  };

  const testCreateService = async () => {
    try {
      const demoService = {
        title: 'Demo Service - ' + new Date().toLocaleTimeString(),
        description: 'This is a test service created from the demo page',
        category: 'Plumbing',
        pricing: {
          category: { 'Plumbing': null },
          minPrice: 100,
          maxPrice: 200,
          unit: { 'PerHour': null }
        },
        location: 'Johannesburg',
        images: [],
        availability: [],
        requirements: ['Basic tools', 'Experience'],
        duration: 60
      };

      const result = await createService(
        demoService.title,
        demoService.description,
        demoService.category,
        demoService.pricing,
        demoService.location,
        demoService.images,
        demoService.availability,
        demoService.requirements,
        demoService.duration
      );

      setDemoResults(prev => [...prev, {
        action: 'Create Service',
        result: result ? 'Service created successfully!' : 'Failed to create service',
        data: result
      }]);
    } catch (error) {
      setDemoResults(prev => [...prev, {
        action: 'Create Service',
        result: 'Error: ' + error,
        data: null
      }]);
    }
  };

  const clearResults = () => {
    setDemoResults([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-orange-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-orange-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">Service Management Demo</h1>
          <p className="text-orange-200">
            Test the backend service functions connected to the frontend
          </p>
          {!isConnected && (
            <div className="bg-red-500 text-white p-3 rounded-lg mt-4">
              Backend not connected. Some functions may not work.
            </div>
          )}
        </motion.div>

        {/* Current State */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 rounded-lg p-6 mb-6"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Current State</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-500">{services.length}</div>
              <div className="text-gray-300">Total Services</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">{activeServices.length}</div>
              <div className="text-gray-300">Active Services</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-500">{supportedCategories.length}</div>
              <div className="text-gray-300">Categories</div>
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800 rounded-lg p-6 mb-6"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Test Controls</h2>
          
          {/* Category Selection */}
          <div className="mb-4">
            <label className="block text-white mb-2">Select Category for Tests:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600"
            >
              <option value="">-- All Categories --</option>
              {supportedCategories.map((category, index) => (
                <option key={index} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              onClick={testGetAllServices}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get All Services
            </button>
            <button
              onClick={testGetActiveServices}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Active Services
            </button>
            <button
              onClick={testSearchServices}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Search "professional"
            </button>
            <button
              onClick={testGetServicesByCategory}
              disabled={!selectedCategory}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Get by Category
            </button>
            <button
              onClick={testCreateService}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Create Demo Service
            </button>
            <button
              onClick={clearResults}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Clear Results
            </button>
          </div>
        </motion.div>

        {/* Results */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800 rounded-lg p-6"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
          {demoResults.length === 0 ? (
            <p className="text-gray-400">No tests run yet. Click the buttons above to test the service functions.</p>
          ) : (
            <div className="space-y-4">
              {demoResults.map((result, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4">
                  <div className="font-semibold text-orange-500">{result.action}</div>
                  <div className="text-white mb-2">{result.result}</div>
                  {result.data && (
                    <pre className="text-gray-300 text-sm overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ServiceManagementDemo;
