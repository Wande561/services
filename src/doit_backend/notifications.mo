import Types "./types";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Int "mo:base/Int";
import Nat "mo:base/Nat";

module NotificationsModule {

  // ============================================================================
  // NOTIFICATION MANAGEMENT FUNCTIONS
  // ============================================================================

  public func createNotification(
    userId: Principal,
    type_: Types.NotificationType,
    title: Text,
    message: Text,
    relatedId: ?Text
  ) : Types.Notification {
    {
      version = 1;
      id = generateNotificationId(userId, type_);
      userId = userId;
      type_ = type_;
      title = title;
      message = message;
      isRead = false;
      createdAt = Time.now();
      relatedId = relatedId;
    }
  };

  public func addNotification(
    notification: Types.Notification,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) {
    let userIdText = Principal.toText(notification.userId);
    
    switch (notifications.get(userIdText)) {
      case (?existingNotifications) {
        let updatedNotifications = Array.append(existingNotifications, [notification]);
        notifications.put(userIdText, updatedNotifications);
      };
      case null {
        notifications.put(userIdText, [notification]);
      };
    }
  };

  public func getNotifications(
    userId: Principal,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<[Types.Notification], Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) { 
        // Sort notifications by creation date (most recent first)
        let sortedNotifications = Array.sort<Types.Notification>(
          userNotifications,
          func (a, b) = Int.compare(b.createdAt, a.createdAt)
        );
        #ok(sortedNotifications) 
      };
      case null { #ok([]) };
    }
  };

  public func getUnreadNotifications(
    userId: Principal,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<[Types.Notification], Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) { 
        let unreadNotifications = Array.filter<Types.Notification>(
          userNotifications,
          func (notification) = not notification.isRead
        );
        let sortedNotifications = Array.sort<Types.Notification>(
          unreadNotifications,
          func (a, b) = Int.compare(b.createdAt, a.createdAt)
        );
        #ok(sortedNotifications) 
      };
      case null { #ok([]) };
    }
  };

  public func markNotificationAsRead(
    userId: Principal,
    notificationId: Text,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Bool, Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) {
        let updatedNotifications = Array.map<Types.Notification, Types.Notification>(
          userNotifications, 
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
        notifications.put(userIdText, updatedNotifications);
        #ok(true)
      };
      case null { 
        #err("User has no notifications")
      };
    }
  };

  public func markAllNotificationsAsRead(
    userId: Principal,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Bool, Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) {
        let updatedNotifications = Array.map<Types.Notification, Types.Notification>(
          userNotifications, 
          func (notification) {
            if (not notification.isRead) {
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
        notifications.put(userIdText, updatedNotifications);
        #ok(true)
      };
      case null { 
        #ok(true) // No notifications to mark as read
      };
    }
  };

  public func deleteNotification(
    userId: Principal,
    notificationId: Text,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Bool, Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) {
        let filteredNotifications = Array.filter<Types.Notification>(
          userNotifications,
          func (notification) = notification.id != notificationId
        );
        notifications.put(userIdText, filteredNotifications);
        #ok(true)
      };
      case null { 
        #err("User has no notifications")
      };
    }
  };

  public func deleteAllNotifications(
    userId: Principal,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<Bool, Text> {
    let userIdText = Principal.toText(userId);
    notifications.put(userIdText, []);
    #ok(true)
  };

  public func getNotificationById(
    userId: Principal,
    notificationId: Text,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<?Types.Notification, Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) {
        let foundNotification = Array.find<Types.Notification>(
          userNotifications,
          func (notification) = notification.id == notificationId
        );
        #ok(foundNotification)
      };
      case null { 
        #ok(null)
      };
    }
  };

  public func getNotificationStats(
    userId: Principal,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<{
    totalNotifications: Nat;
    unreadNotifications: Nat;
    readNotifications: Nat;
  }, Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) {
        let unreadCount = Array.filter<Types.Notification>(
          userNotifications,
          func (notification) = not notification.isRead
        ).size();
        
        let totalCount = userNotifications.size();
        let readCount = Nat.sub(totalCount, unreadCount);
        
        #ok({
          totalNotifications = totalCount;
          unreadNotifications = unreadCount;
          readNotifications = readCount;
        })
      };
      case null { 
        #ok({
          totalNotifications = 0;
          unreadNotifications = 0;
          readNotifications = 0;
        })
      };
    }
  };

  public func getNotificationsByType(
    userId: Principal,
    notificationType: Types.NotificationType,
    notifications: HashMap.HashMap<Text, [Types.Notification]>
  ) : Result.Result<[Types.Notification], Text> {
    let userIdText = Principal.toText(userId);
    
    switch (notifications.get(userIdText)) {
      case (?userNotifications) {
        let filteredNotifications = Array.filter<Types.Notification>(
          userNotifications,
          func (notification) = notification.type_ == notificationType
        );
        let sortedNotifications = Array.sort<Types.Notification>(
          filteredNotifications,
          func (a, b) = Int.compare(b.createdAt, a.createdAt)
        );
        #ok(sortedNotifications)
      };
      case null { 
        #ok([])
      };
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  private func generateNotificationId(userId: Principal, type_: Types.NotificationType) : Text {
    let timestamp = Int.toText(Time.now());
    let userIdText = Principal.toText(userId);
    let typeText = switch(type_) {
      case (#BookingRequest) "booking_request";
      case (#BookingConfirmed) "booking_confirmed"; 
      case (#BookingCancelled) "booking_cancelled";
      case (#PaymentReceived) "payment_received";
      case (#ReviewReceived) "review_received";
      case (#MessageReceived) "message_received";
      case (#SystemUpdate) "system_update";
    };
    
    userIdText # "_" # typeText # "_" # timestamp
  };

  // Notification creation helpers for common notification types
  public func createBookingRequestNotification(
    userId: Principal,
    clientName: Text,
    serviceName: Text,
    bookingId: Text
  ) : Types.Notification {
    createNotification(
      userId,
      #BookingRequest,
      "New Booking Request",
      "You have received a new booking request from " # clientName # " for " # serviceName,
      ?bookingId
    )
  };

  public func createBookingConfirmedNotification(
    userId: Principal,
    providerName: Text,
    serviceName: Text,
    bookingId: Text
  ) : Types.Notification {
    createNotification(
      userId,
      #BookingConfirmed,
      "Booking Confirmed",
      "Your booking with " # providerName # " for " # serviceName # " has been confirmed",
      ?bookingId
    )
  };

  public func createBookingCancelledNotification(
    userId: Principal,
    serviceName: Text,
    bookingId: Text,
    reason: Text
  ) : Types.Notification {
    createNotification(
      userId,
      #BookingCancelled,
      "Booking Cancelled",
      "Your booking for " # serviceName # " has been cancelled. Reason: " # reason,
      ?bookingId
    )
  };

  public func createPaymentReceivedNotification(
    userId: Principal,
    amount: Text,
    bookingId: Text
  ) : Types.Notification {
    createNotification(
      userId,
      #PaymentReceived,
      "Payment Received",
      "You have received a payment of " # amount # " for your service",
      ?bookingId
    )
  };

  public func createReviewReceivedNotification(
    userId: Principal,
    reviewerName: Text,
    rating: Text,
    serviceName: Text
  ) : Types.Notification {
    createNotification(
      userId,
      #ReviewReceived,
      "New Review Received",
      reviewerName # " left you a " # rating # "-star review for " # serviceName,
      null
    )
  };

  public func createMessageReceivedNotification(
    userId: Principal,
    senderName: Text,
    conversationId: Text
  ) : Types.Notification {
    createNotification(
      userId,
      #MessageReceived,
      "New Message",
      "You have received a new message from " # senderName,
      ?conversationId
    )
  };

  public func createSystemUpdateNotification(
    userId: Principal,
    updateTitle: Text,
    updateMessage: Text
  ) : Types.Notification {
    createNotification(
      userId,
      #SystemUpdate,
      updateTitle,
      updateMessage,
      null
    )
  };

}
