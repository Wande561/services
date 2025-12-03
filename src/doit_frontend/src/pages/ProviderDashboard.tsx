import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Calendar, 
  MessageSquare, 
  Settings, 
  Star,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  Mail,
  FileText,
  Briefcase,
  Plus,
  Search,
  BarChart3
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Principal } from '@dfinity/principal';

const ProviderDashboard: React.FC = () => {
  const { 
    user, 
    isLoading, 
    actor, 
    getUserProfile,
    getProviderProfile,
    getProviderBookings,
    getServicesByProvider,
    getProviderAnalytics,
    getConversations
  } = useApp();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [providerStats, setProviderStats] = useState({
    totalServices: 0,
    totalBookings: 0,
    completedJobs: 0,
    averageRating: 0.0,
    totalEarnings: 0.0,
    reviewCount: 0
  });
  const [providerBookings, setProviderBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    if (!isLoading && (!user.isAuthenticated || user.userType !== 'provider')) {
      navigate('/signin');
    }
  }, [user.isAuthenticated, user.userType, isLoading, navigate]);

  useEffect(() => {
    const loadProviderData = async () => {
      if (user.isAuthenticated && user.userType === 'provider' && actor) {
        setLoading(true);
        try {
          // Use getProviderProfile for providers to get business name and provider-specific data
          let profile;
          try {
            profile = await getProviderProfile();
            console.log('Provider profile loaded:', profile);
          } catch (providerError) {
            console.log('getProviderProfile failed, trying getUserProfile:', providerError);
            profile = await getUserProfile();
            console.log('User profile loaded as fallback:', profile);
          }
          setUserProfile(profile);

          try {
            const providerServices = await getServicesByProvider();
            console.log('Provider services from backend:', providerServices);
            
            setProviderStats(prevStats => ({
              ...prevStats,
              totalServices: providerServices.length
            }));
          } catch (error) {
            console.error('Failed to load provider services:', error);
          }

          try {
            const bookings = await getProviderBookings();
            console.log('Provider bookings from backend:', bookings);
            setProviderBookings(bookings);
            
            const completedBookings = bookings.filter((booking: any) => 
              booking.status && booking.status.Completed !== undefined
            );
            
            setProviderStats(prevStats => ({
              ...prevStats,
              totalBookings: bookings.length,
              completedJobs: completedBookings.length
            }));
          } catch (error) {
            console.error('Failed to load provider bookings:', error);
          }

          try {
            const analytics = await getProviderAnalytics();
            console.log('Provider analytics from backend:', analytics);
            
            if (analytics) {
              setProviderStats(prevStats => ({
                ...prevStats,
                averageRating: analytics.averageRating || 0.0,
                totalEarnings: analytics.totalEarnings || 0.0,
                reviewCount: analytics.reviewCount || 0
              }));
            }
          } catch (error) {
            console.error('Failed to load provider analytics:', error);
          }

          // Provider data is now loaded from backend via getUserProfile() above
          // No need for localStorage provider data

        } catch (error) {
          console.error('Failed to load provider data:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadProviderData();
  }, [user.isAuthenticated, user.userType, actor, getUserProfile, getServicesByProvider, getProviderBookings, getProviderAnalytics]);

  useEffect(() => {
    const checkUnreadMessages = async () => {
      if (user.isAuthenticated && user.principal) {
        try {
          // Use backend function to get conversations
          const conversations = await getConversations();
          const totalUnread = conversations.reduce((sum: number, conv: any) => sum + (conv.unread || 0), 0);
          setUnreadMessageCount(totalUnread);
        } catch (error) {
          console.error('Failed to load conversations:', error);
          setUnreadMessageCount(0);
        }
      }
    };

    checkUnreadMessages();

    const interval = setInterval(checkUnreadMessages, 30000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes(`conversations_${user.principal}`) || 
          e.key?.includes(`messages_${user.principal}`)) {
        checkUnreadMessages();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user.isAuthenticated, user.principal]);

  const calculateProfileCompletion = (profile: any) => {
    if (!profile) return 0;
    
    let completedFields = 0;
    const totalFields = 10; 
    
    if (profile.fullName || profile.businessName) completedFields++;
    if (profile.email) completedFields++;
    if (profile.phone) completedFields++;
    if (profile.location) completedFields++;
    if (profile.services && profile.services.length > 0) completedFields++;
    if (profile.experience) completedFields++;
    if (profile.baseRate) completedFields++;
    if (profile.description) completedFields++;
    if (profile.idNumber) completedFields++;
    if (profile.backgroundCheck) completedFields++;
    
    return Math.round((completedFields / totalFields) * 100);
  };

  if (isLoading || !user.isAuthenticated || user.userType !== 'provider' || loading) {
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

  const stats = [
    { 
      title: 'Total Bookings', 
      value: providerStats.totalBookings.toString(), 
      change: providerStats.totalBookings > 0 ? '+0%' : '0%', 
      color: providerStats.totalBookings > 0 ? 'text-green-500' : 'text-gray-400' 
    },
    { 
      title: 'Revenue This Month', 
      value: `R${providerStats.totalEarnings.toFixed(2)}`, 
      change: providerStats.totalEarnings > 0 ? '+0%' : '0%', 
      color: providerStats.totalEarnings > 0 ? 'text-green-500' : 'text-gray-400' 
    },
    { 
      title: 'Average Rating', 
      value: providerStats.averageRating.toFixed(1), 
      change: providerStats.averageRating > 0 ? '+0%' : '0%', 
      color: providerStats.averageRating > 0 ? 'text-green-500' : 'text-gray-400' 
    },
    { 
      title: 'Active Services', 
      value: providerStats.totalServices.toString(), 
      change: providerStats.totalServices > 0 ? '0%' : '0%', 
      color: providerStats.totalServices > 0 ? 'text-green-500' : 'text-gray-400' 
    }
  ];

  const recentBookings = providerBookings.length > 0 ? providerBookings.slice(0, 5).map((booking: any) => ({
    client: booking.clientId ? booking.clientId.toText().substring(0, 10) + '...' : 'Anonymous Client',
    service: booking.serviceId || 'Service',
    time: `${booking.date} ${booking.time}`,
    status: booking.status?.Pending ? 'Pending' : 
            booking.status?.Confirmed ? 'Confirmed' : 
            booking.status?.Completed ? 'Completed' : 
            booking.status?.Cancelled ? 'Cancelled' :
            booking.status?.InProgress ? 'In Progress' : 'Unknown'
  })) : [
    { client: 'No bookings yet', service: 'Start accepting clients', time: 'Get discovered', status: 'Ready' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-orange-900 pt-24 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Provider Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  Welcome, {
                    userProfile?.businessName || 
                    userProfile?.username || 
                    userProfile?.fullName || 
                    user.profile?.businessName || 
                    user.profile?.username || 
                    user.profile?.fullName || 
                    'Provider'
                  }!
                </h1>
                {/* Debug info - remove after testing */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-sm text-orange-200 mt-2 p-2 bg-orange-500/20 rounded">
                    Debug: userProfile loaded={!!userProfile} | user.profile loaded={!!user.profile} | businessName={userProfile?.businessName || 'Not set'}
                  </div>
                )}
                <p className="text-orange-100 text-lg mb-2">
                  Manage your services, track bookings, and grow your business
                </p>
                <div className="flex items-center space-x-4 text-orange-200 text-sm">
                  <span>{formatDate(currentTime)}</span>
                  <span>•</span>
                  <span>{formatTime(currentTime)}</span>
                  <span>•</span>
                  <span>Provider Dashboard v1.0</span>
                </div>
              </div>
              <div className="mt-6 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/services')}
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>View Analytics</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/profile')}
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  <span>Manage Profile</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat, index) => (
            <div key={index} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.title}</p>
                  <p className="text-white text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm ${stat.color}`}>{stat.change}</p>
                  <TrendingUp className="w-5 h-5 text-gray-400 mt-1" />
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Bookings */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Recent Bookings</h2>
              <button className="text-orange-400 hover:text-orange-300 text-sm">View All</button>
            </div>
            <div className="space-y-4">
              {recentBookings.map((booking, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{booking.client}</p>
                      <p className="text-gray-400 text-sm">{booking.service}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{booking.time}</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                      booking.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                      booking.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Profile Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700"
          >
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-white text-lg font-semibold">Your Profile</h3>
              <p className="text-gray-400 text-sm">Provider Profile</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Profile Completion</span>
                <span className="text-white text-sm">{calculateProfileCompletion(userProfile)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500" 
                  style={{width: `${calculateProfileCompletion(userProfile)}%`}}
                ></div>
              </div>
              
              <div className="pt-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-300 text-sm">
                    {providerStats.averageRating > 0 
                      ? `${providerStats.averageRating.toFixed(1)} Rating (${providerStats.reviewCount} review${providerStats.reviewCount !== 1 ? 's' : ''})`
                      : 'No reviews yet'
                    }
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">
                    {userProfile?.location || 'Location not set'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">
                    {userProfile?.services && userProfile.services.length > 0 
                      ? userProfile.services.slice(0, 2).join(', ') + (userProfile.services.length > 2 ? ` +${userProfile.services.length - 2} more` : '')
                      : 'No services selected'
                    }
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">
                    {userProfile?.experience 
                      ? `${userProfile.experience}${userProfile.experience === '0' ? ' (less than a year)' : userProfile.experience === '10' ? '+ years' : userProfile.experience === '1' ? ' year' : ' years'} experience`
                      : 'Experience not set'
                    }
                  </span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/profile')}
                className="w-full mt-6 bg-gradient-to-r from-orange-600 to-red-600 text-white py-2 px-4 rounded-lg hover:from-orange-700 hover:to-red-700 transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <button 
            onClick={() => navigate('/messages')}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-orange-500 transition-colors text-left"
          >
            <MessageSquare className="w-8 h-8 text-orange-500 mb-4" />
            <h3 className="text-white font-semibold mb-2">Messages</h3>
            <p className="text-gray-400 text-sm">
              {unreadMessageCount > 0 
                ? `${unreadMessageCount} new message${unreadMessageCount === 1 ? '' : 's'} from clients`
                : 'No new messages'
              }
            </p>
          </button>

          <button className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-orange-500 transition-colors text-left">
            <Calendar className="w-8 h-8 text-orange-500 mb-4" />
            <h3 className="text-white font-semibold mb-2">Schedule</h3>
            <p className="text-gray-400 text-sm">Manage your availability</p>
          </button>

          <button className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-orange-500 transition-colors text-left">
            <FileText className="w-8 h-8 text-orange-500 mb-4" />
            <h3 className="text-white font-semibold mb-2">Services</h3>
            <p className="text-gray-400 text-sm">Update your service offerings</p>
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
