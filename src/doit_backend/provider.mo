import Types "./types";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Bool "mo:base/Bool";
import Principal "mo:base/Principal";
import Int "mo:base/Int";
import Float "mo:base/Float";
import HashMap "mo:base/HashMap";
import Array "mo:base/Array";
import Result "mo:base/Result";
import Buffer "mo:base/Buffer";
import Option "mo:base/Option";

module ProviderModule {

  private func addNotification(userId: Principal, notification: Types.Notification, providerNotifications: HashMap.HashMap<Text, [Types.Notification]>) {
    let userIdText = Principal.toText(userId);
    
    switch (providerNotifications.get(userIdText)) {
      case (?existingNotifications) {
        let updatedNotifications = Array.append(existingNotifications, [notification]);
        providerNotifications.put(userIdText, updatedNotifications);
      };
      case null {
        providerNotifications.put(userIdText, [notification]);
      };
    };
  };

  public func registerProvider(
    callerId: Principal,
    registration: Types.ProviderRegistration,
    providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>,
    backgroundChecks: HashMap.HashMap<Principal, Types.BackgroundCheck>,
    providerNotifications: HashMap.HashMap<Text, [Types.Notification]>,
    nextProviderId: Nat
  ) : Result.Result<(Types.ProviderProfile, Nat), Text> {

    switch (providerProfiles.get(callerId)) {
      case (?_existing) { #err("Provider already registered") };
      case null {
        if (Text.size(registration.idNumber) != 13) {
          return #err("Invalid South African ID number format");
        };
        
        let newProfile : Types.ProviderProfile = {
          version = 1;
          id = callerId;
          name = registration.name;
          phone = registration.phone;
          idNumber = registration.idNumber;
          businessName = registration.businessName;
          businessType = registration.businessType;
          location = registration.location;
          serviceCategories = registration.serviceCategories;
          businessLicense = registration.businessLicense;
          insuranceDetails = registration.insuranceDetails;
          portfolio = [];
          profileImage = null;
          description = registration.description;
          experience = registration.experience;
          createdAt = Time.now();
          isVerified = false;
          backgroundCheckStatus = #Pending;
          rating = 5.0;
          totalJobs = 0;
          availability = [];
          pricing = [];
        };
        
        providerProfiles.put(callerId, newProfile);

        if (registration.consentBackgroundCheck) {
          let backgroundCheck : Types.BackgroundCheck = {
            providerId = callerId;
            status = #Pending;
            submittedAt = Time.now();
            completedAt = null;
            expiresAt = null;
            documents = [];
            notes = ?"Background check initiated upon registration";
          };
          backgroundChecks.put(callerId, backgroundCheck);
        };

        let welcomeNotification : Types.Notification = {
          version = 1;
          id = "welcome_provider_" # Int.toText(Time.now());
          userId = callerId;
          type_ = #SystemUpdate;
          title = "Welcome to DoIt Services Provider Platform!";
          message = "Welcome " # registration.businessName # "! Please complete your profile and upload required documents.";
          isRead = false;
          createdAt = Time.now();
          relatedId = null;
        };
        
        addNotification(callerId, welcomeNotification, providerNotifications);
        
        #ok((newProfile, nextProviderId + 1))
      };
    }
  };

  public func getProviderProfile(callerId: Principal, providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>) : Result.Result<Types.ProviderProfile, Text> {
    switch (providerProfiles.get(callerId)) {
      case (?profile) { #ok(profile) };
      case null { #err("Provider profile not found") };
    }
  };

  public func updateProviderProfile(
    callerId: Principal,
    businessName: ?Text,
    businessType: ?Text,
    phone: ?Text,
    location: ?Text,
    description: ?Text,
    profileImage: ?Text,
    portfolio: ?[Text],
    providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>
  ) : Result.Result<Types.ProviderProfile, Text> {
    
    switch (providerProfiles.get(callerId)) {
      case (?existingProfile) {
        let updatedProfile : Types.ProviderProfile = {
          version = existingProfile.version + 1;
          id = existingProfile.id;
          name = existingProfile.name;
          phone = Option.get(phone, existingProfile.phone);
          idNumber = existingProfile.idNumber;
          businessName = Option.get(businessName, existingProfile.businessName);
          businessType = Option.get(businessType, existingProfile.businessType);
          location = Option.get(location, existingProfile.location);
          serviceCategories = existingProfile.serviceCategories;
          businessLicense = existingProfile.businessLicense;
          insuranceDetails = existingProfile.insuranceDetails;
          portfolio = Option.get(portfolio, existingProfile.portfolio);
          profileImage = switch(profileImage) {
            case (?img) { ?img };
            case null { existingProfile.profileImage };
          };
          description = Option.get(description, existingProfile.description);
          experience = existingProfile.experience;
          createdAt = existingProfile.createdAt;
          isVerified = existingProfile.isVerified;
          backgroundCheckStatus = existingProfile.backgroundCheckStatus;
          rating = existingProfile.rating;
          totalJobs = existingProfile.totalJobs;
          availability = existingProfile.availability;
          pricing = existingProfile.pricing;
        };
        
        providerProfiles.put(callerId, updatedProfile);
        #ok(updatedProfile)
      };
      case null { #err("Provider profile not found") };
    }
  };

  public func getProviderBookings(callerId: Principal, providerBookings: HashMap.HashMap<Text, Types.Booking>) : Result.Result<[Types.Booking], Text> {
    
    let providerBookingsList = Buffer.Buffer<Types.Booking>(10);
    
    for ((_, booking) in providerBookings.entries()) {
      if (booking.providerId == callerId) {
        providerBookingsList.add(booking);
      };
    };
    
    #ok(Buffer.toArray(providerBookingsList))
  };

  public func acceptBooking(
    callerId: Principal,
    bookingId: Text,
    estimatedCost: Float,
    providerBookings: HashMap.HashMap<Text, Types.Booking>,
    providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>,
    providerNotifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Types.Booking, Text> {
    
    switch (providerBookings.get(bookingId)) {
      case (?booking) {
        if (booking.providerId != callerId) {
          return #err("Not authorized to accept this booking");
        };
        
        if (booking.status != #Pending) {
          return #err("Booking is not in pending status");
        };
        
        let acceptedBooking : Types.Booking = {
          version = booking.version + 1;
          id = booking.id;
          clientId = booking.clientId;
          providerId = booking.providerId;
          serviceId = booking.serviceId;
          date = booking.date;
          time = booking.time;
          duration = booking.duration;
          location = booking.location;
          notes = booking.notes;
          status = #Confirmed;
          paymentMethod = booking.paymentMethod;
          paymentStatus = booking.paymentStatus;
          totalAmount = estimatedCost;
          createdAt = booking.createdAt;
          updatedAt = Time.now();
        };
        
        providerBookings.put(bookingId, acceptedBooking);

        switch (providerProfiles.get(callerId)) {
          case (?profile) {
            let updatedProfile : Types.ProviderProfile = {
              version = profile.version + 1;
              id = profile.id;
              name = profile.name;
              phone = profile.phone;
              idNumber = profile.idNumber;
              businessName = profile.businessName;
              businessType = profile.businessType;
              location = profile.location;
              serviceCategories = profile.serviceCategories;
              businessLicense = profile.businessLicense;
              insuranceDetails = profile.insuranceDetails;
              portfolio = profile.portfolio;
              profileImage = profile.profileImage;
              description = profile.description;
              experience = profile.experience;
              createdAt = profile.createdAt;
              isVerified = profile.isVerified;
              backgroundCheckStatus = profile.backgroundCheckStatus;
              rating = profile.rating;
              totalJobs = profile.totalJobs + 1;
              availability = profile.availability;
              pricing = profile.pricing;
            };
            providerProfiles.put(callerId, updatedProfile);
          };
          case null { /* should not happen */ };
        };

        let acceptNotification : Types.Notification = {
          version = 1;
          id = "booking_accepted_" # bookingId;
          userId = callerId;
          type_ = #BookingConfirmed;
          title = "Booking Accepted";
          message = "You have accepted the booking for " # booking.date # " at " # booking.time # ".";
          isRead = false;
          createdAt = Time.now();
          relatedId = ?bookingId;
        };
        
        addNotification(callerId, acceptNotification, providerNotifications);
        
        #ok(acceptedBooking)
      };
      case null { #err("Booking not found") };
    }
  };

  public func rejectBooking(
    callerId: Principal,
    bookingId: Text,
    reason: ?Text,
    providerBookings: HashMap.HashMap<Text, Types.Booking>
  ) : Result.Result<Types.Booking, Text> {
    
    switch (providerBookings.get(bookingId)) {
      case (?booking) {
        if (booking.providerId != callerId) {
          return #err("Not authorized to reject this booking");
        };
        
        if (booking.status != #Pending) {
          return #err("Booking is not in pending status");
        };
        
        let rejectedBooking : Types.Booking = {
          version = booking.version + 1;
          id = booking.id;
          clientId = booking.clientId;
          providerId = booking.providerId;
          serviceId = booking.serviceId;
          date = booking.date;
          time = booking.time;
          duration = booking.duration;
          location = booking.location;
          notes = switch(reason) {
            case (?r) { ?("Rejected: " # r) };
            case null { ?"Booking rejected by provider" };
          };
          status = #Cancelled;
          paymentMethod = booking.paymentMethod;
          paymentStatus = booking.paymentStatus;
          totalAmount = booking.totalAmount;
          createdAt = booking.createdAt;
          updatedAt = Time.now();
        };
        
        providerBookings.put(bookingId, rejectedBooking);
        
        #ok(rejectedBooking)
      };
      case null { #err("Booking not found") };
    }
  };
  
  public func completeBooking(
    callerId: Principal,
    bookingId: Text,
    providerBookings: HashMap.HashMap<Text, Types.Booking>,
    providerNotifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Types.Booking, Text> {
    
    switch (providerBookings.get(bookingId)) {
      case (?booking) {
        if (booking.providerId != callerId) {
          return #err("Not authorized to complete this booking");
        };
        
        if (booking.status != #Confirmed and booking.status != #InProgress) {
          return #err("Booking is not in a completable status");
        };
        
        let completedBooking : Types.Booking = {
          version = booking.version + 1;
          id = booking.id;
          clientId = booking.clientId;
          providerId = booking.providerId;
          serviceId = booking.serviceId;
          date = booking.date;
          time = booking.time;
          duration = booking.duration;
          location = booking.location;
          notes = booking.notes;
          status = #Completed;
          paymentMethod = booking.paymentMethod;
          paymentStatus = booking.paymentStatus;
          totalAmount = booking.totalAmount;
          createdAt = booking.createdAt;
          updatedAt = Time.now();
        };
        
        providerBookings.put(bookingId, completedBooking);

        let completionNotification : Types.Notification = {
          version = 1;
          id = "booking_completed_" # bookingId;
          userId = callerId;
          type_ = #SystemUpdate;
          title = "Service Completed";
          message = "You have marked the service as completed. Client can now leave a review.";
          isRead = false;
          createdAt = Time.now();
          relatedId = ?bookingId;
        };
        
        addNotification(callerId, completionNotification, providerNotifications);
        
        #ok(completedBooking)
      };
      case null { #err("Booking not found") };
    }
  };

  public func updateAvailability(
    callerId: Principal,
    availability: [Types.AvailabilitySlot],
    providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>
  ) : Result.Result<Types.ProviderProfile, Text> {
    
    switch (providerProfiles.get(callerId)) {
      case (?existingProfile) {
        let updatedProfile : Types.ProviderProfile = {
          version = existingProfile.version + 1;
          id = existingProfile.id;
          name = existingProfile.name;
          phone = existingProfile.phone;
          idNumber = existingProfile.idNumber;
          businessName = existingProfile.businessName;
          businessType = existingProfile.businessType;
          location = existingProfile.location;
          serviceCategories = existingProfile.serviceCategories;
          businessLicense = existingProfile.businessLicense;
          insuranceDetails = existingProfile.insuranceDetails;
          portfolio = existingProfile.portfolio;
          profileImage = existingProfile.profileImage;
          description = existingProfile.description;
          experience = existingProfile.experience;
          createdAt = existingProfile.createdAt;
          isVerified = existingProfile.isVerified;
          backgroundCheckStatus = existingProfile.backgroundCheckStatus;
          rating = existingProfile.rating;
          totalJobs = existingProfile.totalJobs;
          availability = availability;
          pricing = existingProfile.pricing;
        };
        
        providerProfiles.put(callerId, updatedProfile);
        #ok(updatedProfile)
      };
      case null { #err("Provider profile not found") };
    }
  };

  public func getProviderReviews(callerId: Principal, providerReviews: HashMap.HashMap<Text, [Types.Review]>) : Result.Result<[Types.Review], Text> {
    let providerIdText = Principal.toText(callerId);
    
    switch (providerReviews.get(providerIdText)) {
      case (?reviews) { #ok(reviews) };
      case null { #ok([]) };
    }
  };

  public func addProviderReview(
    providerId: Principal,
    review: Types.Review,
    providerReviews: HashMap.HashMap<Text, [Types.Review]>,
    providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>
  ) : Bool {
    let providerIdText = Principal.toText(providerId);
    
    switch (providerReviews.get(providerIdText)) {
      case (?existingReviews) {
        let updatedReviews = Array.append(existingReviews, [review]);
        providerReviews.put(providerIdText, updatedReviews);

        let totalRating = Array.foldLeft<Types.Review, Float>(
          updatedReviews,
          0.0,
          func(acc, r) { acc + r.rating }
        );
        let newRating = totalRating / Float.fromInt(updatedReviews.size());

        switch (providerProfiles.get(providerId)) {
          case (?profile) {
            let updatedProfile : Types.ProviderProfile = {
              version = profile.version + 1;
              id = profile.id;
              name = profile.name;
              phone = profile.phone;
              idNumber = profile.idNumber;
              businessName = profile.businessName;
              businessType = profile.businessType;
              location = profile.location;
              serviceCategories = profile.serviceCategories;
              businessLicense = profile.businessLicense;
              insuranceDetails = profile.insuranceDetails;
              portfolio = profile.portfolio;
              profileImage = profile.profileImage;
              description = profile.description;
              experience = profile.experience;
              createdAt = profile.createdAt;
              isVerified = profile.isVerified;
              backgroundCheckStatus = profile.backgroundCheckStatus;
              rating = newRating;
              totalJobs = profile.totalJobs;
              availability = profile.availability;
              pricing = profile.pricing;
            };
            providerProfiles.put(providerId, updatedProfile);
          };
          case null { /* provider not found */ };
        };
      };
      case null {
        providerReviews.put(providerIdText, [review]);
      };
    };
    
    true
  };

  // public func submitBackgroundCheckDocuments(
  //   callerId: Principal,
  //   documents: [Text],
  //   backgroundChecks: HashMap.HashMap<Principal, Types.BackgroundCheck>,
  //   providerNotifications: HashMap.HashMap<Text, [Types.Notification]>
  // ) : Result.Result<Types.BackgroundCheck, Text> {
  //   
  //   switch (backgroundChecks.get(callerId)) {
  //     case (?existingCheck) {
  //       let updatedCheck : Types.BackgroundCheck = {
  //         providerId = existingCheck.providerId;
  //         status = #InProgress;
  //         submittedAt = existingCheck.submittedAt;
  //         completedAt = null;
  //         expiresAt = null;
  //         documents = documents;
  //         notes = ?"Documents submitted for review";
  //       };
  //       
  //       backgroundChecks.put(callerId, updatedCheck);

  //       let docNotification : Types.Notification = {
  //         version = 1;
  //         id = "bg_docs_submitted_" # Int.toText(Time.now());
  //         userId = callerId;
  //         type_ = #SystemUpdate;
  //         title = "Background Check Documents Submitted";
  //         message = "Your background check documents have been submitted for review.";
  //         isRead = false;
  //         createdAt = Time.now();
  //         relatedId = null;
  //       };
  //       
  //       addNotification(callerId, docNotification, providerNotifications);
  //       
  //       #ok(updatedCheck)
  //     };
  //     case null { #err("Background check not initiated") };
  //   }
  // };

  // public func getBackgroundCheckStatus(callerId: Principal, backgroundChecks: HashMap.HashMap<Principal, Types.BackgroundCheck>) : Result.Result<Types.BackgroundCheck, Text> {
  //   
  //   switch (backgroundChecks.get(callerId)) {
  //     case (?check) { #ok(check) };
  //     case null { #err("No background check found") };
  //   }
  // };

  public func getNotifications(callerId: Principal, providerNotifications: HashMap.HashMap<Text, [Types.Notification]>) : Result.Result<[Types.Notification], Text> {
    let userIdText = Principal.toText(callerId);
    
    switch (providerNotifications.get(userIdText)) {
      case (?notifications) { #ok(notifications) };
      case null { #ok([]) };
    }
  };

  public func markNotificationAsRead(
    callerId: Principal,
    notificationId: Text,
    providerNotifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Bool, Text> {
    let userIdText = Principal.toText(callerId);
    
    switch (providerNotifications.get(userIdText)) {
      case (?notifications) {
        let updatedNotifications = Array.map<Types.Notification, Types.Notification>(
          notifications, 
          func (notification) {
            if (notification.id == notificationId) {
              {
                version = notification.version + 1;
                id = notification.id;
                userId = notification.userId;
                type_ = notification.type_;
                title = notification.title;
                message = notification.message;
                isRead = true;
                createdAt = notification.createdAt;
                relatedId = notification.relatedId;
              }
            } else {
              notification
            }
          }
        );
        providerNotifications.put(userIdText, updatedNotifications);
        #ok(true)
      };
      case null { #err("No notifications found") };
    }
  };

  public func getProviderAnalytics(
    callerId: Principal,
    providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>,
    providerBookings: HashMap.HashMap<Text, Types.Booking>,
    providerReviews: HashMap.HashMap<Text, [Types.Review]>
  ) : Result.Result<{
    totalBookings: Nat;
    completedJobs: Nat;
    averageRating: Float;
    totalEarnings: Float;
    reviewCount: Nat;
  }, Text> {
    
    switch (providerProfiles.get(callerId)) {
      case (?profile) {
        let providerIdText = Principal.toText(callerId);

        var bookingCount = 0;
        var completedCount = 0;
        var totalEarnings = 0.0;
        
        for ((_, booking) in providerBookings.entries()) {
          if (booking.providerId == callerId) {
            bookingCount += 1;
            if (booking.status == #Completed) {
              completedCount += 1;
              totalEarnings += booking.totalAmount;
            };
          };
        };

        let reviewCount = switch (providerReviews.get(providerIdText)) {
          case (?reviews) { reviews.size() };
          case null { 0 };
        };
        
        #ok({
          totalBookings = bookingCount;
          completedJobs = completedCount;
          averageRating = profile.rating;
          totalEarnings = totalEarnings;
          reviewCount = reviewCount;
        })
      };
      case null { #err("Provider profile not found") };
    }
  };

  public func searchProviders(
    location: ?Text,
    serviceCategory: ?Types.ServiceCategory,
    minRating: ?Float,
    verifiedOnly: Bool,
    businessType: ?Text,
    _maxDistance: ?Int,
    providerProfiles: HashMap.HashMap<Principal, Types.ProviderProfile>
  ) : Result.Result<[Types.ProviderProfile], Text> {
    let matchingProviders = Buffer.Buffer<Types.ProviderProfile>(10);
    
    for ((_, provider) in providerProfiles.entries()) {
      var matches = true;

      switch(location) {
        case (?loc) {
          let providerLoc = Text.toLowercase(provider.location);
          let searchLoc = Text.toLowercase(loc);
          if (not Text.contains(providerLoc, #text searchLoc)) {
            matches := false;
          };
        };
        case null { /* no filter */ };
      };

      switch(serviceCategory) {
        case (?category) {
          let hasCategory = Array.find<Types.ServiceCategory>(
            provider.serviceCategories, 
            func(cat) { cat == category }
          );
          switch(hasCategory) {
            case null { matches := false; };
            case (?_) { /* continue */ };
          };
        };
        case null { /* no filter */ };
      };

      switch(minRating) {
        case (?rating) {
          if (provider.rating < rating) {
            matches := false;
          };
        };
        case null { /* no filter */ };
      };

      if (verifiedOnly and not provider.isVerified) {
        matches := false;
      };

      switch(businessType) {
        case (?bizType) {
          let providerBizType = Text.toLowercase(provider.businessType);
          let searchBizType = Text.toLowercase(bizType);
          if (not Text.contains(providerBizType, #text searchBizType)) {
            matches := false;
          };
        };
        case null { /* no filter */ };
      };

      if (matches) {
        matchingProviders.add(provider);
      };
    };
    
    #ok(Buffer.toArray(matchingProviders))
  };

}