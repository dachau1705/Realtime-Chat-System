import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getData, postData } from '../services/api';

export default function PagesScreen() {
  const { user } = useAuth();
  const [myPages, setMyPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected Page Detail View state
  const [selectedPage, setSelectedPage] = useState<any | null>(null);
  const [pagePosts, setPagePosts] = useState<any[]>([]);
  const [loadingPageDetail, setLoadingPageDetail] = useState(false);
  const [pagePostContent, setPagePostContent] = useState('');
  
  // Page Creation Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [description, setDescription] = useState('');
  const [creatingPage, setCreatingPage] = useState(false);

  const fetchMyPages = async () => {
    try {
      const res = await getData('/pages/my');
      setMyPages(res.data || []);
    } catch (err) {
      console.error('Failed to load my pages list', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await getData('/page-categories');
      setCategories(res.data || []);
      if (res.data && res.data.length > 0) {
        setCategory(res.data[0].id || res.data[0].name);
      }
    } catch (err) {
      console.warn('Failed to load page categories', err);
    }
  };

  useEffect(() => {
    fetchMyPages();
    fetchCategories();
  }, []);

  const handleOpenPage = async (page: any) => {
    setSelectedPage(page);
    setPagePosts([]);
    setLoadingPageDetail(true);
    try {
      const [detailRes, postsRes] = await Promise.all([
        getData(`/pages/detail/${page.id}`),
        getData(`/pages/${page.id}/posts`)
      ]);
      setSelectedPage(detailRes.data || page);
      setPagePosts(postsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch page details', err);
    } finally {
      setLoadingPageDetail(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!selectedPage) return;
    const isFollowing = selectedPage.is_following;
    try {
      const endpoint = `/pages/${selectedPage.id}/${isFollowing ? 'unfollow' : 'follow'}`;
      await postData(endpoint);
      setSelectedPage((prev: any) => ({ ...prev, is_following: !isFollowing }));
      Alert.alert('Success', `Successfully ${isFollowing ? 'unfollowed' : 'followed'} page!`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to toggle follow status.');
    }
  };

  const handleCreatePagePost = async () => {
    if (!pagePostContent.trim() || !selectedPage) return;
    const content = pagePostContent.trim();
    setPagePostContent('');
    try {
      const res = await postData(`/pages/${selectedPage.id}/posts`, { content });
      setPagePosts((prev) => [res.data, ...prev]);
    } catch (err) {
      console.error('Failed to create page post', err);
    }
  };

  const handleCreatePage = async () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert('Missing info', 'Name and description are required.');
      return;
    }
    setCreatingPage(true);
    try {
      const res = await postData('/pages', {
        name: name.trim(),
        category_id: category,
        description: description.trim()
      });
      Alert.alert('Success', 'Business Page created successfully!');
      setMyPages((prev) => [res.data, ...prev]);
      setCreateModalVisible(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create page.');
    } finally {
      setCreatingPage(false);
    }
  };

  const renderPostItem = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <Text style={styles.postTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
      <Text style={styles.postContent}>{item.content}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // --- RENDER PAGE DETAIL VIEW OVERLAY ---
  if (selectedPage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedPage(null)}>
            <Text style={styles.backBtnText}>◀ Back</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle} numberOfLines={1}>{selectedPage.name}</Text>
          <View style={{ width: 60 }} />
        </View>

        {loadingPageDetail ? (
          <View style={styles.center}>
            <ActivityIndicator color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            data={pagePosts}
            keyExtractor={(item) => item.id}
            renderItem={renderPostItem}
            contentContainerStyle={styles.listContainer}
            ListHeaderComponent={
              <View style={styles.pageMetaBox}>
                <Text style={styles.pageDesc}>{selectedPage.description}</Text>
                <Text style={styles.pageStatText}>
                  📂 Category: {selectedPage.category_name || selectedPage.category_id || 'Business'}
                </Text>

                <TouchableOpacity 
                  style={[styles.followBtn, selectedPage.is_following && styles.unfollowBtn]}
                  onPress={handleFollowToggle}
                >
                  <Text style={styles.followBtnText}>
                    {selectedPage.is_following ? 'Joined (Leave)' : 'Join / Follow Page'}
                  </Text>
                </TouchableOpacity>

                {/* Create post in page */}
                <View style={styles.creatorCard}>
                  <TextInput
                    style={styles.creatorInput}
                    placeholder="Post something to the page wall..."
                    placeholderTextColor="#94a3b8"
                    value={pagePostContent}
                    onChangeText={setPagePostContent}
                    multiline
                  />
                  <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePagePost}>
                    <Text style={styles.publishBtnText}>Publish Post</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.wallTitle}>Page Wall</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No posts on the page wall yet.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    );
  }

  // --- RENDER MY PAGES DIRECTORY ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pages</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.createBtnText}>+ Create Page</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={myPages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.pageCard} onPress={() => handleOpenPage(item)}>
            <View style={styles.pageIconContainer}>
              <Text style={styles.pageIcon}>🏢</Text>
            </View>
            <View style={styles.pageMeta}>
              <Text style={styles.pageName}>{item.name}</Text>
              <Text style={styles.pageSub} numberOfLines={1}>{item.description}</Text>
            </View>
            <Text style={styles.openBtnText}>Open ➔</Text>
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMyPages} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You haven't joined or created any pages.</Text>
          </View>
        }
      />

      {/* Page Creation Wizard Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Create Business Page</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.closeBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Page Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter business page name"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Category</Text>
                {/* Fallback picker input for simple display */}
                <View style={styles.pickerBox}>
                  {categories.length > 0 ? (
                    categories.map((cat) => (
                      <TouchableOpacity 
                        key={cat.id} 
                        style={[styles.categoryOption, category === cat.id && styles.activeCategoryOption]}
                        onPress={() => setCategory(cat.id)}
                      >
                        <Text style={[styles.categoryOptionText, category === cat.id && styles.activeCategoryOptionText]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No categories found</Text>
                  )}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your business page..."
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleCreatePage}
                disabled={creatingPage}
              >
                {creatingPage ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Page</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  createBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  createBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  listContainer: {
    paddingVertical: 8,
  },
  pageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
  },
  pageIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageIcon: {
    fontSize: 20,
  },
  pageMeta: {
    flex: 1,
    marginLeft: 16,
  },
  pageName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pageSub: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  openBtnText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailHeader: {
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
  detailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  pageMetaBox: {
    padding: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  pageDesc: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  pageStatText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 20,
  },
  followBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  unfollowBtn: {
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef444460',
  },
  followBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  wallTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  postCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  postTime: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 8,
  },
  postContent: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
  },
  creatorCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  creatorInput: {
    color: '#f8fafc',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  publishBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  publishBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
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
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  closeBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  modalForm: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryOption: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  activeCategoryOption: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryOptionText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeCategoryOptionText: {
    color: '#ffffff',
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
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
