import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { PostCard } from './post/PostCard';
import { 
  fetchUserProfile, 
  updateUserProfile, 
  uploadAvatar, 
  uploadCover, 
  fetchUserFriends, 
  fetchUserPosts,
  type UserProfile,
  type UserFriend,
  type Post
} from '../services/api';

export function ProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    token, 
    showToast, 
    addFriend, 
    acceptRequest, 
    declineRequest, 
    startChatWithUser,
    currentUser,
    setCurrentUser
  } = useChat();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<UserFriend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [friendsLoading, setFriendsLoading] = useState<boolean>(false);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  
  // Tabs: 'about' | 'friends' | 'activity'
  const [activeTab, setActiveTab] = useState<'about' | 'friends' | 'activity'>('about');
  
  // Edit Profile Modal State
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    privacy_is_public: true
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUserProfile(token, id);
      setProfile(data);
      
      // Update global currentUser context and session storage if viewing self
      if (currentUser && data.id === currentUser.id) {
        const updatedUser = {
          ...currentUser,
          username: data.username,
          full_name: data.full_name,
          avatar_url: data.avatar_url
        };
        setCurrentUser(updatedUser);
        sessionStorage.setItem('chatUser', JSON.stringify(updatedUser));
      }
      
      // Initialize edit form
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
        bio: data.bio || '',
        privacy_is_public: data.privacy_is_public
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!token || !id || profile?.is_redacted) return;
    try {
      setFriendsLoading(true);
      const data = await fetchUserFriends(token, id);
      setFriends(data);
    } catch (err: any) {
      console.error('Failed to load friends list', err);
    } finally {
      setFriendsLoading(false);
    }
  };

  const loadUserPostsList = async () => {
    if (!token || !id || profile?.is_redacted) return;
    try {
      setPostsLoading(true);
      const data = await fetchUserPosts(token, id);
      setUserPosts(data);
    } catch (err: any) {
      console.error('Failed to load user posts', err);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    setActiveTab('about');
  }, [id, token]);

  useEffect(() => {
    if (profile && !profile.is_redacted && activeTab === 'friends') {
      loadFriends();
    }
  }, [profile, activeTab]);

  useEffect(() => {
    if (profile && !profile.is_redacted && activeTab === 'activity') {
      loadUserPostsList();
    }
  }, [profile, activeTab]);

  // Image Upload Triggers
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    
    // Preview locally first
    const reader = new FileReader();
    reader.onload = () => {
      if (profile) {
        setProfile({ ...profile, avatar_url: reader.result as string });
      }
    };
    reader.readAsDataURL(file);

    try {
      setActionLoading(true);
      await uploadAvatar(token, file);
      showToast('Success', 'Profile avatar updated successfully', false);
      // Reload profile to lock in backend public URL
      await loadProfile();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to upload avatar', true);
      await loadProfile(); // revert preview
    } finally {
      setActionLoading(false);
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    // Preview cover locally
    const reader = new FileReader();
    reader.onload = () => {
      if (profile) {
        setProfile({ ...profile, cover_url: reader.result as string });
      }
    };
    reader.readAsDataURL(file);

    try {
      setActionLoading(true);
      await uploadCover(token, file);
      showToast('Success', 'Cover banner updated successfully', false);
      await loadProfile();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to upload cover banner', true);
      await loadProfile(); // revert preview
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !profile) return;
    try {
      setActionLoading(true);
      const updated = await updateUserProfile(token, profile.id, {
        full_name: formData.full_name.trim() || null,
        phone: formData.phone.trim() || null,
        bio: formData.bio.trim() || null,
        privacy_is_public: formData.privacy_is_public
      });
      setProfile(updated);
      showToast('Success', 'Profile updated successfully', false);
      setEditModalOpen(false);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to update profile', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const message = await addFriend(profile.email || '');
      showToast('Friend Request', message, false);
      await loadProfile();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to send friend request', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      await acceptRequest(profile.id);
      showToast('Friend Request Accepted', `You are now friends with ${profile.username}`, false);
      await loadProfile();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to accept request', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      await declineRequest(profile.id);
      showToast('Friend Request Declined', `Declined friend request from ${profile.username}`, false);
      await loadProfile();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to decline request', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      await startChatWithUser(profile.id, profile.username);
      navigate('/chat');
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to start chat', true);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container loading">
        <div className="profile-spinner">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Loading user profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-container error">
        <div className="profile-error-card">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <h3>Error Loading Profile</h3>
          <p>{error || 'User profile not found'}</p>
          <button className="primary-btn" onClick={() => navigate('/')}>
            Back to Chats
          </button>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.id === profile.id;
  const mutualFriendsCount = friends.filter(f => f.is_mutual).length;
  const formattedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="profile-container">
      {/* Hidden file upload inputs */}
      <input 
        type="file" 
        ref={avatarInputRef} 
        onChange={handleAvatarChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />
      <input 
        type="file" 
        ref={coverInputRef} 
        onChange={handleCoverChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      <div className="profile-card advanced-layout">
        {/* 1. Cover Photo Banner Section */}
        <div className="profile-cover-section">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover Banner" className="profile-cover-img" />
          ) : (
            <div className="profile-cover-placeholder"></div>
          )}
          <button className="profile-back-btn" onClick={() => navigate('/')} title="Back to Dashboard">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          
          {isOwner && (
            <button 
              className="profile-cover-upload-btn" 
              onClick={() => coverInputRef.current?.click()}
              title="Change cover photo"
            >
              <i className="fa-solid fa-camera"></i> <span>Edit Cover</span>
            </button>
          )}
        </div>

        {/* 2. Profile Header Meta Section */}
        <div className="profile-meta-section">
          <div className="profile-avatar-container">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile Avatar" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-letter">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            
            {isOwner && (
              <button 
                className="profile-avatar-upload-btn" 
                onClick={() => avatarInputRef.current?.click()}
                title="Change profile photo"
              >
                <i className="fa-solid fa-camera"></i>
              </button>
            )}
          </div>

          <div className="profile-header-details">
            <h1 className="profile-display-name">
              {profile.full_name || profile.username}
            </h1>
            <p className="profile-username-tag">@{profile.username}</p>
            {profile.bio && <p className="profile-bio-text">{profile.bio}</p>}
            {!isOwner && mutualFriendsCount > 0 && (
              <p className="profile-mutual-friends-tag" style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <i className="fa-solid fa-users" style={{ color: 'var(--primary)' }}></i> {mutualFriendsCount} mutual friend{mutualFriendsCount > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="profile-header-actions">
            {isOwner ? (
              <button className="primary-btn edit-profile-btn" onClick={() => setEditModalOpen(true)}>
                <i className="fa-solid fa-pen"></i> Edit Profile
              </button>
            ) : (
              <div className="profile-action-group">
                {profile.friendshipStatus === 'none' && (
                  <button className="primary-btn" onClick={handleAddFriend} disabled={actionLoading}>
                    {actionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-user-plus"></i> Add Friend</>}
                  </button>
                )}
                {profile.friendshipStatus === 'request_sent' && (
                  <button className="primary-btn disabled-btn" disabled>
                    <i className="fa-solid fa-hourglass-half"></i> Pending
                  </button>
                )}
                {profile.friendshipStatus === 'request_received' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="primary-btn success-btn" onClick={handleAcceptRequest} disabled={actionLoading}>
                      Accept
                    </button>
                    <button className="primary-btn decline-btn" onClick={handleDeclineRequest} disabled={actionLoading}>
                      Decline
                    </button>
                  </div>
                )}
                {(profile.friendshipStatus === 'friends' || profile.friendshipStatus === 'self') && (
                  <button className="primary-btn message-btn" onClick={handleStartChat} disabled={actionLoading}>
                    <i className="fa-solid fa-message"></i> Message
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Inline Navigation Tabs */}
        <div className="profile-tabs-nav">
          <button 
            className={`profile-tab-link ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
          {!profile.is_redacted && (
            <button 
              className={`profile-tab-link ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Friends
            </button>
          )}
          <button 
            className={`profile-tab-link ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>

        {/* 4. Tab Display Panel */}
        <div className="profile-tab-panel">
          {activeTab === 'about' && (
            <div className="tab-about-content">
              <div className="about-info-grid">
                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-circle-user"></i></div>
                  <div className="about-info-value">
                    <span className="info-title">Full Name</span>
                    <span className="info-desc">{profile.full_name || 'Not provided'}</span>
                  </div>
                </div>

                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-envelope"></i></div>
                  <div className="about-info-value">
                    <span className="info-title">Email Address</span>
                    <span className="info-desc">{profile.email || 'Private / Hidden'}</span>
                  </div>
                </div>

                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-phone"></i></div>
                  <div className="about-info-value">
                    <span className="info-title">Phone Number</span>
                    <span className="info-desc">{profile.phone || 'Not provided'}</span>
                  </div>
                </div>

                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-calendar-days"></i></div>
                  <div className="about-info-value">
                    <span className="info-title">Joined Date</span>
                    <span className="info-desc">{formattedDate}</span>
                  </div>
                </div>

                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-earth-americas"></i></div>
                  <div className="about-info-value">
                    <span className="info-title">Privacy Level</span>
                    <span className="info-desc">
                      {profile.privacy_is_public ? 'Public profile' : 'Private (Friends only)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="tab-friends-content">
              {friendsLoading ? (
                <div className="tab-panel-loader">
                  <i className="fa-solid fa-spinner fa-spin"></i> Loading friends...
                </div>
              ) : friends.length === 0 ? (
                <div className="tab-panel-empty">No friends list to show.</div>
              ) : (
                <div className="friends-grid-list">
                  {friends.map((friend) => (
                    <div 
                      key={friend.id} 
                      className="friend-grid-card"
                      onClick={() => navigate(`/profile/${friend.id}`)}
                    >
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.username} className="friend-card-avatar" />
                      ) : (
                        <div className="friend-card-avatar-placeholder">
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="friend-card-info">
                        <div className="friend-card-name">{friend.full_name || friend.username}</div>
                        <div className="friend-card-sub text-muted">
                          {friend.is_mutual ? 'Mutual Friend' : `@${friend.username}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="tab-activity-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {postsLoading ? (
                <div className="tab-panel-loader">
                  <i className="fa-solid fa-spinner fa-spin"></i> Loading user posts...
                </div>
              ) : userPosts.length === 0 ? (
                <div className="activity-timeline">
                  <div className="activity-item">
                    <div className="activity-dot"></div>
                    <div className="activity-details">
                      <span className="activity-title">Account Created</span>
                      <span className="activity-time">{formattedDate}</span>
                    </div>
                  </div>
                  {!profile.is_redacted && (
                    <div className="activity-item">
                      <div className="activity-dot active"></div>
                      <div className="activity-details">
                        <span className="activity-title">Active Connection status</span>
                        <span className="activity-time">
                          {profile.friendshipStatus === 'self' ? 'Fully authenticated' : `Status: ${profile.friendshipStatus}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ maxWidth: '620px', margin: '0 auto', width: '100%' }}>
                  {userPosts.map((post) => (
                    <PostCard key={post.id} post={post} onPostDeleted={loadUserPostsList} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Edit Profile Overlay Modal Component */}
      {editModalOpen && (
        <div className="modal" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content profile-edit-form" onClick={(e) => e.stopPropagation()}>
            <h1>Edit Profile Info</h1>
            <p>Update your display name, biography and security options.</p>
            
            <form onSubmit={handleEditSubmit} className="setup-options">
              <div className="form-group">
                <label>Full Display Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.full_name} 
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
                  placeholder="e.g. Alice Cooper"
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                  placeholder="e.g. +1 555-0199"
                  maxLength={20}
                />
              </div>

              <div className="form-group">
                <label>Biography / Status Bio</label>
                <textarea 
                  className="form-input" 
                  value={formData.bio} 
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })} 
                  placeholder="Tell others about yourself..."
                  rows={3}
                  maxLength={500}
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                <input 
                  type="checkbox" 
                  id="privacy_toggle"
                  checked={formData.privacy_is_public} 
                  onChange={(e) => setFormData({ ...formData, privacy_is_public: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="privacy_toggle" style={{ margin: 0, cursor: 'pointer' }}>
                  Make profile public (visible to everyone)
                </label>
              </div>

              <div className="action-button-group" style={{ marginTop: '24px' }}>
                <button type="submit" className="primary-btn" disabled={actionLoading}>
                  {actionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Save Changes'}
                </button>
                <button type="button" className="primary-btn decline-btn" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
