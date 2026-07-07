import { getData, postData, putData, deleteData } from '../lib/request';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string;
}

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  avatar_url?: string | null;
  member_usernames: string[];
  member_ids: string[];
  member_avatar_urls?: string[];
  member_full_names?: string[];
  created_at: string;
  last_message_content?: string | null;
  last_message?: string | null;
  last_message_type?: 'text' | 'image' | 'sticker' | null;
  last_message_sender_id?: string | null;
  last_message_sender_username?: string | null;
  last_message_created_at?: string | null;
  last_message_time?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  status: 'pending' | 'sent' | 'delivered' | 'seen';
  client_message_id?: string;
  sender_username?: string;
  sender_avatar_url?: string | null;
  sender_full_name?: string | null;
  type?: 'text' | 'image' | 'sticker';
  media_url?: string;
}

export interface LogEntry {
  id: string;
  type: 'info' | 'incoming' | 'outgoing';
  title: string;
  data: any;
  time: string;
}

export interface FriendRequest {
  sender_id: string;
  sender_username: string;
  sender_email: string;
  sender_avatar_url?: string;
  created_at: string;
}

export interface SentFriendRequest {
  receiver_id: string;
  receiver_username: string;
  receiver_email: string;
  receiver_avatar_url?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  created_at: string;
  friendshipStatus: 'none' | 'friends' | 'request_sent' | 'request_received' | 'self';
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  privacy_is_public: boolean;
  is_redacted?: boolean;
}

export interface UserFriend {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_mutual: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: string[];
  created_at: string;
  updated_at: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  comment_count: number;
  reaction_count: number;
  has_reacted: boolean;
  reaction_type: string | null;
  visibility?: 'public' | 'friends' | 'specific_friends' | 'except_friends' | 'only_me';
  allowed_user_ids?: string[];
  blocked_user_ids?: string[];
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow' | 'friend_request' | 'friend_accept';
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor_username: string;
  actor_full_name: string | null;
  actor_avatar_url: string | null;
}

export interface UserSuggestion {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  mutual_friends_count: number;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  userAvatar: string | null;
  thumbnailUrl: string;
  createdAt: string;
  expiresAt?: string;
  isViewed?: boolean;
}

/**
 * Checks if the backend API is online.
 */
export async function checkBackendHealth(): Promise<void> {
  const res = await getData('/health');
  if (res.data && res.data.status === false) {
    throw new Error('API down');
  }
}

/**
 * Authenticates a user.
 */
export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const res = await postData('/auth/login', { username, password });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Login failed');
  }
  return res.data;
}

/**
 * Registers a new user.
 */
export async function register(username: string, email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await postData('/users', { username, email, password });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Registration failed');
  }
  return res.data;
}

/**
 * Triggers database seeding and returns seed user credentials.
 */
export async function seedDatabase(): Promise<{
  alice: User;
  aliceToken: string;
  bob: User;
  bobToken: string;
  conversationId: string;
}> {
  const res = await postData('/seed');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Seeding failed');
  }
  return res.data;
}

/**
 * Retrieves the current user's active conversations.
 */
export async function fetchConversations(_token: string): Promise<Conversation[]> {
  const res = await getData('/conversations');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load conversations');
  }
  return res.data;
}

/**
 * Retrieves the directory user list.
 */
export async function fetchUsers(_token: string): Promise<User[]> {
  const res = await getData('/users');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load users');
  }
  return res.data;
}

/**
 * Creates or retrieves a direct conversation with another user.
 */
export async function createConversation(_token: string, otherUserId: string): Promise<Conversation> {
  const res = await postData('/conversations', {
    name: null,
    isGroup: false,
    memberIds: [otherUserId]
  });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to start conversation');
  }
  return res.data;
}

/**
 * Creates a group conversation.
 */
export async function createGroupConversation(
  _token: string,
  name: string,
  memberIds: string[],
  avatarUrl?: string
): Promise<Conversation> {
  const res = await postData('/conversations', {
    name,
    isGroup: true,
    memberIds,
    avatarUrl
  });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to create group chat');
  }
  return res.data;
}

/**
 * Fetches recent chat history messages for a specific conversation room.
 */
