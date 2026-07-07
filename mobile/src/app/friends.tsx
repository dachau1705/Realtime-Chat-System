import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getData, postData } from '../services/api';

type TabType = 'all' | 'requests' | 'suggestions';

export default function FriendsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  const [emailInput, setEmailInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState<string | null>(null); // tracks loading on accept/decline/add

  const loadData = async () => {
    try {
      if (activeTab === 'all') {
        const res = await getData(`/users/${user?.id}/friends`);
        setFriends(res.data || []);
      } else if (activeTab === 'requests') {
        const res = await getData('/friends/requests');
        setRequests(res.data || []);
      } else if (activeTab === 'suggestions') {
        const res = await getData('/friends/suggestions');
        setSuggestions(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load friends tab data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [activeTab]);

  const handleSendRequest = async () => {
    if (!emailInput.trim()) return;
    const email = emailInput.trim();
    setEmailInput('');
    try {
      const res = await postData('/friends', { email });
      Alert.alert('Success', res.data.message || 'Friend request sent!');
      if (activeTab === 'suggestions') {
        loadData();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send request.';
      Alert.alert('Error', msg);
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    setBtnLoading(senderId);
    try {
      await postData('/friends/accept', { senderId });
      setRequests((prev) => prev.filter((r) => r.sender_id !== senderId));
      Alert.alert('Success', 'Friend request accepted.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to accept request.');
    } finally {
      setBtnLoading(null);
    }
  };

  const handleDeclineRequest = async (senderId: string) => {
    setBtnLoading(senderId);
    try {
      await postData('/friends/decline', { senderId });
      setRequests((prev) => prev.filter((r) => r.sender_id !== senderId));
      Alert.alert('Success', 'Friend request declined.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to decline request.');
    } finally {
      setBtnLoading(null);
    }
  };

  const handleAddFromSuggestions = async (targetUserEmail: string, targetUserId: string) => {
    setBtnLoading(targetUserId);
    try {
      await postData('/friends', { email: targetUserEmail });
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
      Alert.alert('Sent', 'Friend request successfully sent!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send request.');
    } finally {
      setBtnLoading(null);
    }
  };

  const getAvatar = (seed: string) => {
    return `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}`;
  };

  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === 'all') {
      const friendUser = item.user_id_1 === user?.id ? item.user_2 : item.user_1;
      const username = friendUser?.username || 'User';
      return (
        <View style={styles.friendRow}>
          <Image source={{ uri: getAvatar(username) }} style={styles.avatar as any} />
          <Text style={styles.username}>{username}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Friend</Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'requests') {
      const username = item.sender_username || 'User';
      const senderId = item.sender_id;
      return (
        <View style={styles.requestRow}>
          <Image source={{ uri: getAvatar(username) }} style={styles.avatar as any} />
          <View style={styles.requestMeta}>
            <Text style={styles.username}>{username}</Text>
            <Text style={styles.requestSub}>Sent you a friend request</Text>
          </View>
          <View style={styles.requestActions}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.acceptBtn]} 
              onPress={() => handleAcceptRequest(senderId)}
              disabled={btnLoading === senderId}
            >
              {btnLoading === senderId ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Accept</Text>}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.declineBtn]} 
              onPress={() => handleDeclineRequest(senderId)}
              disabled={btnLoading === senderId}
            >
              <Text style={styles.btnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTab === 'suggestions') {
      const username = item.username || 'User';
      return (
        <View style={styles.friendRow}>
          <Image source={{ uri: getAvatar(username) }} style={styles.avatar as any} />
          <View style={styles.requestMeta}>
            <Text style={styles.username}>{username}</Text>
            <Text style={styles.requestSub}>{item.mutual_friends_count || 0} mutual friends</Text>
          </View>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.acceptBtn]} 
            onPress={() => handleAddFromSuggestions(item.email, item.id)}
            disabled={btnLoading === item.id}
          >
            {btnLoading === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Add</Text>}
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      {/* Segment Selector Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabLabel, activeTab === 'all' && styles.activeTabLabel]}>All Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabLabel, activeTab === 'requests' && styles.activeTabLabel]}>
            Requests {requests.length > 0 ? `(${requests.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Text style={[styles.tabLabel, activeTab === 'suggestions' && styles.activeTabLabel]}>Suggestions</Text>
        </TouchableOpacity>
      </View>

      {/* Add Friend Input (email search) */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Add friend by email address..."
          placeholderTextColor="#94a3b8"
          value={emailInput}
          onChangeText={setEmailInput}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSendRequest}>
          <Text style={styles.searchBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'all' ? friends : activeTab === 'requests' ? requests : suggestions}
          keyExtractor={(item, idx) => item.id || idx.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'all' 
                  ? 'No friends yet.' 
                  : activeTab === 'requests' 
                    ? 'No pending requests.' 
                    : 'No suggestions available.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderColor: '#3b82f6',
  },
  tabLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#3b82f6',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginLeft: 12,
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContainer: {
    paddingVertical: 8,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
  },
  username: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 16,
  },
  badge: {
    backgroundColor: '#334155',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
  },
  requestMeta: {
    flex: 1,
    marginLeft: 16,
  },
  requestSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#3b82f6',
  },
  declineBtn: {
    backgroundColor: '#ef4444',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 12,
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
});
