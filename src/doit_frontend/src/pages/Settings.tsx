import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Globe, Palette, Moon, Sun, Smartphone, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

type NotificationType = keyof NotificationSettings;

const Settings = () => {
  const navigate = useNavigate();
  const { 
    user, 
    isConnected, 
    isLoading, 
    getUserProfile, 
    updateUserProfile,
    // Backend functions for client/provider profiles
    getClientProfile,
    updateClientProfile,
    getProviderProfile,
    updateProviderProfile
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email: true,
    push: true,
    sms: false,
    marketing: false
  });
  const [privacySettings, setPrivacySettings] = useState({
    showProfilePublic: true,
    allowDirectMessages: true,
    showOnlineStatus: false
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: ''
  });
  const [profileImage, setProfileImage] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadUserSettings = async () => {
    if (!user.isAuthenticated || !user.principal) return;
    
    setSettingsLoading(true);
    try {
      let profile = null;
      
      if (isConnected) {
        console.log('Loading profile from backend...');
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
          } else {
            profile = await getUserProfile();
            console.log('Loaded general profile from backend:', profile);
          }
        } catch (error) {
          console.error('Failed to load profile from backend:', error);
          profile = await getUserProfile();
        }
      } else {
        console.log('Backend not connected, using getUserProfile fallback...');
        profile = await getUserProfile();
      }
      
      if (profile) {
        setUserProfile(profile);
        setProfileImage(profile.profileImage || '');

        const names = profile.name?.split(' ') || profile.username?.split(' ') || ['', ''];
        setProfileForm({
          firstName: names[0] || '',
          lastName: names[1] || '',
          email: profile.email || '',
          phone: profile.phone || '',
          bio: profile.bio || ''
        });
        
        console.log('Profile data loaded successfully');
      }

      const storedNotifications = localStorage.getItem(`settings_notifications_${user.principal}`);
      if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
      }
      
      const storedPrivacy = localStorage.getItem(`settings_privacy_${user.principal}`);
      if (storedPrivacy) {
        setPrivacySettings(JSON.parse(storedPrivacy));
      }
      
      const storedAppearance = localStorage.getItem(`settings_appearance_${user.principal}`);
      if (storedAppearance) {
        const appearance = JSON.parse(storedAppearance);
        setDarkMode(appearance.darkMode ?? true);
      }
      
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    loadUserSettings();
  }, [user.isAuthenticated, user.principal, isConnected]);

  useEffect(() => {
    if (!isLoading && !user.isAuthenticated) {
      navigate('/signin');
    }
  }, [user.isAuthenticated, isLoading, navigate]);

  const saveProfileChanges = async () => {
    if (!user.principal) return;
    
    try {
      setSettingsLoading(true);
      
      if (isConnected) {
        console.log('Saving profile to backend...');

        const fullName = `${profileForm.firstName} ${profileForm.lastName}`.trim();
        
        try {
          if (user.userType === 'client') {
            const result = await updateClientProfile(
              fullName || undefined,
              profileForm.phone || undefined,
              undefined,
              profileImage || undefined
            );
            
            if ('ok' in result) {
              console.log('Client profile updated successfully via backend');
              await loadUserSettings(); 
              return;
            } else {
              throw new Error(result.err || 'Failed to update client profile');
            }
          } else if (user.userType === 'provider') {
            const result = await updateProviderProfile(
              fullName || undefined,
              profileForm.phone || undefined,
              undefined, 
              profileImage || undefined,
              profileForm.bio || undefined
            );
            
            if ('ok' in result) {
              console.log('Provider profile updated successfully via backend');
              await loadUserSettings();
              return;
            } else {
              throw new Error(result.err || 'Failed to update provider profile');
            }
          } else {
            throw new Error('Unsupported user type for backend update');
          }
        } catch (backendError) {
          console.error('Backend update failed:', backendError);
          throw backendError;
        }
      } else {
        console.log('Backend not connected, cannot save settings');
        throw new Error('Backend not available for settings update');
      }
      
    } catch (error) {
      console.error('Failed to update profile:', error);
      setError('Failed to update profile. Please ensure you are connected to the backend.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const updateProfileLocally = async () => {
    // Update user profile with new data (localStorage fallback)
    const updatedProfile = {
      ...userProfile,
      username: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
      name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
      email: profileForm.email,
      phone: profileForm.phone,
      bio: profileForm.bio,
      profileImage: profileImage,
      lastUpdated: Date.now()
    };
    
    await updateUserProfile(updatedProfile);
    setUserProfile(updatedProfile);
    
    console.log('Profile updated locally');
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        return;
      }

      setUploading(true);
      
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setProfileImage(base64);
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Error reading file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveNotificationSettings = (newSettings: NotificationSettings) => {
    if (!user.principal) return;
    
    setNotifications(newSettings);
    // Settings now only saved through backend when profile is updated
    console.log('Notification settings updated:', newSettings);
  };

  const savePrivacySettings = (newSettings: any) => {
    if (!user.principal) return;
    
    setPrivacySettings(newSettings);
    // Settings now only saved through backend when profile is updated
    console.log('Privacy settings updated:', newSettings);
  };

  const saveAppearanceSettings = (darkModeEnabled: boolean) => {
    if (!user.principal) return;
    
    setDarkMode(darkModeEnabled);
    // Settings now only saved through backend when profile is updated
    console.log('Appearance settings updated:', { darkMode: darkModeEnabled });
    
    // Apply theme to document
    if (darkModeEnabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const tabs: Tab[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  if (isLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <motion.div
          className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (!user.isAuthenticated) {
    return null;
  }

  // Generate avatar from username
  const generateAvatar = (name: string) => {
    if (!name) return '';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
    return initials.slice(0, 2);
  };

  const userName = userProfile?.name || userProfile?.username || userProfile?.fullName || userProfile?.businessName || (user.profile as any)?.name || user.profile?.username || user.profile?.fullName || user.profile?.businessName || (user.userType === 'provider' ? 'Provider' : 'Client');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Backend Connection Status */}
      {!isConnected && (
        <div className="max-w-6xl mx-auto px-4 py-2">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg mb-4"
          >
            <div className="flex items-center space-x-2 text-sm">
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-yellow-300">Using offline settings only - Backend sync unavailable</span>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-orange-100">Manage your account and preferences</p>
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
              <nav className="p-4 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-8">
              {activeTab === 'profile' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Profile Settings</h2>
                    
                    {/* Profile Picture */}
                    <div className="flex items-center gap-6 mb-8">
                      <div className="relative">
                        {profileImage ? (
                          <img
                            src={profileImage}
                            alt="Profile"
                            className="w-24 h-24 rounded-full object-cover border-4 border-orange-400"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                            {generateAvatar(userName)}
                          </div>
                        )}
                        {uploading && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{userName}</h3>
                        <p className="text-gray-500 dark:text-gray-400">Profile picture</p>
                        <div className="mt-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="profile-image-upload"
                            disabled={uploading}
                          />
                          <label
                            htmlFor="profile-image-upload"
                            className={`inline-block px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                              uploading
                                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {uploading ? 'Uploading...' : 'Change Photo'}
                          </label>
                          {profileImage && (
                            <button
                              onClick={() => setProfileImage('')}
                              className="ml-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF. Max size 2MB.</p>
                      </div>
                    </div>

                    {/* Profile Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter your first name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter your last name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter your email"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                          placeholder="Enter your phone number"
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Tell us about yourself..."
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={saveProfileChanges}
                        className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'notifications' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Notification Settings</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Mail className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...notifications, email: !notifications.email };
                            saveNotificationSettings(newSettings);
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            notifications.email ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              notifications.email ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Push Notifications</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications in browser</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...notifications, push: !notifications.push };
                            saveNotificationSettings(newSettings);
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            notifications.push ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              notifications.push ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">SMS Notifications</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via SMS</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...notifications, sms: !notifications.sms };
                            saveNotificationSettings(newSettings);
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            notifications.sms ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              notifications.sms ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Marketing Communications</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Receive updates about new features and products</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...notifications, marketing: !notifications.marketing };
                            saveNotificationSettings(newSettings);
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            notifications.marketing ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              notifications.marketing ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'privacy' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Privacy Settings</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">Public Profile</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Allow others to see your profile information</p>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...privacySettings, showProfilePublic: !privacySettings.showProfilePublic };
                            savePrivacySettings(newSettings);
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            privacySettings.showProfilePublic ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              privacySettings.showProfilePublic ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">Direct Messages</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Allow others to send you direct messages</p>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...privacySettings, allowDirectMessages: !privacySettings.allowDirectMessages };
                            savePrivacySettings(newSettings);
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            privacySettings.allowDirectMessages ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              privacySettings.allowDirectMessages ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">Online Status</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Show when you're online to other users</p>
                        </div>
                        <button
                          onClick={() => {
                            const newSettings = { ...privacySettings, showOnlineStatus: !privacySettings.showOnlineStatus };
                            savePrivacySettings(newSettings);
                          }}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            privacySettings.showOnlineStatus ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              privacySettings.showOnlineStatus ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Password & Security</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Current Password
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                                placeholder="Enter current password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>
                          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                            Change Password
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'appearance' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Appearance Settings</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          {darkMode ? <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Dark Mode</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => saveAppearanceSettings(!darkMode)}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            darkMode ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                              darkMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-4">Language</h3>
                        <select className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-600 dark:text-white">
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                          <option value="ja">日本語</option>
                        </select>
                      </div>

                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-4">Time Zone</h3>
                        <select className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-600 dark:text-white">
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">Eastern Time (ET)</option>
                          <option value="America/Chicago">Central Time (CT)</option>
                          <option value="America/Denver">Mountain Time (MT)</option>
                          <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;