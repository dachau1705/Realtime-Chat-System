import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';

export function Sidebar() {
  const navigate = useNavigate();
  const [friendEmail, setFriendEmail] = useState<string>('');
  const [adding, setAdding] = useState<boolean>(false);
  const [addResultMsg, setAddResultMsg] = useState<{ text: string; isError: boolean } | null>(null);

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
    logout,
    selectConversation,
    startChatWithUser,
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

  const handleLogoutClick = () => {
    if (confirm("Are you sure you want to log out?")) {
      logout();
    }
  };

  const handleProfileClick = () => {
    if (currentUser?.id) {
      navigate(`/profile/${currentUser.id}`);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h2>
            <i className="fa-solid fa-comments"></i> HODA Chat
          </h2>
          <button 
            className="sidebar-logout-btn" 
            onClick={handleLogoutClick} 
            title="Log out"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
        <div className="user-selector" onClick={handleProfileClick} title="View your profile">
          <div className="avatar" id="myAvatar">
            {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
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

      <div className="sidebar-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.1)' }}>
        <button 
          className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`} 
          onClick={() => {
            setActiveTab('feed');
            markNotificationsRead();
            navigate('/');
          }}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'feed' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'feed' ? '2px solid var(--primary)' : '2px solid transparent',
            fontSize: '13px',
            position: 'relative'
          }}
        >
          <i className="fa-solid fa-square-rss"></i> Feed
          {unreadNotifCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              background: 'var(--primary)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
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
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'conversations' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'conversations' ? '2px solid var(--primary)' : '2px solid transparent',
            fontSize: '13px'
          }}
        >
          <i className="fa-solid fa-message"></i> Chats
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} 
          onClick={() => {
            setActiveTab('users');
            navigate('/chat');
          }}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'users' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : '2px solid transparent',
            fontSize: '13px'
          }}
        >
          <i className="fa-solid fa-users"></i> Users
        </button>
        <button 
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} 
          onClick={() => {
            setActiveTab('requests');
            navigate('/chat');
          }}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'requests' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'requests' ? '2px solid var(--primary)' : '2px solid transparent',
            fontSize: '13px',
            position: 'relative'
          }}
        >
          <i className="fa-solid fa-user-plus"></i> Requests
          {friendRequests.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              background: 'var(--error)',
              color: 'white',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {friendRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'conversations' ? (
        <div className="conv-list" id="conversationsContainer">
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
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="conv-details">
                    <div className="conv-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{displayName}</span>
                      {hasBadge && (
                        <span className="unread-badge" style={{ background: 'var(--primary)', color: 'white', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', marginLeft: '8px' }}>
                          New
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
                    {u.username.charAt(0).toUpperCase()}
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
                    {req.sender_username.charAt(0).toUpperCase()}
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
    </div>
  );
}
