import Types "types";
import CoreTypes "../types/coreTypes";
import Text "mo:base/Text";
import Map "mo:base/HashMap";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Nat32 "mo:base/Nat32";

module {

    type Message = Types.Message;
    type MessageAttachment = Types.MessageAttachment;
    type Conversation = Types.Conversation;
    type ConversationSummary = Types.ConversationSummary;
    type ClientProfile = Types.ClientProfile;
    type ClientRegistration = Types.ClientRegistration;
    type ProviderProfile = Types.ProviderProfile;
    type ProviderRegistration = Types.ProviderRegistration;
    type Service = Types.Service;
    type Booking = Types.Booking;
    type Review = Types.Review;
    type Notification = Types.Notification;

    public type MessageId = Text;
    public type MessageAttachmentId = Text;
    public type ConversationId = Text;
    public type ConversationSummaryId = Text;
    public type ClientProfileId = Text;
    public type ClientRegistrationId = Text;
    public type ProviderProfileId = Text;
    public type ProviderRegistrationId = Text;
    public type ServiceId = Text;
    public type BookingId = Text;
    public type ReviewId = Text;
    public type NotificationId = Text;
    public type ConnectingRecordId = Nat;
    public type ConnectingRecord = CoreTypes.ConnectingRecord;

    public type Map<K, V> = Map.HashMap<K, V>;

    public type Messages = Map<MessageId, Message>;
    public type MessageAttachments = Map<MessageAttachmentId, MessageAttachment>;
    public type Conversations = Map<ConversationId, Conversation>;
    public type ConversationSummaries = Map<ConversationSummaryId, ConversationSummary>;
    public type ClientProfiles = Map<ClientProfileId, ClientProfile>;
    public type ClientRegistrations = Map<ClientRegistrationId, ClientRegistration>;
    public type ProviderProfiles = Map<ProviderProfileId, ProviderProfile>;
    public type ProviderRegistrations = Map<ProviderRegistrationId, ProviderRegistration>;
    public type Services = Map<ServiceId, Service>;
    public type Bookings = Map<BookingId, Booking>;
    public type Reviews = Map<ReviewId, Review>;
    public type Notifications = Map<NotificationId, Notification>;
    public type ConnectingRecords = Map<Nat, ConnectingRecord>;

    public type MessagesState = { messages : Messages };
    public func messages_new() : MessagesState = {
        messages = Map.HashMap<MessageId, Message>(0, Text.equal, Text.hash);
    };

    public type MessageAttachmentsState = { attachments : MessageAttachments };
    public func message_attachments_new() : MessageAttachmentsState = {
        attachments = Map.HashMap<MessageAttachmentId, MessageAttachment>(0, Text.equal, Text.hash);
    };

    public type ConversationsState = { conversations : Conversations };
    public func conversations_new() : ConversationsState = {
        conversations = Map.HashMap<ConversationId, Conversation>(0, Text.equal, Text.hash);
    };

    public type ConversationSummariesState = { summaries : ConversationSummaries };
    public func conversation_summaries_new() : ConversationSummariesState = {
        summaries = Map.HashMap<ConversationSummaryId, ConversationSummary>(0, Text.equal, Text.hash);
    };

    public type ClientProfilesState = { profiles : ClientProfiles };
    public func client_profiles_new() : ClientProfilesState = {
        profiles = Map.HashMap<ClientProfileId, ClientProfile>(0, Text.equal, Text.hash);
    };

    public type ClientRegistrationsState = { registrations : ClientRegistrations };
    public func client_registrations_new() : ClientRegistrationsState = {
        registrations = Map.HashMap<ClientRegistrationId, ClientRegistration>(0, Text.equal, Text.hash);
    };

    public type ProviderProfilesState = { profiles : ProviderProfiles };
    public func provider_profiles_new() : ProviderProfilesState = {
        profiles = Map.HashMap<ProviderProfileId, ProviderProfile>(0, Text.equal, Text.hash);
    };

    public type ProviderRegistrationsState = { registrations : ProviderRegistrations };
    public func provider_registrations_new() : ProviderRegistrationsState = {
        registrations = Map.HashMap<ProviderRegistrationId, ProviderRegistration>(0, Text.equal, Text.hash);
    };

    public type ServicesState = { services : Services };
    public func services_new() : ServicesState = {
        services = Map.HashMap<ServiceId, Service>(0, Text.equal, Text.hash);
    };

    public type BookingsState = { bookings : Bookings };
    public func bookings_new() : BookingsState = {
        bookings = Map.HashMap<BookingId, Booking>(0, Text.equal, Text.hash);
    };

    public type ReviewsState = { reviews : Reviews };
    public func reviews_new() : ReviewsState = {
        reviews = Map.HashMap<ReviewId, Review>(0, Text.equal, Text.hash);
    };

    public type NotificationsState = { notifications : Notifications };
    public func notifications_new() : NotificationsState = {
        notifications = Map.HashMap<NotificationId, Notification>(0, Text.equal, Text.hash);
    };

    public type ConnectingRecordsState = { connectingrecords : ConnectingRecords };
    public func connectingrecords_new() : ConnectingRecordsState = {
        connectingrecords = Map.HashMap<ConnectingRecordId, ConnectingRecord>(0, Nat.equal, func(n: Nat) : Hash.Hash { Nat32.fromNat(n % (2**32)) });
    };

};
