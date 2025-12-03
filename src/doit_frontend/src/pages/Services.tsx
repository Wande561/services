import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Star, MapPin, Clock, ArrowRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Service } from '../contexts/AppContext';

const Services = () => {
  const navigate = useNavigate();
  const { 
    user, 
    isConnected, 
    supportedCategories, 
    supportedLocations,
    isLoading, 
    error,
    services,
    activeServices,
    getAllServices,
    getActiveServices,
    searchServices,
    getServicesByCategory
  } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [displayedServices, setDisplayedServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const requireAuth = (callback: () => void) => {
    if (!user.isAuthenticated) {
      navigate('/signin');
      return;
    }
    callback();
  };

  // Load services from backend
  const loadServices = async () => {
    if (!isConnected) return;
    
    setLoadingServices(true);
    try {
      // Load active services by default
      await getActiveServices();
      setDisplayedServices(activeServices);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  // Handle search functionality
  const handleSearch = async () => {
    if (!isConnected) {
      requireAuth(() => {
        console.log('Backend not connected - cannot search');
      });
      return;
    }

    requireAuth(async () => {
      if (!searchTerm.trim() && selectedCategory === 'all' && selectedLocation === 'all') {
        await loadServices();
        return;
      }

      setLoadingServices(true);
      try {
        const categoryFilter = selectedCategory === 'all' ? undefined : selectedCategory;
        const locationFilter = selectedLocation === 'all' ? undefined : selectedLocation;
        
        if (searchTerm.trim()) {
          const results = await searchServices(searchTerm, categoryFilter, locationFilter);
          setDisplayedServices(results);
        } else if (categoryFilter) {
          const results = await getServicesByCategory(categoryFilter);
          setDisplayedServices(results);
        } else {
          await loadServices();
        }
      } catch (err) {
        console.error('Search failed:', err);
        setDisplayedServices([]);
      } finally {
        setLoadingServices(false);
      }
    });
  };

  const handleBookNow = (serviceId: string) => {
    requireAuth(() => {
      navigate(`/book?service=${serviceId}`);
    });
  };  // Load services on component mount and when connection status changes
  useEffect(() => {
    if (isConnected) {
      loadServices();
    }
  }, [isConnected]);

  // Update displayed services when activeServices changes
  useEffect(() => {
    if (activeServices.length > 0) {
      setDisplayedServices(activeServices);
    }
  }, [activeServices]);

  // Helper function to convert backend service category to display string
  const getServiceCategoryDisplay = (category: any): string => {
    if (typeof category === 'object' && category !== null) {
      const keys = Object.keys(category);
      return keys.length > 0 ? keys[0] : 'Unknown';
    }
    return category?.toString() || 'Unknown';
  };

  // Helper function to format service pricing
  const formatServicePricing = (pricing: any): string => {
    if (!pricing) return 'Price on request';
    
    if (pricing && pricing.minPrice !== undefined && pricing.maxPrice !== undefined) {
      if (pricing.minPrice === pricing.maxPrice) {
        return `R${pricing.minPrice}`;
      }
      return `R${pricing.minPrice} - R${pricing.maxPrice}`;
    }
    
    return 'Price on request';
  };

  // Generate categories based on supported backend categories
  const getCategories = () => {
    const allServicesCount = displayedServices.length;
    const categories = [
      { id: 'all', name: 'All Services', count: allServicesCount }
    ];

    // Add backend-supported categories
    if (supportedCategories.length > 0) {
      supportedCategories.forEach(category => {
        const categoryId = category.toLowerCase();
        const count = displayedServices.filter(service => {
          const serviceCategory = getServiceCategoryDisplay(service.category).toLowerCase();
          return serviceCategory === categoryId;
        }).length;
        
        categories.push({
          id: categoryId,
          name: category,
          count
        });
      });
    }

    return categories;
  };

  const categories = getCategories();

  return (
    <div className="min-h-screen bg-gray-900 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Find the Perfect <span className="text-orange-500">Service</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Connect with trusted professionals in your area for all your service needs
          </p>
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          {/* Authentication Status */}
          {!user.isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-orange-300 font-medium">Sign in required to book services</span>
                </div>
                <button
                  onClick={() => navigate('/signin')}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
              </div>
            </motion.div>
          )}

          {/* Backend Connection Status */}
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-300">Backend disconnected - Limited functionality available</span>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={user.isAuthenticated ? "Search services or providers..." : "Sign in to search services..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button 
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium"
            >
              <Search className="w-5 h-5" />
              Search
            </button>
            <button className="flex items-center gap-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition-colors">
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>

          {/* Location Filter */}
          {supportedLocations.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Locations</option>
                {supportedLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
          )}
        </motion.div>

        {/* Loading State */}
        {(loadingServices || isLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <div className="text-gray-400 text-lg">Loading services...</div>
          </motion.div>
        )}

        {/* Services Grid */}
        {!loadingServices && !isLoading && displayedServices.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {displayedServices.map((service, index) => {
              const serviceImage = service.images && service.images.length > 0 
                ? service.images[0] 
                : 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop';
              
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="bg-gray-800 rounded-xl overflow-hidden hover:transform hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  <div className="relative h-48">
                    <img
                      src={serviceImage}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-white text-sm font-medium">5.0</span>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-white mb-2">{service.title}</h3>
                    <p className="text-gray-400 text-sm mb-3 overflow-hidden text-ellipsis">{service.description}</p>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {service.providerId.toText().charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-gray-300 text-sm">
                        {service.providerId.toText().slice(0, 20)}...
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <MapPin className="w-4 h-4" />
                        {service.location}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <span>{getServiceCategoryDisplay(service.category)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-orange-500 font-semibold">
                        {formatServicePricing(service.pricing)}
                      </span>
                      <button 
                        onClick={() => handleBookNow(service.id)}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Book Now
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* No Services Found */}
        {!loadingServices && !isLoading && displayedServices.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-gray-400 text-lg mb-4">No services found</div>
            <p className="text-gray-500 mb-6">
              {isConnected 
                ? "Try adjusting your search criteria or check back later for new services."
                : "Connect to backend to view available services."
              }
            </p>
            {isConnected && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedLocation('all');
                  loadServices();
                }}
                className="text-orange-500 hover:text-orange-400 transition-colors"
              >
                Clear filters and reload
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Services;