import { createContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  User,
  Conversation,
  Message,
  FriendRequest,
  Notification,
  SentFriendRequest
} from '../services/api';
import { markConversationAsReadApi } from '../utils/api';
import {
  fetchConversations as apiFetchConversations,
  fetchUserFriends as apiFetchUserFriends,
  createConversation as apiCreateConversation,
  createGroupConversation as apiCreateGroupConversation,
  fetchChatHistory as apiFetchChatHistory,
  addFriendByEmail as apiAddFriendByEmail,
  fetchFriendRequests as apiFetchFriendRequests,
  fetchSentRequests as apiFetchSentRequests,
  acceptFriendRequest as apiAcceptFriendRequest,
  declineFriendRequest as apiDeclineFriendRequest,
  fetchNotifications as apiFetchNotifications,
  markNotificationsAsRead as apiMarkNotificationsAsRead
} from '../services/api';

export const WS_SERVER_URL = "http://localhost:3001";

interface ChatContextType {
  currentUser: User | null;
  token: string | null;
  currentRoomId: string | null;
  otherUser: User | null;
  conversations: Conversation[];
  users: User[];
  messages: Message[];
  friendRequests: FriendRequest[];
  sentRequests: SentFriendRequest[];
  notifications: Notification[];
  unreadNotifCount: number;
  toasts: Array<{ id: string; title: string; message: string; isError?: boolean }>;
  activeTab: 'feed' | 'conversations' | 'users' | 'requests';
  socketConnected: boolean;
  typingStatusText: string;
  pendingQueue: any[];
  unreadBadges: Record<string, number>;
  socket: Socket | null;

