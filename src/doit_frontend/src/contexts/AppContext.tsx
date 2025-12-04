import React, { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react';
// import { Actor, HttpAgent } from '@dfinity/agent';
// import { Principal } from '@dfinity/principal';
import { AuthClient, AuthClientCreateOptions, AuthClientLoginOptions } from '@dfinity/auth-client';
import { canisterId as iiCanId } from "../../../declarations/internet_identity";
import { Actor, ActorSubclass, HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, canisterId } from '../../../declarations/doit_backend';
// import { idlFactory as kotomoIdlFactory } from '../../../declarations/kotomo';
import { ServiceCategoryEnum } from '../types';
import { getServiceCategoryStrings } from '../utils/serviceUtils';
import type { 
  _SERVICE,
  Service as BackendService,
  ServiceCategory as BackendServiceCategory,
  ServicePricing as BackendServicePricing,
  AvailabilitySlot as BackendAvailabilitySlot,
} from '../../../declarations/doit_backend/doit_backend.did';
// import type {
//   _SERVICE as KotomoTokenService,
//   Account,
//   Tokens,
//   TransferArg,
//   TransferResult,
//   TransferError,
//   ApproveArgs,
//   ApproveResult,
//   Allowance,
//   AllowanceArgs
// } from '../../../declarations/kotomo/kotomo.did';

let network = "local";
if (typeof process !== "undefined" && process.env && process.env.DFX_NETWORK) {
  network = process.env.DFX_NETWORK;
} else if (typeof window !== "undefined" && window.location.host.includes("localhost")) {
  network = "local";
} else if (typeof window !== "undefined" && window.location.host.includes("icp0.io")) {
  network = "ic";
}

const localhost = "http://localhost:4943";
const host = network === "local" ? localhost : "https://icp0.io";

interface ContextType {
  isAuthenticated: boolean | null;
  backendActor: ActorSubclass<_SERVICE> | null;
  identity: Identity | null;
  currentUser: any | null;
  login: () => void;
  logout: () => void;
  registerClient: (username: string) => Promise<any>;
  registerProvider: (username: string, serviceCategories: ServiceCategoryEnum[]) => Promise<any>;
  createService: (title: string, description: string, category: ServiceCategoryEnum, pricing: BackendServicePricing, location: string, images: string[], availability: BackendAvailabilitySlot[], requirements: string[], duration: number) => Promise<any>;
  searchProviders: (keyword: string) => Promise<any>;
  searchServices: (keyword: string) => Promise<any>;
  createBooking: (serviceId: any, providerId: any, date: string, time: string, duration: number, location: string, notes?: string) => Promise<any>;
  getClientBookings: () => Promise<any>; //
  getClientProfile: () => Promise<any>;
  getProviderProfile: () => Promise<any>;
  getUserProfile: (principal: any) => Promise<any>;
  updateUserProfile: (profileData: any) => Promise<any>;
  getService: (serviceId: any) => Promise<any>;
  getAllServices: () => Promise<any[]>;
  getActiveServices: () => Promise<any[]>;
  getServiceCategory: () => string[];
  createConversation: (participant: any) => Promise<any>;
  sendMessage: (receiver: any, text: string) => Promise<boolean>;
  getMessages: (other: any) => Promise<any>;
  getConversations: () => Promise<any>;
  markMessagesAsRead: (conversationId: any) => Promise<void>;
  blockUser: (userId: any) => Promise<void>;
  unblockUser: (userId: any) => Promise<void>;
  getCurrentUser: (principal: any) => Promise<any>;
  getNotifications: () => Promise<any[]>;
  getProviderNotifications: () => Promise<any[]>;
  markProviderNotificationAsRead: (notificationId: any) => Promise<void>;
  getAllNotifications: () => Promise<any>;
  getUnreadNotificationCount: () => Promise<number>;
  markNotificationAsRead: (notificationId: any) => Promise<void>;
  deleteNotification: (notificationId: any) => Promise<void>;
  getNotificationById: (notificationId: any) => Promise<any>;
  deleteAllNotifications: () => Promise<void>;
  createSystemNotification: (message: string, targetUsers: any[]) => Promise<void>;
  getNotificationByType: (type: 'PaymentReceived' | 'SystemUpdate' | 'BookingRequest' | 'BookingConfirmed' | 'MessageReceived' | 'ReviewReceived' | 'BookingCancelled') => Promise<any[]>;
  getProviderBookings: () => Promise<any>;
  acceptproviderBooking: (bookingId: any) => Promise<void>;
  rejectProviderBooking: (bookingId: any, reason: string) => Promise<void>;
  completeProviderBooking: (bookingId: any) => Promise<void>;
  updateProviderAvailability: (availability: BackendAvailabilitySlot[]) => Promise<void>;
  getProviderReviews: () => Promise<any[]>;
}

const initialContext: ContextType = {
  identity: null,
  backendActor: null,
  isAuthenticated: false,
  currentUser: null,
  login: (): void => {},
  logout: (): void => {},
  registerClient: async () => null,
  registerProvider: async () => null,
  createService: async () => [],
  searchServices: async () => [],
  createBooking: async () => null,
  getClientBookings: async () => null,
  getClientProfile: async () => null,
  getProviderProfile: async () => null,
  getUserProfile: async () => null,
  updateUserProfile: async () => {},
  getService: async () => null,
  getAllServices: async () => [],
  getActiveServices: async () => [],
  getServiceCategory: () => getServiceCategoryStrings(),
  createConversation: async () => null,
  searchProviders: async () => [],
  sendMessage: async () => false,
  getConversations: async () => [],
  markMessagesAsRead: async () => {},
  blockUser: async () => {},
  unblockUser: async () => {},
  getMessages: async () => [],
  getCurrentUser: async () => null,
  getNotifications: async () => [],
  getProviderNotifications: async () => [],
  markProviderNotificationAsRead: async () => {},
  getAllNotifications: async () => [],
  getUnreadNotificationCount: async () => 0,
  markNotificationAsRead: async () => {},
  deleteNotification: async () => {},
  getNotificationById: async () => null,
  deleteAllNotifications: async () => {},
  createSystemNotification: async () => {},
  getNotificationByType: async () => [],
  getProviderBookings: async () => null,
  acceptproviderBooking: async () => {},
  rejectProviderBooking: async () => {},
  completeProviderBooking: async () => {},
  updateProviderAvailability: async () => {},
  getProviderReviews: async () => [],
};

const AuthContext = createContext<ContextType>(initialContext);

interface DefaultOptions {
  createOptions: AuthClientCreateOptions;
  loginOptions: AuthClientLoginOptions;
}

const defaultOptions: DefaultOptions = {
  createOptions: {
    idleOptions: {
      disableIdle: true,
    },
  },
  loginOptions: {
    identityProvider:
      network === "ic"
        ? "https://identity.ic0.app/#authorize"
        : `http://${iiCanId}.localhost:4943`, 
  },
};

export const useAuthClient = (options = defaultOptions) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [backendActor, setBackendActor] =
    useState<ActorSubclass<_SERVICE> | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const serializeUser = (user: any) => {
    return JSON.parse(JSON.stringify(user, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  };

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const client = await AuthClient.create(options.createOptions);
      await updateClient(client);
    } catch (error) {
      console.error("Auth initialization failed:", error);
    }
  };

  const login = () => {
    authClient?.login({
      ...options.loginOptions,
      onSuccess: () => {
        updateClient(authClient);
      },
    });
  };

  async function updateClient(client: AuthClient) {
    try {
      const isAuthenticated = await client.isAuthenticated();
      setIsAuthenticated(isAuthenticated);
      setAuthClient(client);

      const _identity = client.getIdentity();
      setIdentity(_identity);

      let agent = new HttpAgent({
        host: host,
        identity: _identity,
      });

      if (network === "local") {
        try {
          await agent.fetchRootKey();
          console.log("Successfully fetched root key for local development");
        } catch (error) {
          console.error("Failed to fetch root key:", error);
          throw new Error("Cannot connect to local replica. Make sure dfx is running.");
        }
      }

      const _backendActor: ActorSubclass<_SERVICE> = Actor.createActor(
        idlFactory,
        {
          agent,
          canisterId: canisterId,
        }
      );
      setBackendActor(_backendActor);

      if (isAuthenticated) {
        const result = await _backendActor.getCurrentUser();
        if ('ok' in result && result.ok) {
          setCurrentUser(result.ok);
          console.log("User profile loaded successfully");
        } else {
          console.log("Authenticated with Internet Identity but no profile yet - user needs to register");
          setCurrentUser(null);
        }
      }
    } catch (error) {
      console.error("Failed to update client:", error);
    }
  }

  async function logout() {
    try {
      await authClient?.logout();
      setCurrentUser(null);
      // if (typeof window !== 'undefined') {
      //   localStorage.removeItem('selectedConversationId');
      //   localStorage.removeItem('messagingAppUser');
      // }
      if (authClient) {
        await updateClient(authClient);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  const registerClient = async (username: string) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }
    
    try {
      const result = await backendActor.registerClient({
        name: username,
        phone: "",
        location: "",
        agreeToTerms: true,
        version: BigInt(1)
      });
      
      if ('ok' in result) {
        const userData = result.ok;
        setCurrentUser(userData);
        return result;
      } else {
        console.error("Client registration failed:", result.err);
        throw new Error(result.err);
      }
    } catch (err) {
      console.error("registerClient error:", err);
      throw err;
    }
  };

  const registerProvider = async (
    username: string,
    serviceCategories: ServiceCategoryEnum[]
  ) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }
    
    try {
      const backendCategories = serviceCategories.map(cat => {
        switch(cat) {
          case ServiceCategoryEnum.Plumbing: return { 'Plumbing': null };
          case ServiceCategoryEnum.HairStyling: return { 'HairStyling': null };
          case ServiceCategoryEnum.HouseCleaning: return { 'HouseCleaning': null };
          case ServiceCategoryEnum.Electrical: return { 'Electrical': null };
          case ServiceCategoryEnum.Gardening: return { 'Gardening': null };
          case ServiceCategoryEnum.PetGrooming: return { 'PetGrooming': null };
          case ServiceCategoryEnum.Tutoring: return { 'Tutoring': null };
          case ServiceCategoryEnum.Construction: return { 'Construction': null };
          case ServiceCategoryEnum.PersonalTraining: return { 'PersonalTraining': null };
          default: return { 'Plumbing': null };
        }
      });

      const result = await backendActor.registerProvider({
        name: username,
        phone: "",
        idNumber: "",
        businessName: "",
        businessType: "",
        location: "",
        serviceCategories: backendCategories,
        businessLicense: [],
        insuranceDetails: [],
        description: "",
        experience: BigInt(0),
        consentBackgroundCheck: true,
        agreeToTerms: true,
        version: BigInt(1)
      });
      
      if ('ok' in result) {
        const userData = result.ok;
        setCurrentUser(userData);
        return result;
      } else {
        console.error("Provider registration failed:", result.err);
        throw new Error(result.err);
      }
    } catch (err) {
      console.error("registerProvider error:", err);
      throw err;
    }
  };

  const createService = async (
    title: string,
    description: string,
    category: ServiceCategoryEnum,
    pricing: BackendServicePricing,
    location: string,
    images: string[],
    availability: BackendAvailabilitySlot[],
    requirements: string[],
    duration: number
  ) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      // Convert ServiceCategoryEnum to backend ServiceCategory format
      let backendCategory;
      switch(category) {
        case ServiceCategoryEnum.Plumbing: backendCategory = { 'Plumbing': null }; break;
        case ServiceCategoryEnum.HairStyling: backendCategory = { 'HairStyling': null }; break;
        case ServiceCategoryEnum.HouseCleaning: backendCategory = { 'HouseCleaning': null }; break;
        case ServiceCategoryEnum.Electrical: backendCategory = { 'Electrical': null }; break;
        case ServiceCategoryEnum.Gardening: backendCategory = { 'Gardening': null }; break;
        case ServiceCategoryEnum.PetGrooming: backendCategory = { 'PetGrooming': null }; break;
        case ServiceCategoryEnum.Tutoring: backendCategory = { 'Tutoring': null }; break;
        case ServiceCategoryEnum.Construction: backendCategory = { 'Construction': null }; break;
        case ServiceCategoryEnum.PersonalTraining: backendCategory = { 'PersonalTraining': null }; break;
        default: backendCategory = { 'Plumbing': null };
      }

      const result = await backendActor.createService(
        title,
        description,
        backendCategory,
        pricing,
        location,
        images,
        availability,
        requirements,
        BigInt(duration)
      );

      if ('ok' in result) {
        return result.ok;
      } else {
        console.error("Service creation failed:", result.err);
        throw new Error(result.err);
      }
    } catch (err) {
      console.error("createService error:", err);
      throw err;
    }
  };

  const searchProviders = async (keyword: string) => {
    if (!backendActor) return [];
    try {
      const result = await backendActor.searchProviders(
        [keyword],
        [],
        [],
        false,
        [],
        []
      );
      if ('ok' in result) {
        return result.ok;
      }
      return [];
    } catch (err) {
      console.error("searchProviders error:", err);
      return [];
    }
  };

  const searchServices = async (keyword: string) => {
    if (!backendActor) return [];
    try {
      const result = await backendActor.searchServices(keyword, [], []);
      return result;
    } catch (err) {
      console.error("searchServices error:", err);
      return [];
    }
  };

  const createBooking = async (
    serviceId: any,
    providerId: any,
    date: string,
    time: string,
    duration: number,
    location: string,
    notes?: string
  ) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.createBooking(
        serviceId,
        providerId,
        date,
        time,
        BigInt(duration),
        location,
        notes ? [notes] : [],
        { 'Card': null }
      );

      if ('ok' in result) {
        return result.ok;
      } else {
        console.error("Booking creation failed:", result.err);
        throw new Error(result.err);
      }
    } catch (err) {
      console.error("createBooking error:", err);
      throw err;
    }
  };

  const getClientProfile = async () => {
    if (!backendActor) {
      throw new Error("Backend not connected");
    }

    try {
      const result = await backendActor.getClientProfile();
      return result;
    } catch (err) {
      console.error("getClientProfile error:", err);
      throw err;
    }
  };

  const getProviderProfile = async () => {
    if (!backendActor) {
      throw new Error("Backend not connected");
    }

    try {
      const result = await backendActor.getProviderProfile();
      return result;
    } catch (err) {
      console.error("getProviderProfile error:", err);
      throw err;
    }
  };

  const getUserProfile = async (principal: any) => {
    if (!backendActor) {
      throw new Error("Backend not connected");
    }

    try {
      const result = await backendActor.getUser(principal);
      return result;
    } catch (err) {
      console.error("getUserProfile error:", err);
      throw err;
    }
  };

  const updateUserProfile = async (profileData: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const currentUserResult = await backendActor.getCurrentUser();
      
      if ('ok' in currentUserResult) {
        const userInfo = currentUserResult.ok;
        
        if ('userType' in userInfo) {
          if ('Client' in userInfo.userType) {
            const result = await backendActor.updateClientProfile(
              profileData.name ? [profileData.name] : [],
              profileData.phone ? [profileData.phone] : [],
              profileData.location ? [profileData.location] : [],
              profileData.profileImage ? [profileData.profileImage] : []
            );
            return result;
          } else if ('Provider' in userInfo.userType) {
            const result = await backendActor.updateProviderProfile(
              profileData.businessName ? [profileData.businessName] : [],
              profileData.businessType ? [profileData.businessType] : [],
              profileData.phone ? [profileData.phone] : [],
              profileData.location ? [profileData.location] : [],
              profileData.description ? [profileData.description] : [],
              profileData.profileImage ? [profileData.profileImage] : [],
              profileData.portfolio ? [profileData.portfolio] : []
            );
            return result;
          }
        }
      }
      
      throw new Error("Could not determine user type");
    } catch (err) {
      console.error("updateUserProfile error:", err);
      throw err;
    }
  };

  const getService = async (serviceId: any) => {
    if (!backendActor) return null;
    try {
      const result = await backendActor.getService(serviceId);
      return result.length > 0 ? result[0] : null;
    } catch (err) {
      console.error("getService error:", err);
      return null;
    }
  };

  const getAllServices = async () => {
    if (!backendActor) return [];
    try {
      const result = await backendActor.getAllServices();
      return result;
    } catch (err) {
      console.error("getAllServices error:", err);
      return [];
    }
  };

  const getActiveServices = async () => {
    if (!backendActor) return [];
    try {
      const result = await backendActor.getActiveServices();
      return result;
    } catch (err) {
      console.error("getActiveServices error:", err);
      return [];
    }
  };

  const getServiceCategory = () => {
    return getServiceCategoryStrings();
  };

  const createConversation = async (participant: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.createConversation(
        [identity.getPrincipal(), participant],
        [],
        { 'Direct': null },
        []
      );

      if ('ok' in result) {
        return result.ok;
      } else {
        console.error("Conversation creation failed:", result.err);
        throw new Error(result.err);
      }
    } catch (err) {
      console.error("createConversation error:", err);
      throw err;
    }
  };

  const sendMessage = async (receiver: any, text: string) => {
    if (!backendActor || !identity) return false;
    try {
      const result = await backendActor.sendMessage(
        "",
        { 'Text': null },
        text,
        [],
        []
      );
      return 'ok' in result;
    } catch (err) {
      console.error("sendMessage error:", err);
      return false;
    }
  };

  const getMessages = async (other: any) => {
    if (!backendActor || !identity) return { ok: [] };
    try {
      const result = await backendActor.getMessages("", [], []);
      return result;
    } catch (err) {
      console.error("getMessages error:", err);
      return { err: String(err) };
    }
  };

  const getCurrentUser = async (principal: any) => {
    if (!backendActor) return null;
    try {
      const result = await backendActor.getUser(principal);
      return result;
    } catch (err) {
      console.error("getCurrentUser error:", err);
      return null;
    }
  };

  const getClientBookings = async () => {
    if (!backendActor) {
      throw new Error("Backend not connected");
    }

    try {
      const result = await backendActor.getClientBookings();
      return result;
    } catch (err) {
      console.error("getClientBookings error:", err);
      throw err;
    }
  };

  const getConversations = async () => {
    if (!backendActor || !identity) return { ok: [] };
    try {
      const result = await backendActor.getConversations();
      return result;
    } catch (err) {
      console.error("getConversations error:", err);
      return { err: String(err) };
    }
  };

  const markMessagesAsRead = async (conversationId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.markMessagesAsRead(conversationId);
      if ('err' in result) {
        console.error("Mark messages as read failed:", result.err);
      }
    } catch (err) {
      console.error("markMessagesAsRead error:", err);
      throw err;
    }
  };

  const blockUser = async (userId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.blockUser(userId, []);
      if ('err' in result) {
        console.error("Block user failed:", result.err);
      }
    } catch (err) {
      console.error("blockUser error:", err);
      throw err;
    }
  };

  const unblockUser = async (userId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.unblockUser(userId);
      if ('err' in result) {
        console.error("Unblock user failed:", result.err);
      }
    } catch (err) {
      console.error("unblockUser error:", err);
      throw err;
    }
  };

  const getNotifications = async () => {
    if (!backendActor) return [];
    try {
      const result = await backendActor.getNotifications();
      if ('ok' in result) {
        return result.ok;
      }
      return [];
    } catch (err) {
      console.error("getNotifications error:", err);
      return [];
    }
  };

  const getProviderNotifications = async () => {
    if (!backendActor) return [];
    try {
      const result = await backendActor.getProviderNotifications();
      if ('ok' in result) {
        return result.ok;
      }
      return [];
    } catch (err) {
      console.error("getProviderNotifications error:", err);
      return [];
    }
  };

  const markProviderNotificationAsRead = async (notificationId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.markProviderNotificationAsRead(notificationId);
      if (!result) {
        console.error("Mark provider notification as read failed");
      }
    } catch (err) {
      console.error("markProviderNotificationAsRead error:", err);
      throw err;
    }
  };

  const getAllNotifications = async () => {
    if (!backendActor) return { ok: [] };
    try {
      const result = await backendActor.getAllNotifications();
      return result;
    } catch (err) {
      console.error("getAllNotifications error:", err);
      return { err: String(err) };
    }
  };

  const getUnreadNotificationCount = async () => {
    if (!backendActor) return 0;
    try {
      const result = await backendActor.getUnreadNotifications();
      return Array.isArray(result) ? result.length : 0;
    } catch (err) {
      console.error("getUnreadNotificationCount error:", err);
      return 0;
    }
  };

  const markNotificationAsRead = async (notificationId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.markNotificationAsRead(notificationId);
      if ('err' in result) {
        console.error("Mark notification as read failed:", result.err);
      }
    } catch (err) {
      console.error("markNotificationAsRead error:", err);
      throw err;
    }
  };

  const deleteNotification = async (notificationId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.deleteNotification(notificationId);
      if ('err' in result) {
        console.error("Delete notification failed:", result.err);
      }
    } catch (err) {
      console.error("deleteNotification error:", err);
      throw err;
    }
  };

  const getNotificationById = async (notificationId: any) => {
    if (!backendActor) return null;
    try {
      const result = await backendActor.getNotificationById(notificationId);
      if ('ok' in result) {
        return result.ok;
      }
      return null;
    } catch (err) {
      console.error("getNotificationById error:", err);
      return null;
    }
  };

  const deleteAllNotifications = async () => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.deleteAllNotifications();
      if ('err' in result) {
        console.error("Delete all notifications failed:", result.err);
      }
    } catch (err) {
      console.error("deleteAllNotifications error:", err);
      throw err;
    }
  };

  const createSystemNotification = async (message: string, targetUsers: any[]) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.createSystemNotification(
        targetUsers[0],
        "System Notification",
        message
      );
      if (!result) {
        console.error("Create system notification failed");
      }
    } catch (err) {
      console.error("createSystemNotification error:", err);
      throw err;
    }
  };

  const getNotificationByType = async (type: 'PaymentReceived' | 'SystemUpdate' | 'BookingRequest' | 'BookingConfirmed' | 'MessageReceived' | 'ReviewReceived' | 'BookingCancelled') => {
    if (!backendActor) return [];
    try {
      const notificationType = { [type]: null };
      const result = await backendActor.getNotificationsByType(notificationType as any);
      if ('ok' in result) {
        return result.ok;
      }
      return [];
    } catch (err) {
      console.error("getNotificationByType error:", err);
      return [];
    }
  };

  const getProviderBookings = async () => {
    if (!backendActor) {
      throw new Error("Backend not connected");
    }

    try {
      const result = await backendActor.getProviderBookings();
      return result;
    } catch (err) {
      console.error("getProviderBookings error:", err);
      throw err;
    }
  };

  const acceptproviderBooking = async (bookingId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.acceptProviderBooking(bookingId, 0);
      if ('err' in result) {
        console.error("Accept provider booking failed:", result.err);
      }
    } catch (err) {
      console.error("acceptproviderBooking error:", err);
      throw err;
    }
  };

  const rejectProviderBooking = async (bookingId: any, reason: string) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.rejectProviderBooking(bookingId, [reason]);
      if ('err' in result) {
        console.error("Reject provider booking failed:", result.err);
      }
    } catch (err) {
      console.error("rejectProviderBooking error:", err);
      throw err;
    }
  };

  const completeProviderBooking = async (bookingId: any) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.completeProviderBooking(bookingId);
      if ('err' in result) {
        console.error("Complete provider booking failed:", result.err);
      }
    } catch (err) {
      console.error("completeProviderBooking error:", err);
      throw err;
    }
  };

  const updateProviderAvailability = async (availability: BackendAvailabilitySlot[]) => {
    if (!backendActor || !identity) {
      throw new Error("Not authenticated");
    }

    try {
      const result = await backendActor.updateProviderAvailability(availability);
      if ('err' in result) {
        console.error("Update provider availability failed:", result.err);
      }
    } catch (err) {
      console.error("updateProviderAvailability error:", err);
      throw err;
    }
  };

  const getProviderReviews = async () => {
    if (!backendActor) return [];
    try {
      const result = await backendActor.getProviderReviews();
      if ('ok' in result) {
        return result.ok;
      }
      return [];
    } catch (err) {
      console.error("getProviderReviews error:", err);
      return [];
    }
  };

  return {
    isAuthenticated,
    backendActor,
    login,
    logout,
    identity,
    currentUser,
    registerClient,
    registerProvider,
    createService,
    searchProviders,
    searchServices,
    createBooking,
    getClientBookings,
    getClientProfile,
    getProviderProfile,
    getUserProfile,
    updateUserProfile,
    getService,
    getAllServices,
    getActiveServices,
    getServiceCategory,
    createConversation,
    sendMessage,
    getMessages,
    getConversations,
    markMessagesAsRead,
    blockUser,
    unblockUser,
    getCurrentUser,
    getNotifications,
    getProviderNotifications,
    markProviderNotificationAsRead,
    getAllNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    deleteNotification,
    getNotificationById,
    deleteAllNotifications,
    createSystemNotification,
    getNotificationByType,
    getProviderBookings,
    acceptproviderBooking,
    rejectProviderBooking,
    completeProviderBooking,
    updateProviderAvailability,
    getProviderReviews,
  };
};



interface LayoutProps {
  children: React.ReactNode;
}

export const AuthProvider: FC<LayoutProps> = ({ children }) => {
  const auth = useAuthClient();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);