import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Check, X, Clock, User, MessageSquare, Star, Calendar, Settings, RefreshCw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  backendId?: string; // For backend notifications
}

interface FilterOption {
  id: string;
  label: string;
  count: number;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { 
    user, 
    isConnected, 
    isLoading,
    // Backend notification functions
    getAllNotifications,
    getUnreadNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification: deleteNotificationFromBackend,
    getNotificationStats,
    getNotificationsByType
  } = useApp();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [notificationStats, setNotificationStats] = useState({
    totalNotifications: 0,
    unreadNotifications: 0,
    readNotifications: 0
  });

  // Load notifications from backend
  useEffect(() => {
    const loadNotifications = async () => {
      if (user.isAuthenticated && user.principal && isConnected) {
        setNotificationsLoading(true);
        try {
          // Get all notifications from backend
          const backendNotifications = await getAllNotifications();
          
          // Convert backend notifications to proper format with icons
          const formattedNotifications = backendNotifications.map((notif: any, index: number) => ({
            id: notif.id || index,
            type: getTypeFromBackend(notif.type_),
            title: notif.title || 'Notification',
            message: notif.message || '',
            time: formatTime(new Date(Number(notif.createdAt) / 1000000).toISOString()),
            read: notif.isRead || false,
            icon: getIconForType(getTypeFromBackend(notif.type_)),
            color: getColorForType(getTypeFromBackend(notif.type_)),
            backendId: notif.id
          }));
          
          setNotifications(formattedNotifications);
          
          // Load notification stats
          const stats = await getNotificationStats();
          setNotificationStats(stats);
          
        } catch (error) {
          console.error('Failed to load notifications from backend:', error);
          setNotifications([]);
        } finally {
          setNotificationsLoading(false);
        }
      } else if (user.isAuthenticated) {
        console.log('Backend not connected');
        setNotifications([]);
      }
    };

    // Removed loadFromLocalStorage - now using backend only

    loadNotifications();
  }, [user.isAuthenticated, user.principal]);
  
  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !user.isAuthenticated) {
      navigate('/signin');
    }
  }, [user.isAuthenticated, isLoading, navigate]);

  // Helper functions
  const getTypeFromBackend = (backendType: any): string => {
    if (typeof backendType === 'object' && backendType !== null) {
      if ('BookingRequest' in backendType) return 'booking';
      if ('BookingConfirmed' in backendType) return 'booking';
      if ('BookingCancelled' in backendType) return 'booking';
      if ('PaymentReceived' in backendType) return 'payment';
      if ('ReviewReceived' in backendType) return 'review';
      if ('MessageReceived' in backendType) return 'message';
      if ('SystemUpdate' in backendType) return 'system';
    }
    return 'system'; // default fallback
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'booking': return Calendar;
      case 'message': return MessageSquare;
      case 'review': return Star;
      case 'system': return User;
      case 'payment': return Check;
      case 'reminder': return Clock;
      default: return Bell;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'booking': return 'text-blue-500';
      case 'message': return 'text-green-500';
      case 'review': return 'text-yellow-500';
      case 'system': return 'text-orange-500';
      case 'payment': return 'text-green-500';
      case 'reminder': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  const createSampleNotifications = () => {
    if (!user.principal) return;
    
    const sampleNotifications = [
      {
        id: 1,
        type: 'system',
        title: 'Welcome to DoIt!',
        message: 'Welcome to our platform! Complete your profile to start connecting with clients and providers.',
        time: new Date().toISOString(),
        read: false
      },
      {
        id: 2,
        type: 'system',
        title: 'Profile Setup Complete',
        message: 'Your profile has been successfully set up. You can now start offering or booking services.',
        time: new Date(Date.now() - 300000).toISOString(),
        read: true
      }
    ];

    // Sample notifications now stored in backend automatically
    
    const formattedNotifications = sampleNotifications.map(notif => ({
      ...notif,
      icon: getIconForType(notif.type),
      color: getColorForType(notif.type),
      time: formatTime(notif.time)
    }));
    
    setNotifications(formattedNotifications);
  };

  const markAsRead = async (id: number) => {
    try {
      // Find the notification to get its backend ID
      const notification = notifications.find(notif => notif.id === id);
      if (!notification) return;

      if (isConnected && notification.backendId) {
        // Use backend function
        const success = await markNotificationAsRead(notification.backendId);
        if (success) {
          const updatedNotifications = notifications.map(notif => 
            notif.id === id ? { ...notif, read: true } : notif
          );
          setNotifications(updatedNotifications);
        }
      } else {
        // Backend-only - no localStorage fallback needed
        const updatedNotifications = notifications.map(notif => 
          notif.id === id ? { ...notif, read: true } : notif
        );
        setNotifications(updatedNotifications);
        // Notifications now persist in backend automatically
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (isConnected) {
        // Use backend function
        const success = await markAllNotificationsAsRead();
        if (success) {
          const updatedNotifications = notifications.map(notif => ({ ...notif, read: true }));
          setNotifications(updatedNotifications);
        }
      } else {
        console.log('Backend not connected - cannot mark notifications as read');
        // Only update local state, no localStorage
        const updatedNotifications = notifications.map(notif => ({ ...notif, read: true }));
        setNotifications(updatedNotifications);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      // Find the notification to get its backend ID
      const notification = notifications.find(notif => notif.id === id);
      if (!notification) return;

      if (isConnected && notification.backendId) {
        // Use backend function
        const success = await deleteNotificationFromBackend(notification.backendId);
        if (success) {
          const updatedNotifications = notifications.filter(notif => notif.id !== id);
          setNotifications(updatedNotifications);
        }
      } else {
        console.log('Backend not connected - cannot delete notification');
        // Only update local state, no localStorage
        const updatedNotifications = notifications.filter(notif => notif.id !== id);
        setNotifications(updatedNotifications);
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const refreshNotifications = async () => {
    if (user.isAuthenticated && user.principal) {
      setNotificationsLoading(true);
      try {
        if (isConnected) {
          // Get fresh notifications from backend
          const backendNotifications = await getAllNotifications();
          
          // Convert backend notifications to proper format with icons
          const formattedNotifications = backendNotifications.map((notif: any, index: number) => ({
            id: notif.id || index,
            type: getTypeFromBackend(notif.type_),
            title: notif.title || 'Notification',
            message: notif.message || '',
            time: formatTime(new Date(Number(notif.createdAt) / 1000000).toISOString()),
            read: notif.isRead || false,
            icon: getIconForType(getTypeFromBackend(notif.type_)),
            color: getColorForType(getTypeFromBackend(notif.type_)),
            backendId: notif.id
          }));
          
          setNotifications(formattedNotifications);
          
          // Load fresh notification stats
          const stats = await getNotificationStats();
          setNotificationStats(stats);
        }
      } catch (error) {
        console.error('Failed to refresh notifications:', error);
      } finally {
        setNotificationsLoading(false);
      }
    }
  };

  // Helper to convert time string back to milliseconds for storage
  const getMillisecondsFromTimeString = (timeStr: string): number => {
    if (timeStr.includes('minutes ago')) {
      const mins = parseInt(timeStr.split(' ')[0]);
      return mins * 60 * 1000;
    }
    if (timeStr.includes('hours ago')) {
      const hours = parseInt(timeStr.split(' ')[0]);
      return hours * 60 * 60 * 1000;
    }
    if (timeStr.includes('days ago')) {
      const days = parseInt(timeStr.split(' ')[0]);
      return days * 24 * 60 * 60 * 1000;
    }
    return 0; // Just now
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.read;
    if (filter === 'read') return notif.read;
    return true;
  });

  // Use backend stats if available, otherwise calculate from local notifications
  const unreadCount = isConnected && notificationStats.unreadNotifications > 0 
    ? notificationStats.unreadNotifications 
    : notifications.filter(notif => !notif.read).length;

  const totalCount = isConnected && notificationStats.totalNotifications > 0
    ? notificationStats.totalNotifications
    : notifications.length;

  const readCount = isConnected && notificationStats.readNotifications > 0
    ? notificationStats.readNotifications
    : notifications.length - unreadCount;

  const filterOptions: FilterOption[] = [
    { id: 'all', label: 'All', count: totalCount },
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'read', label: 'Read', count: readCount }
  ];

  return (
    <div className="min-h-screen bg-gray-900 pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Loading State */}
        {(isLoading || notificationsLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-20"
          >
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <span className="text-white">Loading notifications...</span>
            </div>
          </motion.div>
        )}

        {/* Authentication Required */}
        {!isLoading && !user.isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="bg-gray-800 rounded-xl p-8 max-w-md mx-auto">
              <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">Sign In Required</h2>
              <p className="text-gray-400 mb-6">
                You need to sign in to view your notifications
              </p>
              <button
                onClick={() => navigate('/signin')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Sign In
              </button>
            </div>
          </motion.div>
        )}

        {/* Authenticated Content */}
        {!isLoading && !notificationsLoading && user.isAuthenticated && (
          <>
            {/* Backend Connection Status */}
            {!isConnected && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-yellow-300">Using offline notifications - Real-time updates unavailable</span>
                </div>
              </motion.div>
            )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
            <p className="text-gray-400">
              {unreadCount > 0 ? `You have ${unreadCount} unread notifications` : 'All caught up!'}
              {isConnected && (
                <span className="ml-2 text-green-400">• Live from backend</span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {isConnected && (
              <button
                onClick={refreshNotifications}
                disabled={notificationsLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${notificationsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Mark All Read
              </button>
            )}
            <button className="p-2 text-gray-400 hover:text-orange-500 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex gap-2 mb-6"
        >
          {filterOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === option.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </motion.div>

        {/* Notifications List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="space-y-3"
        >
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No notifications found</h3>
              <p className="text-gray-500">You're all caught up! Check back later for updates.</p>
            </div>
          ) : (
            filteredNotifications.map((notification, index) => {
              const IconComponent = notification.icon;
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className={`bg-gray-800 rounded-lg p-4 border-l-4 hover:bg-gray-750 transition-colors ${
                    !notification.read 
                      ? 'border-orange-500 bg-gray-800/80' 
                      : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full bg-gray-700 ${notification.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-medium ${
                          !notification.read ? 'text-white' : 'text-gray-300'
                        }`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        )}
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-2">{notification.message}</p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-xs">{notification.time}</span>
                        
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                            >
                              Mark as read
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default Notifications;