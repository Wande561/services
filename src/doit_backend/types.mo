import Time "mo:base/Time";
import Text "mo:base/Text";
import Bool "mo:base/Bool";
import Principal "mo:base/Principal";
import Int "mo:base/Int";
import Float "mo:base/Float";

module Types {

  // Messaging Types
  
  public type MessageType = {
    #Text;
    #Image;
    #File;
    #BookingUpdate;
    #PaymentNotification;
    #ServiceQuote;
    #SystemMessage;
  };

  public type MessageStatus = {
    #Sent;
    #Delivered;
    #Read;
    #Failed;
  };

  public type Message = {
    version : Int;
    id : Text;
    sender : Principal;
    receiver : Principal;
    conversationId : Text;
    messageType : MessageType;
    text : Text;
    attachments : ?[MessageAttachment];
    relatedBookingId : ?Text;
    timestamp : Time.Time;
    status : MessageStatus;
    editedAt : ?Time.Time;
    isEdited : Bool;
    replyToMessageId : ?Text;
  };

  public type MessageAttachment = {
    version : Int;
    id : Text;
    fileName : Text;
    fileUrl : Text;
    fileType : Text; 
    fileSize : Int;
    uploadedAt : Time.Time;
  };

  public type Conversation = {
    version : Int;
    id : Text;
    participants : [Principal];
    title : ?Text; 
    createdAt : Time.Time;
    lastMessageAt : Time.Time;
    lastMessage : ?Text;
    unreadCount : [(Principal, Int)]; 
    isArchived : Bool;
    relatedBookingId : ?Text; 
    conversationType : ConversationType;
  };

  public type ConversationType = {
    #Direct;
    #Group;
    #Support;
    #System;
  };

  public type MessageThread = {
    conversationId : Text;
    messages : [Message];
    totalMessages : Int;
    participants : [MessageParticipant];
  };

  public type MessageParticipant = {
    userId : Principal;
    userName : Text;
    userType : UserType;
    profileImage : ?Text;
    isOnline : Bool;
    lastSeenAt : Time.Time;
    joinedAt : Time.Time;
    role : ParticipantRole;
  };

  public type UserType = {
    #Client;
    #Provider;
    #Admin;
    #Support;
  };

  public type ParticipantRole = {
    #Member;
    #Admin;
    #Moderator;
  };

  public type MessageReaction = {
    messageId : Text;
    userId : Principal;
    reaction : ReactionType;
    timestamp : Time.Time;
  };

  public type ReactionType = {
    #Like;
    #Dislike;
    #Heart;
    #Thumbsup;
    #Thumbsdown;
    #Laugh;
    #Sad;
    #Angry;
  };

  public type TypingIndicator = {
    conversationId : Text;
    userId : Principal;
    isTyping : Bool;
    timestamp : Time.Time;
  };

  public type MessageDeliveryReceipt = {
    messageId : Text;
    recipientId : Principal;
    status : MessageStatus;
    timestamp : Time.Time;
  };

  public type ConversationSettings = {
    conversationId : Text;
    userId : Principal;
    isMuted : Bool;
    mutedUntil : ?Time.Time;
    isArchived : Bool;
    customTitle : ?Text;
    notificationSettings : NotificationSettings;
  };

  public type NotificationSettings = {
    enablePushNotifications : Bool;
    enableEmailNotifications : Bool;
    enableSoundNotifications : Bool;
    quietHoursStart : ?Text;
    quietHoursEnd : ?Text;
  };

  public type MessageSearchQuery = {
    searchText : Text;
    conversationId : ?Text;
    senderId : ?Principal;
    messageType : ?MessageType;
    dateFrom : ?Time.Time;
    dateTo : ?Time.Time;
    hasAttachments : ?Bool;
  };

  public type MessageSearchResult = {
    message : Message;
    conversationTitle : Text;
    matchScore : Float; 
    highlightedText : Text; 
  };

  public type ConversationSummary = {
    version : Int;
    id : Text;
    title : Text;
    lastMessage : Text;
    lastMessageAt : Time.Time;
    unreadCount : Int;
    otherParticipant : MessageParticipant; 
    isOnline : Bool;
    conversationType : ConversationType;
  };

  public type MessageDraft = {
    conversationId : Text;
    userId : Principal;
    draftText : Text;
    savedAt : Time.Time;
    replyToMessageId : ?Text;
  };

  public type BlockedUser = {
    blockerId : Principal;
    blockedUserId : Principal;
    reason : ?Text;
    blockedAt : Time.Time;
    isActive : Bool;
  };

  public type ReportedMessage = {
    messageId : Text;
    reporterId : Principal;
    reason : ReportReason;
    description : ?Text;
    reportedAt : Time.Time;
    status : ReportStatus;
    reviewedBy : ?Principal;
    reviewedAt : ?Time.Time;
  };

  public type ReportReason = {
    #Spam;
    #Harassment;
    #InappropriateContent;
    #Fraud;
    #Violence;
    #Other;
  };

  public type ReportStatus = {
    #Pending;
    #UnderReview;
    #Resolved;
    #Dismissed;
  };
  
  public type ClientProfile = {
    version : Int;
    id : Principal;
    name : Text;
    email : Text;
    phone : Text;
    location : Text;
    profileImage : ?Text;
    createdAt : Time.Time;
    isVerified : Bool;
    rating : Float;
    totalBookings : Int;
  };

