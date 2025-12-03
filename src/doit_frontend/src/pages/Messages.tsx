import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Send, Phone, Video, MoreVertical, Paperclip, Smile, User, RefreshCw } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface Conversation {
  id: number;
  name: string;
  role: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

interface Message {
  id: number;
  sender: string;
  content: string;
  time: string;
  isOwn: boolean;
}

interface MessagesData {
  [key: number]: Message[];
}

const Messages = () => {
  const navigate = useNavigate();
  const { 
    user, 
    isConnected, 
    isLoading, 
    getUserProfile,
    // Message functions from backend
    createConversation,
    sendMessage: sendBackendMessage,
    getConversations,
    getMessages: getBackendMessages,
    markMessagesAsRead,
    getMessagingStats
  } = useApp();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<MessagesData>({});
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagingStats, setMessagingStats] = useState({
    totalMessages: 0,
    totalConversations: 0,
    activeConversations: 0
  });

  // Load user conversations and messages from backend
  const loadMessagesData = async () => {
    if (!user.isAuthenticated) return;
    
    setMessagesLoading(true);
    try {
      if (isConnected) {
        // Try to load from backend first
        console.log('Loading messages from backend...');
        
        // Get conversations from backend
        const backendConversations = await getConversations();
        console.log('Backend conversations:', backendConversations);
        
        if (backendConversations && backendConversations.length > 0) {
          // Transform backend conversations to frontend format
          const transformedConversations = backendConversations.map((conv: any, index: number) => ({
            id: index + 1,
            name: conv.title || `Conversation ${index + 1}`,
            role: conv.participants?.length > 0 ? 'Participant' : 'Unknown',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.title || 'User')}&size=48&background=f97316&color=fff&rounded=true`,
            lastMessage: 'Conversation started',
            time: new Date(Number(conv.createdAt) / 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unread: 0,
            online: true
          }));
          
          setConversations(transformedConversations);
          
          // Get messaging stats
          const stats = await getMessagingStats();
          if (stats) {
            setMessagingStats({
              totalMessages: stats.totalMessages || 0,
              totalConversations: stats.totalConversations || 0,
              activeConversations: stats.activeConversations || 0
            });
          }
          
          console.log('Successfully loaded backend conversations');
        } else {
          console.log('No conversations found in backend');
          setConversations([]);
          setMessages([]);
        }
      } else {
        console.log('Backend not connected');
        setConversations([]);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load messages from backend:', error);
      setConversations([]);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Removed loadFromLocalStorage - now using backend only

  // Refresh messages data
  const refreshMessages = async () => {
    setRefreshing(true);
    await loadMessagesData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadMessagesData();
  }, [user.isAuthenticated, user.principal, isConnected]);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !user.isAuthenticated) {
      navigate('/signin');
    }
  }, [user.isAuthenticated, isLoading, navigate]);

  // Load messages for a specific conversation
  const loadConversationMessages = async (conversationId: number) => {
    if (!isConnected) {
      console.log('Backend not connected - cannot load messages');
      return;
    }
    
    try {
      console.log(`Loading messages for conversation ${conversationId}...`);
      
      const backendMessages = await getBackendMessages(`conversation_${conversationId}`);
      if (backendMessages && backendMessages.length > 0) {
        // Transform backend messages to frontend format
        const transformedMessages = backendMessages.map((msg: any, index: number) => ({
          id: index + 1,
          sender: msg.senderId?.toString() === user.principal?.toString() ? 'You' : 'Other',
          content: msg.text || 'No content',
          time: new Date(Number(msg.timestamp) / 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOwn: msg.senderId?.toString() === user.principal?.toString()
        }));
        
        setMessages(prev => ({
          ...prev,
          [conversationId]: transformedMessages
        }));
        
        console.log(`Loaded ${transformedMessages.length} messages for conversation ${conversationId}`);
        
        // Mark messages as read
        await markMessagesAsRead(`conversation_${conversationId}`);
      }
    } catch (error) {
      console.error(`Failed to load messages for conversation ${conversationId}:`, error);
    }
  };

  // Handle conversation selection
  const handleConversationSelect = async (conversationId: number) => {
    setSelectedChat(conversationId);
    await loadConversationMessages(conversationId);
  };

  const currentChat = selectedChat ? conversations.find(conv => conv.id === selectedChat) : null;
  const currentMessages = selectedChat ? (messages[selectedChat] || []) : [];

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      if (isConnected) {
        console.log('Sending message via backend...');
        
        // Find the conversation ID (in a real app, this would be the backend conversation ID)
        const selectedConv = conversations.find(conv => conv.id === selectedChat);
        if (selectedConv) {
          // Send message via backend
          await sendBackendMessage(
            `conversation_${selectedChat}`, // conversation ID
            { Text: null }, // message type
            newMessage.trim(),
            [], // attachments
            undefined // reply to message ID
          );
          
          console.log('Message sent via backend');
          
          // Reload messages to get the latest data
          await loadMessagesData();
        }
      } else {
        console.log('Backend not connected, cannot send message');
        throw new Error('Backend not available');
      }
      
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage('');
    }
  };

  // Helper function to start a new conversation
  const startNewConversation = async () => {
    try {
      if (isConnected) {
        console.log('Creating conversation via backend...');
        
        // Create conversation via backend
        await createConversation(
          [user.principal?.toString() || ''], // participants
          { Direct: null }, // conversation type
          'Test Conversation', // title
          undefined // related booking ID
        );
        
        console.log('Conversation created via backend');
        
        // Reload conversations
        await loadMessagesData();
      } else {
        console.log('Backend not connected, creating locally...');
        createConversationLocally();
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      // Fallback to localStorage
      createConversationLocally();
    }
  };

  const createConversationLocally = () => {
    const newConversation: Conversation = {
      id: Date.now(),
      name: 'Test Provider',
      role: 'Service Provider',
      avatar: `https://ui-avatars.com/api/?name=Test+Provider&size=48&background=f97316&color=fff&rounded=true`,
      lastMessage: 'Hello! How can I help you?',
      time: 'now',
      unread: 1,
      online: true
    };

    const updatedConversations = [...conversations, newConversation];
    setConversations(updatedConversations);
    // Conversations now persist in backend automatically
    
    // Add initial message
    const initialMessage: Message = {
      id: 1,
      sender: newConversation.name,
      content: 'Hello! How can I help you today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: false
    };

    const updatedMessages = {
      ...messages,
      [newConversation.id]: [initialMessage]
    };

    setMessages(updatedMessages);
    // Messages now persist in backend automatically
    setSelectedChat(newConversation.id);
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-16">

      {/* Loading State */}
      {(isLoading || messagesLoading) && (
        <div className="flex items-center justify-center h-screen">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <span className="text-white">Loading messages...</span>
          </div>
        </div>
      )}

      {/* Authentication Required */}
      {!isLoading && !user.isAuthenticated && (
        <div className="flex items-center justify-center h-screen">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="bg-gray-800 rounded-xl p-8 max-w-md mx-auto">
              <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">Sign In Required</h2>
              <p className="text-gray-400 mb-6">You need to sign in to access your messages</p>
              <button
                onClick={() => navigate('/signin')}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Sign In
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Authenticated Content */}
      {!isLoading && !messagesLoading && user.isAuthenticated && (
        <div className="flex h-screen">

          {/* Backend Connection Status */}
          {!isConnected && (
            <div className="absolute top-20 left-4 right-4 z-10">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg"
              >
                <div className="flex items-center space-x-2 text-sm">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-yellow-300">Using offline messages only - Real-time chat unavailable</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Conversations Sidebar */}
          <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Messages
                  {isConnected && <span className="ml-2 text-green-400 text-sm">• Live</span>}
                </h2>
                <div className="flex items-center space-x-4">
                  {messagingStats.totalConversations > 0 && (
                    <span className="text-xs text-gray-400">
                      {messagingStats.totalConversations} conversations • {messagingStats.totalMessages} messages
                    </span>
                  )}
                  <button
                    onClick={refreshMessages}
                    disabled={refreshing}
                    className={`p-2 text-gray-400 hover:text-orange-500 transition-colors ${refreshing ? 'animate-spin' : ''}`}
                    title="Refresh messages"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder={user.isAuthenticated ? "Search conversations..." : "Sign in to search..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <User className="w-16 h-16 text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Conversations Yet</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Your conversations will appear here when you start messaging with service providers or clients.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => navigate('/browse')}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      Browse Services
                    </button>
                    <button
                      onClick={startNewConversation}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors ml-2"
                    >
                      Start Test Chat
                    </button>
                  </div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Search className="w-16 h-16 text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Results Found</h3>
                  <p className="text-gray-400 text-sm">
                    Try adjusting your search terms to find conversations.
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => handleConversationSelect(conversation.id)}
                    className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors ${
                      selectedChat === conversation.id ? 'bg-gray-700' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={conversation.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.name)}&size=48&background=f97316&color=fff&rounded=true`} 
                          alt={conversation.name} 
                          className="w-12 h-12 rounded-full object-cover" 
                        />
                        {conversation.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-white truncate">{conversation.name}</h3>
                          <span className="text-xs text-gray-400">{conversation.time}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-400 truncate">{conversation.lastMessage}</p>
                          {conversation.unread > 0 && (
                            <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                              {conversation.unread}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{conversation.role}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {currentChat ? (
              <>
                {/* Chat Header */}
                <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src={currentChat.avatar} alt={currentChat.name} className="w-10 h-10 rounded-full object-cover" />
                      {currentChat.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{currentChat.name}</h3>
                      <p className="text-sm text-gray-400">{currentChat.online ? 'Online' : 'Last seen ' + currentChat.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-orange-500 transition-colors"><Phone className="w-5 h-5" /></button>
                    <button className="p-2 text-gray-400 hover:text-orange-500 transition-colors"><Video className="w-5 h-5" /></button>
                    <button className="p-2 text-gray-400 hover:text-orange-500 transition-colors"><MoreVertical className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {currentMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="bg-gray-700 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <Send className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">Start the Conversation</h3>
                        <p className="text-gray-400 text-sm">
                          Send a message to {currentChat.name} to start your conversation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    currentMessages.map((message: Message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.isOwn ? 'bg-orange-500 text-white' : 'bg-gray-700 text-white'}`}>
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${message.isOwn ? 'text-orange-100' : 'text-gray-400'}`}>{message.time}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="bg-gray-800 border-t border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <button className="p-2 text-gray-400 hover:text-orange-500 transition-colors"><Paperclip className="w-5 h-5" /></button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <button className="p-2 text-gray-400 hover:text-orange-500 transition-colors"><Smile className="w-5 h-5" /></button>
                    <button onClick={sendMessage} className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"><Send className="w-5 h-5" /></button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-gray-800 rounded-full p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <Send className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-3">
                    {conversations.length === 0 ? 'No Messages Yet' : 'Select a Conversation'}
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-md">
                    {conversations.length === 0 
                      ? 'Start connecting with service providers and clients to begin messaging.' 
                      : 'Choose a conversation from the sidebar to start messaging.'
                    }
                  </p>
                  {conversations.length === 0 && (
                    <button
                      onClick={() => navigate('/browse')}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Find Services
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
