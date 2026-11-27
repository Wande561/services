// Service category enum for consistent typing across the application
export enum ServiceCategoryEnum {
  Plumbing = 'Plumbing',
  HairStyling = 'HairStyling',
  HouseCleaning = 'HouseCleaning',
  Electrical = 'Electrical',
  Gardening = 'Gardening',
  PetGrooming = 'PetGrooming',
  Tutoring = 'Tutoring',
  Construction = 'Construction',
  PersonalTraining = 'PersonalTraining'
}

export type AccountRole = 'client' | 'provider';
export type ProfileRole = AccountRole | 'admin';
export type VerificationTier = 'Basic' | 'IdentityVerified' | 'BusinessVerified';

export interface AccountProfile {
  verificationTier: VerificationTier;
  role: ProfileRole;
  phone: string;
  location: string;
  businessName: string | null;
  serviceCategories: ServiceCategoryEnum[];
}

export interface Account {
  isVerificationAdmin: boolean;
  id: string;
  email: string;
  name: string | null;
  profile: AccountProfile | null;
}

type ContactDetails = Pick<AccountProfile, 'phone' | 'location'> & { name: string };

export type OnboardingInput = ContactDetails & (
  | { role: 'client' }
  | { role: 'provider'; businessName: string; serviceCategories: ServiceCategoryEnum[] }
);

export type PriceUnit = 'PerHour' | 'PerSession' | 'PerProject' | 'PerSquareMeter';

export interface ServiceListingInput {
  title: string;
  description?: string;
  category: ServiceCategoryEnum;
  location: string;
  priceCents: number;
  maxPriceCents: number | null;
  priceUnit: PriceUnit;
  keepPhotoIds?: string[];
  newPhotos?: string[];
}

export interface ServiceListing extends ServiceListingInput {
  id: string;
  providerId: string;
  photos: { id: string }[];
  verificationTier: VerificationTier;
  providerName: string;
  isPublished: boolean;
  reviewCount: number;
  averageRating?: number | null;
}

export interface AvailabilitySlot {
  id: string;
  startsAt: string;
  endsAt: string;
}

export type BookingStatus = 'Pending' | 'Confirmed' | 'Declined' | 'Cancelled' | 'Completed';

export interface Booking {
  id: string;
  createdAt: string;
  updatedAt: string;
  quoteRequestId?: string | null;
  quoteRequest?: { depositCents: number | null; depositConfirmedAt: string | null } | null;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  address: string;
  notes: string | null;
  providerName: string;
  providerVerificationTier: VerificationTier;
  clientName: string;
  clientVerificationTier: VerificationTier;
  status: BookingStatus;
  clientCompletedAt: string | null;
  providerCompletedAt: string | null;
  listingPrice: Pick<ServiceListingInput, 'priceCents' | 'maxPriceCents' | 'priceUnit'> | null;
  payments: BookingPayment[];
  review: Review | null;
  clientReview: Review | null;
}

export type PaymentMethod = 'Cash' | 'BankTransfer' | 'CardInPerson';

export interface BookingPayment {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  recordedAt: string;
  voidedAt: string | null;
}

export interface Review {
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewStats {
  averageRating: number | null;
  reviewCount: number;
}

export interface BookingMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  read: boolean;
}

export interface MessageThread {
  bookingId: string;
  serviceTitle: string;
  contactName: string;
}

export interface Conversation extends MessageThread {
  latest: BookingMessage;
  unread: number;
}

export interface AppNotification {
  id: string;
  bookingId: string;
  serviceTitle: string;
  kind: 'BookingRequested' | 'BookingStatusChanged' | 'MessageReceived' | 'ReviewReceived' | 'PaymentRecorded' | 'PaymentVoided' | 'ServiceCompletionConfirmation' | 'AppointmentReminder';
  bookingStatus: BookingStatus | null;
  createdAt: string;
  read: boolean;
}
