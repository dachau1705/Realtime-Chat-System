import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { getData, postData } from '../services/api';
import { API_URL } from '../services/config';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null); // 'avatar' or 'cover'

  const fetchProfileAndPosts = async () => {
    try {
      const [profileRes, postsRes] = await Promise.all([
        getData(`/users/${user?.id}`),
        getData(`/users/${user?.id}/posts`)
      ]);
      setProfile(profileRes.data || null);
      setPosts(postsRes.data || []);
      
      // Update global user context just in case avatar changed
      if (profileRes.data) {
        updateUser({
          avatar_url: profileRes.data.avatar_url,
          cover_url: profileRes.data.cover_url
        });
      }
    } catch (err) {
      console.error('Failed to load profile data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchProfileAndPosts();
    }
  }, [user?.id]);

  const selectAndUploadImage = async (type: 'avatar' | 'cover') => {
    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please grant photo access in system settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [8, 3],
      quality: 0.8
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const selectedUri = result.assets[0].uri;
    
    // Create multipart form payload
    const formData = new FormData();
    formData.append('file', {
      uri: selectedUri,
      name: `upload_${type}.jpg`,
      type: 'image/jpeg'
    } as any);

    setUploading(type);
    try {
      const endpoint = type === 'avatar' ? '/upload/avatar' : '/upload/cover';
      const res = await postData(endpoint, formData);
      
      Alert.alert('Success', `${type === 'avatar' ? 'Avatar' : 'Cover'} updated successfully!`);
      
      // Update local profile view
      setProfile((prev: any) => ({
        ...prev,
        [type === 'avatar' ? 'avatar_url' : 'cover_url']: res.data[type === 'avatar' ? 'avatarUrl' : 'coverUrl']
      }));
      
      // Sync global session
      updateUser({
        [type === 'avatar' ? 'avatar_url' : 'cover_url']: res.data[type === 'avatar' ? 'avatarUrl' : 'coverUrl']
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || `Failed to upload ${type}.`);
    } finally {
      setUploading(null);
    }
  };

  const getAvatar = (seed: string) => {
    return `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}`;
  };

  const renderPostItem = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image 
          source={profile?.avatar_url ? { uri: profile.avatar_url } : { uri: getAvatar(user?.username || 'User') }} 
          style={styles.postAvatar as any} 
        />
        <View style={styles.postMeta}>
          <Text style={styles.postUser}>{user?.username}</Text>
          <Text style={styles.postTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <Text style={styles.postContent}>{item.content}</Text>
      <View style={styles.postStats}>
        <Text style={styles.statsText}>👍 {item.reaction_count || 0} Likes</Text>
        <Text style={styles.statsText}>{item.comment_count || 0} Comments</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchProfileAndPosts} />}
        ListHeaderComponent={
          <View style={styles.profileHeaderBox}>
            {/* Cover Banner */}
            <TouchableOpacity style={styles.coverWrapper} onPress={() => selectAndUploadImage('cover')}>
              {profile?.cover_url ? (
                <Image source={{ uri: profile.cover_url }} style={styles.coverImg as any} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.placeholderText}>Tap to add cover photo</Text>
                </View>
              )}
              {uploading === 'cover' && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Avatar Floating Bubble */}
            <View style={styles.avatarRow}>
              <TouchableOpacity style={styles.avatarWrapper} onPress={() => selectAndUploadImage('avatar')}>
                <Image 
                  source={profile?.avatar_url ? { uri: profile.avatar_url } : { uri: getAvatar(user?.username || 'User') }} 
                  style={styles.profileAvatar as any} 
                />
                <View style={styles.cameraIconContainer}>
                  <Text style={styles.cameraIcon}>📷</Text>
                </View>
                {uploading === 'avatar' && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.metaRow}>
                <Text style={styles.profileUsername}>{user?.username}</Text>
                <Text style={styles.profileEmail}>{profile?.email}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutBtnText}>Logout Session</Text>
            </TouchableOpacity>

            <View style={styles.postSectionHeader}>
              <Text style={styles.postSectionTitle}>My Posts ({posts.length})</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You haven't posted anything yet.</Text>
          </View>
        }
      />
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
  profileHeaderBox: {
    backgroundColor: '#0f172a',
  },
  coverWrapper: {
    height: 160,
    backgroundColor: '#1e293b',
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#334155',
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -40,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#0f172a',
    position: 'relative',
    backgroundColor: '#1e293b',
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#3b82f6',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  cameraIcon: {
    fontSize: 10,
    color: '#fff',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: {
    marginLeft: 16,
    marginTop: 35,
  },
  profileUsername: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileEmail: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef444440',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 14,
  },
  postSectionHeader: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 8,
  },
  postSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  postCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  postMeta: {
    marginLeft: 12,
  },
  postUser: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  postTime: {
    color: '#64748b',
    fontSize: 11,
  },
  postContent: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  statsText: {
    color: '#64748b',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
});