  public type ClientRegistration = {
    version : Int;
    name : Text;
    email : Text;
    password : Text;
    phone : Text;
    location : Text;
    agreeToTerms : Bool;
  };

  // Provider Types

  public type ProviderProfile = {
    version : Int;
    id : Principal;
    name : Text;
    email : Text;
    phone : Text;
    idNumber : Text;
    businessName : Text;
    businessType : Text;
    location : Text;
    serviceCategories : [ServiceCategory];
    businessLicense : ?Text;
    insuranceDetails : ?Text;
    portfolio : [Text]; 
    profileImage : ?Text;
    description : Text;
    experience : Int;
    createdAt : Time.Time;
    isVerified : Bool;
    backgroundCheckStatus : BackgroundCheckStatus;
    rating : Float;
    totalJobs : Int;
    availability : [AvailabilitySlot];
    pricing : [ServicePricing];
  };

  public type ProviderRegistration = {
    version : Int;
    name : Text;
    email : Text;
    password : Text;
    phone : Text;
    idNumber : Text;
    businessName : Text;
    businessType : Text;
    location : Text;
    serviceCategories : [ServiceCategory];
    businessLicense : ?Text;
    insuranceDetails : ?Text;
    description : Text;
    experience : Int;
    consentBackgroundCheck : Bool;
    agreeToTerms : Bool;
  };

  // Service Types

  public type ServiceCategory = {
    #Plumbing;
    #HairStyling;
    #HouseCleaning;
    #Electrical;
    #Gardening;
    #PetGrooming;
    #Tutoring;
    #Construction;
    #PersonalTraining;
  };

  public type ServicePricing = {
    category : ServiceCategory;
    minPrice : Float;
    maxPrice : Float;
    unit : PriceUnit;
  };

  public type PriceUnit = {
    #PerHour;
    #PerSession;
    #PerProject;
    #PerSquareMeter;
  };

  public type Service = {
    version : Int;
    id : Text;
    providerId : Principal;
    title : Text;
    description : Text;
    category : ServiceCategory;
    pricing : ServicePricing;
    location : Text;
    images : [Text];
    availability : [AvailabilitySlot];
    requirements : [Text];
    duration : Int; 
    isActive : Bool;
    createdAt : Time.Time;
    rating : Float;
    reviewCount : Int;
  };

  // Booking Types

  public type BookingStatus = {
    #Pending;
    #Confirmed;
    #InProgress;
    #Completed;
    #Cancelled;
    #Disputed;
  };

  public type PaymentMethod = {
    #Card;
    #Cash;
    #BankTransfer;
  };

  public type PaymentStatus = {
    #Pending;
    #Paid;
    #Failed;
    #Refunded;
  };

  public type Booking = {
    version : Int;
    id : Text;
    clientId : Principal;
    providerId : Principal;
    serviceId : Text;
    date : Text; 
    time : Text;
    duration : Int; 
    location : Text;
    notes : ?Text;
    status : BookingStatus;
    paymentMethod : PaymentMethod;
    paymentStatus : PaymentStatus;
    totalAmount : Float;
    createdAt : Time.Time;
    updatedAt : Time.Time;
  };

  // Availability Types

  public type DayOfWeek = {
    #Monday;
    #Tuesday;
    #Wednesday;
    #Thursday;
    #Friday;
    #Saturday;
    #Sunday;
  };

  public type AvailabilitySlot = {
    day : DayOfWeek;
    startTime : Text; 
    endTime : Text;   
    isAvailable : Bool;
  };

  public type Review = {
    version : Int;
    id : Text;
    bookingId : Text;
    reviewerId : Principal; 
    providerId : Principal;
    rating : Float;
    comment : ?Text;
    createdAt : Time.Time;
    isVerified : Bool;
  };

  public type BackgroundCheckStatus = {
    #Pending;
    #InProgress;
    #Approved;
    #Rejected;
    #Expired;
  };

  public type BackgroundCheck = {
    providerId : Principal;
    status : BackgroundCheckStatus;
    submittedAt : Time.Time;
    completedAt : ?Time.Time;
    expiresAt : ?Time.Time;
    documents : [Text]; 
    notes : ?Text;
  };

  public type NotificationType = {
    #BookingRequest;
    #BookingConfirmed;
    #BookingCancelled;
    #PaymentReceived;
    #ReviewReceived;
    #MessageReceived;
    #SystemUpdate;
  };

  public type Notification = {
    version : Int;
    id : Text;
    userId : Principal;
    type_ : NotificationType;
    title : Text;
    message : Text;
    isRead : Bool;
    createdAt : Time.Time;
    relatedId : ?Text; 
  };

  public type Province = {
    #Gauteng;
    #WesternCape;
    #KwaZuluNatal;
    #EasternCape;
    #Limpopo;
    #Mpumalanga;
    #NorthWest;
    #FreeState;
    #NorthernCape;
  };

  public type LocationInfo = {
    address : Text;
    city : Text;
    province : Province;
    postalCode : Text;
    coordinates : ?(Float, Float); 
  };

  public type UserInfo = {
    id : Principal;
    userType : UserType;
    name : Text;
    email : Text;
    phone : Text;
    location : Text;
    profileImage : ?Text;
    createdAt : Time.Time;
    isVerified : Bool;
    rating : Float;
    totalBookings : ?Int;
    businessName : ?Text;
    businessType : ?Text;
    serviceCategories : ?[ServiceCategory];
    totalJobs : ?Int;
    experience : ?Int;
  };

};