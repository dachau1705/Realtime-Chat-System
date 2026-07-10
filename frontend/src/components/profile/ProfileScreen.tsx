import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { PostCard } from '../post/PostCard';
import { CreatePostBox } from '../post/CreatePostBox';
import { useLanguage } from '../../context/LanguageContext';
import { PhotosGrid } from './PhotosGrid';
import { FriendsGrid } from './FriendsGrid';
import { ReelsGrid } from './ReelsGrid';
import { AboutTabCard } from './AboutTabCard';
import {
  fetchUserProfile,
  updateUserProfile,
  uploadAvatar,
  uploadCover,
  fetchUserFriends,
  fetchUserPosts,
  fetchUserReels,
  type UserProfile,
  type UserFriend,
  type Post,
  type Reel
} from '../../services/api';

export function ProfileScreen() {
  const { t } = useLanguage();
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
  const [userReels, setUserReels] = useState<Reel[]>([]);
  const [reelsLoading, setReelsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Tabs: 'all' | 'about' | 'reels' | 'photos' | 'friends'
  const [activeTab, setActiveTab] = useState<'all' | 'about' | 'reels' | 'photos' | 'friends'>('all');
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);

  const renderBirthdayDisplay = (val: string | null | undefined) => {
    if (!val) return '12 tháng 10';
    try {
      if (val.trim().startsWith('{')) {
        const bd = JSON.parse(val);
        if (bd.hide_year) {
          return `Ngày ${bd.day} tháng ${bd.month}`;
        }
        return `Ngày ${bd.day} tháng ${bd.month}, năm ${bd.year}`;
      }
    } catch (err) {
      // Ignore
    }
    return val;
  };

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

  const loadUserReelsList = async () => {
    if (!token || !id || profile?.is_redacted) return;
    try {
      setReelsLoading(true);
      const data = await fetchUserReels(token, id);
      setUserReels(data);
    } catch (err: any) {
      console.error('Failed to load user reels', err);
    } finally {
      setReelsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    setActiveTab('all');
  }, [id, token]);

  useEffect(() => {
    if (profile && !profile.is_redacted && (activeTab === 'friends' || activeTab === 'all' || activeTab === 'about')) {
      loadFriends();
    }
  }, [profile, activeTab]);

  useEffect(() => {
    if (profile && !profile.is_redacted && (activeTab === 'all' || activeTab === 'photos' || activeTab === 'about')) {
      loadUserPostsList();
    }
  }, [profile, activeTab]);

  useEffect(() => {
    if (profile && !profile.is_redacted && (activeTab === 'reels' || activeTab === 'all' || activeTab === 'about')) {
      loadUserReelsList();
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
      showToast(t('common.success') || 'Success', t('profile.avatarSuccess'), false);
      // Reload profile to lock in backend public URL
      await loadProfile();
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to upload avatar', true);
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
      showToast(t('common.success') || 'Success', t('profile.coverSuccess'), false);
      await loadProfile();
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to upload cover banner', true);
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
      showToast(t('common.success') || 'Success', t('profile.profileSuccess'), false);
      setEditModalOpen(false);
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to update profile', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAboutInfo = async (aboutData: any) => {
    if (!token || !profile) return;
    console.log("[DEBUG FRONTEND] handleUpdateAboutInfo triggered. aboutData:", aboutData);
    try {
      setActionLoading(true);
      const updated = await updateUserProfile(token, profile.id, {
        full_name: profile.full_name,
        phone: profile.phone,
        bio: profile.bio,
        privacy_is_public: profile.privacy_is_public,
        about_info: aboutData
      });
      console.log("[DEBUG FRONTEND] handleUpdateAboutInfo API success. Returned updated profile:", updated);
      setProfile(updated);
    } catch (err: any) {
      console.error("[DEBUG FRONTEND] handleUpdateAboutInfo API error:", err);
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to update about details', true);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      const message = await addFriend(profile.email || '');
      showToast(t('profile.friendRequestSent'), message, false);
      await loadProfile();
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to send friend request', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      await acceptRequest(profile.id);
      showToast(t('profile.friendRequestAccepted'), t('profile.nowFriends').replace('{name}', profile.username), false);
      await loadProfile();
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to accept request', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!profile) return;
    try {
      setActionLoading(true);
      await declineRequest(profile.id);
      showToast(t('profile.friendRequestDeclined'), `Declined friend request from ${profile.username}`, false);
      await loadProfile();
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to decline request', true);
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
      showToast(t('friends.delete') || 'Error', err.message || 'Failed to start chat', true);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container loading">
        <div className="profile-spinner">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>{t('profile.loadingProfile')}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-container error">
        <div className="profile-error-card">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <h3>{t('profile.errorLoading')}</h3>
          <p>{error || t('profile.profileNotFound')}</p>
          <button className="primary-btn" onClick={() => navigate('/')}>
            {t('profile.backToChats')}
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

  const allPhotos = userPosts.flatMap(post => post.media_urls || []);

  const handlePhotoClick = (url: string) => {
    const post = userPosts.find(p => p.media_urls?.includes(url));
    if (post) {
      navigate(`/posts/${post.id}`);
    }
  };

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
              <i className="fa-solid fa-camera"></i> <span>{t('profile.editCover')}</span>
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
                <i className="fa-solid fa-users" style={{ color: 'var(--primary)' }}></i> {t('profile.mutualFriendsCount').replace('{count}', String(mutualFriendsCount))}
              </p>
            )}
          </div>

          <div className="profile-header-actions">
            {isOwner ? (
              <button className="primary-btn edit-profile-btn" onClick={() => setEditModalOpen(true)}>
                <i className="fa-solid fa-pen"></i> {t('profile.editProfile')}
              </button>
            ) : (
              <div className="profile-action-group">
                {profile.friendshipStatus === 'none' && (
                  <button className="primary-btn" onClick={handleAddFriend} disabled={actionLoading}>
                    {actionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-user-plus"></i> {t('profile.addFriend')}</>}
                  </button>
                )}
                {profile.friendshipStatus === 'request_sent' && (
                  <button className="primary-btn disabled-btn" disabled>
                    <i className="fa-solid fa-hourglass-half"></i> {t('profile.pending')}
                  </button>
                )}
                {profile.friendshipStatus === 'request_received' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="primary-btn success-btn" onClick={handleAcceptRequest} disabled={actionLoading}>
                      {t('profile.accept')}
                    </button>
                    <button className="primary-btn decline-btn" onClick={handleDeclineRequest} disabled={actionLoading}>
                      {t('profile.decline')}
                    </button>
                  </div>
                )}
                {(profile.friendshipStatus === 'friends' || profile.friendshipStatus === 'self') && (
                  <button className="primary-btn message-btn" onClick={handleStartChat} disabled={actionLoading}>
                    <i className="fa-solid fa-message"></i> {t('profile.message')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Inline Navigation Tabs */}
        <div className="profile-tabs-nav" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`profile-tab-link ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            {t('profile.all')}
          </button>
          <button
            className={`profile-tab-link ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            {t('profile.about')}
          </button>
          <button
            className={`profile-tab-link ${activeTab === 'reels' ? 'active' : ''}`}
            onClick={() => setActiveTab('reels')}
          >
            {t('reels.reelsTitle')}
          </button>
          <button
            className={`profile-tab-link ${activeTab === 'photos' ? 'active' : ''}`}
            onClick={() => setActiveTab('photos')}
          >
            {t('profile.photos')}
          </button>
          {!profile.is_redacted && (
            <button
              className={`profile-tab-link ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              {t('profile.friends')}
            </button>
          )}

          {/* Xem thêm Dropdown Menu */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="profile-tab-link"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {t('profile.more')} <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i>
            </button>

            {showMoreMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'var(--panel-bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                padding: '6px',
                minWidth: '180px',
                animation: 'fadeIn 0.2s'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    showToast('Info', t('accountMenu.activityLog') || 'Activity Log', false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    borderRadius: '8px'
                  }}
                  className="post-action-btn"
                >
                  <i className="fa-solid fa-list-check" style={{ width: '14px', textAlign: 'center', color: 'var(--primary)' }} />
                  {t('accountMenu.activityLog') || 'Activity Log'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    showToast('Info', 'Videos will be available in future releases', false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    borderRadius: '8px'
                  }}
                  className="post-action-btn"
                >
                  <i className="fa-solid fa-video" style={{ width: '14px', textAlign: 'center', color: 'var(--primary)' }} />
                  Videos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    showToast('Info', t('accountMenu.managedPages') || 'Managed Pages', false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    borderRadius: '8px'
                  }}
                  className="post-action-btn"
                >
                  <i className="fa-solid fa-flag" style={{ width: '14px', textAlign: 'center', color: 'var(--primary)' }} />
                  {t('accountMenu.managedPages') || 'Pages'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4. Tab Display Panel */}
        <div className="profile-tab-panel">
          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
              
              <AboutTabCard 
                profile={profile} 
                formattedDate={formattedDate} 
                t={t} 
                isOwner={currentUser?.id === profile.id}
                onUpdateProfile={handleUpdateAboutInfo}
                currentUser={currentUser}
              />

              {/* 2. Reels Card */}
              <div className="profile-widget-card">
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-clapperboard" style={{ color: 'var(--primary)' }} />
                  {t('reels.reelsTitle')}
                </h3>
                <ReelsGrid reels={userReels} loading={reelsLoading} limit={12} emptyMessage={t('reels.noUserReels')} />
              </div>

              {/* 3. Ảnh (Photos Card) */}
              <div className="profile-widget-card">
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-regular fa-image" style={{ color: 'var(--success)' }} />
                  {t('profile.photos')}
                </h3>
                <PhotosGrid photos={allPhotos} loading={postsLoading} onPhotoClick={handlePhotoClick} limit={12} emptyMessage="Chưa có ảnh nào được chia sẻ." />
              </div>

              {/* 4. Nhóm (Groups Card) */}
              <div className="profile-widget-card">
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-users-rectangle" style={{ color: '#EAB026' }} />
                  Nhóm
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {[{ name: 'Cộng đồng lập trình Việt Nam', members: '142K thành viên', icon: '💻', gradient: 'linear-gradient(135deg, #1f4037, #99f2c8)' },
                    { name: 'Connectly Designers Space', members: '24K thành viên', icon: '🎨', gradient: 'linear-gradient(135deg, #f857a6, #ff5858)' },
                    { name: 'Vite & React Developers', members: '89K thành viên', icon: '⚡', gradient: 'linear-gradient(135deg, #00c6ff, #0072ff)' }
                  ].map((group, idx) => (
                    <div 
                      key={idx}
                      onClick={() => showToast('Group Info', `Truy cập nhóm: ${group.name}`, false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--panel-border)',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      className="friend-grid-card"
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: group.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px'
                      }}>
                        {group.icon}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{group.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{group.members}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Bạn bè (Friends Card) */}
              {!profile.is_redacted && (
                <div className="profile-widget-card">
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-user-group" style={{ color: '#38ef7d' }} />
                    {t('profile.friends')}
                  </h3>
                  <FriendsGrid friends={friends} loading={friendsLoading} showMutualLabel={true} />
                </div>
              )}

            </div>
          )}

          {activeTab === 'friends' && (
            <div className="tab-friends-content">
              <FriendsGrid friends={friends} loading={friendsLoading} emptyMessage={t('profile.noFriendsShow')} />
            </div>
          )}

          {activeTab === 'all' && (
            <div className="profile-all-tab-layout">
              {/* Left Column (Sidebar Widgets) */}
              <div className="profile-left-column">

                {/* 1. Thông tin cá nhân (Intro Card) */}
                <div className="profile-widget-card">
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
                    {t('profile.introTitle')}
                  </h3>
                  {profile.bio && (
                    <p style={{ fontSize: '13px', color: 'var(--text-main)', textAlign: 'center', padding: '10px 0', borderBottom: '1px solid var(--panel-border)', marginBottom: '12px', fontStyle: 'italic', lineHeight: '1.4' }}>
                      "{profile.bio}"
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-circle-user" style={{ width: '16px', color: 'var(--primary)' }}></i>
                      <span>{t('profile.fullName')}: <strong style={{ color: 'var(--text-main)' }}>{profile.full_name || t('profile.notProvided')}</strong></span>
                    </div>

                    {(profile.privacy_settings?.['category'] !== 'private' && profile.privacy_settings?.['category'] !== 'friends') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-tags" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span>Hạng mục: <strong style={{ color: 'var(--text-main)' }}>{profile.category || 'Người sáng tạo nội dung số (Digital Creator)'}</strong></span>
                      </div>
                    )}

                    {(profile.privacy_settings?.['personal_info.location'] !== 'private' && profile.privacy_settings?.['personal_info.location'] !== 'friends') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-location-dot" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span>Sống tại: <strong style={{ color: 'var(--text-main)' }}>{profile.location || 'Quận 1, Thành phố Hồ Chí Minh, Việt Nam'}</strong></span>
                      </div>
                    )}

                    {(profile.privacy_settings?.['personal_info.hometown'] !== 'private' && profile.privacy_settings?.['personal_info.hometown'] !== 'friends') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-house" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span>Đến từ: <strong style={{ color: 'var(--text-main)' }}>{profile.hometown || 'Hà Nội, Việt Nam'}</strong></span>
                      </div>
                    )}

                    {(profile.privacy_settings?.['personal_info.birthday'] !== 'private' && profile.privacy_settings?.['personal_info.birthday'] !== 'friends') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-cake-candles" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span>Sinh nhật: <strong style={{ color: 'var(--text-main)' }}>{renderBirthdayDisplay(profile.birthday)}</strong></span>
                      </div>
                    )}

                    {(profile.privacy_settings?.['personal_info.relationship_status'] !== 'private' && profile.privacy_settings?.['personal_info.relationship_status'] !== 'friends') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-heart" style={{ width: '16px', color: '#EF4444' }}></i>
                        <span>Mối quan hệ: <strong style={{ color: 'var(--text-main)' }}>{profile.relationship_status || 'Độc thân'}</strong></span>
                      </div>
                    )}

                    {/* Jobs (Public only) */}
                    {(profile.work || [
                      { company: 'S-TECH Corp', position: 'Kỹ sư Web Developer', description: 'Xây dựng hệ thống chat trực tuyến thời gian thực và quản lý nhân sự.', duration: '2024 - Hiện tại', privacy_level: 'public' },
                      { company: 'FPT Software', position: 'Fullstack Developer', description: 'Thiết kế API backend và triển khai cơ sở dữ liệu Postgres.', duration: '2021 - 2023', privacy_level: 'public' }
                    ]).filter((job: any) => (job.privacy_level || 'public') === 'public').map((job: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-briefcase" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span>Làm <strong style={{ color: 'var(--text-main)' }}>{job.position}</strong> tại <strong style={{ color: 'var(--text-main)' }}>{job.company}</strong></span>
                      </div>
                    ))}

                    {/* Education (Public only) */}
                    {(profile.education || [
                      { school_name: 'Đại học Bách Khoa Hà Nội', degree: 'Đại học', description: 'Kỹ sư CNTT, 2017 - 2021', privacy_level: 'public' },
                      { school_name: 'THPT Chuyên Hà Nội - Amsterdam', degree: 'Trường trung học phổ thông', description: 'Lớp chuyên Toán, 2014 - 2017', privacy_level: 'public' },
                      { school_name: 'THCS Trưng Vương', degree: 'Trường trung học', description: 'Hà Nội, 2010 - 2014', privacy_level: 'public' }
                    ]).filter((edu: any) => (edu.privacy_level || 'public') === 'public').map((edu: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-graduation-cap" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span>Học <strong style={{ color: 'var(--text-main)' }}>{edu.degree}</strong> tại <strong style={{ color: 'var(--text-main)' }}>{edu.school_name}</strong></span>
                      </div>
                    ))}

                    {(profile.privacy_settings?.['phone'] !== 'private' && profile.privacy_settings?.['phone'] !== 'friends') && profile.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-phone" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span>Số điện thoại: <strong style={{ color: 'var(--text-main)' }}>{profile.phone}</strong></span>
                      </div>
                    )}

                    {(profile.privacy_settings?.['email'] !== 'private' && profile.privacy_settings?.['email'] !== 'friends') && profile.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-envelope" style={{ width: '16px', color: 'var(--primary)' }}></i>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Email: <strong style={{ color: 'var(--text-main)' }}>{profile.email}</strong></span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-calendar-days" style={{ width: '16px', color: 'var(--primary)' }}></i>
                      <span>{t('profile.joinedDate')}: <strong style={{ color: 'var(--text-main)' }}>{formattedDate}</strong></span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-earth-americas" style={{ width: '16px', color: 'var(--primary)' }}></i>
                      <span>{profile.privacy_is_public ? t('profile.publicProfile') : t('profile.privateFriendsOnly')}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Tin nổi bật (Highlights Carousel) */}
                <div className="profile-widget-card" style={{ marginTop: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-star" style={{ color: '#F59E0B' }}></i>
                    {t('profile.highlightsTitle')}
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }} className="stories-scroll-container">
                    {[{ title: 'Kỷ niệm', icon: '🎬', gradient: 'linear-gradient(135deg, #FF512F, #DD2476)' },
                    { title: 'Du lịch', icon: '✈️', gradient: 'linear-gradient(135deg, #180B20, #3E105C)' },
                    { title: 'Ẩm thực', icon: '🍜', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },
                    { title: 'Bạn bè', icon: '❤️', gradient: 'linear-gradient(135deg, #FF8008, #FFC837)' },
                    { title: 'Chill', icon: '🎵', gradient: 'linear-gradient(135deg, #00c6ff, #0072ff)' }
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => showToast('Highlights Info', `Mở tin nổi bật: ${item.title}`, false)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <div style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          background: item.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px',
                          border: '3px solid var(--panel-border)',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                        }} className="highlight-circle">
                          {item.icon}
                        </div>
                        <span style={{ fontSize: '11.5px', fontWeight: 650, color: 'var(--text-main)' }}>{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Ảnh Widget */}
                <div className="profile-widget-card" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {t('profile.photos')} <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-muted)' }}>({allPhotos.length})</span>
                    </h3>
                    <button onClick={() => setActiveTab('photos')} style={{ fontSize: '12.5px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                      {t('profile.viewAll')}
                    </button>
                  </div>
                  <PhotosGrid photos={allPhotos} loading={postsLoading} onPhotoClick={handlePhotoClick} limit={9} gridTemplateColumns="repeat(3, 1fr)" emptyMessage="Chưa có ảnh nào để hiển thị." />
                </div>

                {/* 3. Bạn bè Widget */}
                {!profile.is_redacted && (
                  <div className="profile-widget-card" style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {t('profile.friends')} <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-muted)' }}>({friends.length})</span>
                      </h3>
                      <button onClick={() => setActiveTab('friends')} style={{ fontSize: '12.5px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                        {t('profile.viewAll')}
                      </button>
                    </div>
                    <FriendsGrid friends={friends} loading={friendsLoading} limit={9} gridTemplateColumns="repeat(3, 1fr)" emptyMessage="Chưa có bạn bè để hiển thị." />
                  </div>
                )}

              </div>

              {/* Right Column (Timeline Feed, Create Post) */}
              <div className="profile-right-column">

                {/* 5. Bài viết mới (Create Post Box - only for Owner) */}
                {isOwner && <CreatePostBox />}

                {/* 6. Bài viết (Timeline feed list) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="profile-widget-card" style={{ padding: '12px 16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                      {t('profile.postsTitle')}
                    </h3>
                  </div>

                  {postsLoading ? (
                    <div className="tab-panel-loader">
                      <i className="fa-solid fa-spinner fa-spin"></i> {t('profile.loadingPosts')}
                    </div>
                  ) : userPosts.length === 0 ? (
                    <div className="profile-widget-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chưa có bài viết nào để hiển thị.
                    </div>
                  ) : (
                    userPosts.map((post) => (
                      <PostCard key={post.id} post={post} onPostDeleted={loadUserPostsList} />
                    ))
                  )}
                </div>

              </div>
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="tab-photos-content">
              <PhotosGrid photos={allPhotos} loading={postsLoading} onPhotoClick={handlePhotoClick} emptyMessage="Chưa có ảnh nào được chia sẻ." />
            </div>
          )}

          {activeTab === 'reels' && (
            <div className="tab-activity-content">
              <ReelsGrid reels={userReels} loading={reelsLoading} emptyMessage={t('reels.noUserReels')} />
            </div>
          )}
        </div>
      </div>

      {/* 5. Edit Profile Overlay Modal Component */}
      {editModalOpen && (
        <div className="modal" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content profile-edit-form" onClick={(e) => e.stopPropagation()}>
            <h1>{t('profile.editProfileInfo')}</h1>
            <p>{t('profile.editProfileDesc')}</p>

            <form onSubmit={handleEditSubmit} className="setup-options">
              <div className="form-group">
                <label>{t('profile.fullDisplayName')}</label>
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
                <label>{t('profile.phoneNumber')}</label>
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
                <label>{t('profile.biography')}</label>
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
                  {t('profile.makePublic')}
                </label>
              </div>

              <div className="action-button-group" style={{ marginTop: '24px' }}>
                <button type="submit" className="primary-btn" disabled={actionLoading}>
                  {actionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : t('profile.saveChanges')}
                </button>
                <button type="button" className="primary-btn decline-btn" onClick={() => setEditModalOpen(false)}>
                  {t('profile.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