export async function fetchChatHistory(_token: string, roomId: string): Promise<Message[]> {
  const res = await getData(`/conversations/${roomId}/messages`, { limit: 50 });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to fetch chat history');
  }
  return res.data;
}

/**
 * Uploads a file for rich media messages and returns URL options.
 */
export async function uploadMedia(_token: string, file: File): Promise<{ url: string; thumbnailUrl: string }> {
  const res = await postData('/upload', { file }, { isFormData: true });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to upload media');
  }
  return res.data;
}

/**
 * Sends or accepts a friend request by email.
 */
export async function addFriendByEmail(_token: string, email: string): Promise<{ message: string; status: 'pending' | 'accepted' }> {
  const res = await postData('/friends', { email });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to add friend');
  }
  return res.data;
}

/**
 * Fetches pending friend requests received by the current user.
 */
export async function fetchFriendRequests(_token: string): Promise<FriendRequest[]> {
  const res = await getData('/friends/requests');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load friend requests');
  }
  return res.data;
}

/**
 * Fetches pending friend requests sent by the current user.
 */
export async function fetchSentRequests(_token: string): Promise<SentFriendRequest[]> {
  const res = await getData('/friends/requests/sent');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load sent friend requests');
  }
  return res.data;
}

/**
 * Accepts a friend request.
 */
export async function acceptFriendRequest(_token: string, senderId: string): Promise<{ message: string }> {
  const res = await postData('/friends/accept', { senderId });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to accept request');
  }
  return res.data;
}

/**
 * Declines/removes a friend request.
 */
export async function declineFriendRequest(_token: string, senderId: string): Promise<{ message: string }> {
  const res = await postData('/friends/decline', { senderId });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to decline request');
  }
  return res.data;
}

/**
 * Fetches a user profile by ID (including friendship relationship status).
 */
export async function fetchUserProfile(_token: string, userId: string): Promise<UserProfile> {
  const res = await getData(`/users/${userId}`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to fetch user profile');
  }
  return res.data;
}

/**
 * Updates user profile details (full_name, phone, bio, privacy_is_public).
 */
export async function updateUserProfile(
  _token: string,
  userId: string,
  data: { full_name: string | null; phone: string | null; bio: string | null; privacy_is_public: boolean }
): Promise<UserProfile> {
  const res = await putData(`/users/${userId}`, data);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to update profile');
  }
  return res.data;
}

/**
 * Uploads an avatar image.
 */
export async function uploadAvatar(_token: string, file: File): Promise<{ avatarUrl: string }> {
  const res = await postData('/upload/avatar', { file }, { isFormData: true });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to upload avatar');
  }
  return res.data;
}

/**
 * Uploads a cover photo image.
 */
export async function uploadCover(_token: string, file: File): Promise<{ coverUrl: string }> {
  const res = await postData('/upload/cover', { file }, { isFormData: true });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to upload cover photo');
  }
  return res.data;
}

/**
 * Fetches the friend list of a user.
 */
export async function fetchUserFriends(_token: string, userId: string): Promise<UserFriend[]> {
  const res = await getData(`/users/${userId}/friends`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load friends');
  }
  return res.data;
}

/**
 * Fetches global news feed for the authenticated user.
 */
export async function fetchFeed(_token: string, before?: string): Promise<Post[]> {
  const params: any = { limit: 20 };
  if (before) {
    params.before = before;
  }
  const res = await getData('/feed', params);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to fetch news feed');
  }
  return res.data;
}

/**
 * Creates a new post.
 */
export async function createPost(
  _token: string, 
  content: string, 
  mediaUrls: string[],
  visibility: string = 'public',
  allowedUserIds: string[] = [],
  blockedUserIds: string[] = []
): Promise<Post> {
  const res = await postData('/posts', { 
    content, 
    media_urls: mediaUrls,
    visibility,
    allowed_user_ids: allowedUserIds,
    blocked_user_ids: blockedUserIds
  });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to create post');
  }
  return res.data;
}

/**
 * Fetches a single post details.
 */
export async function fetchPostDetails(_token: string, postId: string): Promise<Post> {
  const res = await getData(`/posts/${postId}`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load post details');
  }
  return res.data;
}

