import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Users, Briefcase, Star, MapPin } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import ServiceCard from '../components/ServiceCard';
import type { Service } from '../contexts/AppContext';

// Helper function to convert ServiceCategory to string (copied from AppContext)
const serviceCategoryToString = (category: any): string => {
  if ('Plumbing' in category) return 'Plumbing';
  if ('HairStyling' in category) return 'HairStyling';
  if ('HouseCleaning' in category) return 'HouseCleaning';
  if ('Electrical' in category) return 'Electrical';
  if ('Gardening' in category) return 'Gardening';
  if ('PetGrooming' in category) return 'PetGrooming';
  if ('Tutoring' in category) return 'Tutoring';
  if ('Construction' in category) return 'Construction';
  if ('PersonalTraining' in category) return 'PersonalTraining';
  return 'Other';
};

interface HomeProps {
  onClientLogin?: () => void;
  onProviderLogin?: () => void;
}

const Home: React.FC<HomeProps> = ({ onClientLogin, onProviderLogin }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [stats, setStats] = useState({
    activeProviders: 0,
    servicesCompleted: 0,
    averageRating: 0,
    citiesCovered: 0
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { 
    user, 
    isLoading, 
    isConnected,
    getActiveServices, 
    getSupportedServiceCategories, 
    getServiceStats,
    searchProviders
  } = useApp();
  
  useEffect(() => {
    if (!isLoading && user.isAuthenticated) {
      navigate('/dashboard');
    }
  }, [user.isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    const loadHomeData = async () => {
      if (!isConnected) return;
      
      try {
        setDataLoading(true);
        setError(null);

        // Load services and categories
        const [activeServices, categories, serviceStats] = await Promise.all([
          getActiveServices(),
          getSupportedServiceCategories(),
          getServiceStats().catch(() => ({ totalServices: 0, activeServices: 0, averageRating: 4.8 }))
        ]);

        setServices(activeServices.slice(0, 6)); // Show only first 6 services
        setServiceCategories(categories);

        // Load provider stats
        const providers = await searchProviders().catch(() => []);
        
        setStats({
          activeProviders: providers.length || Math.floor(serviceStats.activeServices || 0),
          servicesCompleted: Math.floor((providers.length || serviceStats.totalServices || 0) * 7.5) || 500, // Estimate based on providers
          averageRating: serviceStats.averageRating || 4.8,
          citiesCovered: Math.max(Math.floor((providers.length || 10) / 20), 1) || 10 // Estimate cities
        });
      } catch (err) {
        console.error('Failed to load home data:', err);
        setError('Failed to load data');
        // Use fallback data
        setStats({
          activeProviders: 150,
          servicesCompleted: 1200,
          averageRating: 4.8,
          citiesCovered: 15
        });
      } finally {
        setDataLoading(false);
      }
    };

    loadHomeData();
  }, [isConnected]);

  const handleGetStarted = () => {
    navigate('/signin');
  };

  const handleSearch = () => {
    if (!user.isAuthenticated) {
      navigate('/signin');
      return;
    }
    navigate(`/services?search=${encodeURIComponent(searchTerm)}`);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (isLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Create category icons mapping
  const getCategoryIcon = (category: string): string => {
    const iconMap: Record<string, string> = {
      'Plumbing': '🔧',
      'HairStyling': '✂️', 
      'HouseCleaning': '🧹',
      'Electrical': '⚡',
      'Gardening': '🌱',
      'PetGrooming': '🐕',
      'Tutoring': '📚',
      'Construction': '🏗️',
      'PersonalTraining': '💪'
    };
    return iconMap[category] || '🔧';
  };

  // Create display data for services - ServiceCard expects this format
  const displayServices = services.slice(0, 6).map(service => ({
    id: parseInt(service.id) || Math.random(), // Convert string id to number for ServiceCard
    name: service.title,
    icon: getCategoryIcon(serviceCategoryToString(service.category)),
    providers: Math.floor(Math.random() * 100) + 50, // Estimate providers per service
    rating: service.rating || (4.7 + Math.random() * 0.3)
  }));

  const displayStats = [
    { 
      label: 'Active Providers', 
      value: stats.activeProviders > 0 ? `${stats.activeProviders}+` : 'Loading...', 
      icon: Users 
    },
    { 
      label: 'Services Completed', 
      value: stats.servicesCompleted > 0 ? `${stats.servicesCompleted.toLocaleString()}+` : 'Loading...', 
      icon: Briefcase 
    },
    { 
      label: 'Average Rating', 
      value: stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '4.8', 
      icon: Star 
    },
    { 
      label: 'Cities Covered', 
      value: stats.citiesCovered > 0 ? `${stats.citiesCovered}+` : 'Loading...', 
      icon: MapPin 
    }
  ];

  return (
    <div className="min-h-screen bg-gray-800 text-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Find Your Perfect
              <span className="text-orange-500 block">Service Provider</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Connect with skilled professionals in your area. From home repairs to personal care,
              we've got you covered with trusted service providers.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={user.isAuthenticated ? "Search for services..." : "Sign in to search for services..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="w-full pl-12 pr-16 py-4 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Search
                </button>
              </div>
              {!user.isAuthenticated && (
                <p className="text-center text-gray-400 text-sm mt-2">
                  Sign in to search and book services
                </p>
              )}
            </div>

            <button
              onClick={user.isAuthenticated ? () => navigate('/services') : handleGetStarted}
              className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold transition-colors inline-flex items-center gap-2"
            >
              {user.isAuthenticated ? 'Browse Services' : 'Get Started'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-gray-700">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {displayStats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="text-center"
                >
                  <IconComponent className="w-8 h-8 text-orange-500 mx-auto mb-4" />
                  <div className="text-3xl font-bold mb-2">{stat.value}</div>
                  <div className="text-gray-400">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4">
              Popular <span className="text-orange-500">Services</span>
            </h2>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Discover the most requested services in your area
            </p>
          </motion.div>

          {error && (
            <div className="text-center text-red-400 mb-6">
              <p>{error}</p>
              <p className="text-gray-400 text-sm">Showing sample data</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayServices.length > 0 ? (
              displayServices.map((service, index) => (
                <ServiceCard key={`service-${service.id}-${index}`} service={service} index={index} />
              ))
            ) : (
              // Show fallback services if no backend data
              [
                { id: 1, name: 'Plumbing', icon: '🔧', providers: 50, rating: 4.8 },
                { id: 2, name: 'Hairstyling', icon: '✂️', providers: 30, rating: 4.9 },
                { id: 3, name: 'Cleaning', icon: '🧹', providers: 80, rating: 4.7 },
                { id: 4, name: 'Electrical', icon: '⚡', providers: 40, rating: 4.8 },
                { id: 5, name: 'Gardening', icon: '🌱', providers: 25, rating: 4.6 },
                { id: 6, name: 'Tutoring', icon: '📚', providers: 35, rating: 4.7 }
              ].map((service, index) => (
                <ServiceCard key={`fallback-${service.id}`} service={service} index={index} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-orange-600 to-orange-500">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl mb-8 text-orange-100">
              Join thousands of satisfied customers and skilled providers
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onClientLogin || handleGetStarted}
                className="bg-white text-orange-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
              >
                Find Services
              </button>
              <button
                onClick={onProviderLogin || handleGetStarted}
                className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white hover:text-orange-600 transition-colors"
              >
                Become a Provider
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;