  connectSocket: (userToken: string) => void;
  toggleSocketConnection: () => void;
  sendTypingStatus: (isTyping: boolean) => void;
  submitMessage: (content: string, type?: 'text' | 'image' | 'sticker', mediaUrl?: string) => void;
  logout: () => void;
  selectConversation: (roomId: string, displayName: string, otherUserId: string) => Promise<void>;
  startChatWithUser: (otherUserId: string, otherUsername: string) => Promise<void>;
  createGroupChat: (name: string, memberIds: string[], avatarUrl?: string) => Promise<Conversation | undefined>;
  loadConversations: () => Promise<void>;
  loadUserList: () => Promise<void>;
  addFriend: (email: string) => Promise<string>;
  loadRequests: () => Promise<void>;
  acceptRequest: (senderId: string) => Promise<void>;
  declineRequest: (senderId: string) => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationsRead: (id?: string) => Promise<void>;
  showToast: (title: string, message: string, isError?: boolean) => void;
  dismissToast: (id: string) => void;
  setActiveTab: (tab: 'feed' | 'conversations' | 'users' | 'requests') => void;
  setToken: (token: string | null) => void;
  setCurrentUser: (user: User | null) => void;
  setOtherUser: (user: User | null) => void;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentFriendRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string; isError?: boolean }>>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'conversations' | 'users' | 'requests'>('feed');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [typingStatusText, setTypingStatusText] = useState<string>('');
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [unreadBadges, setUnreadBadges] = useState<Record<string, number>>({});

  const socketRef = useRef<Socket | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const pendingQueueRef = useRef<any[]>([]);
  const isTypingStateRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<any>(null);

  // Synchronize refs to avoid stale closures in socket callbacks
  useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { pendingQueueRef.current = pendingQueue; }, [pendingQueue]);

  // Console log events utility helper for developers
  const logEvent = (type: 'info' | 'incoming' | 'outgoing', title: string, data?: any) => {
    console.log(`[${type.toUpperCase()}] ${title}:`, data || '');
  };

  // Socket Connection Management
  const connectSocket = (userToken: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    logEvent('info', 'SOCKET_CONNECT_INIT', { url: WS_SERVER_URL, token: userToken });

    // Request browser notification permission if not yet decided
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const showNativeNotification = (title: string, options?: NotificationOptions) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, options);
        } catch (err) {
          console.error('Failed to create native notification:', err);
        }
      }
    };

    const socketInstance = io(WS_SERVER_URL, {
      query: { token: userToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setSocketConnected(true);
      logEvent('incoming', 'SOCKET_CONNECTED', { socketId: socketInstance.id });
    });

    socketInstance.on('connect_error', (err) => {
      setSocketConnected(false);
      logEvent('incoming', 'SOCKET_CONNECT_ERROR', err.message);
    });

    socketInstance.on('disconnect', (reason) => {
      setSocketConnected(false);
      logEvent('incoming', 'SOCKET_DISCONNECTED', { reason });
    });

    socketInstance.on('message', (msg: Message) => {
      logEvent('incoming', 'MESSAGE_RECEIVED', msg);

      // Push conversation to top and update previews
      setConversations(prev => {
        const target = prev.find(c => c.id === msg.conversation_id);
        const filtered = prev.filter(c => c.id !== msg.conversation_id);
        if (target) {
          const updated = {
            ...target,
            last_message_content: msg.content,
            last_message: msg.content,
            last_message_type: msg.type || 'text',
            last_message_sender_id: msg.sender_id,
            last_message_sender_username: msg.sender_username,
            last_message_created_at: msg.created_at,
            last_message_time: msg.created_at
          };
          return [updated, ...filtered];
        }
        return prev;
      });

      if (msg.conversation_id === currentRoomIdRef.current) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === msg.id || m.client_message_id === msg.client_message_id);
          if (exists) {
            return prev.map(m => {
              if (m.client_message_id === msg.client_message_id) {
                return { ...msg, status: 'sent' as const };
              }
              return m;
            });
          }
          return [...prev, msg];
        });

        // Send read receipt if we are not the sender
        if (msg.sender_id !== currentUserRef.current?.id) {
          logEvent('outgoing', 'READ_RECEIPT', { conversationId: msg.conversation_id, messageId: msg.id, status: 'seen' });
          markConversationAsReadApi(msg.conversation_id).catch(err => console.error('Failed to mark read', err));

          // Show browser notification if tab is hidden/out of focus
          if (document.hidden) {
            showNativeNotification('New Message', {
              body: msg.content
            });
          }
        }
      } else {
        if (msg.sender_id !== currentUserRef.current?.id) {
          setUnreadBadges(prev => ({
            ...prev,
            [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1
          }));

          const conv = conversationsRef.current.find(c => c.id === msg.conversation_id);
          const senderName = conv ? (conv.is_group ? conv.name : conv.member_usernames[0]) : 'Someone';

          showToast(`${senderName}`, msg.content);
          showNativeNotification(`${senderName}`, {
            body: msg.content
          });
        }
      }
    });

    socketInstance.on('typing', (event) => {
      logEvent('incoming', 'TYPING_EVENT', event);
      if (event.conversation_id === currentRoomIdRef.current && event.user_id !== currentUserRef.current?.id) {
        if (event.is_typing) {
          setTypingStatusText(`${event.username} is typing...`);
        } else {
          setTypingStatusText('');
        }
      }
    });

    socketInstance.on('receipt', (event) => {
      logEvent('incoming', 'RECEIPT_RECEIVED', event);
      if (event.conversation_id === currentRoomIdRef.current) {
        setMessages(prev => prev.map(m => {
          if (event.message_id === 'all') {
            if (m.sender_id !== event.user_id) {
              return { ...m, status: event.status };
            }
          } else if (m.id === event.message_id) {
            return { ...m, status: event.status };
          }
          return m;
        }));
      }
    });

    socketInstance.on('new_conversation', (conv) => {
      logEvent('incoming', 'NEW_CONVERSATION_RECEIVED', conv);
      setConversations(prev => {
        const exists = prev.some(c => c.id === conv.id);
        if (exists) return prev;
        return [conv, ...prev];
      });
    });

    socketInstance.on('friend_request', (data: { senderUsername: string }) => {
      logEvent('incoming', 'FRIEND_REQUEST_RECEIVED', data);
      showToast('New Friend Request', `${data.senderUsername} sent you a friend request.`);
      showNativeNotification('New Friend Request', {
        body: `${data.senderUsername} sent you a friend request.`
      });
      loadRequestsRef.current?.();
    });

    socketInstance.on('friend_accepted', (data: { senderUsername: string }) => {
      logEvent('incoming', 'FRIEND_ACCEPTED_RECEIVED', data);
      showToast('Friend Request Accepted', `${data.senderUsername} accepted your friend request.`);
      showNativeNotification('Friend Request Accepted', {
        body: `${data.senderUsername} accepted your friend request.`
      });
      loadUserListRef.current?.();
      loadConversationsRef.current?.();
    });

    socketInstance.on('profile_updated', (data: { userId: string; username: string; fullName: string | null; avatarUrl: string | null }) => {
      logEvent('incoming', 'PROFILE_UPDATED_RECEIVED', data);

      if (currentUserRef.current && currentUserRef.current.id === data.userId) {
        setCurrentUser(prev => {
          if (prev) {
            const updated = { ...prev, username: data.username, full_name: data.fullName, avatar_url: data.avatarUrl };
            sessionStorage.setItem('chatUser', JSON.stringify(updated));
            return updated;
          }
          return prev;
        });
      }

      setOtherUser(prev => {
        if (prev && prev.id === data.userId) {
          return { ...prev, username: data.username, full_name: data.fullName, avatar_url: data.avatarUrl };
        }
        return prev;
      });

      setConversations(prev => prev.map(c => {
        if (c.member_ids.includes(data.userId)) {
          const index = c.member_ids.indexOf(data.userId);
          const usernamesCopy = [...c.member_usernames];
          usernamesCopy[index] = data.username;
          
          let avatarUrlsCopy = c.member_avatar_urls ? [...c.member_avatar_urls] : [];
          if (avatarUrlsCopy.length > 0) {
            avatarUrlsCopy[index] = data.avatarUrl || '';
          }
          
          let fullNamesCopy = c.member_full_names ? [...c.member_full_names] : [];
          if (fullNamesCopy.length > 0) {
            fullNamesCopy[index] = data.fullName || '';
          }

          return { 
            ...c, 
            member_usernames: usernamesCopy,
            member_avatar_urls: avatarUrlsCopy,
            member_full_names: fullNamesCopy
          };
        }
        return c;
      }));

      setUsers(prev => prev.map(u => {
        if (u.id === data.userId) {
          return { ...u, username: data.username, full_name: data.fullName, avatar_url: data.avatarUrl };
        }
        return u;
      }));

      setMessages(prev => prev.map(m => {
        if (m.sender_id === data.userId) {
          return { ...m, sender_username: data.username, sender_avatar_url: data.avatarUrl, sender_full_name: data.fullName };
        }
        return m;
      }));
    });

    socketInstance.on('notification', (notif: Notification) => {
      logEvent('incoming', 'NOTIFICATION_RECEIVED', notif);
      
      const actorName = notif.actor_full_name || notif.actor_username;
      let text = '';
      if (notif.type === 'like') {
        text = `${actorName} liked your post.`;
      } else if (notif.type === 'comment') {
        text = `${actorName} commented on your post.`;
      } else if (notif.type === 'follow') {
        text = `${actorName} started following you.`;
      } else if (notif.type === 'friend_request') {
        text = `${actorName} sent you a friend request.`;
      } else if (notif.type === 'friend_accept') {
        text = `${actorName} accepted your friend request.`;
      }

      showToast('Notification', text);
      showNativeNotification('New Notification', { body: text });

      setNotifications(prev => {
        const exists = prev.some(n => n.id === notif.id);
        if (exists) return prev;
        return [notif, ...prev];
      });
      setUnreadNotifCount(prev => prev + 1);
    });
  };

  const toggleSocketConnection = () => {
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) {
      logEvent('info', 'MANUAL_DISCONNECT', 'Client disconnect triggered.');
      socket.disconnect();
    } else {
      logEvent('info', 'MANUAL_CONNECT', 'Client reconnect triggered.');
      socket.connect();
    }
  };

  useEffect(() => {
    if (token && currentUser) {
      loadConversations();
      loadUserList();
      loadRequests();
      loadNotifications();
    }
  }, [token, currentUser]);

  // Re-flush buffered retry queue when connectivity status turns online
  useEffect(() => {
    if (socketConnected && pendingQueue.length > 0 && socketRef.current) {
      const socket = socketRef.current;
      logEvent('info', 'RETRY_QUEUE_FLUSH', `Flushing ${pendingQueue.length} offline buffered messages...`);

      const queue = [...pendingQueue];
      setPendingQueue([]);

      queue.forEach(msgPayload => {
        logEvent('outgoing', 'RETRY_SEND_MESSAGE', msgPayload);
        socket.emit('send_message', msgPayload, (ack: any) => {
          logEvent('incoming', 'RETRY_MESSAGE_ACK', ack);
          if (ack && ack.status === 'sent') {
            setMessages(prev => prev.map(m => {
              if (m.client_message_id === msgPayload.clientMessageId) {
                return { ...m, id: ack.id, status: 'sent' as const };
              }
              return m;
            }));
          }
        });
      });
    }
  }, [socketConnected]);

  const sendTypingStatus = (isTyping: boolean) => {
    if (isTypingStateRef.current === isTyping) return;
    isTypingStateRef.current = isTyping;

    const socket = socketRef.current;
    if (socket && socket.connected && currentRoomId) {
      const eventName = isTyping ? 'typing_start' : 'typing_stop';
      logEvent('outgoing', eventName, { conversationId: currentRoomId });
      socket.emit(eventName, { conversationId: currentRoomId });
    }
  };

  // Submitting direct message
  const submitMessage = (content: string, type: 'text' | 'image' | 'sticker' = 'text', mediaUrl?: string) => {
    if (!currentRoomId || !currentUser) return;

    const clientMessageId = crypto.randomUUID();
    const msgPayload = {
      conversationId: currentRoomId,
      clientMessageId: clientMessageId,
      content: content,
      type,
      mediaUrl
    };

    sendTypingStatus(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const localMsg: Message = {
      id: clientMessageId,
      conversation_id: currentRoomId,
      sender_id: currentUser.id,
      content: content,
      created_at: new Date().toISOString(),
      status: 'pending' as const,
      client_message_id: clientMessageId,
      type,
      media_url: mediaUrl
    };

    setMessages(prev => [...prev, localMsg]);

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      logEvent('outgoing', 'OFFLINE_BUFFERED_MESSAGE', msgPayload);
      setPendingQueue(prev => [...prev, msgPayload]);
      return;
    }

    logEvent('outgoing', 'SEND_MESSAGE', msgPayload);
    socket.emit('send_message', msgPayload, (ack: any) => {
      logEvent('incoming', 'MESSAGE_ACK', ack);
      if (ack && ack.status === 'sent') {
        setMessages(prev => prev.map(m => {
          if (m.client_message_id === clientMessageId) {
            return { ...m, id: ack.id, status: 'sent' as const };
          }
          return m;
        }));
      }
    });
  };

  // Load active chats
  const loadConversations = async () => {
    if (!token) return;
    try {
      const convList = await apiFetchConversations(token);
      setConversations(convList);
    } catch (err: any) {
      logEvent('info', 'LOAD_CONVERSATIONS_FAILED', err.message);
    }
  };

  // Load user directory
  const loadUserList = async () => {
    if (!token || !currentUserRef.current) return;
    try {
      const userList = await apiFetchUserFriends(token, currentUserRef.current.id);
      const formattedUsers: User[] = userList.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email || '',
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        bio: u.bio
      }));
      setUsers(formattedUsers);
    } catch (err: any) {
      logEvent('info', 'LOAD_USERS_FAILED', err.message);
    }
  };

  const addFriend = async (email: string): Promise<string> => {
    if (!token) throw new Error("Authentication token missing");
    try {
      const result = await apiAddFriendByEmail(token, email);
      await loadUserList(); // refresh the users list
      await loadRequests(); // refresh friend requests (including sent)
      return result.message;
    } catch (err: any) {
      logEvent('info', 'ADD_FRIEND_FAILED', err.message);
      throw err;
    }
  };

  const loadRequests = async () => {
    if (!token) return;
    try {
      const [receivedList, sentList] = await Promise.all([
        apiFetchFriendRequests(token),
        apiFetchSentRequests(token)
      ]);
      setFriendRequests(receivedList);
      setSentRequests(sentList);
    } catch (err: any) {
      logEvent('info', 'LOAD_REQUESTS_FAILED', err.message);
    }
  };

  const acceptRequest = async (senderId: string) => {
    if (!token) return;
    try {
      await apiAcceptFriendRequest(token, senderId);
      await loadRequests();
      await loadUserList();
    } catch (err: any) {
      logEvent('info', 'ACCEPT_REQUEST_FAILED', err.message);
    }
  };

  const declineRequest = async (senderId: string) => {
    if (!token) return;
    try {
      await apiDeclineFriendRequest(token, senderId);
      await loadRequests();
    } catch (err: any) {
      logEvent('info', 'DECLINE_REQUEST_FAILED', err.message);
    }
  };

  const loadNotifications = async () => {
    if (!token) return;
    try {
      const data = await apiFetchNotifications(token);
      setNotifications(data);
      const unread = data.filter(n => !n.is_read).length;
      setUnreadNotifCount(unread);
    } catch (err: any) {
      logEvent('info', 'LOAD_NOTIFICATIONS_FAILED', err.message);
    }
  };

  const markNotificationsRead = async (id?: string) => {
    if (!token) return;
    try {
      await apiMarkNotificationsAsRead(token, id);
      if (id) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadNotifCount(prev => Math.max(0, prev - 1));
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadNotifCount(0);
      }
    } catch (err: any) {
      logEvent('info', 'MARK_NOTIFICATIONS_READ_FAILED', err.message);
    }
  };

  // Synchronize refs to avoid stale closures in socket callbacks
  const conversationsRef = useRef<Conversation[]>([]);
  const loadRequestsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const loadUserListRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const loadConversationsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const loadNotificationsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { loadRequestsRef.current = loadRequests; }, [loadRequests]);
  useEffect(() => { loadUserListRef.current = loadUserList; }, [loadUserList]);
  useEffect(() => { loadConversationsRef.current = loadConversations; }, [loadConversations]);
  useEffect(() => { loadNotificationsRef.current = loadNotifications; }, [loadNotifications]);

  const selectConversation = async (roomId: string, displayName: string, otherUserId: string) => {
    if (!token) return;
    setCurrentRoomId(roomId);
    setOtherUser({ id: otherUserId, username: displayName, email: '' });
    setTypingStatusText('');

    // Clear unread badges
    setUnreadBadges(prev => {
      const copy = { ...prev };
      delete copy[roomId];
      return copy;
    });

    setMessages([]);
    logEvent('info', 'HISTORY_SYNC_INIT', { roomId });

    try {
      const history = await apiFetchChatHistory(token, roomId);
      setMessages(history);

      // Call bulk read endpoint
      markConversationAsReadApi(roomId).catch(err => console.error('Failed to mark conversation as read', err));
    } catch (err: any) {
      logEvent('info', 'HISTORY_SYNC_FAILED', 'Failed to load historical database logs. Operating in transient memory-only channel mode.');
    }
  };

  const startChatWithUser = async (otherUserId: string, otherUsername: string) => {
    if (!token) return;
    logEvent('info', 'START_CHAT_INIT', { otherUserId, otherUsername });
    try {
      const conversation = await apiCreateConversation(token, otherUserId);
      setCurrentRoomId(conversation.id);
      setOtherUser({ id: otherUserId, username: otherUsername, email: '' });
      setActiveTab('conversations');
      await loadConversations();
    } catch (err: any) {
      logEvent('info', 'START_CHAT_FAILED', err.message);
    }
  };

  const createGroupChat = async (name: string, memberIds: string[], avatarUrl?: string) => {
    if (!token) return;
    logEvent('info', 'CREATE_GROUP_INIT', { name, memberIds, avatarUrl });
    try {
      const conversation = await apiCreateGroupConversation(token, name, memberIds, avatarUrl);
      setCurrentRoomId(conversation.id);
      setOtherUser(null);
      setActiveTab('conversations');
      await loadConversations();
      return conversation;
    } catch (err: any) {
      logEvent('info', 'CREATE_GROUP_FAILED', err.message);
      showToast('Error', err.message || 'Failed to create group chat', true);
    }
  };

  const showToast = (title: string, message: string, isError: boolean = false) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, message, isError }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Logout Flow
  const logout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    sessionStorage.removeItem('chatToken');
    sessionStorage.removeItem('chatUser');

    logEvent('info', 'LOGOUT', 'User logged out.');

    setCurrentUser(null);
    setToken(null);
    setCurrentRoomId(null);
    setOtherUser(null);
    setConversations([]);
    setUsers([]);
    setMessages([]);
    setFriendRequests([]);
    setSentRequests([]);
    setSocketConnected(false);
    setTypingStatusText('');
    setPendingQueue([]);
    setUnreadBadges({});
  };

  return (
    <ChatContext.Provider value={{
      currentUser,
      token,
      currentRoomId,
      otherUser,
      conversations,
      users,
      messages,
      friendRequests,
      sentRequests,
      notifications,
      unreadNotifCount,
      toasts,
      activeTab,
      socketConnected,
      typingStatusText,
      pendingQueue,
      unreadBadges,
      socket: socketRef.current,

      connectSocket,
      toggleSocketConnection,
      sendTypingStatus,
      submitMessage,
      logout,
      selectConversation,
      startChatWithUser,
      createGroupChat,
      loadConversations,
      loadUserList,
      addFriend,
      loadRequests,
      acceptRequest,
      declineRequest,
      loadNotifications,
      markNotificationsRead,
      showToast,
      dismissToast,
      setActiveTab,
      setToken,
      setCurrentUser,
      setOtherUser
    }}>
      {children}
    </ChatContext.Provider>
  );
}
