import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Account, OnboardingInput } from '../types';
import { apiRequest } from '../utils/apiRequest';
import { getServiceCategoryStrings } from '../utils/serviceUtils';

interface AuthState {
  currentUser: Account | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, keepSignedIn?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, keepSignedIn?: boolean) => Promise<'google' | 'check-email'>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  switchRole: (input: OnboardingInput) => Promise<void>;
  updateProfile: (input: Omit<OnboardingInput, 'role'>) => Promise<void>;
  logout: () => Promise<void>;
  googleLogin: (keepSignedIn?: boolean) => void;
}

const AuthContext = createContext<any>(null);

const unavailable = async (..._args: any[]): Promise<any> => {
  throw new Error('This feature is being migrated and is not available yet.');
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Account>('/auth/me').then(setCurrentUser).catch(() => setCurrentUser(null)).finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string, keepSignedIn = false) => {
    const user = await apiRequest<Account>('/auth/login', { method: 'POST', data: { email, password, keepSignedIn } });
    queryClient.clear();
    setCurrentUser(user);
  };
  const register = async (name: string, email: string, password: string, keepSignedIn = false) => {
    const result = await apiRequest<{ next?: 'google' | 'check-email' }>('/auth/register', { method: 'POST', data: { name, email, password, keepSignedIn } });
    return result.next === 'google' ? 'google' : 'check-email';
  };
  const completeOnboarding = async (input: OnboardingInput) => {
    const user = await apiRequest<Account>('/auth/onboarding', { method: 'POST', data: input });
    setCurrentUser(user);
  };
  const switchRole = async (input: OnboardingInput) => {
    const user = await apiRequest<Account>('/auth/switch-role', { method: 'POST', data: input });
    await queryClient.cancelQueries();
    queryClient.clear();
    setCurrentUser(user);
  };
  const updateProfile = async (input: Omit<OnboardingInput, 'role'>) => {
    const user = await apiRequest<Account>('/auth/profile', { method: 'PATCH', data: input });
    setCurrentUser(user);
  };
  const logout = async () => {
    setError(null);
    try { await apiRequest('/auth/logout', { method: 'POST' }); queryClient.clear(); setCurrentUser(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign out'); }
  };
  const googleLogin = (keepSignedIn = false) => { window.location.href = `/api/auth/google?keepSignedIn=${keepSignedIn}`; };
  const getUserProfile = useCallback(async () => {
    if (!currentUser) return null;
    const { profile, ...account } = currentUser;
    return { ...account, ...profile };
  }, [currentUser]);

  const auth: AuthState = {
    currentUser, isAuthenticated: !!currentUser, isLoading, error, login, register, completeOnboarding, switchRole, updateProfile, logout, googleLogin,
  };
  const categories = getServiceCategoryStrings();
  const value = {
    ...auth, openSignIn: () => { window.location.href = "/signin"; },
    user: {
      id: currentUser?.id,
      isAuthenticated: auth.isAuthenticated,
      userType: currentUser?.profile?.role ?? null,
    },
    isConnected: false, actor: null, systemInfo: null, services: [], activeServices: [], availableServices: [],
    supportedCategories: categories, supportedLocations: [],
    getSupportedServiceCategories: async () => categories,
    getServiceStats: unavailable, getAllServices: unavailable, getActiveServices: unavailable,
    getServicesByCategory: unavailable, getServicesByProvider: unavailable, searchServices: unavailable,
    searchProviders: unavailable, refreshServices: unavailable, createService: unavailable,
    getService: unavailable, createBooking: unavailable, getClientBookings: unavailable,
    getClientProfile: unavailable, getProviderProfile: unavailable, getUserProfile,
    updateUserProfile: unavailable, updateClientProfile: unavailable, updateProviderProfile: unavailable,
    registerClient: unavailable, registerProvider: unavailable, getCurrentUser: async () => currentUser,
    createConversation: unavailable, sendMessage: unavailable, getMessages: unavailable,
    getConversations: unavailable, markMessagesAsRead: unavailable, getMessagingStats: unavailable,
    blockUser: unavailable, unblockUser: unavailable, getAllNotifications: unavailable,
    getNotifications: unavailable, getProviderNotifications: unavailable, getUnreadNotifications: unavailable,
    getUnreadNotificationCount: unavailable, markNotificationAsRead: unavailable,
    markAllNotificationsAsRead: unavailable, deleteNotification: unavailable, deleteAllNotifications: unavailable,
    getNotificationById: unavailable, getNotificationStats: unavailable, getNotificationsByType: unavailable,
    getNotificationByType: unavailable, createSystemNotification: unavailable, getProviderBookings: unavailable,
    acceptproviderBooking: unavailable, rejectProviderBooking: unavailable, completeProviderBooking: unavailable,
    updateProviderAvailability: unavailable, getProviderReviews: unavailable, getProviderAnalytics: unavailable,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthState => useContext(AuthContext);
export const useApp = () => useContext(AuthContext);
export interface Service { [key: string]: any }
