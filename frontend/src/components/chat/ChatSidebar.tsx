import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { useLanguage } from '../../context/LanguageContext';

export function ChatSidebar() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    currentUser,
    conversations,
    users,
    unreadBadges,
    currentRoomId,
    selectConversation,
    startChatWithUser,
    createGroupChat,
    loadConversations,
    loadUserList,
    logout
  } = useChat();

  // Component states
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'group'>('all');
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'direct' | 'group'>('direct');

  // Group chat creation states
  const [groupName, setGroupName] = useState<string>('');
  const [groupAvatar, setGroupAvatar] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState<string>('');

  // Initial data loading
  useEffect(() => {
    loadConversations();
    loadUserList();
  }, []);

  // Close menu dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtering conversations
  const filteredConversations = conversations.filter((c) => {
    if (activeFilter === 'unread') {
      return (unreadBadges[c.id] || 0) > 0;
    }
    if (activeFilter === 'group') {
      return c.is_group;
    }
    return true; // 'all'
  });

  const handleStartDirectChat = async (userId: string, username: string) => {
    await startChatWithUser(userId, username);
    setShowModal(false);
    setFriendSearchQuery('');
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
      setShowModal(false);
      setGroupName('');
      setGroupAvatar('');
      setSelectedMembers([]);
    } catch (err) {
      console.error('Failed to create group chat:', err);
    }
  };

  const handleLogoutClick = () => {
    logout();
    navigate('/');
  };

  // Filter friends list for starting a chat
  const filteredFriends = users.filter((u) => {
    if (u.id === currentUser?.id) return false;
    const nameMatch = (u.full_name || '').toLowerCase().includes(friendSearchQuery.toLowerCase());
    const userMatch = u.username.toLowerCase().includes(friendSearchQuery.toLowerCase());
    return nameMatch || userMatch;
  });

  return (
    <div className="chat-sidebar">
      {/* Sidebar Header Section */}
      <div className="chat-sidebar-header">
        <h2 className="chat-sidebar-title">{t('sidebar.chats')}</h2>
        
        <div className="chat-sidebar-actions">
          {/* Action Menu (Menu Thao Tác) */}
          <div className="menu-dropdown-wrapper" ref={menuRef}>
            <button 
              className={`sidebar-icon-btn ${showMenu ? 'active' : ''}`} 
              onClick={() => setShowMenu(!showMenu)}
              title="Menu Options"
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
            {showMenu && (
              <div className="sidebar-dropdown-menu">
                <button onClick={() => { setShowMenu(false); navigate('/'); }}>
                  <i className="fa-solid fa-house"></i> {t('sidebar.feed')}
                </button>
                <button onClick={() => { setShowMenu(false); navigate('/friends'); }}>
                  <i className="fa-solid fa-users"></i> {t('sidebar.friends')}
                </button>
                <button onClick={() => { setShowMenu(false); navigate('/friends/requests'); }}>
                  <i className="fa-solid fa-user-plus"></i> {t('sidebar.requests')}
                </button>
                {currentUser?.id && (
                  <button onClick={() => { setShowMenu(false); navigate(`/profile/${currentUser.id}`); }}>
                    <i className="fa-regular fa-user"></i> {t('accountMenu.viewProfile')}
                  </button>
                )}
                <hr className="dropdown-divider" />
                <button onClick={handleLogoutClick} className="logout-action-btn">
                  <i className="fa-solid fa-arrow-right-from-bracket"></i> {t('accountMenu.logOut')}
                </button>
              </div>
            )}
          </div>

          {/* New Chat Button (Đoạn Chat Mới) */}
          <button 
            className="sidebar-icon-btn highlight" 
            onClick={() => {
              loadUserList();
              setShowModal(true);
            }}
            title="New Chat / Group"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
      </div>

      {/* Tabs Filter Section */}
      <div className="chat-sidebar-tabs">
        <button 
          className={`sidebar-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          {t('chat.tabAll')}
        </button>
        <button 
          className={`sidebar-tab-btn ${activeFilter === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveFilter('unread')}
        >
          {t('chat.tabNotSeen')}
          {Object.values(unreadBadges).reduce((a, b) => a + b, 0) > 0 && (
            <span className="unread-dot"></span>
          )}
        </button>
        <button 
          className={`sidebar-tab-btn ${activeFilter === 'group' ? 'active' : ''}`}
          onClick={() => setActiveFilter('group')}
        >
          {t('chat.tabGroup')}
        </button>
      </div>

      {/* Conversations List */}
      <div className="chat-conversations-list">
        {filteredConversations.length === 0 ? (
          <div className="chat-empty-state">
            <i className="fa-regular fa-comments"></i>
            <p>{t('chat.noMedia')}</p>
          </div>
        ) : (
          filteredConversations.map((c) => {
            const displayName = c.is_group ? (c.name || 'Group Chat') : (c.member_usernames[0] || 'Unknown User');
            const otherUserId = c.is_group ? '' : c.member_ids[0];
            const isActive = currentRoomId === c.id;
            const hasBadge = unreadBadges[c.id] > 0;

            return (
              <div
                key={c.id}
                className={`chat-conversation-item ${isActive ? 'active' : ''}`}
                onClick={() => selectConversation(c.id, displayName, otherUserId)}
              >
                <div className="chat-avatar-container">
                  <div className="avatar">
                    {c.is_group && c.avatar_url ? (
                      <img src={c.avatar_url} alt={displayName} />
                    ) : !c.is_group && c.member_avatar_urls?.[0] ? (
                      <img src={c.member_avatar_urls[0]} alt={displayName} />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  {!c.is_group && c.is_online && <div className="presence-dot-online"></div>}
                </div>
                
                <div className="chat-item-details">
                  <div className="chat-item-header">
                    <span className="chat-item-name">{displayName}</span>
                    <span className="chat-item-time">
                      {c.last_message_time ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  
                  <div className="chat-item-body">
                    <span className={`chat-item-preview ${hasBadge ? 'unread' : ''}`}>
                      {(() => {
                        if (!c.last_message_content) return 'No messages yet';
                        const prefix = c.last_message_sender_id === currentUser?.id
                          ? 'You: '
                          : (c.is_group ? `${c.last_message_sender_username}: ` : '');
                        
                        if (c.last_message_type === 'image') {
                          return `${prefix}📷 Image`;
                        }
                        if (c.last_message_type === 'sticker') {
                          return `${prefix}🎬 Sticker`;
                        }
                        return `${prefix}${c.last_message_content}`;
                      })()}
                    </span>
                    {hasBadge && (
                      <span className="unread-count-badge">
                        {unreadBadges[c.id]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Chat & Create Group Modal */}
      {showModal && (
        <div className="chat-modal-overlay">
          <div className="chat-modal-content">
            <div className="chat-modal-header">
              <h3>{t('chat.newDirectChat')}</h3>
              <button className="close-modal-btn" onClick={() => {
                setShowModal(false);
                setFriendSearchQuery('');
                setGroupName('');
                setSelectedMembers([]);
              }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Tabs: Direct Chat or Group Chat */}
            <div className="chat-modal-tabs">
              <button 
                className={`modal-tab-btn ${modalMode === 'direct' ? 'active' : ''}`}
                onClick={() => setModalMode('direct')}
              >
                {t('chat.newDirectChat')}
              </button>
              <button 
                className={`modal-tab-btn ${modalMode === 'group' ? 'active' : ''}`}
                onClick={() => setModalMode('group')}
              >
                {t('chat.newGroupChat')}
              </button>
            </div>

            {modalMode === 'direct' ? (
              <div className="modal-body-direct">
                <div className="modal-search-wrapper">
                  <i className="fa-solid fa-magnifying-glass search-icon"></i>
                  <input
                    type="text"
                    placeholder={t('friends.searchFriends')}
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    className="modal-search-input"
                    autoFocus
                  />
                </div>
                <div className="modal-friends-list">
                  {filteredFriends.length === 0 ? (
                    <div className="modal-empty-state">{t('friends.noRequests')}</div>
                  ) : (
                    filteredFriends.map((u) => (
                      <div 
                        key={u.id} 
                        className="modal-friend-item"
                        onClick={() => handleStartDirectChat(u.id, u.username)}
                      >
                        <div className="avatar">
                          {u.avatar_url ? <img src={u.avatar_url} alt={u.username} /> : u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="modal-friend-info">
                          <span className="name">{u.full_name || u.username}</span>
                          <span className="username">@{u.username}</span>
                        </div>
                        <i className="fa-solid fa-comment-medical chat-icon"></i>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateGroupSubmit} className="modal-body-group">
                <div className="form-group">
                  <label>{t('chat.groupName')}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Study Group"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Group Avatar URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.png"
                    value={groupAvatar}
                    onChange={(e) => setGroupAvatar(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>{t('chat.members')}</label>
                  <div className="modal-members-checklist">
                    {users.length === 0 ? (
                      <div className="empty-state">No friends to invite</div>
                    ) : (
                      users.filter(u => u.id !== currentUser?.id).map((u) => {
                        const isChecked = selectedMembers.includes(u.id);
                        return (
                          <label key={u.id} className="checklist-item">
                            <div className="checklist-friend">
                              <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                                {u.avatar_url ? <img src={u.avatar_url} alt={u.username} /> : u.username.charAt(0).toUpperCase()}
                              </div>
                              <span>{u.full_name || u.username}</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedMembers(prev =>
                                  isChecked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                );
                              }}
                            />
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="modal-footer-actions">
                  <button 
                    type="button" 
                    className="secondary-btn" 
                    onClick={() => {
                      setShowModal(false);
                      setGroupName('');
                      setSelectedMembers([]);
                    }}
                  >
                    {t('accountMenu.cancel')}
                  </button>
                  <button type="submit" className="primary-btn">
                    {t('chat.create')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
