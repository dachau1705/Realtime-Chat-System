import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getData, postData } from '../services/api';
import { LOCAL_IP } from '../services/config';

export default function FeedScreen() {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Comments modal state
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchFeedAndStories = async () => {
    try {
      const [feedRes, storiesRes] = await Promise.all([
        getData('/feed', { limit: 20 }),
        getData('/stories')
      ]);
      setPosts(feedRes.data || []);
      setStories(storiesRes.data || []);
    } catch (err) {
      console.error('Failed to load social feed data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeedAndStories();
  }, []);

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    try {
      const res = await postData('/posts', { content: newPostContent });
      setPosts((prev) => [res.data, ...prev]);
      setNewPostContent('');
    } catch (err) {
      console.error('Failed to create post', err);
    }
  };

  const handleReact = async (postId: string) => {
    try {
      const res = await postData(`/posts/${postId}/react`, { type: 'like' });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, has_reacted: res.data.has_reacted, reaction_count: res.data.count }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to react to post', err);
    }
  };

  const openComments = async (post: any) => {
    setSelectedPost(post);
    setComments([]);
    setLoadingComments(true);
    try {
      const res = await getData(`/posts/${post.id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error('Failed to load comments', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPost) return;
    try {
      const res = await postData(`/posts/${selectedPost.id}/comments`, { content: newComment });
      setComments((prev) => [...prev, res.data]);
      setNewComment('');
      // Update comment count in feed list
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
        )
      );
    } catch (err) {
      console.error('Failed to add comment', err);
    }
  };

  // Helper avatar generator
  const getAvatar = (url: string | null, seed: string) => {
    if (url && url.startsWith('http')) return { uri: url };
    return { uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}` };
  };

  const renderPostItem = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image source={getAvatar(item.avatar_url, item.username)} style={styles.avatar as any} />
        <View style={styles.postMeta}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.timeText}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <Text style={styles.postContent}>{item.content}</Text>
      <View style={styles.postStats}>
        <Text style={styles.statsText}>👍 {item.reaction_count || 0}</Text>
        <Text style={styles.statsText}>{item.comment_count || 0} Comments</Text>
      </View>
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleReact(item.id)}>
          <Text style={[styles.actionBtnText, item.has_reacted && styles.reactedText]}>
            {item.has_reacted ? '❤️ Liked' : '🤍 Like'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item)}>
          <Text style={styles.actionBtnText}>💬 Comment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.logo}>Antigravity</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchFeedAndStories} />}
        ListHeaderComponent={
          <>
            {/* Stories Section */}
            {stories.length > 0 ? (
              <View style={styles.storiesContainer}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={stories}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.storyCard}>
                      <Image source={{ uri: item.thumbnail_url }} style={styles.storyImg as any} />
                      <View style={styles.storyUserOverlay}>
                        <Image source={getAvatar(null, item.username)} style={styles.storyAvatar as any} />
                        <Text style={styles.storyUsername} numberOfLines={1}>
                          {item.username}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            ) : null}

            {/* Post Creator Box */}
            <View style={styles.creatorCard}>
              <View style={styles.creatorRow}>
                <Image source={getAvatar(null, user?.username)} style={styles.avatar as any} />
                <TextInput
                  style={styles.creatorInput}
                  placeholder={`What's on your mind, ${user?.username || 'user'}?`}
                  placeholderTextColor="#94a3b8"
                  value={newPostContent}
                  onChangeText={setNewPostContent}
                  multiline
                />
              </View>
              <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePost}>
                <Text style={styles.publishBtnText}>Post Update</Text>
              </TouchableOpacity>
            </View>
          </>
        }
      />

      {/* Comments Drawer Modal */}
      <Modal visible={!!selectedPost} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPost(null)}>
                <Text style={styles.closeBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator color="#3b82f6" />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.commentsList}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image source={getAvatar(item.avatar_url, item.username)} style={styles.commentAvatar as any} />
                    <View style={styles.commentContentBox}>
                      <Text style={styles.commentUser}>{item.username}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Write a comment..."
                  placeholderTextColor="#94a3b8"
                  value={newComment}
                  onChangeText={setNewComment}
                />
                <TouchableOpacity style={styles.sendCommentBtn} onPress={handleAddComment}>
                  <Text style={styles.sendCommentText}>Send</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#1e293b',
  },
  logo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3b82f6',
    flex: 1,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  logoutBtnText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  storiesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  storyCard: {
    width: 110,
    height: 170,
    borderRadius: 12,
    marginHorizontal: 6,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  storyImg: {
    width: '100%',
    height: '100%',
  },
  storyUserOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  storyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  storyUsername: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  creatorCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    margin: 12,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorInput: {
    flex: 1,
    marginLeft: 12,
    color: '#f8fafc',
    fontSize: 15,
    maxHeight: 80,
  },
  publishBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  publishBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  postMeta: {
    marginLeft: 12,
  },
  username: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 15,
  },
  timeText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  postContent: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  statsText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  postActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  reactedText: {
    color: '#f87171',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '75%',
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 15,
  },
  commentsList: {
    padding: 20,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
  },
  commentContentBox: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentUser: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
  },
  commentText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 18,
  },
  commentInputRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#f8fafc',
    maxHeight: 80,
  },
  sendCommentBtn: {
    marginLeft: 12,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sendCommentText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