/**
 * Updates an existing post.
 */
export async function updatePost(_token: string, postId: string, content: string, mediaUrls: string[]): Promise<Post> {
  const res = await putData(`/posts/${postId}`, { content, media_urls: mediaUrls });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to update post');
  }
  return res.data;
}

/**
 * Deletes a post.
 */
export async function deletePost(_token: string, postId: string): Promise<{ message: string }> {
  const res = await deleteData(`/posts/${postId}`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to delete post');
  }
  return res.data;
}

/**
 * Fetches posts written by a specific user.
 */
export async function fetchUserPosts(_token: string, userId: string): Promise<Post[]> {
  const res = await getData(`/users/${userId}/posts`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load user posts');
  }
  return res.data;
}

/**
 * Toggles a reaction (like) on a post.
 */
export async function reactToPost(_token: string, postId: string, type: string | null): Promise<{
  postId: string;
  reaction_count: number;
  has_reacted: boolean;
  reaction_type: string | null;
}> {
  const res = await postData(`/posts/${postId}/react`, { type });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to submit reaction');
  }
  return res.data;
}

/**
 * Comments on a post.
 */
export async function commentOnPost(_token: string, postId: string, content: string, parentId?: string): Promise<Comment> {
  const res = await postData(`/posts/${postId}/comments`, { content, parent_id: parentId });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to add comment');
  }
  return res.data;
}

/**
 * Fetches comments for a post.
 */
export async function fetchPostComments(_token: string, postId: string): Promise<Comment[]> {
  const res = await getData(`/posts/${postId}/comments`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load comments');
  }
  return res.data;
}

/**
 * Follows a user.
 */
export async function followUser(_token: string, userId: string): Promise<{ message: string; is_following: boolean }> {
  const res = await postData(`/users/${userId}/follow`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to follow user');
  }
  return res.data;
}

/**
 * Unfollows a user.
 */
export async function unfollowUser(_token: string, userId: string): Promise<{ message: string; is_following: boolean }> {
  const res = await postData(`/users/${userId}/unfollow`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to unfollow user');
  }
  return res.data;
}

/**
 * Queries follow status for a user.
 */
export async function fetchFollowStatus(_token: string, userId: string): Promise<{ is_following: boolean; is_follower: boolean }> {
  const res = await getData(`/users/${userId}/follow-status`);
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load follow status');
  }
  return res.data;
}

/**
 * Fetches friend suggestions for current user.
 */
export async function fetchSuggestions(_token: string): Promise<any[]> {
  const res = await getData('/friends/suggestions');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load suggestions');
  }
  return res.data;
}

/**
 * Fetches social notifications for current user.
 */
export async function fetchNotifications(_token: string): Promise<Notification[]> {
  const res = await getData('/notifications');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load notifications');
  }
  return res.data;
}

/**
 * Marks notifications as read.
 */
export async function markNotificationsAsRead(_token: string, notificationId?: string): Promise<{ message: string }> {
  const res = await postData('/notifications/read', { notificationId });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to update notifications status');
  }
  return res.data;
}

/**
 * Fetches recent active stories from the gateway.
 */
export async function fetchStories(_token: string): Promise<Story[]> {
  const res = await getData('/stories');
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to load stories');
  }
  return (res.data || []).map((item: any) => ({
    id: item.id,
    userId: item.user_id,
    username: item.username,
    userAvatar: item.user_avatar,
    thumbnailUrl: item.thumbnail_url,
    createdAt: item.created_at,
    isViewed: false
  }));
}

/**
 * Creates/publishes a story by uploading a media url.
 */
export async function createStory(_token: string, mediaUrl: string): Promise<Story> {
  const res = await postData('/stories', { media_url: mediaUrl });
  if (res.data && res.data.status === false) {
    throw new Error(res.data.mess || 'Failed to publish story');
  }
  return {
    id: res.data.id,
    userId: res.data.user_id,
    username: res.data.username,
    userAvatar: res.data.avatar_url,
    thumbnailUrl: res.data.media_url,
    createdAt: res.data.created_at
  };
}
