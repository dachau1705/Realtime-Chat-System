import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getSocket, connectSocket } from '../services/socket';
import { getData, postData } from '../services/api';

export default function ChatsScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active Chat Room state
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchConversations = async () => {
    try {
      const res = await getData('/conversations');
      setConversations(res.data || []);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    connectSocket();

    // Listen for incoming realtime messages
    let socketInstance: any;
    getSocket().then((s) => {
      socketInstance = s;
      
      s.on('message', (msg: any) => {
        // If message is in the active chat room, append it
        if (activeChat && msg.conversation_id === activeChat.id) {
          setMessages((prev) => [...prev, msg]);
          // Mark as seen
          s.emit('receipt', {
            message_id: msg.id,
            user_id: user?.id,
            status: 'seen'
          });
        }
        
        // Update last message in the conversations list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversation_id
              ? { ...c, last_message: msg.content, last_message_time: msg.created_at }
              : c
          )
        );
      });
    });

    return () => {
      if (socketInstance) {
        socketInstance.off('message');
      }
    };
  }, [activeChat, user]);

  const handleSelectChat = async (conversation: any) => {
    setActiveChat(conversation);
    setMessages([]);
    setLoadingMessages(true);
    try {
      const res = await getData(`/conversations/${conversation.id}/messages`, { limit: 50 });
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load chat messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!text.trim() || !activeChat) return;
    const content = text.trim();
    setText('');

    try {
      const socketInstance = await getSocket();
      
      // Send message via HTTP post
      const res = await postData(`/conversations/${activeChat.id}/messages`, { content });
      const savedMsg = res.data;

      // Append locally
      setMessages((prev) => [...prev, savedMsg]);

      // Emit to WebSocket for real-time distribution
      socketInstance.emit('message', {
        id: savedMsg.id,
        conversation_id: activeChat.id,
        content,
        sender_id: user?.id,
        sender_username: user?.username,
        created_at: new Date().toISOString()
      });

      // Update last message in conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, last_message: content, last_message_time: new Date().toISOString() }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const getAvatar = (seed: string) => {
    return `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // --- RENDER CONVERSATION LIST (INBOX) ---
  if (!activeChat) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const partnerName = item.is_group 
              ? item.name 
              : item.participants?.find((p: any) => p.user_id !== user?.id)?.username || 'Direct Chat';
            return (
              <TouchableOpacity style={styles.chatRow} onPress={() => handleSelectChat(item)}>
                <Image source={{ uri: getAvatar(partnerName) }} style={styles.avatar as any} />
                <View style={styles.chatMeta}>
                  <Text style={styles.partnerName}>{partnerName}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.last_message || 'No messages yet'}
                  </Text>
                </View>
                {item.unread_count > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No active conversations yet.</Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  // --- RENDER CHAT ROOM OVERLAY ---
  const activeChatPartnerName = activeChat.is_group 
    ? activeChat.name 
    : activeChat.participants?.find((p: any) => p.user_id !== user?.id)?.username || 'Chat';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.roomHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveChat(null)}>
          <Text style={styles.backBtnText}>◀ Back</Text>
        </TouchableOpacity>
        <Text style={styles.roomTitle}>{activeChatPartnerName}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loadingMessages ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, idx) => item.id || idx.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.sender_id === user?.id;
            return (
              <View style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePartner]}>
                  <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextPartner]}>
                    {item.content}
                  </Text>
                </View>
                <Text style={styles.bubbleTime}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
            <Text style={styles.sendBtnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  listContainer: {
    paddingVertical: 8,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
  },
  chatMeta: {
    flex: 1,
    marginLeft: 16,
  },
  partnerName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lastMessage: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  unreadBadge: {
    backgroundColor: '#3b82f6',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backBtnText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: 'bold',
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  messagesList: {
    padding: 16,
  },
  bubbleWrapper: {
    marginBottom: 12,
    maxWidth: '75%',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubblePartner: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextPartner: {
    color: '#cbd5e1',
  },
  bubbleTextMe: {
    color: '#ffffff',
    fontWeight: '500',
  },
  bubbleTime: {
    color: '#475569',
    fontSize: 10,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 8,
  },
  sendBtnText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
