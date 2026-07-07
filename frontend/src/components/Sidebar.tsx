import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';

export function Sidebar() {
  const navigate = useNavigate();
  const [friendEmail, setFriendEmail] = useState<string>('');
  const [adding, setAdding] = useState<boolean>(false);
  const [addResultMsg, setAddResultMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('');
  const [groupAvatar, setGroupAvatar] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const {
    currentUser,
    activeTab,
    setActiveTab,
    conversations,
    users,
    friendRequests,
    currentRoomId,
    unreadBadges,
    socketConnected,
    selectConversation,
    startChatWithUser,
    createGroupChat,
    loadConversations,
    loadUserList,
    addFriend,
    loadRequests,
    acceptRequest,
    declineRequest,
    unreadNotifCount,
    markNotificationsRead
  } = useChat();

  // Load active tab list items on tab shift
  useEffect(() => {
    if (activeTab === 'conversations') {
      loadConversations();
    } else if (activeTab === 'users') {
      loadUserList();
    } else if (activeTab === 'requests') {
      loadRequests();
    }
  }, [activeTab]);

  // Initial load of friend requests for badge count
  useEffect(() => {
    loadRequests();
  }, []);

  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendEmail.trim()) return;

    try {
      setAdding(true);
      setAddResultMsg(null);
      const message = await addFriend(friendEmail.trim());
      setAddResultMsg({ text: message, isError: false });
      setFriendEmail('');
    } catch (err: any) {
      setAddResultMsg({ text: err.message || 'Failed to add friend', isError: true });
    } finally {
      setAdding(false);
    }
  };

  const handleProfileClick = () => {
    if (currentUser?.id) {
      navigate(`/profile/${currentUser.id}`);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    if (selectedMembers.length === 0) {
      alert('Please select at least one member.');
      return;
    }
    try {
      await createGroupChat(groupName.trim(), selectedMembers, groupAvatar.trim() || undefined);
      setShowGroupModal(false);
      setGroupName('');
      setGroupAvatar('');
      setSelectedMembers([]);
    } catch (err) {
      // handled
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-selector" onClick={handleProfileClick} title="View your profile">
          <div className="avatar" id="myAvatar">
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="My Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              currentUser?.username?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div className="profile-info">
            <div className="profile-name" id="myName">
              {currentUser?.username ? `${currentUser.username} (You)` : 'Loading...'}
            </div>
            <div className="profile-status" id="myStatus">
              {socketConnected ? "Online & Connected" : "Connecting to Socket..."}
            </div>
          </div>
          <div className={`status-dot ${socketConnected ? '' : 'offline'}`} id="myPresenceDot"></div>
        </div>
      </div>

      <div className="sidebar-tabs">
        <button
          className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('feed');
            markNotificationsRead();
            navigate('/');
          }}
        >
          <i className="fa-solid fa-square-rss"></i> Feed
          {unreadNotifCount > 0 && (
            <span className="tab-btn-badge primary-badge">
              {unreadNotifCount}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'conversations' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('conversations');
            navigate('/chat');
          }}
        >
          <i className="fa-solid fa-message"></i> Chats
          {Object.values(unreadBadges).reduce((a, b) => a + b, 0) > 0 && (
            <span className="tab-btn-badge error-badge">
              {Object.values(unreadBadges).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('users');
            navigate('/friends');
          }}
        >
          <i className="fa-solid fa-users"></i> Friends
        </button>
        <button
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('requests');
            navigate('/friends/requests');
          }}
        >
          <i className="fa-solid fa-user-plus"></i> Requests
          {friendRequests.length > 0 && (
            <span className="tab-btn-badge error-badge">
              {friendRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'conversations' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px 6px 16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recent Chats</span>
            <button
              onClick={() => {
                loadUserList();
                setShowGroupModal(true);
              }}
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: 'none',
                borderRadius: '6px',
                color: 'var(--primary)',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.2s'
              }}
            >
              <i className="fa-solid fa-plus" /> New Group
            </button>
          </div>

          <div className="conv-list" id="conversationsContainer" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px', padding: '20px' }}>
                <i className="fa-regular fa-folder-open" style={{ fontSize: '24px', marginBottom: '8px', display: 'block', opacity: 0.5 }}></i>
                No active chats. Select 'Users' tab to start a conversation!
              </div>
            ) : (
              conversations.map((c) => {
                const displayName = c.is_group ? (c.name || 'Group Chat') : (c.member_usernames[0] || 'Unknown User');
                const otherUserId = c.is_group ? '' : c.member_ids[0];
                const isActive = currentRoomId === c.id;
                const hasBadge = unreadBadges[c.id] > 0;

                return (
                  <div
                    key={c.id}
                    className={`conv-item ${isActive ? 'active' : ''}`}
                    onClick={() => selectConversation(c.id, displayName, otherUserId)}
                  >
                    <div
                      className="avatar"
                      onClick={(e) => {
                        if (!c.is_group && otherUserId) {
                          e.stopPropagation();
                          navigate(`/profile/${otherUserId}`);
                        }
                      }}
                      style={{ cursor: c.is_group ? 'default' : 'pointer' }}
                      title={c.is_group ? '' : 'View profile'}
                    >
                      {c.is_group && c.avatar_url ? (
                        <img src={c.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : !c.is_group && c.member_avatar_urls?.[0] ? (
                        <img src={c.member_avatar_urls[0]} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                  <div className="conv-details">
                    <div className="conv-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{displayName}</span>
                      {hasBadge && (
                        <span className="unread-badge" style={{ background: 'var(--error)', color: 'white', fontSize: '10px', fontWeight: 800, minWidth: '18px', height: '18px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', lineHeight: 1 }}>
                          {unreadBadges[c.id]}
                        </span>
                      )}
                    </div>
                    <div className="conv-preview" style={{ color: hasBadge ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: hasBadge ? 'bold' : 'normal' }}>
                      Click to view messages
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      ) : activeTab === 'users' ? (
        <div className="users-tab-content" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
          <div className="add-friend-bar" style={{ padding: '16px', borderBottom: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.08)' }}>
            <form onSubmit={handleAddFriendSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="Enter friend's email..."
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                style={{
                  flexGrow: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none'
                }}
                disabled={adding}
                required
              />
              <button
                type="submit"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                disabled={adding}
              >
                {adding ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Add'}
              </button>
            </form>
            {addResultMsg && (
              <div style={{
                marginTop: '8px',
                fontSize: '11px',
                color: addResultMsg.isError ? 'var(--error)' : 'var(--success)',
                fontWeight: 500
              }}>
                {addResultMsg.text}
              </div>
            )}
          </div>

          <div className="conv-list" id="usersContainer" style={{ flexGrow: 1, overflowY: 'auto' }}>
            {users.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px', padding: '20px' }}>
                No friends added yet. Use the input above to find and add friends by email!
              </div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="conv-item"
                  onClick={() => startChatWithUser(u.id, u.username)}
                >
                  <div
                    className="avatar"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${u.id}`);
                    }}
                    style={{ cursor: 'pointer' }}
                    title="View profile"
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      u.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="conv-details">
                    <div className="conv-name">{u.username}</div>
                    <div className="conv-preview">{u.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="conv-list" id="requestsContainer" style={{ flexGrow: 1, overflowY: 'auto' }}>
          {friendRequests.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px', padding: '20px' }}>
              <i className="fa-solid fa-user-plus" style={{ fontSize: '24px', marginBottom: '8px', display: 'block', opacity: 0.5 }}></i>
              No pending friend requests.
            </div>
          ) : (
            friendRequests.map((req) => (
              <div
                key={req.sender_id}
                className="conv-item"
                style={{ cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flexGrow: 1 }}>
                  <div
                    className="avatar"
                    onClick={() => navigate(`/profile/${req.sender_id}`)}
                    style={{ cursor: 'pointer' }}
                    title="View profile"
                  >
                    {req.sender_avatar_url ? (
                      <img src={req.sender_avatar_url} alt={req.sender_username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      req.sender_username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="conv-details" style={{ overflow: 'hidden' }}>
                    <div className="conv-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {req.sender_username}
                    </div>
                    <div className="conv-preview" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {req.sender_email}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                  <button
                    onClick={() => acceptRequest(req.sender_id)}
                    style={{
                      background: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontWeight: 600,
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                    title="Accept request"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineRequest(req.sender_id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontWeight: 600,
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                    title="Decline request"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Group Chat Modal */}
      {showGroupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--panel-bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid var(--panel-border)'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>Create Group Chat</h3>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Avengers"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Group Avatar URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.png"
                  value={groupAvatar}
                  onChange={(e) => setGroupAvatar(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Select Members</label>
                <div style={{
                  border: '1px solid var(--panel-border)',
                  borderRadius: '8px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.1)'
                }}>
                  {users.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No members available
                    </div>
                  ) : (
                    users.filter(u => u.id !== currentUser?.id).map((u) => {
                      const isChecked = selectedMembers.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            textAlign: 'left'
                          }}
                          className="friend-select-item"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                              {u.avatar_url ? <img src={u.avatar_url} alt={u.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : u.username.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{u.full_name || u.username}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedMembers(prev =>
                                isChecked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              );
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  style={{
                    width: 'auto',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    borderRadius: '8px',
                    fontWeight: 600
                  }}
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
