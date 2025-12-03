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

module MessagesModule {

  public func createConversation(
    callerId: Principal,
    participants: [Principal],
    title: ?Text,
    conversationType: Types.ConversationType,
    relatedBookingId: ?Text,
    nextConversationId: Nat,
    conversations: HashMap.HashMap<Text, Types.Conversation>,
    messageThreads: HashMap.HashMap<Text, Types.MessageThread>
  ) : Result.Result<(Types.Conversation, Nat), Text> {

    let isParticipant = Array.find<Principal>(participants, func(p) { p == callerId });
    switch(isParticipant) {
      case null { return #err("Caller must be a participant in the conversation") };
      case (?_) { /* continue */ };
    };
    
    let conversationId = "conv_" # Int.toText(nextConversationId);
    let newNextConversationId = nextConversationId + 1;
    
    let newConversation : Types.Conversation = {
      version = 1;
      id = conversationId;
      participants = participants;
      title = title;
      createdAt = Time.now();
      lastMessageAt = Time.now();
      lastMessage = null;
      unreadCount = Array.map<Principal, (Principal, Int)>(participants, func(p) { (p, 0) });
      isArchived = false;
      relatedBookingId = relatedBookingId;
      conversationType = conversationType;
    };
    
    conversations.put(conversationId, newConversation);

    let messageThread : Types.MessageThread = {
      conversationId = conversationId;
      messages = [];
      totalMessages = 0;
      participants = Array.map<Principal, Types.MessageParticipant>(
        participants, 
        func(p) {
          {
            userId = p;
            userName = "User";
            userType = #Client;
            profileImage = null;
            isOnline = false;
            lastSeenAt = Time.now();
            joinedAt = Time.now();
            role = #Member;
          }
        }
      );
    };
    
    messageThreads.put(conversationId, messageThread);
    
    #ok((newConversation, newNextConversationId))
  };

  public func sendMessage(
    callerId: Principal,
    conversationId: Text,
    messageType: Types.MessageType,
    text: Text,
    attachments: ?[Types.MessageAttachment],
    replyToMessageId: ?Text,
    nextMessageId: Nat,
    conversations: HashMap.HashMap<Text, Types.Conversation>,
    messages: HashMap.HashMap<Text, Types.Message>,
    messageThreads: HashMap.HashMap<Text, Types.MessageThread>
  ) : Result.Result<(Types.Message, Nat), Text> {

    switch (conversations.get(conversationId)) {
      case (?conversation) {
        let isParticipant = Array.find<Principal>(conversation.participants, func(p) { p == callerId });
        switch(isParticipant) {
          case null { return #err("Not authorized to send messages in this conversation") };
          case (?_) { /* continue */ };
        };
      };
      case null { return #err("Conversation not found") };
    };
    
    let messageId = "msg_" # Int.toText(nextMessageId);
    let newNextMessageId = nextMessageId + 1;

    let receiver = switch (conversations.get(conversationId)) {
      case (?conv) {
        if (conv.participants.size() == 2) {
          Array.find<Principal>(conv.participants, func(p) { p != callerId })
        } else {
          null
        }
      };
      case null { null };
    };
    
    let newMessage : Types.Message = {
      version = 1;
      id = messageId;
      sender = callerId;
      receiver = Option.get(receiver, callerId);
      conversationId = conversationId;
      messageType = messageType;
      text = text;
      attachments = attachments;
      relatedBookingId = null;
      timestamp = Time.now();
      status = #Sent;
      editedAt = null;
      isEdited = false;
      replyToMessageId = replyToMessageId;
    };
    
    messages.put(messageId, newMessage);

    switch (conversations.get(conversationId)) {
      case (?conversation) {
        let updatedConversation : Types.Conversation = {
          version = conversation.version + 1;
          id = conversation.id;
          participants = conversation.participants;
          title = conversation.title;
          createdAt = conversation.createdAt;
          lastMessageAt = Time.now();
          lastMessage = ?text;
          unreadCount = Array.map<(Principal, Int), (Principal, Int)>(
            conversation.unreadCount,
            func((userId, count)) {
              if (userId != callerId) {
                (userId, count + 1)
              } else {
                (userId, count)
              }
            }
          );
          isArchived = conversation.isArchived;
          relatedBookingId = conversation.relatedBookingId;
          conversationType = conversation.conversationType;
        };
        conversations.put(conversationId, updatedConversation);
      };
      case null { /* should not happen */ };
    };

    switch (messageThreads.get(conversationId)) {
      case (?thread) {
        let updatedThread : Types.MessageThread = {
          conversationId = thread.conversationId;
          messages = Array.append(thread.messages, [newMessage]);
          totalMessages = thread.totalMessages + 1;
          participants = thread.participants;
        };
        messageThreads.put(conversationId, updatedThread);
      };
      case null { /* should not happen */ };
    };
    
    #ok((newMessage, newNextMessageId))
  };

  public func getConversations(callerId: Principal, conversations: HashMap.HashMap<Text, Types.Conversation>) : Result.Result<[Types.ConversationSummary], Text> {
    let userConversations = Buffer.Buffer<Types.ConversationSummary>(10);
    
    for ((_, conversation) in conversations.entries()) {
      let isParticipant = Array.find<Principal>(conversation.participants, func(p) { p == callerId });
      switch(isParticipant) {
        case (?_) {

          let unreadCount = switch (Array.find<(Principal, Int)>(conversation.unreadCount, func((p, _)) { p == callerId })) {
            case (?(_, count)) { count };
            case null { 0 };
          };

          let otherParticipant = if (conversation.participants.size() == 2) {
            switch (Array.find<Principal>(conversation.participants, func(p) { p != callerId })) {
              case (?otherId) {
                {
                  userId = otherId;
                  userName = "User";
                  userType = #Client;
                  profileImage = null;
                  isOnline = false;
                  lastSeenAt = Time.now();
                  joinedAt = Time.now();
                  role = #Member;
                }
              };
              case null {
                {
                  userId = callerId;
                  userName = "Unknown";
                  userType = #Client;
                  profileImage = null;
                  isOnline = false;
                  lastSeenAt = Time.now();
                  joinedAt = Time.now();
                  role = #Member;
                }
              };
            }
          } else {
            {
              userId = callerId;
              userName = "Group Chat";
              userType = #Client;
              profileImage = null;
              isOnline = false;
              lastSeenAt = Time.now();
              joinedAt = Time.now();
              role = #Member;
            }
          };
          
          let summary : Types.ConversationSummary = {
            version = 1;
            id = conversation.id;
            title = Option.get(conversation.title, "Direct Message");
            lastMessage = Option.get(conversation.lastMessage, "No messages yet");
            lastMessageAt = conversation.lastMessageAt;
            unreadCount = unreadCount;
            otherParticipant = otherParticipant;
            isOnline = false;
            conversationType = conversation.conversationType;
          };
          
          userConversations.add(summary);
        };
        case null { /* not a participant */ };
      };
    };
    
    #ok(Buffer.toArray(userConversations))
  };

  public func getMessages(callerId: Principal, conversationId: Text, limit: ?Nat, offset: ?Nat, conversations: HashMap.HashMap<Text, Types.Conversation>, messageThreads: HashMap.HashMap<Text, Types.MessageThread>) : Result.Result<[Types.Message], Text> {

    switch (conversations.get(conversationId)) {
      case (?conversation) {
        let isParticipant = Array.find<Principal>(conversation.participants, func(p) { p == callerId });
        switch(isParticipant) {
          case null { return #err("Not authorized to view this conversation") };
          case (?_) { /* continue */ };
        };
      };
      case null { return #err("Conversation not found") };
    };
    
    switch (messageThreads.get(conversationId)) {
      case (?thread) {
        let allMessages = thread.messages;
        let startIndex = Option.get(offset, 0);
        let maxLimit = Option.get(limit, allMessages.size());
        
        if (startIndex >= allMessages.size()) {
          return #ok([]);
        };
        
        let endIndex = Int.min(startIndex + maxLimit, allMessages.size());
        if (endIndex <= startIndex) {
          return #ok([]);
        };
        
        let requestedMessages = Array.tabulate<Types.Message>(
          Int.abs(endIndex - startIndex),
          func(i) { allMessages[startIndex + i] }
        );
        
        #ok(requestedMessages)
      };
      case null { #err("Message thread not found") };
    }
  };

  public func markMessagesAsRead(callerId: Principal, conversationId: Text, conversations: HashMap.HashMap<Text, Types.Conversation>) : Result.Result<Bool, Text> {

    switch (conversations.get(conversationId)) {
      case (?conversation) {
        let isParticipant = Array.find<Principal>(conversation.participants, func(p) { p == callerId });
        switch(isParticipant) {
          case null { return #err("Not authorized") };
          case (?_) { /* continue */ };
        };

        let updatedConversation : Types.Conversation = {
          version = conversation.version + 1;
          id = conversation.id;
          participants = conversation.participants;
          title = conversation.title;
          createdAt = conversation.createdAt;
          lastMessageAt = conversation.lastMessageAt;
          lastMessage = conversation.lastMessage;
          unreadCount = Array.map<(Principal, Int), (Principal, Int)>(
            conversation.unreadCount,
            func((userId, count)) {
              if (userId == callerId) {
                (userId, 0)
              } else {
                (userId, count)
              }
            }
          );
          isArchived = conversation.isArchived;
          relatedBookingId = conversation.relatedBookingId;
          conversationType = conversation.conversationType;
        };
        
        conversations.put(conversationId, updatedConversation);
        #ok(true)
      };
      case null { #err("Conversation not found") };
    }
  };

  public func blockUser(callerId: Principal, userToBlock: Principal, reason: ?Text, blockedUsers: HashMap.HashMap<Principal, [Types.BlockedUser]>) : Result.Result<Bool, Text> {
    
    if (callerId == userToBlock) {
      return #err("Cannot block yourself");
    };
    
    let blockEntry : Types.BlockedUser = {
      blockerId = callerId;
      blockedUserId = userToBlock;
      reason = reason;
      blockedAt = Time.now();
      isActive = true;
    };
    
    switch (blockedUsers.get(callerId)) {
      case (?existingBlocks) {
        let filteredBlocks = Array.filter<Types.BlockedUser>(
          existingBlocks,
          func(b) { b.blockedUserId != userToBlock }
        );
        let updatedBlocks = Array.append(filteredBlocks, [blockEntry]);
        blockedUsers.put(callerId, updatedBlocks);
      };
      case null {
        blockedUsers.put(callerId, [blockEntry]);
      };
    };
    
    #ok(true)
  };

  public func unblockUser(callerId: Principal, userToUnblock: Principal, blockedUsers: HashMap.HashMap<Principal, [Types.BlockedUser]>) : Result.Result<Bool, Text> {
    
    switch (blockedUsers.get(callerId)) {
      case (?existingBlocks) {
        let updatedBlocks = Array.map<Types.BlockedUser, Types.BlockedUser>(
          existingBlocks,
          func(b) {
            if (b.blockedUserId == userToUnblock) {
              {
                blockerId = b.blockerId;
                blockedUserId = b.blockedUserId;
                reason = b.reason;
                blockedAt = b.blockedAt;
                isActive = false;
              }
            } else {
              b
            }
          }
        );
        blockedUsers.put(callerId, updatedBlocks);
        #ok(true)
      };
      case null { #err("No blocks found") };
    }
  };

  public func saveDraft(
    callerId: Principal,
    conversationId: Text,
    draftText: Text,
    replyToMessageId: ?Text,
    messageDrafts: HashMap.HashMap<Text, Types.MessageDraft>
  ) : Result.Result<Bool, Text> {
    let draftKey = conversationId # "_" # Principal.toText(callerId);
    
    let draft : Types.MessageDraft = {
      conversationId = conversationId;
      userId = callerId;
      draftText = draftText;
      savedAt = Time.now();
      replyToMessageId = replyToMessageId;
    };
    
    messageDrafts.put(draftKey, draft);
    #ok(true)
  };

  public func getDraft(callerId: Principal, conversationId: Text, messageDrafts: HashMap.HashMap<Text, Types.MessageDraft>) : ?Types.MessageDraft {
    let draftKey = conversationId # "_" # Principal.toText(callerId);
    
    messageDrafts.get(draftKey)
  };

  public func clearDraft(callerId: Principal, conversationId: Text, messageDrafts: HashMap.HashMap<Text, Types.MessageDraft>) : Bool {
    let draftKey = conversationId # "_" # Principal.toText(callerId);
    
    messageDrafts.delete(draftKey);
    true
  };
  
  public func getSystemStats(messages: HashMap.HashMap<Text, Types.Message>, conversations: HashMap.HashMap<Text, Types.Conversation>) : {
    totalMessages: Nat;
    totalConversations: Nat;
    activeConversations: Nat;
  } {
    var activeCount = 0;
    for ((_, conversation) in conversations.entries()) {
      if (not conversation.isArchived) {
        activeCount += 1;
      };
    };
    
    {
      totalMessages = messages.size();
      totalConversations = conversations.size();
      activeConversations = activeCount;
    }
  };

}
