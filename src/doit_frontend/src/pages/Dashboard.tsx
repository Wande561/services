import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  Clock, 
  Star, 
  ArrowRight, 
  Calendar, 
  MapPin, 
  User,
  Bell,
  MessageSquare,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Heart,
  Filter,
  Wallet as WalletIcon
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import Wallet from '../components/Wallet';

const Dashboard = () => {
  const { user, isLoading, isConnected, availableServices, supportedLocations, systemInfo, actor, getUserProfile, getClientProfile, getProviderProfile } = useApp();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'wallet'>('overview');

  useEffect(() => {
    if (!isLoading && !user.isAuthenticated) {
      navigate('/signin');
    }
  }, [user.isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || !user.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-orange-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white">Loading your dashboard...</p>
        </motion.div>
      </div>
    );
  }
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeServices: 0,
    earnings: 0,
    rating: 0
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  const [platformStats, setPlatformStats] = useState<any>(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        let profile = null;
        
        if (isConnected && user.userType) {
          console.log('Loading profile from backend for user type:', user.userType);
          try {
            if (user.userType === 'client') {
              const result = await getClientProfile();
              if ('ok' in result) {
                profile = result.ok;
                console.log('Loaded client profile from backend:', profile);
              }
            } else if (user.userType === 'provider') {
              const result = await getProviderProfile();
              if ('ok' in result) {
                profile = result.ok;
                console.log('Loaded provider profile from backend:', profile);
              }
            }
          } catch (error) {
            console.error('Failed to load profile from backend:', error);
            profile = await getUserProfile();
          }
        } else {
          console.log('Backend not connected or no user type, using getUserProfile fallback...');
          profile = await getUserProfile();
        }
        
        setUserProfile(profile);
        
        if (isConnected && actor) {
          try {
            // TODO: Uncomment when getPlatformStatistics is added to backend
            // const platformData = await actor.getPlatformStatistics();
            // setPlatformStats(platformData);
            
            // Mock platform stats for now
            setPlatformStats({
              totalServices: 0,
              totalProviders: 0,
              totalClients: 0,
              averageRating: 0,
              totalBookings: 0,
              completedBookings: 0
            });
          } catch (error) {
            console.error('Failed to load platform statistics:', error);
          }
        }

        if (profile) {
          setStats({
            totalBookings: profile.totalBookings || 0,
            activeServices: availableServices.length,
            earnings: profile.totalEarnings || profile.totalSpent || 0,
            rating: profile.averageRating || 0
          });
        } else {
          // Initialize with zero values for new users
          setStats({
            totalBookings: 0,
            activeServices: availableServices.length,
            earnings: 0,
            rating: 0
          });
        }
        
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    if (user.isAuthenticated) {
      loadUserData();
    }
  }, [user.isAuthenticated, user.principal, isConnected, actor, getUserProfile, availableServices]);

  useEffect(() => {
    setStats(prev => ({
      ...prev,
      activeServices: availableServices.length
    }));
  }, [availableServices]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const generateAvatar = (name: string) => {
    if (!name) return '';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return initials.slice(0, 2);
  };

  const getUserDisplayName = () => {
    if (userProfile?.name) return userProfile.name;
    if (userProfile?.username) return userProfile.username;
    if (userProfile?.fullName) return userProfile.fullName;
    if (userProfile?.businessName) return userProfile.businessName;
    if (user.profile?.username) return user.profile.username;
    if (user.profile?.fullName) return user.profile.fullName;
    if (user.profile?.businessName) return user.profile.businessName;
    return user.userType === 'provider' ? 'Provider' : 'Client';
  };

  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const loadUserActivity = () => {
      if (!user.principal) return;

      if (userProfile?.recentActivity) {
        setRecentActivity(userProfile.recentActivity.slice(0, 10));
      } else if (platformStats?.userActivity) {
        setRecentActivity(platformStats.userActivity.slice(0, 10));
      } else {
        setRecentActivity([]);
      }
    };

    if (user.isAuthenticated && (userProfile || platformStats)) {
      loadUserActivity();
    }
  }, [user.isAuthenticated, user.principal, userProfile, platformStats]);

  const [popularServices, setPopularServices] = useState<any[]>([]);

  useEffect(() => {
    const loadServicesData = () => {
      if (availableServices.length > 0) {
        const backendServices = availableServices.map((service, index) => ({
          id: index + 1,
          name: service,
          icon: getServiceIcon(service),
          bookings: 0,
          avgPrice: 0
        }));
        setPopularServices(backendServices.slice(0, 6));
      } else {
        setPopularServices([]);
      }
    };

    loadServicesData();
  }, [availableServices]);

  const getServiceIcon = (serviceName: string) => {
    const icons: { [key: string]: string } = {
      'HouseCleaning': '🏠',
      'Plumbing': '🔧', 
      'HairStyling': '✂️',
      'Gardening': '🌱',
      'Electrical': '⚡',
      'PetGrooming': '🐕',
      'Tutoring': '📚',
      'Construction': '🏗️',
      'PersonalTraining': '💪'
    };
    return icons[serviceName] || '🔧';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-orange-900 pt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Backend Status Banner */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-300">Backend disconnected - Some features may be limited</span>
            </div>
          </motion.div>
        )}

        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  Welcome, {getUserDisplayName()}!
                </h1>
                <p className="text-orange-100 text-lg mb-2">
                  {user.userType === 'provider' 
                    ? 'Manage your services and connect with clients'
                    : 'Discover and book amazing services in your area'
                  }
                </p>
                <div className="flex items-center space-x-4 text-orange-200 text-sm">
                  <span>{formatDate(currentTime)}</span>
                  <span>•</span>
                  <span>{formatTime(currentTime)}</span>
                  {systemInfo && (
                    <>
                      <span>•</span>
                      <span>Platform v{systemInfo.version}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-6 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(user.userType === 'provider' ? '/provider-dashboard' : '/book')}
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  {user.userType === 'provider' ? <Briefcase className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  <span>{user.userType === 'provider' ? 'Business Dashboard' : 'Book Service'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/services')}
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <Search className="w-5 h-5" />
                  <span>Browse Services</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-2 border border-gray-700">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'overview'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Briefcase size={16} />
                <span>Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('wallet')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'wallet'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <WalletIcon size={16} />
                <span>Wallet</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <motion.div variants={itemVariants} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">
                  {user.userType === 'provider' ? 'Total Clients' : 'Total Bookings'}
                </p>
                <p className="text-2xl font-bold text-white">{stats.totalBookings}</p>
              </div>
              <div className="bg-orange-500/20 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-green-400 text-sm">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span>
                {stats.totalBookings === 0 
                  ? (user.userType === 'provider' ? 'Start accepting clients' : 'Start booking services')
                  : `${Math.round(Math.min(stats.totalBookings * 10, 100))}% growth rate`
                }
              </span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Available Services</p>
                <p className="text-2xl font-bold text-white">{stats.activeServices}</p>
              </div>
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <Briefcase className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-blue-400 text-sm">
              <span>
                {supportedLocations.length > 0 
                  ? `${supportedLocations.length} locations supported`
                  : 'Expanding to more locations'
                }
              </span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">
                  {user.userType === 'provider' ? 'Total Earnings' : 'Total Spent'}
                </p>
                <p className="text-2xl font-bold text-white">R{stats.earnings}</p>
              </div>
              <div className="bg-green-500/20 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-green-400 text-sm">
              <span>
                {stats.earnings === 0 
                  ? (user.userType === 'provider' ? 'Ready to earn!' : 'No expenses yet')
                  : 'This month'
                }
              </span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Average Rating</p>
                <p className="text-2xl font-bold text-white">
                  {stats.rating > 0 ? stats.rating.toFixed(1) : '--'}
                </p>
              </div>
              <div className="bg-yellow-500/20 p-3 rounded-lg">
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
            <div className="flex items-center mt-4 text-yellow-400 text-sm">
              <span>
                {stats.rating === 0 
                  ? 'No reviews yet'
                  : stats.totalBookings > 0 
                    ? `Based on ${stats.totalBookings} ${stats.totalBookings === 1 ? 'review' : 'reviews'}`
                    : 'Rating available'
                }
              </span>
            </div>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Popular Services */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {user.userType === 'provider' ? 'Your Services' : 'Popular Services'}
              </h2>
              <button 
                onClick={() => navigate('/services')}
                className="text-orange-500 hover:text-orange-400 text-sm font-medium flex items-center"
              >
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularServices.length > 0 ? (
                popularServices.map((service) => (
                  <motion.div
                    key={service.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => navigate('/services')}
                    className="bg-gray-700/50 rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-600/50 border border-gray-600/50 hover:border-orange-500/30"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{service.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{service.name}</h3>
                        <p className="text-gray-400 text-sm">
                          {service.bookings > 0 ? `${service.bookings} bookings` : 'Available'}
                        </p>
                      </div>
                      <div className="text-right">
                        {service.avgPrice > 0 ? (
                          <>
                            <p className="text-orange-500 font-medium">R{service.avgPrice}</p>
                            <p className="text-gray-400 text-xs">avg price</p>
                          </>
                        ) : (
                          <p className="text-gray-400 text-sm">Quote on request</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  <div className="bg-gray-700/30 rounded-lg p-6">
                    <Briefcase className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <h4 className="text-white text-lg font-medium mb-2">No Services Available</h4>
                    <p className="text-gray-400 text-sm mb-4">
                      {user.userType === 'provider' 
                        ? 'Set up your services to start connecting with clients'
                        : 'Services are being loaded from the platform'
                      }
                    </p>
                    {user.userType === 'provider' && (
                      <button 
                        onClick={() => navigate('/provider-dashboard')}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                      >
                        Set Up Services
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Recent Activity</h2>
              <button 
                onClick={() => navigate('/notifications')}
                className="text-orange-500 hover:text-orange-400 text-sm font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors">
                    <div className="bg-orange-500/20 p-2 rounded-lg">
                      {activity.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {activity.status === 'in-progress' && <Clock className="w-4 h-4 text-blue-500" />}
                      {activity.status === 'scheduled' && <Calendar className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white text-sm font-medium">{activity.service}</h4>
                      <p className="text-gray-400 text-xs">
                        {user.userType === 'provider' ? 'Client: ' : 'Provider: '}
                        {activity.provider}
                      </p>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          activity.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          activity.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {activity.status}
                        </span>
                        <span className="text-gray-500 text-xs">{activity.date}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="bg-gray-700/30 rounded-lg p-6">
                    <Bell className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <h4 className="text-white text-lg font-medium mb-2">No Activity Yet</h4>
                    <p className="text-gray-400 text-sm mb-4">
                      {user.userType === 'provider' 
                        ? 'Start offering your services to see activity here'
                        : 'Book your first service to see activity here'
                      }
                    </p>
                    <button 
                      onClick={() => navigate(user.userType === 'provider' ? '/provider-dashboard' : '/services')}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                    >
                      {user.userType === 'provider' ? 'Set Up Services' : 'Browse Services'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="mt-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-white text-xl font-bold mb-2">
                {user.userType === 'provider' 
                  ? 'Ready to grow your business?' 
                  : 'Need a service right now?'
                }
              </h3>
              <p className="text-orange-100">
                {user.userType === 'provider'
                  ? 'Manage your services and connect with more clients in your area.'
                  : 'Get instant quotes from verified providers in your area.'
                }
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(user.userType === 'provider' ? '/provider-dashboard' : '/book')}
                className="bg-white text-orange-500 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center"
              >
                {user.userType === 'provider' ? 'Manage Services' : 'Book Now'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/services')}
                className="bg-orange-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-800 transition-colors flex items-center justify-center"
              >
                Browse All Services
              </motion.button>
            </div>
          </div>
        </motion.div>
        </>
        )}

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Wallet />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;