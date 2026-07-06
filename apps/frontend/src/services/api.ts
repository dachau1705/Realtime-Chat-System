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
  member_usernames: string[];
  member_ids: string[];
  member_avatar_urls?: string[];
  member_full_names?: string[];
  created_at: string;
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

/**
 * Checks if the backend API is online.
 */
export async function checkBackendHealth(): Promise<void> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error('API down');
  }
}

/**
 * Authenticates a user.
 */
export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }
  return data;
}

/**
 * Registers a new user.
 */
export async function register(username: string, email: string, password: string): Promise<{ token: string; user: User }> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }
  return data;
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
  const res = await fetch('/api/seed', { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Server returned status ${res.status}`);
  }
  return await res.json();
}

/**
 * Retrieves the current user's active conversations.
 */
export async function fetchConversations(token: string): Promise<Conversation[]> {
  const res = await fetch('/api/conversations', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to load conversations');
  return await res.json();
}

/**
 * Retrieves the directory user list.
 */
export async function fetchUsers(token: string): Promise<User[]> {
  const res = await fetch('/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to load users');
  return await res.json();
}

/**
 * Creates or retrieves a direct conversation with another user.
 */
export async function createConversation(token: string, otherUserId: string): Promise<Conversation> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: null,
      isGroup: false,
      memberIds: [otherUserId]
    })
  });
  if (!res.ok) throw new Error('Failed to start conversation');
  return await res.json();
}

/**
 * Fetches recent chat history messages for a specific conversation room.
 */
export async function fetchChatHistory(token: string, roomId: string): Promise<Message[]> {
  const res = await fetch(`/api/conversations/${roomId}/messages?limit=50`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return await res.json();
}

/**
 * Uploads a file for rich media messages and returns URL options.
 */
export async function uploadMedia(token: string, file: File): Promise<{ url: string; thumbnailUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to upload media');
  }

  return await res.json();
}

/**
 * Sends or accepts a friend request by email.
 */
export async function addFriendByEmail(token: string, email: string): Promise<{ message: string; status: 'pending' | 'accepted' }> {
  const res = await fetch('/api/friends', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ email })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add friend');
  }
  return data;
}

export interface FriendRequest {
  sender_id: string;
  sender_username: string;
  sender_email: string;
  sender_avatar_url?: string;
  created_at: string;
}

/**
 * Fetches pending friend requests received by the current user.
 */
export async function fetchFriendRequests(token: string): Promise<FriendRequest[]> {
  const res = await fetch('/api/friends/requests', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to load friend requests');
  return await res.json();
}

/**
 * Accepts a friend request.
 */
export async function acceptFriendRequest(token: string, senderId: string): Promise<{ message: string }> {
  const res = await fetch('/api/friends/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ senderId })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to accept request');
  }
  return data;
}

/**
 * Declines/removes a friend request.
 */
export async function declineFriendRequest(token: string, senderId: string): Promise<{ message: string }> {
  const res = await fetch('/api/friends/decline', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ senderId })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to decline request');
  }
  return data;
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

/**
 * Fetches a user profile by ID (including friendship relationship status).
 */
export async function fetchUserProfile(token: string, userId: string): Promise<UserProfile> {
  const res = await fetch(`/api/users/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch user profile');
  }
  return data;
}

/**
 * Updates user profile details (full_name, phone, bio, privacy_is_public).
 */
