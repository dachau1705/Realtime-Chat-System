import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { fetchSuggestions, fetchUserProfile } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

interface FriendsPageProps {
  activeTab: 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists';
  setActiveTab: (tab: 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists') => void;
  selectedRequestId?: string;
}

export function FriendsPage({ activeTab, setActiveTab, selectedRequestId }: FriendsPageProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { 
    users, 
    friendRequests, 
    sentRequests,
    loadUserList, 
    loadRequests,
    acceptRequest, 
    declineRequest, 
    addFriend,
    startChatWithUser, 
    token,
    showToast
  } = useChat();

  const isOutgoing = sentRequests.some(r => r.receiver_id === selectedRequestId);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedList, setSelectedList] = useState<string | null>(null);

  // Request Profile detail states
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Simulated Custom Lists Data
  const customLists = [
    { id: 'close', name: 'Close Friends', icon: 'fa-star', color: '#F59E0B' },
    { id: 'family', name: 'Family', icon: 'fa-heart', color: '#EF4444' },
    { id: 'work', name: 'Work / Professional', icon: 'fa-briefcase', color: '#3B82F6' },
    { id: 'acquaintances', name: 'Acquaintances', icon: 'fa-handshake', color: '#10B981' }
  ];

  useEffect(() => {
    if (token) {
      loadUserList();
      loadRequests();
      loadSuggestionsList();
    }
  }, [token]);

  // Load detailed profile if a request is selected
  useEffect(() => {
    if (token && selectedRequestId && activeTab === 'requests') {
      loadSelectedProfile();
    } else {
      setSelectedProfile(null);
    }
  }, [selectedRequestId, activeTab, token]);

