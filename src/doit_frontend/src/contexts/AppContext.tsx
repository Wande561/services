import React, { createContext, useContext, useState, useEffect, FC, ReactNode } from 'react';
// import { Actor, HttpAgent } from '@dfinity/agent';
// import { Principal } from '@dfinity/principal';
import { AuthClient, AuthClientCreateOptions, AuthClientLoginOptions } from '@dfinity/auth-client';
import { canisterId as iiCanId } from "../../../declarations/internet_identity";
import { Actor, ActorSubclass, HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory } from '../../../declarations/doit_backend';
// import { idlFactory as kotomoIdlFactory } from '../../../declarations/kotomo';
import { ServiceCategoryEnum } from '../types';
import type { 
  _SERVICE as DoItBackendService,
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

interface ContextType {
  isAuthenticated: boolean | null;
  backendActor: ActorSubclass<_SERVICE> | null;
  identity: Identity | null;
  currentUser: any | null;
  login: () => void;
  logout: () => void;
  registerUser: (username: string) => Promise<any>;
  searchUsers: (keyword: string) => Promise<any>;
  sendMessage: (receiver: any, text: string) => Promise<boolean>;
  getMessages: (other: any) => Promise<any[]>;
  getUser: (principal: any) => Promise<any>;
  getUserConversations: () => Promise<any[]>;
}

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

// export type Service = BackendService;
// export type ServiceCategory = BackendServiceCategory;
// export type ServicePricing = BackendServicePricing;  
// export type AvailabilitySlot = BackendAvailabilitySlot;

// const stringToServiceCategory = (categoryStr: string): ServiceCategory => {
//   switch (categoryStr) {
//     case 'Plumbing': return { 'Plumbing': null };
//     case 'HairStyling': return { 'HairStyling': null };
//     case 'HouseCleaning': return { 'HouseCleaning': null };
//     case 'Electrical': return { 'Electrical': null };
//     case 'Gardening': return { 'Gardening': null };
//     case 'PetGrooming': return { 'PetGrooming': null };
//     case 'Tutoring': return { 'Tutoring': null };
//     case 'Construction': return { 'Construction': null };
//     case 'PersonalTraining': return { 'PersonalTraining': null };
//     default: return { 'Plumbing': null };
//   }
// };

// const serviceCategoryToString = (category: ServiceCategory): string => {
//   if ('Plumbing' in category) return 'Plumbing';
//   if ('HairStyling' in category) return 'HairStyling';
//   if ('HouseCleaning' in category) return 'HouseCleaning';
//   if ('Electrical' in category) return 'Electrical';
//   if ('Gardening' in category) return 'Gardening';
//   if ('PetGrooming' in category) return 'PetGrooming';
//   if ('Tutoring' in category) return 'Tutoring';
//   if ('Construction' in category) return 'Construction';
//   if ('PersonalTraining' in category) return 'PersonalTraining';
//   return 'Plumbing';
// };

// export interface SystemInfo {
//   version: string;
//   deployedAt: bigint;
//   currentTime: bigint;
//   status: string;
// }

// export interface HealthCheck {
//   status: string;
//   timestamp: bigint;
//   version: string;
// }

// export interface PlatformStatistics {
//   platformVersion: string;
//   deployedAt: bigint;
//   uptime: bigint;
//   supportedServices: bigint;
//   supportedLocations: bigint;
// }

// export type DoItBackendActor = DoItBackendService;

// export interface User {
//   principal: Principal | null;
//   isAuthenticated: boolean;
//   userType: 'client' | 'provider' | null;
//   profile: {
//     username?: string;
//     fullName?: string;
//     email?: string;
//     phone?: string;
//     location?: string;
//     businessName?: string;
//     description?: string;
//     experience?: number;
//     serviceCategories?: string[];
//     pricing?: {
//       baseRate: number;
//       currency: string;
//     };
//     preferences?: {
//       preferredCategories?: string[];
//       maxDistance?: number;
//       notifications?: boolean;
//     };
//     availability?: {
//       workingHours?: {
//         start: string;
//         end: string;
//       };
//       workingDays?: string[];
//     };
//     createdAt?: string;
//     updatedAt?: string;
//   } | null;
//   identity: any | null;
// }

// export interface AppContextState {
//   agent: HttpAgent | null;
//   actor: DoItBackendActor | null;
//   kotomoActor: KotomoTokenService | null;
//   canisterId: string | null;
//   kotomoCanisterId: string | null;
//   isConnected: boolean;
//   user: User;
//   systemInfo: SystemInfo | null;
//   isLoading: boolean;
//   error: string | null;
//   availableServices: string[];
//   supportedLocations: string[];
//   supportedCategories: string[]; 
//   authClient: AuthClient | null;

//   tokenBalance: Tokens | null;
//   tokenMetadata: Array<[string, any]> | null;

//   services: Service[];
//   activeServices: Service[];

//   connectToBackend: () => Promise<void>;
//   disconnect: () => void;
//   loginWithII: () => Promise<void>;
//   logout: () => void;
//   refreshSystemInfo: () => Promise<void>;
//   clearError: () => void;
//   setLoading: (loading: boolean) => void;
//   detectUserType: (actorToUse?: any) => Promise<'client' | 'provider' | null>;
//   updateUserType: (userType: 'client' | 'provider') => void;

//   registerClient: (registration: {
//     name: string;
//     email: string;
//     password: string;
//     phone: string;
//     location: string;
//     agreeToTerms: boolean;
//   }) => Promise<any>;
//   getClientProfile: () => Promise<any>;
//   updateClientProfile: (
//     name?: string,
//     phone?: string,
//     location?: string,
//     profileImage?: string
//   ) => Promise<any>;
//   createBooking: (
//     serviceId: string,
//     providerId: string,
//     date: string,
//     time: string,
//     duration: number,
//     location: string,
//     paymentMethod: string,
//     notes?: string
//   ) => Promise<any>;
//   getClientBookings: () => Promise<any[]>;
//   getNotifications: () => Promise<any[]>;

//   registerProvider: (registration: {
//     name: string;
//     email: string;
//     password: string;
//     phone: string;
//     idNumber: string;
//     businessName: string;
//     businessType: string;
//     location: string;
//     serviceCategories: string[];
//     businessLicense?: string;
//     insuranceDetails?: string;
//     description: string;
//     experience: number;
//     consentBackgroundCheck: boolean;
//     agreeToTerms: boolean;
//   }) => Promise<any>;
//   getProviderProfile: () => Promise<any>;
//   updateProviderProfile: (
//     businessName?: string,
//     businessType?: string,
//     phone?: string,
//     location?: string,
//     description?: string,
//     profileImage?: string,
//     portfolio?: string[]
//   ) => Promise<any>;
//   getProviderBookings: () => Promise<any[]>;
//   acceptProviderBooking: (bookingId: string, estimatedCost: number) => Promise<any>;
//   rejectProviderBooking: (bookingId: string, reason?: string) => Promise<any>;
//   completeProviderBooking: (bookingId: string) => Promise<any>;
//   updateProviderAvailability: (availability: AvailabilitySlot[]) => Promise<any>;
//   getProviderReviews: () => Promise<any[]>;
//   getProviderNotifications: () => Promise<any[]>;
//   markProviderNotificationAsRead: (notificationId: string) => Promise<boolean>;
//   getProviderAnalytics: () => Promise<{
//     totalBookings: number;
//     completedJobs: number;
//     averageRating: number;
//     totalEarnings: number;
//     reviewCount: number;
//   }>;
//   searchProviders: (
//     location?: string,
//     serviceCategory?: string,
//     minRating?: number,
//     verifiedOnly?: boolean,
//     businessType?: string,
//     maxDistance?: number
//   ) => Promise<any[]>;

//   createService: (
//     title: string,
//     description: string,
//     category: string, 
//     pricing: ServicePricing,
//     location: string,
//     images: string[],
//     availability: AvailabilitySlot[],
//     requirements: string[],
//     duration: number
//   ) => Promise<Service | null>;
//   updateService: (
//     serviceId: string,
//     updates: {
//       title?: string;
//       description?: string;
//       pricing?: ServicePricing;
//       location?: string;
//       images?: string[];
//       availability?: AvailabilitySlot[];
//       requirements?: string[];
//       duration?: number;
//       isActive?: boolean;
//     }
//   ) => Promise<Service | null>;
//   deleteService: (serviceId: string) => Promise<boolean>;
//   getService: (serviceId: string) => Promise<Service | null>;
//   getAllServices: () => Promise<Service[]>;
//   getActiveServices: () => Promise<Service[]>;
//   getServicesByProvider: () => Promise<Service[]>;
//   getServicesByCategory: (category: string) => Promise<Service[]>;
//   searchServices: (searchQuery: string, category?: string, location?: string) => Promise<Service[]>;
//   getSupportedServiceCategories: () => Promise<string[]>;
//   getServiceCategoryName: (category: string) => Promise<string>;
//   getDefaultServicePricing: (category: string) => Promise<ServicePricing | null>;
//   getServiceStats: () => Promise<{
//     totalServices: number;
//     activeServices: number;
//     servicesByCategory: [string, number][];
//     averageRating: number;
//   }>;
//   updateServiceRating: (serviceId: string, newRating: number, reviewCount: number) => Promise<boolean>;
//   validateServiceData: (
//     title: string,
//     description: string,
//     category: string,
//     pricing: ServicePricing,
//     duration: number
//   ) => Promise<string[]>;
//   bulkUpdateServiceStatus: (serviceIds: string[], isActive: boolean) => Promise<[string, boolean][]>;
//   exportServices: () => Promise<Service[]>;
//   getServiceCount: () => Promise<number>;
//   getProviderServiceCount: () => Promise<number>;
  
//   // ============================================================================
//   // MESSAGING MANAGEMENT FUNCTIONS
//   // ============================================================================
//   createConversation: (
//     participants: string[],
//     conversationType: any,
//     title?: string,
//     relatedBookingId?: string
//   ) => Promise<any>;
//   sendMessage: (
//     conversationId: string,
//     messageType: any,
//     text: string,
//     attachments?: any[],
//     replyToMessageId?: string
//   ) => Promise<any>;
//   getConversations: () => Promise<any[]>;
//   getMessages: (
//     conversationId: string,
//     limit?: number,
//     offset?: number
//   ) => Promise<any[]>;
//   markMessagesAsRead: (conversationId: string) => Promise<boolean>;
//   blockUser: (userToBlock: string, reason?: string) => Promise<boolean>;
//   unblockUser: (userToUnblock: string) => Promise<boolean>;
//   saveDraft: (
//     conversationId: string,
//     draftText: string,
//     replyToMessageId?: string
//   ) => Promise<boolean>;
//   getDraft: (conversationId: string) => Promise<any | null>;
//   clearDraft: (conversationId: string) => Promise<boolean>;
//   getMessagingStats: () => Promise<{
//     totalMessages: number;
//     totalConversations: number;
//     activeConversations: number;
//   }>;

//   getAllNotifications: () => Promise<any[]>;
//   getUnreadNotifications: () => Promise<any[]>;
//   markNotificationAsRead: (notificationId: string) => Promise<boolean>;
//   markAllNotificationsAsRead: () => Promise<boolean>;
//   deleteNotification: (notificationId: string) => Promise<boolean>;
//   deleteAllNotifications: () => Promise<boolean>;
//   getNotificationById: (notificationId: string) => Promise<any | null>;
//   getNotificationStats: () => Promise<{
//     totalNotifications: number;
//     unreadNotifications: number;
//     readNotifications: number;
//   }>;
//   getNotificationsByType: (notificationType: string) => Promise<any[]>;
//   createSystemNotification: (
//     userId: string,
//     title: string,
//     message: string
//   ) => Promise<boolean>;

//   refreshServices: () => Promise<void>;
  
//   formatCurrency: (amount: number) => Promise<string>;
//   validateSAId: (idNumber: string) => Promise<boolean>;
//   formatPhone: (phone: string) => Promise<string>;
//   saveUserProfile: (profileData: any) => Promise<void>;
//   getUserProfile: () => Promise<any>;
//   updateUserProfile: (profileData: any) => Promise<void>;

//   connectToKotomo: () => Promise<void>;
//   getTokenBalance: (account?: Account) => Promise<Tokens>;
//   getTokenMetadata: () => Promise<Array<[string, any]>>;
//   transferTokens: (to: Account, amount: Tokens, memo?: Uint8Array) => Promise<TransferResult>;
//   approveTokens: (spender: Account, amount: Tokens, memo?: Uint8Array) => Promise<ApproveResult>;
//   getTokenAllowance: (owner: Account, spender: Account) => Promise<Allowance>;
//   getTokenSymbol: () => Promise<string>;
//   getTokenName: () => Promise<string>;
//   getTokenDecimals: () => Promise<number>;
//   getTokenFee: () => Promise<Tokens>;
//   getTokenTotalSupply: () => Promise<Tokens>;
//   refreshTokenBalance: () => Promise<void>;
// }

// const AppContext = createContext<AppContextState | undefined>(undefined);

// interface ImportMetaEnv {
//   readonly VITE_DOIT_BACKEND_CANISTER_ID: string;
//   readonly VITE_KOTOMO_TOKEN_CANISTER_ID: string;
//   readonly VITE_HOST_URL: string;
//   readonly NODE_ENV: string;
// }

// interface ImportMeta {
//   readonly env: ImportMetaEnv;
// }

// const getCanisterId = (): string => {
//   return import.meta.env.VITE_DOIT_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';
// };

// const getKotomoCanisterId = (): string => {
//   return import.meta.env.VITE_KOTOMO_TOKEN_CANISTER_ID || 'uzt4z-lp777-77774-qaabq-cai';
// };

// const getHostUrl = (): string => {
//   // In development mode, use the current origin so Vite can proxy the requests
//   if (import.meta.env.MODE === 'development') {
//     return window.location.origin;
//   }
//   return import.meta.env.VITE_HOST_URL || 'http://localhost:4943';
// };

// const createActor = (canisterId: string, agent: HttpAgent): DoItBackendActor => {
//   return Actor.createActor(idlFactory, {
//     agent,
//     canisterId: Principal.fromText(canisterId)
//   }) as DoItBackendActor;
// };

// const createKotomoActor = (canisterId: string, agent: HttpAgent): KotomoTokenService => {
//   return Actor.createActor(kotomoIdlFactory, {
//     agent,
//     canisterId: Principal.fromText(canisterId)
//   }) as KotomoTokenService;
// };



// interface AppProviderProps {
//   children: ReactNode;
// }

// export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
//   const [agent, setAgent] = useState<HttpAgent | null>(null);
//   const [actor, setActor] = useState<DoItBackendActor | null>(null);
//   const [kotomoActor, setKotomoActor] = useState<KotomoTokenService | null>(null);
//   const [canisterId] = useState<string>(getCanisterId());
//   const [kotomoCanisterId] = useState<string>(getKotomoCanisterId());
//   const [isConnected, setIsConnected] = useState<boolean>(false);
//   const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  
//   // Token state
//   const [tokenBalance, setTokenBalance] = useState<Tokens | null>(null);
//   const [tokenMetadata, setTokenMetadata] = useState<Array<[string, any]> | null>(null);
  
//   const [user, setUser] = useState<User>({
//     principal: null,
//     isAuthenticated: false,
//     userType: null,
//     profile: null,
//     identity: null
//   });
  
//   const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
//   const [isLoading, setIsLoading] = useState<boolean>(false);
//   const [error, setError] = useState<string | null>(null);
  
//   const [availableServices, setAvailableServices] = useState<string[]>([]);
//   const [supportedLocations, setSupportedLocations] = useState<string[]>([]);
//   const [supportedCategories, setSupportedCategories] = useState<string[]>([]);

//   const [services, setServices] = useState<Service[]>([]);
//   const [activeServices, setActiveServices] = useState<Service[]>([]);

//   const initializeAuth = async (): Promise<void> => {
//     try {
//       const client = await AuthClient.create({
//         idleOptions: {
//           disableIdle: true,
//           disableDefaultIdleCallback: true
//         }
//       });
//       setAuthClient(client);

//       const isAuthenticated = await client.isAuthenticated();
//       console.log('Auth client created. Is authenticated:', isAuthenticated);
      
//       if (isAuthenticated) {
//         console.log('Found existing Internet Identity session in browser - auto-restoring...');
//         await restoreAuthenticatedSession(client);
//       } else {
//         console.log('No existing session found - user needs to manually login with Internet Identity');
//       }
//     } catch (err) {
//       console.error('Failed to initialize auth client:', err);
//       setError('Failed to initialize authentication');
//     }
//   };

//   const restoreAuthenticatedSession = async (client: AuthClient): Promise<void> => {
//     try {
//       setIsLoading(true);
//       const identity = client.getIdentity();
//       const principal = identity.getPrincipal();

//       console.log('Checking identity for session restoration:', {
//         isAnonymous: principal.isAnonymous(),
//         principalText: principal.toText()
//       });

//       if (principal.isAnonymous()) {
//         console.log('Anonymous principal found - no valid session to restore');
//         await client.logout();
//         return;
//       }

//       // Additional check: verify the principal is not the default anonymous principal
//       if (principal.toText() === '2vxsx-fae') {
//         console.log('Default anonymous principal detected - no valid session to restore');
//         await client.logout();
//         return;
//       }

//       console.log('Valid session found - restoring Internet Identity session for principal:', principal.toText());

//       // Create authenticated agent
//       const authenticatedAgent = new HttpAgent({
//         host: getHostUrl(),
//         identity,
//       });

//       if (import.meta.env.MODE === 'development') {
//         await authenticatedAgent.fetchRootKey();
//       }

//       const authenticatedActor = createActor(canisterId, authenticatedAgent);

//       // Test the connection with a simple call to verify the session is actually valid
//       try {
//         await authenticatedActor.healthCheck();
//         console.log('Backend connection verified - session is valid');
//       } catch (connectionError) {
//         console.error('Backend connection failed with authenticated identity - clearing session:', connectionError);
//         await client.logout();
//         return;
//       }

//       setAgent(authenticatedAgent);
//       setActor(authenticatedActor);

//       console.log('Backend connection established with authenticated identity');

//       const detectedUserType = await detectUserType(authenticatedActor);
//       console.log('User type detected during session restoration:', detectedUserType);

//       if (detectedUserType === null) {
//         console.log('No profile found during session restoration - user needs to create a profile');
//         // Set user as authenticated but without profile/userType
//         setUser({
//           principal,
//           isAuthenticated: true,
//           userType: null,
//           profile: null,
//           identity
//         });
//       } else {
//         setUser({
//           principal,
//           isAuthenticated: true,
//           userType: detectedUserType,
//           profile: null,
//           identity
//         });
//       }

//       try {
//         await connectToKotomo();
//       } catch (kotomoError) {
//         console.warn('Failed to connect to Kotomo canister during session restoration:', kotomoError);
//       }

//       setIsConnected(true);
      
//       if (detectedUserType === null) {
//         console.log('Session restored but no profile found - user needs profile setup');
//       } else {
//         console.log(`Session restored successfully as ${detectedUserType}`);
//       }
      
//     } catch (error) {
//       console.error('Failed to restore authenticated session:', error);
//       console.log('Clearing invalid session...');
//       await client.logout();
//       setUser({
//         principal: null,
//         isAuthenticated: false,
//         userType: null,
//         profile: null,
//         identity: null
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const connectToBackend = async (): Promise<void> => {
//     try {
//       setIsLoading(true);
//       setError(null);

//       const newAgent = new HttpAgent({
//         host: getHostUrl(),
//       });

//       if (import.meta.env.MODE === 'development') {
//         await newAgent.fetchRootKey().catch(err => {
//           console.warn('Unable to fetch root key. Check to ensure that your local replica is running');
//           console.error(err);
//         });
//       }

//       const newActor = createActor(canisterId, newAgent);
//       const health = await newActor.healthCheck();
//       console.log('Backend health check:', health);

//       setAgent(newAgent);
//       setActor(newActor);

//       try {
//         const newKotomoActor = createKotomoActor(kotomoCanisterId, newAgent);
//         setKotomoActor(newKotomoActor);

//         const metadata = await newKotomoActor.icrc1_metadata();
//         setTokenMetadata(metadata);
        
//         console.log('Connected to Kotomo token canister successfully');
//       } catch (kotomoError) {
//         console.warn('Failed to connect to Kotomo canister:', kotomoError);
//       }

//       setIsConnected(true);
//       await loadInitialData(newActor);
      
//     } catch (err) {
//       console.error('Failed to connect to backend:', err);
//       setError(err instanceof Error ? err.message : 'Failed to connect to backend');
//       setIsConnected(false);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const loadInitialData = async (backendActor: DoItBackendActor): Promise<void> => {
//     try {
//       const [
//         sysInfo,
//         tempServices, 
//         locations,
//         categories,
//         allServices,
//         activeServices
//       ] = await Promise.all([
//         backendActor.getSystemInfo(),
//         backendActor.getAllServices(), 
//         [], 
//         supportedCategories, 
//         backendActor.getAllServices(),
//         backendActor.getActiveServices()
//       ]);

//       setSystemInfo(sysInfo);
//       setAvailableServices(categories); 
//       setSupportedLocations(locations);
//       setServices(allServices);
//       setActiveServices(activeServices);

//       setSupportedCategories(categories);
      
//     } catch (err) {
//       console.error('Failed to load initial data:', err);
//       setError('Failed to load system data');
//     }
//   };

//   const disconnect = (): void => {
//     setAgent(null);
//     setActor(null);
//     setIsConnected(false);
//     setUser({
//       principal: null,
//       isAuthenticated: false,
//       userType: null,
//       profile: null,
//       identity: null
//     });
//     setSystemInfo(null);
//     setAvailableServices([]);
//     setSupportedLocations([]);
//     setSupportedCategories([]);
//   };

//   const loginWithII = async (): Promise<void> => {
//     if (!authClient) {
//       setError('Authentication client not initialized');
//       return;
//     }

//     try {
//       setIsLoading(true);
//       setError(null);

//       return new Promise((resolve, reject) => {
//         authClient.login({
//           identityProvider: import.meta.env.MODE === 'production' 
//             ? 'https://identity.ic0.app' 
//             : `http://127.0.0.1:4943?canisterId=${import.meta.env.VITE_INTERNET_IDENTITY_CANISTER_ID || 'rdmx6-jaaaa-aaaaa-aaadq-cai'}`,
//           windowOpenerFeatures: `
//             left=${window.screen.width / 2 - 400},
//             top=${window.screen.height / 2 - 300},
//             toolbar=0,location=0,menubar=0,width=800,height=600
//           `,
//           onSuccess: async () => {
//             try {
//               console.log('Internet Identity login successful - processing authentication...');
              
//               const identity = authClient.getIdentity();
//               const principal = identity.getPrincipal();

//               console.log('Processing authentication for principal:', principal.toText(), 'Anonymous:', principal.isAnonymous());

//               if (principal.isAnonymous()) {
//                 console.error('Login completed but received anonymous principal - this indicates a login failure');
//                 setError('Authentication failed - no valid identity received');
//                 reject(new Error('Authentication failed'));
//                 return;
//               }

//               if (actor && !principal.isAnonymous()) {
//                 // TODO: Uncomment when validateUserPrincipal is added to backend
//                 // const isValid = await actor.validateUserPrincipal(principal);
//                 // if (!isValid) {
//                 //   console.warn('Principal validation failed, but proceeding with login');
//                 // }
//               }

//               setUser({
//                 principal,
//                 isAuthenticated: true,
//                 userType: null, 
//                 profile: null,
//                 identity
//               });

//               const authenticatedAgent = new HttpAgent({
//                 host: getHostUrl(),
//                 identity,
//               });

//               if (import.meta.env.MODE === 'development') {
//                 await authenticatedAgent.fetchRootKey();
//               }

//               const authenticatedActor = createActor(canisterId, authenticatedAgent);
//               setAgent(authenticatedAgent);
//               setActor(authenticatedActor);

//               const detectedUserType = await detectUserType(authenticatedActor);

//               if (detectedUserType === null) {
//                 console.log('No existing profile found - user will be prompted to choose account type');
//                 // Set user as authenticated but without profile/userType - will show account type selection
//                 setUser(prevUser => ({
//                   ...prevUser,
//                   userType: null
//                 }));
//               } else {
//                 console.log(`Existing profile found - user is a ${detectedUserType}`);
//                 setUser(prevUser => ({
//                   ...prevUser,
//                   userType: detectedUserType
//                 }));
//               }

//               console.log('Internet Identity authentication successful');
//               console.log(`User logged in as: ${detectedUserType || 'new user (needs to select account type)'}`);
              
//               setIsLoading(false);
//               resolve();
              
//             } catch (err) {
//               console.error('Error processing successful login:', err);
//               setError('Failed to process authentication');
//               setIsLoading(false);
//               reject(err);
//             }
//           },
//           onError: (error) => {
//             console.error('Internet Identity login error:', error);
//             setError('Login failed. Please try again.');
//             setUser({
//               principal: null,
//               isAuthenticated: false,
//               userType: null,
//               profile: null,
//               identity: null
//             });
//             setIsLoading(false);
//             reject(new Error('Login failed'));
//           }
//         });
//       });
      
//     } catch (err) {
//       console.error('Internet Identity login failed:', err);
//       setError(err instanceof Error ? err.message : 'Login failed');

//       setUser({
//         principal: null,
//         isAuthenticated: false,
//         userType: null,
//         profile: null,
//         identity: null
//       });
//       setIsLoading(false);
//       throw err;
//     }
//   };

//   const logout = async (): Promise<void> => {
//     try {
//       setIsLoading(true);
      
//       console.log('Logging out user...');
      
//       if (authClient) {
//         await authClient.logout();
//         console.log('AuthClient logout completed');
//       }

//       // Clear all user state
//       setUser({
//         principal: null,
//         isAuthenticated: false,
//         userType: null,
//         profile: null,
//         identity: null
//       });

//       // Reset token state
//       setTokenBalance(null);
//       setTokenMetadata(null);

//       // Reconnect with anonymous agent
//       await connectToBackend();
      
//       console.log('Logged out from Internet Identity - user is now anonymous');
//     } catch (err) {
//       console.error('Logout failed:', err);
//       setError('Logout failed');
      
//       // Force clear state even if logout failed
//       setUser({
//         principal: null,
//         isAuthenticated: false,
//         userType: null,
//         profile: null,
//         identity: null
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const refreshSystemInfo = async (): Promise<void> => {
//     if (!actor) return;
    
//     try {
//       const sysInfo = await actor.getSystemInfo();
//       setSystemInfo(sysInfo);
//     } catch (err) {
//       console.error('Failed to refresh system info:', err);
//       setError('Failed to refresh system information');
//     }
//   };

//   const clearError = (): void => {
//     setError(null);
//   };

//   const formatCurrency = async (amount: number): Promise<string> => {
//     return `R${amount.toFixed(2)}`;
//   };

//   const validateSAId = async (idNumber: string): Promise<boolean> => {
//     try {
//       return idNumber.length === 13 && /^\d+$/.test(idNumber);
//     } catch (err) {
//       console.error('Failed to validate SA ID:', err);
//       return false;
//     }
//   };

//   const formatPhone = async (phone: string): Promise<string> => {
//     try {
//       const cleaned = phone.replace(/\D/g, '');
//       if (cleaned.startsWith('27')) {
//         return `+${cleaned}`;
//       } else if (cleaned.startsWith('0')) {
//         return `+27${cleaned.substring(1)}`;
//       } else {
//         return `+27${cleaned}`;
//       }
//     } catch (err) {
//       console.error('Failed to format phone:', err);
//       return phone;
//     }
//   };

//   const createService = async (
//     title: string,
//     description: string,
//     category: string, 
//     pricing: ServicePricing,
//     location: string,
//     images: string[],
//     availability: AvailabilitySlot[],
//     requirements: string[],
//     duration: number
//   ): Promise<Service | null> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return null;
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);

//       const backendCategory = stringToServiceCategory(category);
//       const result = await actor.createService(
//         title,
//         description,
//         backendCategory,
//         pricing,
//         location,
//         images,
//         availability,
//         requirements,
//         BigInt(duration)
//       );

//       await refreshServices();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Service creation failed:', result.err);
//         setError(result.err);
//         return null;
//       }
//     } catch (err) {
//       console.error('Failed to create service:', err);
//       setError(err instanceof Error ? err.message : 'Failed to create service');
//       return null;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getService = async (serviceId: string): Promise<Service | null> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return null;
//     }
    
//     try {
//       const result = await actor.getService(serviceId);
//       return result.length > 0 ? result[0] || null : null;
//     } catch (err) {
//       console.error('Failed to get service:', err);
//       return null;
//     }
//   };

//   const getAllServices = async (): Promise<Service[]> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return [];
//     }
    
//     try {
//       const result = await actor.getAllServices();
//       setServices(result);
//       return result;
//     } catch (err) {
//       console.error('Failed to get all services:', err);
//       return [];
//     }
//   };

//   const getActiveServices = async (): Promise<Service[]> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return [];
//     }
    
//     try {
//       const result = await actor.getActiveServices();
//       setActiveServices(result);
//       return result;
//     } catch (err) {
//       console.error('Failed to get active services:', err);
//       return [];
//     }
//   };

//   const getServicesByCategory = async (category: string): Promise<Service[]> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return [];
//     }
    
//     try {
//       const backendCategory = stringToServiceCategory(category);
//       return await actor.getServicesByCategory(backendCategory);
//     } catch (err) {
//       console.error('Failed to get services by category:', err);
//       return [];
//     }
//   };

//   const searchServices = async (
//     searchQuery: string,
//     category?: string,
//     location?: string
//   ): Promise<Service[]> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return [];
//     }
    
//     try {
//       const categoryParam: [] | [ServiceCategory] = category ? [stringToServiceCategory(category)] : [];
//       const locationParam: [] | [string] = location ? [location] : [];
//       return await actor.searchServices(searchQuery, categoryParam, locationParam);
//     } catch (err) {
//       console.error('Failed to search services:', err);
//       return [];
//     }
//   };

//   const refreshServices = async (): Promise<void> => {
//     try {
//       await Promise.all([
//         getAllServices(),
//         getActiveServices()
//       ]);
//     } catch (err) {
//       console.error('Failed to refresh services:', err);
//     }
//   };

//   useEffect(() => {
//     const initialize = async () => {
//       await connectToBackend();
//       await initializeAuth();
//     };
//     initialize();
//   }, []);

//   useEffect(() => {
//     if (kotomoActor && user.isAuthenticated && user.principal) {
//       refreshTokenBalance().catch(error => {
//         console.warn('Failed to load token balance:', error);
//       });
//     }
//   }, [kotomoActor, user.isAuthenticated, user.principal]);

//   const loadSavedProfile = async (): Promise<void> => {
//     console.log('Profile loading handled by authentication system');
//   };

//   const detectUserType = async (actorToUse?: any): Promise<'client' | 'provider' | null> => {
//     const currentActor = actorToUse || actor;
//     if (!currentActor) return null;
    
//     try {
//       const providerResult = await currentActor.getProviderProfile();
//       if ('ok' in providerResult && providerResult.ok) {
//         console.log('Detected as provider based on backend profile');
//         return 'provider';
//       }
//     } catch (error) {
//       console.log('Not a provider, checking client profile...');
//     }
    
//     try {
//       const clientResult = await currentActor.getClientProfile();
//       if ('ok' in clientResult && clientResult.ok) {
//         console.log('Detected as client based on backend profile');
//         return 'client';
//       }
//     } catch (error) {
//       console.log('No client profile found either');
//     }
    
//     console.log('No profile found - user needs to create a profile');
//     return null; // No profile found - user needs to create one
//   };

//   const updateUserType = (userType: 'client' | 'provider'): void => {
//     setUser(prev => ({
//       ...prev,
//       userType
//     }));
//     console.log(`User type updated to: ${userType}`);
//   };

//   const saveUserProfile = async (profileData: any): Promise<void> => {
//     try {
//       setIsLoading(true);
//       setError(null);

//       if (actor && user.principal) {
//         try {
//           let existingProfile = null;
//           if (user.userType === 'provider') {
//             const result = await actor.getProviderProfile();
//             existingProfile = 'ok' in result ? result.ok : null;
//           } else {
//             const result = await actor.getClientProfile();
//             existingProfile = 'ok' in result ? result.ok : null;
//           }

//           if (existingProfile) {
//             if (user.userType === 'provider') {
//               await updateProviderProfile(profileData);
//             } else {
//               await updateClientProfile(profileData);
//             }
//           } else {
//             if (user.userType === 'provider') {
//               await actor.registerProvider(profileData);
//             } else {
//               await actor.registerClient(profileData);
//             }
//           }
//         } catch (error) {
//           console.log('Profile not found, registering new user');
//           if (user.userType === 'provider') {
//             await actor.registerProvider(profileData);
//           } else {
//             await actor.registerClient(profileData);
//           }
//         }
//       }

//       setUser(prev => ({
//         ...prev,
//         profile: profileData
//       }));

//       console.log('Profile saved successfully');
//     } catch (error) {
//       console.error('Failed to save profile:', error);
//       setError('Failed to save profile');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getUserProfile = async (): Promise<any> => {
//     try {
//       if (!actor) return null;

//       if (user.userType === 'provider') {
//         return await getProviderProfile();
//       } else {
//         return await getClientProfile();
//       }
//     } catch (error) {
//       console.error('Failed to get profile:', error);
//       return null;
//     }
//   };

//   const updateUserProfile = async (profileData: any): Promise<void> => {
//     try {
//       setIsLoading(true);
//       setError(null);

//       const currentProfile = user.profile || {};
//       const updatedProfile = { ...currentProfile, ...profileData, updatedAt: new Date().toISOString() };
      
//       if (actor && user.principal) {
//         if (user.userType === 'provider') {
//           await updateProviderProfile(updatedProfile);
//         } else {
//           await updateClientProfile(updatedProfile);
//         }
//       }

//       setUser(prev => ({
//         ...prev,
//         profile: updatedProfile
//       }));

//       console.log('Profile updated successfully');
//     } catch (error) {
//       console.error('Failed to update profile:', error);
//       setError('Failed to update profile');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // ============================================================================
//   // KOTOMO TOKEN FUNCTIONS
//   // ============================================================================

//   const connectToKotomo = async (): Promise<void> => {
//     const currentAgent = agent;
//     if (!currentAgent) {
//       throw new Error('Agent not initialized');
//     }

//     try {
//       setIsLoading(true);
//       const newKotomoActor = createKotomoActor(kotomoCanisterId, currentAgent);
//       setKotomoActor(newKotomoActor);

//       const metadata = await newKotomoActor.icrc1_metadata();
//       setTokenMetadata(metadata);

//       if (user.principal) {
//         const balance = await newKotomoActor.icrc1_balance_of({
//           owner: user.principal,
//           subaccount: []
//         });
//         setTokenBalance(balance);
//       }
      
//       console.log('Connected to Kotomo token canister successfully');
//     } catch (error) {
//       console.error('Failed to connect to Kotomo canister:', error);
//       setError('Failed to connect to Kotomo token canister');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getTokenBalance = async (account?: Account): Promise<Tokens> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     const targetAccount = account || {
//       owner: user.principal || Principal.anonymous(),
//       subaccount: []
//     };

//     const balance = await kotomoActor.icrc1_balance_of(targetAccount);
//     return balance;
//   };

//   const getTokenMetadata = async (): Promise<Array<[string, any]>> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     return await kotomoActor.icrc1_metadata();
//   };

//   const transferTokens = async (to: Account, amount: Tokens, memo?: Uint8Array): Promise<TransferResult> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     if (!user.principal) {
//       throw new Error('User not authenticated');
//     }

//     const transferArg: TransferArg = {
//       to,
//       amount,
//       fee: [],
//       memo: memo ? [memo] : [],
//       from_subaccount: [],
//       created_at_time: []
//     };

//     const result = await kotomoActor.icrc1_transfer(transferArg);

//     if ('Ok' in result) {
//       await refreshTokenBalance();
//     }
    
//     return result;
//   };

//   const approveTokens = async (spender: Account, amount: Tokens, memo?: Uint8Array): Promise<ApproveResult> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     const approveArgs: ApproveArgs = {
//       spender,
//       amount,
//       fee: [],
//       memo: memo ? [memo] : [],
//       from_subaccount: [],
//       created_at_time: [],
//       expected_allowance: [],
//       expires_at: []
//     };

//     return await kotomoActor.icrc2_approve(approveArgs);
//   };

//   const getTokenAllowance = async (owner: Account, spender: Account): Promise<Allowance> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     const allowanceArgs: AllowanceArgs = {
//       account: owner,
//       spender
//     };

//     return await kotomoActor.icrc2_allowance(allowanceArgs);
//   };

//   const getTokenSymbol = async (): Promise<string> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     return await kotomoActor.icrc1_symbol();
//   };

//   const getTokenName = async (): Promise<string> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     return await kotomoActor.icrc1_name();
//   };

//   const getTokenDecimals = async (): Promise<number> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     return await kotomoActor.icrc1_decimals();
//   };

//   const getTokenFee = async (): Promise<Tokens> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     return await kotomoActor.icrc1_fee();
//   };

//   const getTokenTotalSupply = async (): Promise<Tokens> => {
//     if (!kotomoActor) {
//       throw new Error('Kotomo token canister not connected');
//     }

//     return await kotomoActor.icrc1_total_supply();
//   };

//   const refreshTokenBalance = async (): Promise<void> => {
//     if (!kotomoActor || !user.principal) {
//       return;
//     }

//     try {
//       const balance = await kotomoActor.icrc1_balance_of({
//         owner: user.principal,
//         subaccount: []
//       });
//       setTokenBalance(balance);
//     } catch (error) {
//       console.error('Failed to refresh token balance:', error);
//     }
//   };

//   // ============================================================================
//   // CLIENT MANAGEMENT FUNCTIONS
//   // ============================================================================

//   const registerClient = async (registration: {
//     name: string;
//     email: string;
//     password: string;
//     phone: string;
//     location: string;
//     agreeToTerms: boolean;
//   }): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const result = await actor.registerClient({
//         ...registration,
//         version: BigInt(1)
//       });
//       return result;
//     } catch (err) {
//       console.error('Failed to register client:', err);
//       setError(err instanceof Error ? err.message : 'Failed to register client');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getClientProfile = async (): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getClientProfile();
//       return result;
//     } catch (err) {
//       console.error('Failed to get client profile:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get client profile');
//       throw err;
//     }
//   };

//   const updateClientProfile = async (
//     name?: string,
//     phone?: string,
//     location?: string,
//     profileImage?: string
//   ): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const result = await actor.updateClientProfile(
//         name ? [name] : [],
//         phone ? [phone] : [],
//         location ? [location] : [],
//         profileImage ? [profileImage] : []
//       );
//       return result;
//     } catch (err) {
//       console.error('Failed to update client profile:', err);
//       setError(err instanceof Error ? err.message : 'Failed to update client profile');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const createBooking = async (
//     serviceId: string,
//     providerId: string,
//     date: string,
//     time: string,
//     duration: number,
//     location: string,
//     paymentMethod: string,
//     notes?: string
//   ): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const providerPrincipal = Principal.fromText(providerId);
//       const paymentMethodVariant = paymentMethod === 'Card' ? { 'Card': null } : 
//                                    paymentMethod === 'Cash' ? { 'Cash': null } : 
//                                    { 'BankTransfer': null };
      
//       const result = await actor.createBooking(
//         serviceId,
//         providerPrincipal,
//         date,
//         time,
//         BigInt(duration),
//         location,
//         notes ? [notes] : [],
//         paymentMethodVariant
//       );
//       return result;
//     } catch (err) {
//       console.error('Failed to create booking:', err);
//       setError(err instanceof Error ? err.message : 'Failed to create booking');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getClientBookings = async (): Promise<any[]> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getClientBookings();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get client bookings:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get client bookings:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get client bookings');
//       return [];
//     }
//   };

//   const getNotifications = async (): Promise<any[]> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getNotifications();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get notifications:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get notifications:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get notifications');
//       return [];
//     }
//   };

//   // ============================================================================
//   // PROVIDER MANAGEMENT FUNCTIONS
//   // ============================================================================

//   const registerProvider = async (registration: {
//     name: string;
//     email: string;
//     password: string;
//     phone: string;
//     idNumber: string;
//     businessName: string;
//     businessType: string;
//     location: string;
//     serviceCategories: string[];
//     businessLicense?: string;
//     insuranceDetails?: string;
//     description: string;
//     experience: number;
//     consentBackgroundCheck: boolean;
//     agreeToTerms: boolean;
//   }): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const backendCategories = registration.serviceCategories.map(cat => stringToServiceCategory(cat));
//       const providerRegistration: any = {
//         name: registration.name,
//         email: registration.email,
//         password: registration.password,
//         phone: registration.phone,
//         idNumber: registration.idNumber,
//         businessName: registration.businessName,
//         businessType: registration.businessType,
//         location: registration.location,
//         serviceCategories: backendCategories,
//         description: registration.description,
//         consentBackgroundCheck: registration.consentBackgroundCheck,
//         agreeToTerms: registration.agreeToTerms,
//         version: BigInt(1),
//         experience: BigInt(registration.experience),
//         businessLicense: registration.businessLicense ? [registration.businessLicense] : [],
//         insuranceDetails: registration.insuranceDetails ? [registration.insuranceDetails] : []
//       };
      
//       const result = await actor.registerProvider(providerRegistration);
//       return result;
//     } catch (err) {
//       console.error('Failed to register provider:', err);
//       setError(err instanceof Error ? err.message : 'Failed to register provider');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getProviderProfile = async (): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getProviderProfile();
//       return result;
//     } catch (err) {
//       console.error('Failed to get provider profile:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get provider profile');
//       throw err;
//     }
//   };

//   const updateProviderProfile = async (
//     businessName?: string,
//     businessType?: string,
//     phone?: string,
//     location?: string,
//     description?: string,
//     profileImage?: string,
//     portfolio?: string[]
//   ): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const result = await actor.updateProviderProfile(
//         businessName ? [businessName] : [],
//         businessType ? [businessType] : [],
//         phone ? [phone] : [],
//         location ? [location] : [],
//         description ? [description] : [],
//         profileImage ? [profileImage] : [],
//         portfolio ? [portfolio] : []
//       );
//       return result;
//     } catch (err) {
//       console.error('Failed to update provider profile:', err);
//       setError(err instanceof Error ? err.message : 'Failed to update provider profile');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getProviderBookings = async (): Promise<any[]> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getProviderBookings();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get provider bookings:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get provider bookings:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get provider bookings');
//       return [];
//     }
//   };

//   const acceptProviderBooking = async (bookingId: string, estimatedCost: number): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const result = await actor.acceptProviderBooking(bookingId, estimatedCost);
//       return result;
//     } catch (err) {
//       console.error('Failed to accept booking:', err);
//       setError(err instanceof Error ? err.message : 'Failed to accept booking');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const rejectProviderBooking = async (bookingId: string, reason?: string): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const result = await actor.rejectProviderBooking(bookingId, reason ? [reason] : []);
//       return result;
//     } catch (err) {
//       console.error('Failed to reject booking:', err);
//       setError(err instanceof Error ? err.message : 'Failed to reject booking');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const completeProviderBooking = async (bookingId: string): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const result = await actor.completeProviderBooking(bookingId);
//       return result;
//     } catch (err) {
//       console.error('Failed to complete booking:', err);
//       setError(err instanceof Error ? err.message : 'Failed to complete booking');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const updateProviderAvailability = async (availability: AvailabilitySlot[]): Promise<any> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       const result = await actor.updateProviderAvailability(availability);
//       return result;
//     } catch (err) {
//       console.error('Failed to update availability:', err);
//       setError(err instanceof Error ? err.message : 'Failed to update availability');
//       throw err;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const getProviderReviews = async (): Promise<any[]> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getProviderReviews();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get provider reviews:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get provider reviews:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get provider reviews');
//       return [];
//     }
//   };

//   const getProviderNotifications = async (): Promise<any[]> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getProviderNotifications();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get provider notifications:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get provider notifications:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get provider notifications');
//       return [];
//     }
//   };

//   const markProviderNotificationAsRead = async (notificationId: string): Promise<boolean> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.markProviderNotificationAsRead(notificationId);
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to mark notification as read:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to mark notification as read:', err);
//       setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
//       return false;
//     }
//   };

//   const getProviderAnalytics = async (): Promise<{
//     totalBookings: number;
//     completedJobs: number;
//     averageRating: number;
//     totalEarnings: number;
//     reviewCount: number;
//   }> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.getProviderAnalytics();
//       if ('ok' in result) {
//         return {
//           totalBookings: Number(result.ok.totalBookings),
//           completedJobs: Number(result.ok.completedJobs),
//           averageRating: Number(result.ok.averageRating),
//           totalEarnings: Number(result.ok.totalEarnings),
//           reviewCount: Number(result.ok.reviewCount)
//         };
//       } else {
//         console.error('Failed to get provider analytics:', result.err);
//         return {
//           totalBookings: 0,
//           completedJobs: 0,
//           averageRating: 5.0,
//           totalEarnings: 0,
//           reviewCount: 0
//         };
//       }
//     } catch (err) {
//       console.error('Failed to get provider analytics:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get provider analytics');
//       return {
//         totalBookings: 0,
//         completedJobs: 0,
//         averageRating: 5.0,
//         totalEarnings: 0,
//         reviewCount: 0
//       };
//     }
//   };

//   const searchProviders = async (
//     location?: string,
//     serviceCategory?: string,
//     minRating?: number,
//     verifiedOnly?: boolean,
//     businessType?: string,
//     maxDistance?: number
//   ): Promise<any[]> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       const result = await actor.searchProviders(
//         location ? [location] : [],
//         serviceCategory ? [stringToServiceCategory(serviceCategory)] : [],
//         minRating ? [minRating] : [],
//         verifiedOnly || false,
//         businessType ? [businessType] : [],
//         maxDistance ? [BigInt(maxDistance)] : []
//       );
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to search providers:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to search providers:', err);
//       setError(err instanceof Error ? err.message : 'Failed to search providers');
//       return [];
//     }
//   };

//   // ============================================================================
//   // ENHANCED SERVICES MANAGEMENT FUNCTIONS
//   // TODO: Update these to use new IDL interface methods
//   // ============================================================================

//   const updateService = async (
//     serviceId: string,
//     updates: {
//       title?: string;
//       description?: string;
//       pricing?: ServicePricing;
//       location?: string;
//       images?: string[];
//       availability?: AvailabilitySlot[];
//       requirements?: string[];
//       duration?: number;
//       isActive?: boolean;
//     }
//   ): Promise<Service | null> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       // TODO: Uncomment when IDL is updated
//       // const updateParams = {
//       //   title: updates.title ? [updates.title] : [],
//       //   description: updates.description ? [updates.description] : [],
//       //   pricing: updates.pricing ? [updates.pricing] : [],
//       //   location: updates.location ? [updates.location] : [],
//       //   images: updates.images ? [updates.images] : [],
//       //   availability: updates.availability ? [updates.availability] : [],
//       //   requirements: updates.requirements ? [updates.requirements] : [],
//       //   duration: updates.duration ? [BigInt(updates.duration)] : [],
//       //   isActive: updates.isActive !== undefined ? [updates.isActive] : []
//       // };
//       // 
//       // const result = await actor.updateService(serviceId, updateParams);
//       // await refreshServices();
//       // return result;
      
//       // Mock implementation for now
//       console.warn('updateService: Mock implementation - IDL needs to be regenerated');
//       await refreshServices();
//       return null;
//     } catch (err) {
//       console.error('Failed to update service:', err);
//       setError(err instanceof Error ? err.message : 'Failed to update service');
//       return null;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const deleteService = async (serviceId: string): Promise<boolean> => {
//     if (!actor) {
//       throw new Error('Backend not connected');
//     }
    
//     try {
//       setIsLoading(true);
//       setError(null);
      
//       // TODO: Uncomment when IDL is updated
//       // const result = await actor.deleteService(serviceId);
//       // await refreshServices();
//       // return true;
      
//       // Mock implementation for now
//       console.warn('deleteService: Mock implementation - IDL needs to be regenerated');
//       await refreshServices();
//       return true;
//     } catch (err) {
//       console.error('Failed to delete service:', err);
//       setError(err instanceof Error ? err.message : 'Failed to delete service');
//       return false;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Mock implementations for other service functions that need IDL updates
//   const getServicesByProvider = async (): Promise<Service[]> => {
//     console.warn('getServicesByProvider: Mock implementation - IDL needs to be regenerated');
//     return [];
//   };

//   const getSupportedServiceCategories = async (): Promise<string[]> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return [];
//     }
    
//     try {
//       const result = await actor.getSupportedServiceCategories();
//       if (Array.isArray(result)) {
//         const categoryStrings = result.map(cat => serviceCategoryToString(cat));
//         setSupportedCategories(categoryStrings);
//         return categoryStrings;
//       } else {
//         console.warn('Unexpected result format from getSupportedServiceCategories');
//         return supportedCategories;
//       }
//     } catch (err) {
//       console.error('Failed to get supported service categories:', err);
//       return supportedCategories;
//     }
//   };

//   const getServiceCategoryName = async (category: string): Promise<string> => {
//     console.warn('getServiceCategoryName: Mock implementation - IDL needs to be regenerated');
//     return category;
//   };

//   const getDefaultServicePricing = async (category: string): Promise<ServicePricing | null> => {
//     console.warn('getDefaultServicePricing: Mock implementation - IDL needs to be regenerated');
//     return null;
//   };

//   const getServiceStats = async (): Promise<{
//     totalServices: number;
//     activeServices: number;
//     servicesByCategory: [string, number][];
//     averageRating: number;
//   }> => {
//     if (!actor) {
//       console.error('Backend not connected');
//       return {
//         totalServices: 0,
//         activeServices: 0,
//         servicesByCategory: [],
//         averageRating: 0
//       };
//     }
    
//     try {
//       // Try to get stats from backend if available
//       // For now, calculate stats from current data
//       const categoryCounts = new Map<string, number>();
      
//       // Count services by category
//       services.forEach(service => {
//         const categoryStr = serviceCategoryToString(service.category);
//         categoryCounts.set(categoryStr, (categoryCounts.get(categoryStr) || 0) + 1);
//       });
      
//       // Calculate average rating from services
//       const servicesWithRatings = services.filter(service => service.rating && service.rating > 0);
//       const averageRating = servicesWithRatings.length > 0 
//         ? servicesWithRatings.reduce((sum, service) => sum + (service.rating || 0), 0) / servicesWithRatings.length
//         : 0;
      
//       return {
//         totalServices: services.length,
//         activeServices: activeServices.length,
//         servicesByCategory: Array.from(categoryCounts.entries()),
//         averageRating: Number(averageRating.toFixed(1))
//       };
//     } catch (err) {
//       console.error('Failed to get service stats:', err);
//       return {
//         totalServices: services.length,
//         activeServices: activeServices.length,
//         servicesByCategory: supportedCategories.map(cat => [cat, 0]),
//         averageRating: 0
//       };
//     }
//   };

//   const updateServiceRating = async (serviceId: string, newRating: number, reviewCount: number): Promise<boolean> => {
//     console.warn('updateServiceRating: Mock implementation - IDL needs to be regenerated');
//     return true;
//   };

//   const validateServiceData = async (
//     title: string,
//     description: string,
//     category: string,
//     pricing: ServicePricing,
//     duration: number
//   ): Promise<string[]> => {
//     console.warn('validateServiceData: Mock implementation - IDL needs to be regenerated');
//     const errors: string[] = [];
//     if (!title || title.length < 3) errors.push('Title must be at least 3 characters');
//     if (!description || description.length < 10) errors.push('Description must be at least 10 characters');
//     if (duration <= 0) errors.push('Duration must be greater than 0');
//     return errors;
//   };

//   const bulkUpdateServiceStatus = async (serviceIds: string[], isActive: boolean): Promise<[string, boolean][]> => {
//     console.warn('bulkUpdateServiceStatus: Mock implementation - IDL needs to be regenerated');
//     return serviceIds.map(id => [id, true]);
//   };

//   const exportServices = async (): Promise<Service[]> => {
//     console.warn('exportServices: Mock implementation - IDL needs to be regenerated');
//     return services;
//   };

//   const getServiceCount = async (): Promise<number> => {
//     console.warn('getServiceCount: Mock implementation - IDL needs to be regenerated');
//     return services.length;
//   };

//   const getProviderServiceCount = async (): Promise<number> => {
//     console.warn('getProviderServiceCount: Mock implementation - IDL needs to be regenerated');
//     return 0;
//   };

//   // ============================================================================
//   // MESSAGING MANAGEMENT FUNCTIONS IMPLEMENTATION
//   // ============================================================================
  
//   const createConversation = async (
//     participants: string[],
//     conversationType: any = { DirectMessage: null },
//     title?: string,
//     relatedBookingId?: string
//   ): Promise<any> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const participantPrincipals = participants.map(p => Principal.fromText(p));
//       const result = await actor.createConversation(
//         participantPrincipals,
//         title ? [title] : [],
//         conversationType,
//         relatedBookingId ? [relatedBookingId] : []
//       );
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         throw new Error(result.err);
//       }
//     } catch (err) {
//       console.error('Failed to create conversation:', err);
//       setError(err instanceof Error ? err.message : 'Failed to create conversation');
//       throw err;
//     }
//   };

//   const sendMessage = async (
//     conversationId: string,
//     messageType: any = { Text: null },
//     text: string,
//     attachments?: any[],
//     replyToMessageId?: string
//   ): Promise<any> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.sendMessage(
//         conversationId,
//         messageType,
//         text,
//         attachments ? [attachments] : [],
//         replyToMessageId ? [replyToMessageId] : []
//       );
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         throw new Error(result.err);
//       }
//     } catch (err) {
//       console.error('Failed to send message:', err);
//       setError(err instanceof Error ? err.message : 'Failed to send message');
//       throw err;
//     }
//   };

//   const getConversations = async (): Promise<any[]> => {
//     if (!isConnected || !actor) {
//       console.warn('Backend not connected for conversations');
//       return [];
//     }

//     try {
//       const result = await actor.getConversations();
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get conversations:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get conversations:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get conversations');
//       return [];
//     }
//   };

//   const getMessages = async (
//     conversationId: string,
//     limit?: number,
//     offset?: number
//   ): Promise<any[]> => {
//     if (!isConnected || !actor) {
//       console.warn('Backend not connected for messages');
//       return [];
//     }

//     try {
//       const result = await actor.getMessages(
//         conversationId,
//         limit ? [BigInt(limit)] : [],
//         offset ? [BigInt(offset)] : []
//       );
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get messages:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get messages:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get messages');
//       return [];
//     }
//   };

//   const markMessagesAsRead = async (conversationId: string): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       console.warn('Backend not connected for marking messages as read');
//       return false;
//     }

//     try {
//       const result = await actor.markMessagesAsRead(conversationId);
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to mark messages as read:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to mark messages as read:', err);
//       setError(err instanceof Error ? err.message : 'Failed to mark messages as read');
//       return false;
//     }
//   };

//   const blockUser = async (userToBlock: string, reason?: string): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.blockUser(
//         Principal.fromText(userToBlock),
//         reason ? [reason] : []
//       );
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         throw new Error(result.err);
//       }
//     } catch (err) {
//       console.error('Failed to block user:', err);
//       setError(err instanceof Error ? err.message : 'Failed to block user');
//       throw err;
//     }
//   };

//   const unblockUser = async (userToUnblock: string): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.unblockUser(Principal.fromText(userToUnblock));
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         throw new Error(result.err);
//       }
//     } catch (err) {
//       console.error('Failed to unblock user:', err);
//       setError(err instanceof Error ? err.message : 'Failed to unblock user');
//       throw err;
//     }
//   };

//   const saveDraft = async (
//     conversationId: string,
//     draftText: string,
//     replyToMessageId?: string
//   ): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       console.warn('Backend not connected for saving draft');
//       return false;
//     }

//     try {
//       const result = await actor.saveDraft(
//         conversationId,
//         draftText,
//         replyToMessageId ? [replyToMessageId] : []
//       );
      
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to save draft:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to save draft:', err);
//       return false;
//     }
//   };

//   const getDraft = async (conversationId: string): Promise<any | null> => {
//     if (!isConnected || !actor) {
//       console.warn('Backend not connected for getting draft');
//       return null;
//     }

//     try {
//       const result = await actor.getDraft(conversationId);
//       return result.length > 0 ? result[0] : null;
//     } catch (err) {
//       console.error('Failed to get draft:', err);
//       return null;
//     }
//   };

//   const clearDraft = async (conversationId: string): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       console.warn('Backend not connected for clearing draft');
//       return false;
//     }

//     try {
//       return await actor.clearDraft(conversationId);
//     } catch (err) {
//       console.error('Failed to clear draft:', err);
//       return false;
//     }
//   };

//   const getMessagingStats = async (): Promise<{
//     totalMessages: number;
//     totalConversations: number;
//     activeConversations: number;
//   }> => {
//     if (!isConnected || !actor) {
//       console.warn('Backend not connected for messaging stats');
//       return {
//         totalMessages: 0,
//         totalConversations: 0,
//         activeConversations: 0
//       };
//     }

//     try {
//       const result = await actor.getMessagingStats();
//       return {
//         totalMessages: Number(result.totalMessages),
//         totalConversations: Number(result.totalConversations),
//         activeConversations: Number(result.activeConversations)
//       };
//     } catch (err) {
//       console.error('Failed to get messaging stats:', err);
//       return {
//         totalMessages: 0,
//         totalConversations: 0,
//         activeConversations: 0
//       };
//     }
//   };

//   // ============================================================================
//   // COMPREHENSIVE NOTIFICATION FUNCTIONS
//   // ============================================================================

//   const getAllNotifications = async (): Promise<any[]> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.getAllNotifications();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get all notifications:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get all notifications:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get all notifications');
//       return [];
//     }
//   };

//   const getUnreadNotifications = async (): Promise<any[]> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.getUnreadNotifications();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get unread notifications:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get unread notifications:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get unread notifications');
//       return [];
//     }
//   };

//   const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.markNotificationAsRead(notificationId);
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to mark notification as read:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to mark notification as read:', err);
//       setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
//       return false;
//     }
//   };

//   const markAllNotificationsAsRead = async (): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.markAllNotificationsAsRead();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to mark all notifications as read:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to mark all notifications as read:', err);
//       setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
//       return false;
//     }
//   };

//   const deleteNotification = async (notificationId: string): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.deleteNotification(notificationId);
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to delete notification:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to delete notification:', err);
//       setError(err instanceof Error ? err.message : 'Failed to delete notification');
//       return false;
//     }
//   };

//   const deleteAllNotifications = async (): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.deleteAllNotifications();
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to delete all notifications:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to delete all notifications:', err);
//       setError(err instanceof Error ? err.message : 'Failed to delete all notifications');
//       return false;
//     }
//   };

//   const getNotificationById = async (notificationId: string): Promise<any | null> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.getNotificationById(notificationId);
//       if ('ok' in result) {
//         return result.ok || null;
//       } else {
//         console.error('Failed to get notification by ID:', result.err);
//         return null;
//       }
//     } catch (err) {
//       console.error('Failed to get notification by ID:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get notification by ID');
//       return null;
//     }
//   };

//   const getNotificationStats = async (): Promise<{
//     totalNotifications: number;
//     unreadNotifications: number;
//     readNotifications: number;
//   }> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const result = await actor.getNotificationStats();
//       if ('ok' in result) {
//         return {
//           totalNotifications: Number(result.ok.totalNotifications),
//           unreadNotifications: Number(result.ok.unreadNotifications),
//           readNotifications: Number(result.ok.readNotifications)
//         };
//       } else {
//         console.error('Failed to get notification stats:', result.err);
//         return {
//           totalNotifications: 0,
//           unreadNotifications: 0,
//           readNotifications: 0
//         };
//       }
//     } catch (err) {
//       console.error('Failed to get notification stats:', err);
//       return {
//         totalNotifications: 0,
//         unreadNotifications: 0,
//         readNotifications: 0
//       };
//     }
//   };

//   const getNotificationsByType = async (notificationType: string): Promise<any[]> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       // Convert string to proper notification type
//       let typeVariant;
//       switch (notificationType.toLowerCase()) {
//         case 'bookingrequest':
//           typeVariant = { BookingRequest: null };
//           break;
//         case 'bookingconfirmed':
//           typeVariant = { BookingConfirmed: null };
//           break;
//         case 'bookingcancelled':
//           typeVariant = { BookingCancelled: null };
//           break;
//         case 'paymentreceived':
//           typeVariant = { PaymentReceived: null };
//           break;
//         case 'reviewreceived':
//           typeVariant = { ReviewReceived: null };
//           break;
//         case 'messagereceived':
//           typeVariant = { MessageReceived: null };
//           break;
//         case 'systemupdate':
//           typeVariant = { SystemUpdate: null };
//           break;
//         default:
//           typeVariant = { SystemUpdate: null };
//       }

//       const result = await actor.getNotificationsByType(typeVariant);
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to get notifications by type:', result.err);
//         return [];
//       }
//     } catch (err) {
//       console.error('Failed to get notifications by type:', err);
//       setError(err instanceof Error ? err.message : 'Failed to get notifications by type');
//       return [];
//     }
//   };

//   const createSystemNotification = async (
//     userId: string,
//     title: string,
//     message: string
//   ): Promise<boolean> => {
//     if (!isConnected || !actor) {
//       throw new Error('Backend not connected');
//     }

//     try {
//       const userPrincipal = Principal.fromText(userId);
//       const result = await actor.createSystemNotification(userPrincipal, title, message);
//       if ('ok' in result) {
//         return result.ok;
//       } else {
//         console.error('Failed to create system notification:', result.err);
//         return false;
//       }
//     } catch (err) {
//       console.error('Failed to create system notification:', err);
//       setError(err instanceof Error ? err.message : 'Failed to create system notification');
//       return false;
//     }
//   };

//   const contextValue: AppContextState = {
//     agent,
//     actor,
//     kotomoActor,
//     canisterId,
//     kotomoCanisterId,
//     isConnected,

//     authClient,

//     // Token state
//     tokenBalance,
//     tokenMetadata,

//     user,

//     systemInfo,
//     isLoading,
//     error,

//     availableServices,
//     supportedLocations,
//     supportedCategories,
//     services,
//     activeServices,

//     connectToBackend,
//     disconnect,
//     loginWithII,
//     logout,
//     refreshSystemInfo,
//     clearError,
//     setLoading: setIsLoading,
//     detectUserType,
//     updateUserType,

//     createService,
//     getService,
//     getAllServices,
//     getActiveServices,
//     getServicesByCategory,
//     searchServices,
//     refreshServices,

//     formatCurrency,
//     validateSAId,
//     formatPhone,

//     saveUserProfile,
//     getUserProfile,
//     updateUserProfile,

//     // ============================================================================
//     // KOTOMO TOKEN FUNCTIONS
//     // ============================================================================
//     connectToKotomo,
//     getTokenBalance,
//     getTokenMetadata,
//     transferTokens,
//     approveTokens,
//     getTokenAllowance,
//     getTokenSymbol,
//     getTokenName,
//     getTokenDecimals,
//     getTokenFee,
//     getTokenTotalSupply,
//     refreshTokenBalance,

//     // ============================================================================
//     // CLIENT MANAGEMENT FUNCTIONS (added)
//     // ============================================================================
//     registerClient,
//     getClientProfile,
//     updateClientProfile,
//     createBooking,
//     getClientBookings,
//     getNotifications,

//     // ============================================================================
//     // PROVIDER MANAGEMENT FUNCTIONS (added)
//     // ============================================================================
//     registerProvider,
//     getProviderProfile,
//     updateProviderProfile,
//     getProviderBookings,
//     acceptProviderBooking,
//     rejectProviderBooking,
//     completeProviderBooking,
//     updateProviderAvailability,
//     getProviderReviews,
//     getProviderNotifications,
//     markProviderNotificationAsRead,
//     getProviderAnalytics,
//     searchProviders,

//     // ============================================================================
//     // ENHANCED SERVICES MANAGEMENT FUNCTIONS (added)
//     // ============================================================================
//     updateService,
//     deleteService,
//     getServicesByProvider,
//     getSupportedServiceCategories,
//     getServiceCategoryName,
//     getDefaultServicePricing,
//     getServiceStats,
//     updateServiceRating,
//     validateServiceData,
//     bulkUpdateServiceStatus,
//     exportServices,
//     getServiceCount,
//     getProviderServiceCount,

//     // ============================================================================
//     // MESSAGING FUNCTIONS (added)
//     // ============================================================================
//     createConversation,
//     sendMessage,
//     getConversations,
//     getMessages,
//     markMessagesAsRead,
//     blockUser,
//     unblockUser,
//     saveDraft,
//     getDraft,
//     clearDraft,
//     getMessagingStats,

//     // ============================================================================
//     // COMPREHENSIVE NOTIFICATION FUNCTIONS (added)
//     // ============================================================================
//     getAllNotifications,
//     getUnreadNotifications,
//     markNotificationAsRead,
//     markAllNotificationsAsRead,
//     deleteNotification,
//     deleteAllNotifications,
//     getNotificationById,
//     getNotificationStats,
//     getNotificationsByType,
//     createSystemNotification
//   };

//   return (
//     <AppContext.Provider value={contextValue}>
//       {children}
//     </AppContext.Provider>
//   );
// };

// export const useApp = (): AppContextState => {
//   const context = useContext(AppContext);
//   if (context === undefined) {
//     throw new Error('useApp must be used within an AppProvider');
//   }
//   return context;
// };

// export default AppContext;
