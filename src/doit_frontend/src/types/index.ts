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
  PersonalTraining = 'PersonalTraining',
  Other = 'Other'
}

export type AccountRole = 'client' | 'provider';
export type ProfileRole = AccountRole | 'admin';
export type VerificationTier = 'Basic' | 'IdentityVerified' | 'BusinessVerified';

export interface AccountProfile {
  verificationTier: VerificationTier;
  role: ProfileRole;
  clientEnabled: boolean;
  providerEnabled: boolean;
  phone: string;
  location: string;
  businessName: string | null;
  serviceCategories: ServiceCategoryEnum[];
  otherService: string | null;
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
  | { role: 'provider'; businessName: string; serviceCategories: ServiceCategoryEnum[]; otherService?: string }
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
  workspaceId?: string | null;
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
  clientId: string;
  providerId: string;
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
  kind: 'message' | 'quote-created' | 'booking-created' | 'booking-completed';
}

export interface MessageThread {
  bookingId: string;
  contactId: string;
  activeBookingId: string | null;
  quoteRequestId: string | null;
  closed: boolean;
  serviceTitle: string;
  contactName: string;
}

export interface Conversation extends MessageThread {
  latest: BookingMessage;
  unread: number;
}

export interface AppNotification {
  id: string;
  bookingId: string | null;
  quoteRequestId: string | null;
  serviceTitle: string;
  kind: 'BookingRequested' | 'BookingStatusChanged' | 'MessageReceived' | 'ReviewReceived' | 'PaymentRecorded' | 'PaymentVoided' | 'ServiceCompletionConfirmation' | 'AppointmentReminder';
  bookingStatus: BookingStatus | null;
  createdAt: string;
  read: boolean;
}

export type WorkspaceRole = 'Owner' | 'Manager' | 'Staff' | 'Receptionist' | 'Finance';
export type WorkspaceMemberStatus = 'Invited' | 'Active' | 'Inactive';

export interface WorkspaceMembership {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  createdAt: string;
  memberCount: number;
  role: WorkspaceRole;
  isOwner: boolean;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  permissions: Record<string, boolean> | null;
  workingHours: unknown;
  inviteExpiresAt: string | null;
  invitedAt: string;
  joinedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  serviceIds: string[];
  effectivePermissions: string[];
}

export interface WorkspaceAssignment {
  id: string;
  memberId: string;
  assignedAt: string;
  member: { id: string; name: string | null; email: string; role: WorkspaceRole };
}

export interface WorkspaceBooking {
  id: string;
  serviceTitle: string;
  status: BookingStatus;
  address: string;
  notes: string | null;
  priceCents: number | null;
  createdAt: string;
  updatedAt: string;
  slot: { startsAt: string; endsAt: string };
  client: { phone: string; user: { name: string | null } };
  listing: { id: string; title: string };
  workspaceAssignments: WorkspaceAssignment[];
}

export interface WorkspaceSummary {
  workspace: { id: string; name: string; description: string | null; location: string | null; createdAt: string; ownerId: string };
  access: { role: WorkspaceRole; permissions: string[] };
  metrics: { todayBookings: number; pendingRequests: number; upcomingBookings: number; activeMembers: number; completedThisMonth: number };
  upcoming: WorkspaceBooking[];
  team: WorkspaceMember[];
  activity: { id: string; kind: string; message: string; createdAt: string; actor: { name: string | null } | null }[];
  listings: { id: string; title: string; isPublished: boolean }[];
}
