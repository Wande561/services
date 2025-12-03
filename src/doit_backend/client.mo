import Types "./types";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Int "mo:base/Int";
import HashMap "mo:base/HashMap";
import Array "mo:base/Array";
import Result "mo:base/Result";
import Buffer "mo:base/Buffer";
import Option "mo:base/Option";

module ClientModule {

  public func registerClient(
    callerId: Principal, 
    registration: Types.ClientRegistration, 
    clientProfiles: HashMap.HashMap<Principal, Types.ClientProfile>,
    clientNotifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Types.ClientProfile, Text> {

    switch (clientProfiles.get(callerId)) {
      case (?_existing) { #err("Client already registered") };
      case null {
        let newProfile : Types.ClientProfile = {
          version = 1;
          id = callerId;
          name = registration.name;
          email = registration.email;
          phone = registration.phone;
          location = registration.location;
          profileImage = null;
          createdAt = Time.now();
          isVerified = false;
          rating = 5.0;
          totalBookings = 0;
        };
        
        clientProfiles.put(callerId, newProfile);

        let welcomeNotification : Types.Notification = {
          version = 1;
          id = "welcome_" # Int.toText(Time.now());
          userId = callerId;
          type_ = #SystemUpdate;
          title = "Welcome to DoIt Services!";
          message = "Welcome " # registration.name # "! Your account has been created successfully.";
          isRead = false;
          createdAt = Time.now();
          relatedId = null;
        };
        
        addNotification(callerId, welcomeNotification, clientNotifications);
        
        #ok(newProfile)
      };
    }
  };

  public func getClientProfile(callerId: Principal, clientProfiles: HashMap.HashMap<Principal, Types.ClientProfile>) : Result.Result<Types.ClientProfile, Text> {
    
    switch (clientProfiles.get(callerId)) {
      case (?profile) { #ok(profile) };
      case null { #err("Client profile not found") };
    }
  };

  public func updateClientProfile(
    callerId: Principal,
    name: ?Text, 
    phone: ?Text, 
    location: ?Text, 
    profileImage: ?Text,
    clientProfiles: HashMap.HashMap<Principal, Types.ClientProfile>
  ) : Result.Result<Types.ClientProfile, Text> {
    
    switch (clientProfiles.get(callerId)) {
      case (?existingProfile) {
        let updatedProfile : Types.ClientProfile = {
          version = existingProfile.version + 1;
          id = existingProfile.id;
          name = Option.get(name, existingProfile.name);
          email = existingProfile.email;
          phone = Option.get(phone, existingProfile.phone);
          location = Option.get(location, existingProfile.location);
          profileImage = switch(profileImage) {
            case (?img) { ?img };
            case null { existingProfile.profileImage };
          };
          createdAt = existingProfile.createdAt;
          isVerified = existingProfile.isVerified;
          rating = existingProfile.rating;
          totalBookings = existingProfile.totalBookings;
        };
        
        clientProfiles.put(callerId, updatedProfile);
        #ok(updatedProfile)
      };
      case null { #err("Client profile not found") };
    }
  };

  public func createBooking(
    callerId: Principal,
    providerId: Principal,
    serviceId: Text,
    date: Text,
    time: Text,
    duration: Int,
    location: Text,
    notes: ?Text,
    paymentMethod: Types.PaymentMethod,
    nextBookingId: Nat,
    clientProfiles: HashMap.HashMap<Principal, Types.ClientProfile>,
    clientBookings: HashMap.HashMap<Text, Types.Booking>,
    clientNotifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<(Types.Booking, Nat), Text> {

    switch (clientProfiles.get(callerId)) {
      case null { return #err("Client profile not found") };
      case (?_) { /* continue */ };
    };
    
    let bookingId = "booking_" # Int.toText(nextBookingId);
    let newNextBookingId = nextBookingId + 1;
    
    let newBooking : Types.Booking = {
      version = 1;
      id = bookingId;
      clientId = callerId;
      providerId = providerId;
      serviceId = serviceId;
      date = date;
      time = time;
      duration = duration;
      location = location;
      notes = notes;
      status = #Pending;
      paymentMethod = paymentMethod;
      paymentStatus = #Pending;
      totalAmount = 0.0; 
      createdAt = Time.now();
      updatedAt = Time.now();
    };
    
    clientBookings.put(bookingId, newBooking);

    switch (clientProfiles.get(callerId)) {
      case (?profile) {
        let updatedProfile : Types.ClientProfile = {
          version = profile.version + 1;
          id = profile.id;
          name = profile.name;
          email = profile.email;
          phone = profile.phone;
          location = profile.location;
          profileImage = profile.profileImage;
          createdAt = profile.createdAt;
          isVerified = profile.isVerified;
          rating = profile.rating;
          totalBookings = profile.totalBookings + 1;
        };
        clientProfiles.put(callerId, updatedProfile);
      };
      case null { /* should not happen as we verified above */ };
    };

    let bookingNotification : Types.Notification = {
      version = 1;
      id = "booking_created_" # bookingId;
      userId = callerId;
      type_ = #BookingRequest;
      title = "Booking Request Submitted";
      message = "Your booking request for " # date # " at " # time # " has been submitted.";
      isRead = false;
      createdAt = Time.now();
      relatedId = ?bookingId;
    };
    
    addNotification(callerId, bookingNotification, clientNotifications);
    
    #ok((newBooking, newNextBookingId))
  };

  public func getClientBookings(callerId: Principal, clientProfiles: HashMap.HashMap<Principal, Types.ClientProfile>, clientBookings: HashMap.HashMap<Text, Types.Booking>) : Result.Result<[Types.Booking], Text> {

    switch (clientProfiles.get(callerId)) {
      case null { return #err("Client profile not found") };
      case (?_) { /* continue */ };
    };
    
    let clientBookingsList = Buffer.Buffer<Types.Booking>(10);
    
    for ((_, booking) in clientBookings.entries()) {
      if (booking.clientId == callerId) {
        clientBookingsList.add(booking);
      };
    };
    
    #ok(Buffer.toArray(clientBookingsList))
  };

  private func addNotification(userId: Principal, notification: Types.Notification, clientNotifications: HashMap.HashMap<Text, [Types.Notification]>) {
    let userIdText = Principal.toText(userId);
    
    switch (clientNotifications.get(userIdText)) {
      case (?existingNotifications) {
        let updatedNotifications = Array.append(existingNotifications, [notification]);
        clientNotifications.put(userIdText, updatedNotifications);
      };
      case null {
        clientNotifications.put(userIdText, [notification]);
      };
    };
  };

  public func getNotifications(callerId: Principal, clientNotifications: HashMap.HashMap<Text, [Types.Notification]>) : Result.Result<[Types.Notification], Text> {
    let userIdText = Principal.toText(callerId);
    
    switch (clientNotifications.get(userIdText)) {
      case (?notifications) { #ok(notifications) };
      case null { #ok([]) };
    }
  };

  public func getSystemStats(clientProfiles: HashMap.HashMap<Principal, Types.ClientProfile>, clientBookings: HashMap.HashMap<Text, Types.Booking>, clientReviews: HashMap.HashMap<Text, Types.Review>) : {
    totalClients: Nat;
    totalBookings: Nat;
    totalReviews: Nat;
  } {
    {
      totalClients = clientProfiles.size();
      totalBookings = clientBookings.size();
      totalReviews = clientReviews.size();
    }
  };

}