export async function updateUserProfile(
  token: string,
  userId: string,
  data: { full_name: string | null; phone: string | null; bio: string | null; privacy_is_public: boolean }
): Promise<UserProfile> {
  const res = await fetch(`/api/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  const resData = await res.json();
  if (!res.ok) {
    throw new Error(resData.error || 'Failed to update profile');
  }
  return resData;
}

/**
 * Uploads an avatar image.
 */
export async function uploadAvatar(token: string, file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload/avatar', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload avatar');
  }
  return data;
}

/**
 * Uploads a cover photo image.
 */
export async function uploadCover(token: string, file: File): Promise<{ coverUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload/cover', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload cover photo');
  }
  return data;
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

/**
 * Fetches the friend list of a user.
 */
export async function fetchUserFriends(token: string, userId: string): Promise<UserFriend[]> {
  const res = await fetch(`/api/users/${userId}/friends`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load friends');
  }
  return data;
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

/**
 * Fetches global news feed for the authenticated user.
 */
export async function fetchFeed(token: string, before?: string): Promise<Post[]> {
  let url = '/api/feed?limit=20';
  if (before) {
    url += `&before=${encodeURIComponent(before)}`;
  }
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch news feed');
  return data;
}

/**
 * Creates a new post.
 */
export async function createPost(token: string, content: string, mediaUrls: string[]): Promise<Post> {
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content, media_urls: mediaUrls })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create post');
  return data;
}

/**
 * Fetches a single post details.
 */
export async function fetchPostDetails(token: string, postId: string): Promise<Post> {
  const res = await fetch(`/api/posts/${postId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load post details');
  return data;
}

/**
 * Updates an existing post.
 */
export async function updatePost(token: string, postId: string, content: string, mediaUrls: string[]): Promise<Post> {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content, media_urls: mediaUrls })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update post');
  return data;
}

/**
 * Deletes a post.
 */
export async function deletePost(token: string, postId: string): Promise<{ message: string }> {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete post');
  return data;
}

/**
 * Fetches posts written by a specific user.
 */
export async function fetchUserPosts(token: string, userId: string): Promise<Post[]> {
  const res = await fetch(`/api/users/${userId}/posts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load user posts');
  return data;
}

/**
 * Toggles a reaction (like) on a post.
 */
export async function reactToPost(token: string, postId: string, type: string | null): Promise<{
  postId: string;
  reaction_count: number;
  has_reacted: boolean;
  reaction_type: string | null;
}> {
  const res = await fetch(`/api/posts/${postId}/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ type })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit reaction');
  return data;
}

/**
 * Comments on a post.
 */
export async function commentOnPost(token: string, postId: string, content: string, parentId?: string): Promise<Comment> {
  const res = await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content, parent_id: parentId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add comment');
  return data;
}

/**
 * Fetches comments for a post.
 */
export async function fetchPostComments(token: string, postId: string): Promise<Comment[]> {
  const res = await fetch(`/api/posts/${postId}/comments`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load comments');
  return data;
}

/**
 * Follows a user.
 */
export async function followUser(token: string, userId: string): Promise<{ message: string; is_following: boolean }> {
  const res = await fetch(`/api/users/${userId}/follow`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to follow user');
  return data;
}

/**
 * Unfollows a user.
 */
export async function unfollowUser(token: string, userId: string): Promise<{ message: string; is_following: boolean }> {
  const res = await fetch(`/api/users/${userId}/unfollow`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unfollow user');
  return data;
}

/**
 * Queries follow status for a user.
 */
export async function fetchFollowStatus(token: string, userId: string): Promise<{ is_following: boolean; is_follower: boolean }> {
  const res = await fetch(`/api/users/${userId}/follow-status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load follow status');
  return data;
}

/**
 * Fetches friend suggestions for current user.
 */
export async function fetchSuggestions(token: string): Promise<UserSuggestion[]> {
  const res = await fetch('/api/friends/suggestions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load suggestions');
  return data;
}

/**
 * Fetches social notifications for current user.
 */
export async function fetchNotifications(token: string): Promise<Notification[]> {
  const res = await fetch('/api/notifications', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load notifications');
  return data;
}

/**
 * Marks notifications as read.
 */
export async function markNotificationsAsRead(token: string, notificationId?: string): Promise<{ message: string }> {
  const res = await fetch('/api/notifications/read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ notificationId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update notifications status');
  return data;
}

/**
 * Facebook-style Story item expiring after 24 hours.
 */
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
 * Fetches recent active stories from the gateway.
 */
export async function fetchStories(token: string): Promise<Story[]> {
  const res = await fetch('/api/stories', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load stories');
  return (data || []).map((item: any) => ({
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
export async function createStory(token: string, mediaUrl: string): Promise<Story> {
  const res = await fetch('/api/stories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ media_url: mediaUrl })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to publish story');
  return {
    id: data.id,
    userId: data.user_id,
    username: data.username,
    userAvatar: data.avatar_url,
    thumbnailUrl: data.media_url,
    createdAt: data.created_at
  };
}