  const loadSelectedProfile = async () => {
    if (!token || !selectedRequestId) return;
    try {
      setProfileLoading(true);
      const data = await fetchUserProfile(token, selectedRequestId);
      setSelectedProfile(data);
    } catch (err) {
      console.error('Failed to load request profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadSuggestionsList = async () => {
    if (!token) return;
    try {
      setSuggestionsLoading(true);
      const data = await fetchSuggestions(token);
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleAddFriend = async (email: string) => {
    try {
      const msg = await addFriend(email);
      showToast('Friend Request', msg, false);
      loadSuggestionsList();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to send friend request', true);
    }
  };

  const handleMessage = async (userId: string, username: string) => {
    try {
      await startChatWithUser(userId, username);
      navigate('/chat');
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  // Deterministically simulate birthday dates based on user IDs so they stay constant
  const getSimulatedBirthday = (username: string, index: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index;
    const month = months[hash % 12];
    const day = (hash % 28) + 1;
    return `${month} ${day}`;
  };

  // Check if birthday is today (simulated: if hash matches current month/day index)
  const isBirthdayToday = (username: string) => {
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % 10 === 0; // 10% chance to be today for mock display
  };

  // Filter friends list
  const filteredFriends = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter custom lists friends
  const getFriendsForList = (listId: string) => {
    // Deterministically assign friends to lists for demonstration
    return users.filter((_, index) => {
      if (listId === 'close') return index % 3 === 0;
      if (listId === 'family') return index % 4 === 1;
      if (listId === 'work') return index % 5 === 2;
      return index % 3 === 1; // acquaintances
    });
  };

  return (
    <div className="friends-page-wrapper" style={{ flexGrow: 1, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      
      {/* 1. HOME VIEW */}
      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Welcome Dashboard Banner */}
          <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.02))', border: '1px solid var(--panel-border)', borderRadius: '20px', padding: '28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{t('friends.dashboardTitle')}</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '6px 0 0 0', maxWidth: '500px', lineHeight: 1.5 }}>
                {t('friends.dashboardDesc')}
              </p>
            </div>
            <div style={{ position: 'absolute', right: '30px', bottom: '-10px', fontSize: '100px', opacity: 0.05, color: 'var(--primary)', transform: 'rotate(15deg)' }}>
              <i className="fa-solid fa-user-group"></i>
            </div>
          </div>

          {/* Pending Requests Summary Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {t('friends.pendingRequests')} ({friendRequests.length})
              </h2>
              {friendRequests.length > 0 && (
                <button 
                  onClick={() => setActiveTab('requests')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  See All
                </button>
              )}
            </div>
            {friendRequests.length === 0 ? (
              <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                <i className="fa-solid fa-user-clock" style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4, display: 'block' }}></i>
                {t('friends.noRequests')}
              </div>
            ) : (
              <div className="friends-grid-list">
                {friendRequests.slice(0, 4).map((req) => (
                  <div key={req.sender_id} className="friend-grid-card-large">
                    <div onClick={() => navigate(`/friends/requests/${req.sender_id}`)} style={{ cursor: 'pointer' }}>
                      {req.sender_avatar_url ? (
                        <img src={req.sender_avatar_url} alt={req.sender_username} className="friend-card-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div className="friend-card-avatar-placeholder" style={{ width: '80px', height: '80px', borderRadius: '50%', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white' }}>
                          {req.sender_username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                      <div onClick={() => navigate(`/friends/requests/${req.sender_id}`)} style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.sender_username}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-user-group" style={{ fontSize: '9px', color: 'var(--primary)' }}></i>
                        <span>{((req.sender_username.charCodeAt(0) + req.sender_username.length) % 5) + 1} {t('friends.mutualFriends')}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.sender_email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                      <button 
                        onClick={() => acceptRequest(req.sender_id)}
                        className="friends-action-btn-primary"
                        style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 0', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {t('friends.confirm')}
                      </button>
                      <button 
                        onClick={() => declineRequest(req.sender_id)}
                        className="friends-action-btn-secondary"
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '10px 0', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {t('friends.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sent Friend Requests Section */}
          {sentRequests.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  {t('friends.sentRequests')} ({sentRequests.length})
                </h2>
              </div>
              <div className="friends-grid-list">
                {sentRequests.slice(0, 4).map((req) => (
                  <div key={req.receiver_id} className="friend-grid-card-large">
                    <div onClick={() => navigate(`/profile/${req.receiver_id}`)} style={{ cursor: 'pointer' }}>
                      {req.receiver_avatar_url ? (
                        <img src={req.receiver_avatar_url} alt={req.receiver_username} className="friend-card-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div className="friend-card-avatar-placeholder" style={{ width: '80px', height: '80px', borderRadius: '50%', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white' }}>
                          {req.receiver_username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                      <div onClick={() => navigate(`/profile/${req.receiver_id}`)} style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.receiver_username}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-user-group" style={{ fontSize: '9px', color: 'var(--primary)' }}></i>
                        <span>{((req.receiver_username.charCodeAt(0) + req.receiver_username.length) % 5) + 1} {t('friends.mutualFriends')}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.receiver_email}
                      </div>
                    </div>
                    <button 
                      onClick={() => declineRequest(req.receiver_id)}
                      className="friends-action-btn-secondary"
                      style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '10px 0', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}
                    >
                      <i className="fa-solid fa-user-xmark" style={{ fontSize: '11px' }}></i> {t('friends.cancelRequest')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions Summary Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {t('friends.peopleYouMayKnow')}
              </h2>
              {suggestions.length > 4 && (
                <button 
                  onClick={() => setActiveTab('suggestions')} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  See All
                </button>
              )}
            </div>
            {suggestionsLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Loading suggestions...
              </div>
            ) : suggestions.length === 0 ? (
              <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                <i className="fa-solid fa-user-group" style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4, display: 'block' }}></i>
                {t('friends.noRequests')}
              </div>
            ) : (
              <div className="friends-grid-list">
                {suggestions.slice(0, 4).map((friend) => (
                  <div key={friend.id} className="friend-grid-card-large">
                    <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ cursor: 'pointer' }}>
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.username} className="friend-card-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div className="friend-card-avatar-placeholder" style={{ width: '80px', height: '80px', borderRadius: '50%', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white' }}>
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                      <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {friend.full_name || friend.username}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-user-group" style={{ fontSize: '9px', color: 'var(--primary)' }}></i>
                        <span>{((friend.username.charCodeAt(0) + friend.username.length) % 5) + 1} {t('friends.mutualFriends')}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{friend.username}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddFriend(friend.email)}
                      className="friends-action-btn-primary"
                      style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 0', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}
                    >
                      <i className="fa-solid fa-user-plus" style={{ fontSize: '11px' }}></i> {t('friends.addFriend')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. FRIEND REQUESTS VIEW (SPLIT DETAIL PANEL ROUTE) */}
      {activeTab === 'requests' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {selectedRequestId ? (
            profileLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '36px', color: 'var(--primary)', marginBottom: '16px' }}></i>
                <p style={{ margin: 0 }}>Loading user profile...</p>
              </div>
            ) : selectedProfile ? (
              <div className="profile-container" style={{ minHeight: 'auto', padding: 0, display: 'block', height: 'auto', width: '100%' }}>
                <div className="profile-card advanced-layout" style={{ width: '100%', height: 'auto', minHeight: '500px', animation: 'none', boxShadow: 'none' }}>
                  {/* Cover Photo */}
                  <div className="profile-cover-section" style={{ height: '180px' }}>
                    {selectedProfile.cover_url ? (
                      <img src={selectedProfile.cover_url} alt="Cover Banner" className="profile-cover-img" />
                    ) : (
                      <div className="profile-cover-placeholder"></div>
                    )}
                  </div>

                  {/* Profile Info Row */}
                  <div className="profile-meta-section" style={{ padding: '0 24px 20px 24px', marginTop: '-45px' }}>
                    <div className="profile-avatar-container" style={{ width: '90px', height: '90px' }}>
                      {selectedProfile.avatar_url ? (
                        <img src={selectedProfile.avatar_url} alt="Profile Avatar" className="profile-avatar-img" />
                      ) : (
                        <div className="profile-avatar-letter" style={{ fontSize: '32px' }}>
                          {selectedProfile.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="profile-header-details" style={{ marginBottom: 0 }}>
                      <h1 className="profile-display-name" style={{ fontSize: '20px' }}>
                        {selectedProfile.full_name || selectedProfile.username}
                      </h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span className="profile-username-tag" style={{ fontSize: '12px', margin: 0 }}>@{selectedProfile.username}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>•</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-user-group" style={{ fontSize: '10px', color: 'var(--primary)' }}></i>
                          {((selectedProfile.username.charCodeAt(0) + selectedProfile.username.length) % 5) + 1} {t('friends.mutualFriends')}
                        </span>
                      </div>
                      {selectedProfile.bio && <p className="profile-bio-text" style={{ fontSize: '12px', marginTop: '6px' }}>{selectedProfile.bio}</p>}
                    </div>

                    <div className="profile-header-actions" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isOutgoing ? (
                          <button 
                            onClick={() => {
                              declineRequest(selectedProfile.id);
                              navigate('/friends/requests');
                            }}
                            className="friends-action-btn-secondary"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            {t('friends.cancelRequest')}
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                acceptRequest(selectedProfile.id);
                                navigate('/friends/requests');
                              }}
                              className="friends-action-btn-primary"
                              style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              {t('friends.confirm')}
                            </button>
                            <button 
                              onClick={() => {
                                declineRequest(selectedProfile.id);
                                navigate('/friends/requests');
                              }}
                              className="friends-action-btn-secondary"
                              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              {t('friends.delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <hr className="dropdown-divider" style={{ margin: 0 }} />

                  {/* Profile Details body */}
                  <div style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>User Details</h3>
                    
                    <div className="about-info-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      <div className="about-info-item" style={{ padding: '12px' }}>
                        <div className="about-info-icon" style={{ width: '28px', height: '28px', fontSize: '16px' }}><i className="fa-solid fa-envelope"></i></div>
                        <div className="about-info-value">
                          <span className="info-title" style={{ fontSize: '10px' }}>Email Address</span>
                          <span className="info-desc" style={{ fontSize: '13px' }}>{selectedProfile.email || 'Private'}</span>
                        </div>
                      </div>

                      <div className="about-info-item" style={{ padding: '12px' }}>
                        <div className="about-info-icon" style={{ width: '28px', height: '28px', fontSize: '16px' }}><i className="fa-solid fa-phone"></i></div>
                        <div className="about-info-value">
                          <span className="info-title" style={{ fontSize: '10px' }}>Phone Number</span>
                          <span className="info-desc" style={{ fontSize: '13px' }}>{selectedProfile.phone || 'Not provided'}</span>
                        </div>
                      </div>

                      <div className="about-info-item" style={{ padding: '12px' }}>
                        <div className="about-info-icon" style={{ width: '28px', height: '28px', fontSize: '16px' }}><i className="fa-solid fa-calendar-days"></i></div>
                        <div className="about-info-value">
                          <span className="info-title" style={{ fontSize: '10px' }}>Joined Date</span>
                          <span className="info-desc" style={{ fontSize: '13px' }}>
                            {selectedProfile.created_at ? new Date(selectedProfile.created_at).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}></i>
                <p style={{ margin: 0 }}>Failed to load profile details</p>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: 'var(--text-muted)', textAlign: 'center' }}>
              <i className="fa-solid fa-user-clock" style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.3 }}></i>
              <h3 style={{ fontSize: '18px', color: 'var(--text-main)', margin: '0 0 8px 0' }}>Select a request to view profile details</h3>
              <p style={{ margin: 0, fontSize: '13px', maxWidth: '380px', lineHeight: 1.5 }}>
                Click on a friend request from the left list to inspect their profile info before confirming.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. SUGGESTIONS VIEW */}
      {activeTab === 'suggestions' && (
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{t('friends.peopleYouMayKnow')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', marginTop: 0 }}>People you may know based on mutual connections</p>

          {suggestionsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px', display: 'block', color: 'var(--primary)' }}></i>
              Loading suggested profiles...
            </div>
          ) : suggestions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-user-group" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}></i>
              <p style={{ margin: 0, fontSize: '14px' }}>{t('friends.noRequests')}</p>
            </div>
          ) : (
            <div className="friends-grid-list">
              {suggestions.map((friend) => (
                <div key={friend.id} className="friend-grid-card-large">
                  <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ cursor: 'pointer' }}>
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt={friend.username} className="friend-card-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div className="friend-card-avatar-placeholder" style={{ width: '80px', height: '80px', borderRadius: '50%', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white' }}>
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                    <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {friend.full_name || friend.username}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-user-group" style={{ fontSize: '9px', color: 'var(--primary)' }}></i>
                      <span>{((friend.username.charCodeAt(0) + friend.username.length) % 5) + 1} {t('friends.mutualFriends')}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{friend.username}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAddFriend(friend.email)}
                    className="friends-action-btn-primary"
                    style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 0', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}
                  >
                    <i className="fa-solid fa-user-plus" style={{ fontSize: '11px' }}></i> {t('friends.addFriend')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. ALL FRIENDS VIEW */}
      {activeTab === 'all' && (
        <div>
          <div className="friends-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{t('friends.allFriends')}</h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Manage and connect with your {users.length} friend{users.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="friends-search-bar" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '8px 14px', gap: '10px', width: '280px' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)', fontSize: '13px' }} />
              <input
                type="text"
                placeholder={t('friends.searchFriends')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flexGrow: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {filteredFriends.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-user-group" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}></i>
              <p style={{ margin: 0, fontSize: '14px' }}>
                {searchQuery ? 'No friends found match your search' : 'No friends yet. Add friends by email in the sidebar!'}
              </p>
            </div>
          ) : (
            <div className="friends-grid-list">
              {filteredFriends.map((friend) => (
                <div key={friend.id} className="friend-grid-card-large">
                  <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ cursor: 'pointer' }}>
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt={friend.username} className="friend-card-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--panel-border)' }} />
                    ) : (
                      <div className="friend-card-avatar-placeholder" style={{ width: '80px', height: '80px', borderRadius: '50%', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', background: 'var(--primary)', color: 'white', border: '3px solid var(--panel-border)' }}>
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                    <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {friend.full_name || friend.username}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-user-group" style={{ fontSize: '9px', color: 'var(--primary)' }}></i>
                      <span>{((friend.username.charCodeAt(0) + friend.username.length) % 5) + 1} {t('friends.mutualFriends')}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      @{friend.username}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {friend.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                    <button 
                      onClick={() => handleMessage(friend.id, friend.username)}
                      className="friends-action-btn-primary"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 0', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-message"></i> {t('friends.messageBtn')}
                    </button>
                    <button 
                      onClick={() => navigate(`/profile/${friend.id}`)}
                      className="friends-action-btn-secondary"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '10px 0', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-user"></i> {t('friends.profileBtn')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. BIRTHDAYS VIEW */}
      {activeTab === 'birthdays' && (
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{t('friends.birthdays')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', marginTop: 0 }}>Celebrate upcoming birthdays of your friends</p>

          {users.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-cake-candles" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}></i>
              <p style={{ margin: 0, fontSize: '14px' }}>Add some friends to see their birthday calendar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Today's birthdays block */}
              <div style={{ background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(245, 158, 11, 0.05))', border: '1px solid rgba(236, 72, 153, 0.2)', borderRadius: '20px', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0' }}>
                  <i className="fa-solid fa-gift" style={{ color: '#EC4899' }}></i> {t('friends.birthdaysToday')}
                </h3>
                {users.filter(u => isBirthdayToday(u.username)).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>{t('friends.birthdaysTodayEmpty')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {users.filter(u => isBirthdayToday(u.username)).map((friend) => (
                      <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px' }}>
                        <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ cursor: 'pointer', width: '40px', height: '40px' }}>
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', background: 'var(--primary)', color: 'white' }}>
                              {friend.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>{friend.full_name || friend.username}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}> is celebrating their birthday today! 🎂 🎉</span>
                        </div>
                        <button 
                          onClick={() => handleMessage(friend.id, friend.username)}
                          style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {t('friends.wishWell')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monthly Birthday Calendar */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>{t('friends.upcomingBirthdays')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {users.map((friend, index) => (
                    <div key={friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', padding: '12px 18px', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ cursor: 'pointer', width: '36px', height: '36px' }}>
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', background: 'var(--primary)', color: 'white', fontSize: '12px' }}>
                              {friend.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', cursor: 'pointer' }}>
                            {friend.full_name || friend.username}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{friend.username}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-regular fa-calendar"></i> {getSimulatedBirthday(friend.username, index)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. CUSTOM LISTS VIEW */}
      {activeTab === 'lists' && (
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{t('friends.customLists')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', marginTop: 0 }}>Segment your friends into custom groups</p>

          {selectedList === null ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {customLists.map((list) => {
                const count = getFriendsForList(list.id).length;
                return (
                  <div 
                    key={list.id} 
                    onClick={() => setSelectedList(list.id)}
                    style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', gap: '12px' }}
                    className="suggestion-item-card"
                  >
                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${list.color}15`, border: `1px solid ${list.color}30`, color: list.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      <i className={`fa-solid ${list.icon}`}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0' }}>{list.name}</h3>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>{count} friend{count !== 1 ? 's' : ''} added</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <button 
                onClick={() => setSelectedList(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', padding: 0 }}
              >
                <i className="fa-solid fa-arrow-left"></i> Back to Custom Lists
              </button>

              {(() => {
                const list = customLists.find(l => l.id === selectedList);
                const friendsInList = getFriendsForList(selectedList);

                return (
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <span style={{ color: list?.color }}><i className={`fa-solid ${list?.icon}`}></i></span> {list?.name}
                    </h2>

                    {friendsInList.length === 0 ? (
                      <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                        No friends added to this list.
                      </div>
                    ) : (
                      <div className="friends-grid-list">
                        {friendsInList.map((friend) => (
                          <div key={friend.id} className="friend-grid-card-large">
                            <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ cursor: 'pointer' }}>
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt={friend.username} className="friend-card-avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div className="friend-card-avatar-placeholder" style={{ width: '80px', height: '80px', borderRadius: '50%', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white' }}>
                                  {friend.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div style={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                              <div onClick={() => navigate(`/profile/${friend.id}`)} style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {friend.full_name || friend.username}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                @{friend.username}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                              <button 
                                onClick={() => handleMessage(friend.id, friend.username)}
                                className="friends-action-btn-primary"
                                style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 0', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                {t('friends.messageBtn')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default FriendsPage;
