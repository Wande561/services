import Types "./types";
import Client "./client";
import Provider "./provider";
import Services "./services";
import Messages "./messages";
import Notifications "./notifications";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Nat "mo:base/Nat";

persistent actor DoItMain {

  // ============================================================================
  // COUNTERS
  // ============================================================================

  let kotomo_canister = actor("ufxgi-4p777-77774-qaadq-cai") : actor {
    icrc1_transfer : ({
      from_subaccount: ?[Nat8];
      to: { owner: Principal; subaccount: ?[Nat8] };
      amount: Nat;
      fee: ?Nat;
      memo: ?[Nat8];
      created_at_time: ?Nat64;
    }) -> async { #Ok: Nat; #Err: { 
      #BadFee: { expected_fee: Nat };
      #BadBurn: { min_burn_amount: Nat };
      #InsufficientFunds: { balance: Nat };
      #TooOld;
      #CreatedInFuture: { ledger_time: Nat64 };
      #Duplicate: { duplicate_of: Nat };
      #TemporarilyUnavailable;
      #GenericError: { error_code: Nat; message: Text };
    } };
    icrc1_balance_of : ({ owner: Principal; subaccount: ?[Nat8] }) -> async Nat;
  };

  let signUpReward : Nat = 1_000_000_000;
  let messageReward : Nat = 500_000_000;
  let messageThreshold : Nat = 10;

  private transient var messageCounts = HashMap.HashMap<Principal, Nat>(10, Principal.equal, Principal.hash);
  private var messageCountEntries : [(Principal, Nat)] = [];

  private func transferReward(recipient: Principal, amount: Nat) : async Bool {
    Debug.print("💰 Starting reward transfer to: " # Principal.toText(recipient) # " amount: " # Nat.toText(amount));

    Debug.print("Skipping balance check - will rely on transfer result");
    
    let transferArgs = {
      from_subaccount = null;
      to = { owner = recipient; subaccount = null };
      amount = amount;
      fee = null;
      memo = null;
      created_at_time = null;
    };
    
    Debug.print("� Transfer args: to_owner=" # Principal.toText(recipient) # ", amount=" # Nat.toText(amount));

    try {
      let result = await kotomo_canister.icrc1_transfer(transferArgs);
      
      switch (result) {
        case (#Ok(blockIndex)) { 
          Debug.print("✅ Transfer successful! Block index: " # Nat.toText(blockIndex));

          Debug.print("Transfer completed - skipping balance verification");
          
          true 
        };
        case (#Err(error)) { 
          Debug.print("❌ Transfer failed with error: " # debug_show(error));
          false 
        };
      };
    } catch (e) {
      Debug.print("� Transfer threw exception: " # Error.message(e));
      false;
    };
  };

  private func rewardSignUp(user: Principal) : async () {
    let userText = Principal.toText(user);
    Debug.print("🎁 Attempting sign-up reward for user: " # userText);
    Debug.print("🪙 Reward amount: " # Nat.toText(signUpReward));
    
    let success = await transferReward(user, signUpReward);
    if (success) {
      Debug.print("✅ Sign-up reward sent successfully!");
    } else {
      Debug.print("❌ Sign-up reward failed for user " # userText);
    };
  };

  private func checkAndRewardMessages(user: Principal) : async () {
    let userText = Principal.toText(user);
    let currentCount = messageCounts.get(user);
    switch (currentCount) {
      case null { 
        Debug.print("📝 First message from user: " # userText);
        messageCounts.put(user, 1) 
      };
      case (?count) {
        let newCount = count + 1;
        messageCounts.put(user, newCount);
        Debug.print("📊 Message count for " # userText # ": " # Nat.toText(newCount));

        if (newCount % messageThreshold == 0) {
          Debug.print("🎉 Message milestone reached! Rewarding user: " # userText);
          let success = await transferReward(user, messageReward);
          if (success) {
            Debug.print("✅ Message reward sent successfully!");
          } else {
            Debug.print("❌ Message reward failed for user " # userText);
          };
        };
      };
    };
  };

  // ============================================================================
  // SYSTEM INFORMATION
  // ============================================================================

  private transient let systemVersion : Text = "1.0.0";
  private transient let deployedAt : Int = Time.now();

  // ============================================================================
  // STATE MANAGEMENT USING STATE_MANAGER
  // ============================================================================

  private var clientProfilesEntries : [(Principal, Types.ClientProfile)] = [];
  private var clientBookingsEntries : [(Text, Types.Booking)] = [];
  private var clientNotificationsEntries : [(Text, [Types.Notification])] = [];
  
  private transient var clientProfiles = HashMap.HashMap<Principal, Types.ClientProfile>(10, Principal.equal, Principal.hash);
  private transient var clientBookings = HashMap.HashMap<Text, Types.Booking>(10, Text.equal, Text.hash);
  private transient var clientNotifications = HashMap.HashMap<Text, [Types.Notification]>(10, Text.equal, Text.hash);

  private var providerProfilesEntries : [(Principal, Types.ProviderProfile)] = [];
  private var providerBookingsEntries : [(Text, Types.Booking)] = [];
  private var providerNotificationsEntries : [(Text, [Types.Notification])] = [];
  private var providerReviewsEntries : [(Text, [Types.Review])] = [];
  private var backgroundChecksEntries : [(Principal, Types.BackgroundCheck)] = [];

  private transient var providerProfiles = HashMap.HashMap<Principal, Types.ProviderProfile>(10, Principal.equal, Principal.hash);
  private transient var providerBookings = HashMap.HashMap<Text, Types.Booking>(10, Text.equal, Text.hash);
  private transient var providerNotifications = HashMap.HashMap<Text, [Types.Notification]>(10, Text.equal, Text.hash);
  private transient var providerReviews = HashMap.HashMap<Text, [Types.Review]>(10, Text.equal, Text.hash);
  private transient var backgroundChecks = HashMap.HashMap<Principal, Types.BackgroundCheck>(10, Principal.equal, Principal.hash);

  private var servicesEntries : [(Text, Types.Service)] = [];
  private transient var services = HashMap.HashMap<Text, Types.Service>(10, Text.equal, Text.hash);

  private var conversationsEntries : [(Text, Types.Conversation)] = [];
  private var messagesEntries : [(Text, Types.Message)] = [];
  private var messageThreadsEntries : [(Text, Types.MessageThread)] = [];
  private var messageDraftsEntries : [(Text, Types.MessageDraft)] = [];
  private var blockedUsersEntries : [(Principal, [Types.BlockedUser])] = [];

  private transient var conversations = HashMap.HashMap<Text, Types.Conversation>(10, Text.equal, Text.hash);
  private transient var messages = HashMap.HashMap<Text, Types.Message>(10, Text.equal, Text.hash);
  private transient var messageThreads = HashMap.HashMap<Text, Types.MessageThread>(10, Text.equal, Text.hash);
  private transient var messageDrafts = HashMap.HashMap<Text, Types.MessageDraft>(10, Text.equal, Text.hash);
  private transient var blockedUsers = HashMap.HashMap<Principal, [Types.BlockedUser]>(10, Principal.equal, Principal.hash);

  // ============================================================================
  // COUNTERS
  // ============================================================================

  private var nextBookingId : Nat = 1;
  private var nextProviderId : Nat = 1;
  private var nextConversationId : Nat = 1;
  private var nextMessageId : Nat = 1;

  // ============================================================================
  // SERVICE MANAGER INITIALIZATION
  // ============================================================================
  
  private transient var serviceManager = Services.ServiceManager();

  // ============================================================================
  // SYSTEM UPGRADE HANDLERS
  // ============================================================================

  system func preupgrade() {
    clientProfilesEntries := Iter.toArray(clientProfiles.entries());
    clientBookingsEntries := Iter.toArray(clientBookings.entries());
    clientNotificationsEntries := Iter.toArray(clientNotifications.entries());
    
    providerProfilesEntries := Iter.toArray(providerProfiles.entries());
    providerBookingsEntries := Iter.toArray(providerBookings.entries());
    providerNotificationsEntries := Iter.toArray(providerNotifications.entries());
    providerReviewsEntries := Iter.toArray(providerReviews.entries());
    backgroundChecksEntries := Iter.toArray(backgroundChecks.entries());
    
    servicesEntries := Iter.toArray(services.entries());
    
    conversationsEntries := Iter.toArray(conversations.entries());
    messagesEntries := Iter.toArray(messages.entries());
    messageThreadsEntries := Iter.toArray(messageThreads.entries());
    messageDraftsEntries := Iter.toArray(messageDrafts.entries());
    blockedUsersEntries := Iter.toArray(blockedUsers.entries());
    messageCountEntries := Iter.toArray(messageCounts.entries());
  };

  system func postupgrade() {
    clientProfiles := HashMap.fromIter<Principal, Types.ClientProfile>(
      clientProfilesEntries.vals(), clientProfilesEntries.size(), Principal.equal, Principal.hash
    );
    clientBookings := HashMap.fromIter<Text, Types.Booking>(
      clientBookingsEntries.vals(), clientBookingsEntries.size(), Text.equal, Text.hash
    );
    clientNotifications := HashMap.fromIter<Text, [Types.Notification]>(
      clientNotificationsEntries.vals(), clientNotificationsEntries.size(), Text.equal, Text.hash
    );
    
    providerProfiles := HashMap.fromIter<Principal, Types.ProviderProfile>(
      providerProfilesEntries.vals(), providerProfilesEntries.size(), Principal.equal, Principal.hash
    );
    providerBookings := HashMap.fromIter<Text, Types.Booking>(
      providerBookingsEntries.vals(), providerBookingsEntries.size(), Text.equal, Text.hash
    );
    providerNotifications := HashMap.fromIter<Text, [Types.Notification]>(
      providerNotificationsEntries.vals(), providerNotificationsEntries.size(), Text.equal, Text.hash
    );
    providerReviews := HashMap.fromIter<Text, [Types.Review]>(
      providerReviewsEntries.vals(), providerReviewsEntries.size(), Text.equal, Text.hash
    );
    backgroundChecks := HashMap.fromIter<Principal, Types.BackgroundCheck>(
      backgroundChecksEntries.vals(), backgroundChecksEntries.size(), Principal.equal, Principal.hash
    );
    
    services := HashMap.fromIter<Text, Types.Service>(
      servicesEntries.vals(), servicesEntries.size(), Text.equal, Text.hash
    );
    
    conversations := HashMap.fromIter<Text, Types.Conversation>(
      conversationsEntries.vals(), conversationsEntries.size(), Text.equal, Text.hash
    );
    messages := HashMap.fromIter<Text, Types.Message>(
      messagesEntries.vals(), messagesEntries.size(), Text.equal, Text.hash
    );
    messageThreads := HashMap.fromIter<Text, Types.MessageThread>(
      messageThreadsEntries.vals(), messageThreadsEntries.size(), Text.equal, Text.hash
    );
    messageDrafts := HashMap.fromIter<Text, Types.MessageDraft>(
      messageDraftsEntries.vals(), messageDraftsEntries.size(), Text.equal, Text.hash
    );
    blockedUsers := HashMap.fromIter<Principal, [Types.BlockedUser]>(
      blockedUsersEntries.vals(), blockedUsersEntries.size(), Principal.equal, Principal.hash
    );
    messageCounts := HashMap.fromIter<Principal, Nat>(
      messageCountEntries.vals(), messageCountEntries.size(), Principal.equal, Principal.hash
    );
    
    clientProfilesEntries := [];
    clientBookingsEntries := [];
    clientNotificationsEntries := [];
    providerProfilesEntries := [];
    providerBookingsEntries := [];
    providerNotificationsEntries := [];
    providerReviewsEntries := [];
    backgroundChecksEntries := [];
    servicesEntries := [];
    conversationsEntries := [];
    messagesEntries := [];
    messageThreadsEntries := [];
    messageDraftsEntries := [];
    blockedUsersEntries := [];
    messageCountEntries := [];
  };  // ============================================================================
  // SYSTEM INFORMATION FUNCTIONS
  // ============================================================================

  public query func getSystemInfo() : async {
    version: Text;
    deployedAt: Int;
    currentTime: Int;
    status: Text;
  } {
    {
      version = systemVersion;
      deployedAt = deployedAt;
      currentTime = Time.now();
      status = "DoIt Services Platform - Your trusted South African services marketplace";
    }
  };

  public query func greet(name : Text) : async Text {
    return "Welcome to DoIt Services, " # name # "! Your trusted South African services marketplace.";
  };

  public query func healthCheck() : async {
    status: Text;
    timestamp: Int;
    version: Text;
  } {
    {
      status = "healthy";
      timestamp = Time.now();
      version = systemVersion;
    }
  };

  // ============================================================================
  // CLIENT MANAGEMENT FUNCTIONS
  // ============================================================================

  public func registerClient(registration: Types.ClientRegistration) : async Result.Result<Types.ClientProfile, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let result = Client.registerClient(
      callerId,
      registration,
      clientProfiles,
      clientNotifications
    );
    
    // Reward user for signing up
    switch (result) {
      case (#ok(profile)) {
        ignore rewardSignUp(callerId);
        #ok(profile)
      };
      case (#err(error)) { #err(error) };
    }
  };

  public query func getClientProfile() : async Result.Result<Types.ClientProfile, Text> {
    let callerId = Principal.fromActor(DoItMain);
    Client.getClientProfile(callerId, clientProfiles)
  };

  public func updateClientProfile(
    name: ?Text,
    phone: ?Text,
    location: ?Text,
    profileImage: ?Text
  ) : async Result.Result<Types.ClientProfile, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Client.updateClientProfile(
      callerId,
      name,
      phone,
      location,
      profileImage,
      clientProfiles
    )
  };

  public func createBooking(
    serviceId: Text,
    providerId: Principal,
    date: Text,
    time: Text,
    duration: Int,
    location: Text,
    notes: ?Text,
    paymentMethod: Types.PaymentMethod
  ) : async Result.Result<Types.Booking, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let result = Client.createBooking(
      callerId,
      providerId,
      serviceId,
      date,
      time,
      duration,
      location,
      notes,
      paymentMethod,
      nextBookingId,
      clientProfiles,
      clientBookings,
      clientNotifications
    );
    
    switch (result) {
      case (#ok(booking, newNextBookingId)) {
        nextBookingId := newNextBookingId;
        #ok(booking)
      };
      case (#err(error)) { #err(error) };
    }
  };

  public query func getClientBookings() : async Result.Result<[Types.Booking], Text> {
    let callerId = Principal.fromActor(DoItMain);
    Client.getClientBookings(callerId, clientProfiles, clientBookings)
  };

  public query func getNotifications() : async Result.Result<[Types.Notification], Text> {
    let callerId = Principal.fromActor(DoItMain);
    Notifications.getNotifications(callerId, clientNotifications)
  };

  // ============================================================================
  // PROVIDER MANAGEMENT FUNCTIONS
  // ============================================================================

  public func registerProvider(registration: Types.ProviderRegistration) : async Result.Result<Types.ProviderProfile, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let result = Provider.registerProvider(
      callerId,
      registration,
      providerProfiles,
      backgroundChecks,
      providerNotifications,
      nextProviderId
    );
    
    switch (result) {
      case (#ok(profile, newNextProviderId)) {
        nextProviderId := newNextProviderId;
        // Reward user for signing up
        ignore rewardSignUp(callerId);
        #ok(profile)
      };
      case (#err(error)) { #err(error) };
    }
  };

  public query func getProviderProfile() : async Result.Result<Types.ProviderProfile, Text> {
    let callerId = Principal.fromActor(DoItMain);
    Provider.getProviderProfile(callerId, providerProfiles)
  };

  public func updateProviderProfile(
    businessName: ?Text,
    businessType: ?Text,
    phone: ?Text,
    location: ?Text,
    description: ?Text,
    profileImage: ?Text,
    portfolio: ?[Text]
  ) : async Result.Result<Types.ProviderProfile, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Provider.updateProviderProfile(
      callerId,
      businessName,
      businessType,
      phone,
      location,
      description,
      profileImage,
      portfolio,
      providerProfiles
    )
  };

  public query func getProviderBookings() : async Result.Result<[Types.Booking], Text> {
    let callerId = Principal.fromActor(DoItMain);
    Provider.getProviderBookings(callerId, providerBookings)
  };

  public func acceptProviderBooking(
    bookingId: Text,
    estimatedCost: Float
  ) : async Result.Result<Types.Booking, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Provider.acceptBooking(
      callerId,
      bookingId,
      estimatedCost,
      providerBookings,
      providerProfiles,
      providerNotifications
    )
  };

  public func rejectProviderBooking(
    bookingId: Text,
    reason: ?Text
  ) : async Result.Result<Types.Booking, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Provider.rejectBooking(
      callerId,
      bookingId,
      reason,
      providerBookings
    )
  };

  public func completeProviderBooking(
    bookingId: Text
  ) : async Result.Result<Types.Booking, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Provider.completeBooking(
      callerId,
      bookingId,
      providerBookings,
      providerNotifications
    )
  };

  public func updateProviderAvailability(
    availability: [Types.AvailabilitySlot]
  ) : async Result.Result<Types.ProviderProfile, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Provider.updateAvailability(
      callerId,
      availability,
      providerProfiles
    )
  };

  public query func getProviderReviews() : async Result.Result<[Types.Review], Text> {
    let callerId = Principal.fromActor(DoItMain);
    Provider.getProviderReviews(callerId, providerReviews)
  };

  public query func getProviderNotifications() : async Result.Result<[Types.Notification], Text> {
    let callerId = Principal.fromActor(DoItMain);
    Provider.getNotifications(callerId, providerNotifications)
  };

  public func markProviderNotificationAsRead(
    notificationId: Text
  ) : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Provider.markNotificationAsRead(
      callerId,
      notificationId,
      providerNotifications
    )
  };

  public query func getProviderAnalytics() : async Result.Result<{
    totalBookings: Nat;
    completedJobs: Nat;
    averageRating: Float;
    totalEarnings: Float;
    reviewCount: Nat;
  }, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    Provider.getProviderAnalytics(
      callerId,
      providerProfiles,
      providerBookings,
      providerReviews
    )
  };

  public query func searchProviders(
    location: ?Text,
    serviceCategory: ?Types.ServiceCategory,
    minRating: ?Float,
    verifiedOnly: Bool,
    businessType: ?Text,
    maxDistance: ?Int
  ) : async Result.Result<[Types.ProviderProfile], Text> {
    
    Provider.searchProviders(
      location,
      serviceCategory,
      minRating,
      verifiedOnly,
      businessType,
      maxDistance,
      providerProfiles
    )
  };

  // ============================================================================
  // COMPREHENSIVE NOTIFICATIONS MANAGEMENT FUNCTIONS
  // ============================================================================

  public query func getAllNotifications() : async Result.Result<[Types.Notification], Text> {
    let callerId = Principal.fromActor(DoItMain);
    let clientResult = Notifications.getNotifications(callerId, clientNotifications);
    let providerResult = Notifications.getNotifications(callerId, providerNotifications);
    
    switch (clientResult, providerResult) {
      case (#ok(clientNotes), #ok(providerNotes)) {
        let allNotifications = Array.append(clientNotes, providerNotes);
        let sortedNotifications = Array.sort<Types.Notification>(
          allNotifications,
          func (a, b) = Int.compare(b.createdAt, a.createdAt)
        );
        #ok(sortedNotifications)
      };
      case (#err(e), _) { #err(e) };
      case (_, #err(e)) { #err(e) };
    }
  };

  public query func getUnreadNotifications() : async Result.Result<[Types.Notification], Text> {
    let callerId = Principal.fromActor(DoItMain);
    let clientResult = Notifications.getUnreadNotifications(callerId, clientNotifications);
    let providerResult = Notifications.getUnreadNotifications(callerId, providerNotifications);
    
    switch (clientResult, providerResult) {
      case (#ok(clientNotes), #ok(providerNotes)) {
        let allNotifications = Array.append(clientNotes, providerNotes);
        let sortedNotifications = Array.sort<Types.Notification>(
          allNotifications,
          func (a, b) = Int.compare(b.createdAt, a.createdAt)
        );
        #ok(sortedNotifications)
      };
      case (#err(e), _) { #err(e) };
      case (_, #err(e)) { #err(e) };
    }
  };

  public func markNotificationAsRead(notificationId: Text) : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);

    let clientResult = Notifications.markNotificationAsRead(callerId, notificationId, clientNotifications);
    switch (clientResult) {
      case (#ok(true)) { #ok(true) };
      case _ {
        Notifications.markNotificationAsRead(callerId, notificationId, providerNotifications)
      };
    }
  };

  public func markAllNotificationsAsRead() : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let clientResult = Notifications.markAllNotificationsAsRead(callerId, clientNotifications);
    let providerResult = Notifications.markAllNotificationsAsRead(callerId, providerNotifications);
    
    switch (clientResult, providerResult) {
      case (#ok(_), #ok(_)) { #ok(true) };
      case (#err(e), _) { #err(e) };
      case (_, #err(e)) { #err(e) };
    }
  };

  public func deleteNotification(notificationId: Text) : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let clientResult = Notifications.deleteNotification(callerId, notificationId, clientNotifications);
    switch (clientResult) {
      case (#ok(true)) { #ok(true) };
      case _ {
        Notifications.deleteNotification(callerId, notificationId, providerNotifications)
      };
    }
  };

  public func deleteAllNotifications() : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let clientResult = Notifications.deleteAllNotifications(callerId, clientNotifications);
    let providerResult = Notifications.deleteAllNotifications(callerId, providerNotifications);
    
    switch (clientResult, providerResult) {
      case (#ok(_), #ok(_)) { #ok(true) };
      case (#err(e), _) { #err(e) };
      case (_, #err(e)) { #err(e) };
    }
  };

  public query func getNotificationById(notificationId: Text) : async Result.Result<?Types.Notification, Text> {
    let callerId = Principal.fromActor(DoItMain);

    let clientResult = Notifications.getNotificationById(callerId, notificationId, clientNotifications);
    switch (clientResult) {
      case (#ok(?notification)) { #ok(?notification) };
      case (#ok(null)) {
        Notifications.getNotificationById(callerId, notificationId, providerNotifications)
      };
      case (#err(e)) { #err(e) };
    }
  };

  public query func getNotificationStats() : async Result.Result<{
    totalNotifications: Nat;
    unreadNotifications: Nat;
    readNotifications: Nat;
  }, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let clientResult = Notifications.getNotificationStats(callerId, clientNotifications);
    let providerResult = Notifications.getNotificationStats(callerId, providerNotifications);
    
    switch (clientResult, providerResult) {
      case (#ok(clientStats), #ok(providerStats)) {
        #ok({
          totalNotifications = clientStats.totalNotifications + providerStats.totalNotifications;
          unreadNotifications = clientStats.unreadNotifications + providerStats.unreadNotifications;
          readNotifications = clientStats.readNotifications + providerStats.readNotifications;
        })
      };
      case (#err(e), _) { #err(e) };
      case (_, #err(e)) { #err(e) };
    }
  };

  // Get notifications by type
  public query func getNotificationsByType(notificationType: Types.NotificationType) : async Result.Result<[Types.Notification], Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let clientResult = Notifications.getNotificationsByType(callerId, notificationType, clientNotifications);
    let providerResult = Notifications.getNotificationsByType(callerId, notificationType, providerNotifications);
    
    switch (clientResult, providerResult) {
      case (#ok(clientNotes), #ok(providerNotes)) {
        let allNotifications = Array.append(clientNotes, providerNotes);
        let sortedNotifications = Array.sort<Types.Notification>(
          allNotifications,
          func (a, b) = Int.compare(b.createdAt, a.createdAt)
        );
        #ok(sortedNotifications)
      };
      case (#err(e), _) { #err(e) };
      case (_, #err(e)) { #err(e) };
    }
  };

  // Create and send a system notification to a user
  public func createSystemNotification(
    userId: Principal,
    title: Text,
    message: Text
  ) : async Result.Result<Bool, Text> {
    let notification = Notifications.createSystemUpdateNotification(userId, title, message);
    
    // Add to both client and provider notifications (they'll be filtered appropriately)
    Notifications.addNotification(notification, clientNotifications);
    Notifications.addNotification(notification, providerNotifications);
    
    #ok(true)
  };

  // ============================================================================
  // SERVICES MANAGEMENT FUNCTIONS
  // ============================================================================

  public func createService(
    title: Text,
    description: Text,
    category: Types.ServiceCategory,
    pricing: Types.ServicePricing,
    location: Text,
    images: [Text],
    availability: [Types.AvailabilitySlot],
    requirements: [Text],
    duration: Int
  ) : async Result.Result<Types.Service, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    await serviceManager.createService(
      callerId,
      title,
      description,
      category,
      pricing,
      location,
      images,
      availability,
      requirements,
      duration
    )
  };

  public func updateService(
    serviceId: Text,
    updates: {
      title: ?Text;
      description: ?Text;
      pricing: ?Types.ServicePricing;
      location: ?Text;
      images: ?[Text];
      availability: ?[Types.AvailabilitySlot];
      requirements: ?[Text];
      duration: ?Int;
      isActive: ?Bool;
    }
  ) : async Result.Result<Types.Service, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    await serviceManager.updateService(serviceId, callerId, updates)
  };

  public func deleteService(serviceId: Text) : async Result.Result<Text, Text> {
    let callerId = Principal.fromActor(DoItMain);
    await serviceManager.deleteService(serviceId, callerId)
  };

  public query func getService(serviceId: Text) : async ?Types.Service {
    serviceManager.getService(serviceId)
  };

  public query func getAllServices() : async [Types.Service] {
    serviceManager.getAllServices()
  };

  public query func getActiveServices() : async [Types.Service] {
    serviceManager.getActiveServices()
  };

  public query func getServicesByProvider() : async [Types.Service] {
    let callerId = Principal.fromActor(DoItMain);
    serviceManager.getServicesByProvider(callerId)
  };

  public query func getServicesByCategory(category: Types.ServiceCategory) : async [Types.Service] {
    serviceManager.getServicesByCategory(category)
  };

  public query func searchServices(
    searchQuery: Text, 
    category: ?Types.ServiceCategory, 
    location: ?Text
  ) : async [Types.Service] {
    serviceManager.searchServices(searchQuery, category, location)
  };

  public query func getSupportedServiceCategories() : async [Types.ServiceCategory] {
    serviceManager.getSupportedCategories()
  };

  public query func getServiceCategoryName(category: Types.ServiceCategory) : async Text {
    serviceManager.getCategoryName(category)
  };

  public query func getDefaultServicePricing(category: Types.ServiceCategory) : async ?Types.ServicePricing {
    serviceManager.getDefaultPricing(category)
  };

  public query func getServiceStats() : async {
    totalServices: Nat;
    activeServices: Nat;
    servicesByCategory: [(Types.ServiceCategory, Nat)];
    averageRating: Float;
  } {
    serviceManager.getServiceStats()
  };

  public func updateServiceRating(serviceId: Text, newRating: Float, reviewCount: Nat) : async Result.Result<(), Text> {
    await serviceManager.updateServiceRating(serviceId, newRating, reviewCount)
  };

  public func validateServiceData(
    title: Text,
    description: Text,
    category: Types.ServiceCategory,
    pricing: Types.ServicePricing,
    duration: Int
  ) : async Result.Result<(), [Text]> {
    serviceManager.validateServiceData(title, description, category, pricing, duration)
  };

  public func bulkUpdateServiceStatus(serviceIds: [Text], isActive: Bool) : async [(Text, Result.Result<(), Text>)] {
    let callerId = Principal.fromActor(DoItMain);
    await serviceManager.bulkUpdateServiceStatus(serviceIds, callerId, isActive)
  };

  public query func exportServices() : async [Types.Service] {
    serviceManager.exportServices()
  };

  public query func getServiceCount() : async Nat {
    serviceManager.getServiceCount()
  };

  public query func getProviderServiceCount() : async Nat {
    let callerId = Principal.fromActor(DoItMain);
    serviceManager.getProviderServiceCount(callerId)
  };

  // ============================================================================
  // USER STATISTICS FUNCTIONS
  // ============================================================================

  public query func getClientUserCount() : async Nat {
    clientProfiles.size()
  };

  public query func getProviderUserCount() : async Nat {
    providerProfiles.size()
  };

  public query func getTotalUserCount() : async Nat {
    clientProfiles.size() + providerProfiles.size()
  };

  public query func getUser(userPrincipal: Principal) : async Result.Result<Types.UserInfo, Text> {
    // First check if user is a client
    switch (clientProfiles.get(userPrincipal)) {
      case (?clientProfile) {
        let userInfo: Types.UserInfo = {
          id = clientProfile.id;
          userType = #Client;
          name = clientProfile.name;
          phone = clientProfile.phone;
          location = clientProfile.location;
          profileImage = clientProfile.profileImage;
          createdAt = clientProfile.createdAt;
          isVerified = clientProfile.isVerified;
          rating = clientProfile.rating;
          totalBookings = ?clientProfile.totalBookings;
          businessName = null;
          businessType = null;
          serviceCategories = null;
          totalJobs = null;
          experience = null;
        };
        #ok(userInfo)
      };
      case null {
        // Check if user is a provider
        switch (providerProfiles.get(userPrincipal)) {
          case (?providerProfile) {
            let userInfo: Types.UserInfo = {
              id = providerProfile.id;
              userType = #Provider;
              name = providerProfile.name;
              phone = providerProfile.phone;
              location = providerProfile.location;
              profileImage = providerProfile.profileImage;
              createdAt = providerProfile.createdAt;
              isVerified = providerProfile.isVerified;
              rating = providerProfile.rating;
              totalBookings = null;
              businessName = ?providerProfile.businessName;
              businessType = ?providerProfile.businessType;
              serviceCategories = ?providerProfile.serviceCategories;
              totalJobs = ?providerProfile.totalJobs;
              experience = ?providerProfile.experience;
            };
            #ok(userInfo)
          };
          case null {
            #err("User not found")
          };
        };
      };
    }
  };

  public query func getCurrentUser() : async Result.Result<Types.UserInfo, Text> {
    let callerId = Principal.fromActor(DoItMain);
    // First check if user is a client
    switch (clientProfiles.get(callerId)) {
      case (?clientProfile) {
        let userInfo: Types.UserInfo = {
          id = clientProfile.id;
          userType = #Client;
          name = clientProfile.name;
          phone = clientProfile.phone;
          location = clientProfile.location;
          profileImage = clientProfile.profileImage;
          createdAt = clientProfile.createdAt;
          isVerified = clientProfile.isVerified;
          rating = clientProfile.rating;
          totalBookings = ?clientProfile.totalBookings;
          businessName = null;
          businessType = null;
          serviceCategories = null;
          totalJobs = null;
          experience = null;
        };
        #ok(userInfo)
      };
      case null {
        // Check if user is a provider
        switch (providerProfiles.get(callerId)) {
          case (?providerProfile) {
            let userInfo: Types.UserInfo = {
              id = providerProfile.id;
              userType = #Provider;
              name = providerProfile.name;
              phone = providerProfile.phone;
              location = providerProfile.location;
              profileImage = providerProfile.profileImage;
              createdAt = providerProfile.createdAt;
              isVerified = providerProfile.isVerified;
              rating = providerProfile.rating;
              totalBookings = null;
              businessName = ?providerProfile.businessName;
              businessType = ?providerProfile.businessType;
              serviceCategories = ?providerProfile.serviceCategories;
              totalJobs = ?providerProfile.totalJobs;
              experience = ?providerProfile.experience;
            };
            #ok(userInfo)
          };
          case null {
            #err("User not found")
          };
        };
      };
    }
  };

  public func deleteCurrentUser() : async Result.Result<Text, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    // Check if user is a client and delete
    switch (clientProfiles.get(callerId)) {
      case (?_clientProfile) {
        // Remove client profile
        clientProfiles.delete(callerId);
        
        // Clean up related client data
        let principalText = Principal.toText(callerId);
        
        // Remove client bookings
        for ((bookingId, booking) in clientBookings.entries()) {
          if (Principal.equal(booking.clientId, callerId)) {
            clientBookings.delete(bookingId);
          };
        };
        
        // Remove client notifications
        clientNotifications.delete(principalText);
        
        return #ok("Client user deleted successfully");
      };
      case null {
        // Check if user is a provider and delete
        switch (providerProfiles.get(callerId)) {
          case (?_providerProfile) {
            // Remove provider profile
            providerProfiles.delete(callerId);
            
            let principalText = Principal.toText(callerId);
            
            // Remove provider bookings
            for ((bookingId, booking) in providerBookings.entries()) {
              if (Principal.equal(booking.providerId, callerId)) {
                providerBookings.delete(bookingId);
              };
            };
            
            // Remove provider notifications
            providerNotifications.delete(principalText);
            
            // Remove provider reviews
            providerReviews.delete(principalText);
            
            // Remove background check
            backgroundChecks.delete(callerId);
            
            // Remove provider services
            for ((serviceId, service) in services.entries()) {
              if (Principal.equal(service.providerId, callerId)) {
                services.delete(serviceId);
              };
            };
            
            return #ok("Provider user deleted successfully");
          };
          case null {
            return #err("User not found - no profile exists for this principal");
          };
        };
      };
    }
  };

  public func deleteUser(userPrincipal: Principal) : async Result.Result<Text, Text> {
    // Check if user is a client and delete
    switch (clientProfiles.get(userPrincipal)) {
      case (?_clientProfile) {
        // Remove client profile
        clientProfiles.delete(userPrincipal);
        
        // Clean up related client data
        let principalText = Principal.toText(userPrincipal);
        
        // Remove client bookings
        for ((bookingId, booking) in clientBookings.entries()) {
          if (Principal.equal(booking.clientId, userPrincipal)) {
            clientBookings.delete(bookingId);
          };
        };
        
        // Remove client notifications
        clientNotifications.delete(principalText);
        
        return #ok("Client user deleted successfully");
      };
      case null {
        // Check if user is a provider and delete
        switch (providerProfiles.get(userPrincipal)) {
          case (?_providerProfile) {
            // Remove provider profile
            providerProfiles.delete(userPrincipal);
            
            let principalText = Principal.toText(userPrincipal);
            
            // Remove provider bookings
            for ((bookingId, booking) in providerBookings.entries()) {
              if (Principal.equal(booking.providerId, userPrincipal)) {
                providerBookings.delete(bookingId);
              };
            };
            
            // Remove provider notifications
            providerNotifications.delete(principalText);
            
            // Remove provider reviews
            providerReviews.delete(principalText);
            
            // Remove background check
            backgroundChecks.delete(userPrincipal);
            
            // Remove provider services
            for ((serviceId, service) in services.entries()) {
              if (Principal.equal(service.providerId, userPrincipal)) {
                services.delete(serviceId);
              };
            };
            
            return #ok("Provider user deleted successfully");
          };
          case null {
            return #err("User not found - no profile exists for this principal");
          };
        };
      };
    }
  };

  // ============================================================================
  // MESSAGING MANAGEMENT FUNCTIONS  
  // ============================================================================

  public func createConversation(
    participants: [Principal],
    title: ?Text,
    conversationType: Types.ConversationType,
    relatedBookingId: ?Text
  ) : async Result.Result<Types.Conversation, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let result = Messages.createConversation(
      callerId,
      participants,
      title,
      conversationType,
      relatedBookingId,
      nextConversationId,
      conversations,
      messageThreads
    );
    
    switch (result) {
      case (#ok(conversation, newNextConversationId)) {
        nextConversationId := newNextConversationId;
        #ok(conversation)
      };
      case (#err(error)) { #err(error) };
    }
  };

  public func sendMessage(
    conversationId: Text,
    messageType: Types.MessageType,
    text: Text,
    attachments: ?[Types.MessageAttachment],
    replyToMessageId: ?Text
  ) : async Result.Result<Types.Message, Text> {
    let callerId = Principal.fromActor(DoItMain);
    
    let result = Messages.sendMessage(
      callerId,
      conversationId,
      messageType,
      text,
      attachments,
      replyToMessageId,
      nextMessageId,
      conversations,
      messages,
      messageThreads
    );
    
    switch (result) {
      case (#ok(message, newNextMessageId)) {
        nextMessageId := newNextMessageId;
        // Reward user for message milestones
        ignore checkAndRewardMessages(callerId);
        #ok(message)
      };
      case (#err(error)) { #err(error) };
    }
  };

  public query func getConversations() : async Result.Result<[Types.ConversationSummary], Text> {
    let callerId = Principal.fromActor(DoItMain);
    Messages.getConversations(callerId, conversations)
  };

  public query func getMessages(
    conversationId: Text,
    limit: ?Nat,
    offset: ?Nat
  ) : async Result.Result<[Types.Message], Text> {
    let callerId = Principal.fromActor(DoItMain);
    Messages.getMessages(callerId, conversationId, limit, offset, conversations, messageThreads)
  };

  public func markMessagesAsRead(conversationId: Text) : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    Messages.markMessagesAsRead(callerId, conversationId, conversations)
  };

  public func blockUser(userToBlock: Principal, reason: ?Text) : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    Messages.blockUser(callerId, userToBlock, reason, blockedUsers)
  };

  public func unblockUser(userToUnblock: Principal) : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    Messages.unblockUser(callerId, userToUnblock, blockedUsers)
  };

  public func saveDraft(
    conversationId: Text,
    draftText: Text,
    replyToMessageId: ?Text
  ) : async Result.Result<Bool, Text> {
    let callerId = Principal.fromActor(DoItMain);
    Messages.saveDraft(callerId, conversationId, draftText, replyToMessageId, messageDrafts)
  };

  public query func getDraft(conversationId: Text) : async ?Types.MessageDraft {
    let callerId = Principal.fromActor(DoItMain);
    Messages.getDraft(callerId, conversationId, messageDrafts)
  };

  public func clearDraft(conversationId: Text) : async Bool {
    let callerId = Principal.fromActor(DoItMain);
    Messages.clearDraft(callerId, conversationId, messageDrafts)
  };

  public query func getMessagingStats() : async {
    totalMessages: Nat;
    totalConversations: Nat;
    activeConversations: Nat;
  } {
    Messages.getSystemStats(messages, conversations)
  };

};