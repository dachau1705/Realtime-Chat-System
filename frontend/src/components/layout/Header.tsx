import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { useSearchUsers, useGetMyPages } from '../../utils/api';

import { useLanguage } from '../../context/LanguageContext';

interface UserSearchResult {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface MyPageItem {
  id: string;
  page_name: string;
  username: string;
  avatar: string | null;
  role: string;
}

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { 
    token, 
    currentUser, 
    logout, 
    unreadBadges, 
    conversations, 
    selectConversation,
    notifications,
    unreadNotifCount,
    markNotificationsRead,
    loadNotifications,
    showToast
  } = useChat();

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPagesMenu, setShowPagesMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const searchResults = useSearchUsers(searchQuery, { enabled: !!token }) as any as UserSearchResult[];
  const myPages = useGetMyPages({ enabled: !!token && (showPagesMenu || showProfileMenu) }) as any as MyPageItem[];

  const loadingSearch = false;
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [showChatsMenu, setShowChatsMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);

  // User Account submenus & popup modals states
  const [activeSubMenu, setActiveSubMenu] = useState<'main' | 'settings' | 'help' | 'display' | 'language'>('main');
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general'>('general');
  const [feedbackAttachment, setFeedbackAttachment] = useState<string>('');

  const searchRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const chatsRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Theme synchronization
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    setTheme(nextTheme);
  };

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (pagesRef.current && !pagesRef.current.contains(event.target as Node)) {
        setShowPagesMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (chatsRef.current && !chatsRef.current.contains(event.target as Node)) {
        setShowChatsMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset Account submenus on profile menu close
  useEffect(() => {
    if (!showProfileMenu) {
      setActiveSubMenu('main');
    }
  }, [showProfileMenu]);

  // Handle Ctrl + B keyboard shortcut for submitting feedback when modal is open
  useEffect(() => {
    const handleFeedbackShortcut = (e: KeyboardEvent) => {
      if (showFeedbackModal && e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleSubmitFeedback();
      }
    };
    window.addEventListener('keydown', handleFeedbackShortcut);
    return () => window.removeEventListener('keydown', handleFeedbackShortcut);
  }, [showFeedbackModal, feedbackText, feedbackType, feedbackAttachment]);

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutModal(false);
    setShowProfileMenu(false);
    navigate('/');
  };

  const handleSubmitFeedback = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!feedbackText.trim()) return;

    console.log('[USER_FEEDBACK_SUBMITTED]', {
      type: feedbackType,
      content: feedbackText.trim(),
      attachment: feedbackAttachment.trim() || null
    });

    showToast('Success', 'Cảm ơn ý kiến đóng góp của bạn! Hệ thống đã ghi nhận thành công.', false);
    
    // Reset fields
    setFeedbackText('');
    setFeedbackAttachment('');
    setFeedbackType('general');
    setShowFeedbackModal(false);
    setShowProfileMenu(false);
  };

  const handleSwitchPage = (pageId: string) => {
    navigate(`/pages/${pageId}`);
    setShowProfileMenu(false);
    showToast('Switch Context', 'Đã chuyển sang chế độ quản lý Fanpage.', false);
  };

  return (
    <header className="shared-glass-header">
      <div className="header-logo-section" onClick={() => navigate('/')}>
        <img 
          src={theme === 'light' ? '/logo/connectly-logo-light.jpg' : '/logo/connectly-logo-dark.jpg'} 
          alt="Logo" 
          className="header-logo-img" 
        />
        <span className="header-logo-title">Connectly</span>
      </div>

      {/* 2. Debounced User Search Engine */}
      <div className="header-search-container" ref={searchRef}>
        <div className="header-search-bar">
          <i className="fa-solid fa-magnifying-glass search-icon" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />
          {loadingSearch && <i className="fa-solid fa-spinner fa-spin search-loader" />}
        </div>

        {showSearchResults && searchQuery.trim() && (
          <div className="search-dropdown-menu">
            {searchResults.length === 0 ? (
              <div className="search-no-results">No users found match "{searchQuery}"</div>
            ) : (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="search-result-card"
                  onClick={() => {
                    navigate(`/profile/${user.id}`);
                    setShowSearchResults(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="user-fullname">{user.full_name || user.username}</div>
                    <div className="user-tag">@{user.username}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. Global Action Navigation */}
      <nav className="header-nav-shortcuts">
        <button
          className={`nav-shortcut-btn ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <i className="fa-solid fa-house" />
          <span>Feed</span>
        </button>
        
        <div ref={chatsRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            className={`nav-shortcut-btn ${location.pathname === '/chat' ? 'active' : ''}`}
            onClick={() => setShowChatsMenu(!showChatsMenu)}
            style={{ position: 'relative' }}
          >
            <i className="fa-solid fa-comment-dots" />
            <span>Chats</span>
            {Object.values(unreadBadges).reduce((a, b) => a + b, 0) > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'var(--error)',
                color: 'white',
                fontSize: '9px',
                fontWeight: 800,
                minWidth: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                {Object.values(unreadBadges).reduce((a, b) => a + b, 0)}
              </span>
            )}
          </button>

          {showChatsMenu && (
            <div className="header-dropdown-panel" style={{ 
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px',
              minWidth: '320px',
              zIndex: 20
            }}>
              <div className="dropdown-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Chats</span>
                <span 
                  onClick={() => { navigate('/chat'); setShowChatsMenu(false); }} 
                  style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Open in Messenger
                </span>
              </div>
              
              <div className="panel-list-scroll" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {conversations.length === 0 ? (
                  <div className="panel-empty-info">No active chats. Start a chat from the users list.</div>
                ) : (
                  conversations.map((c) => {
                    const displayName = c.is_group ? (c.name || 'Group Chat') : (c.member_usernames[0] || 'Unknown User');
                    const otherUserId = c.is_group ? '' : c.member_ids[0];
                    const hasBadge = unreadBadges[c.id] > 0;

                    return (
                      <div
                        key={c.id}
                        className="panel-list-item"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          background: hasBadge ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          transition: 'background 0.2s',
                          textAlign: 'left'
                        }}
                        onClick={() => {
                          setShowChatsMenu(false);
                          navigate('/chat');
                          selectConversation(c.id, displayName, otherUserId);
                        }}
                      >
                        <div className="avatar" style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                          {c.is_group && c.avatar_url ? (
                            <img src={c.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : !c.is_group && c.member_avatar_urls?.[0] ? (
                            <img src={c.member_avatar_urls[0]} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {displayName}
                            </span>
                            {hasBadge && (
                              <span style={{
                                background: 'var(--error)',
                                color: 'white',
                                fontSize: '9px',
                                fontWeight: 800,
                                minWidth: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 2px',
                                lineHeight: 1
                              }}>
                                {unreadBadges[c.id]}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: hasBadge ? 'var(--text-main)' : 'var(--text-muted)',
                            fontWeight: hasBadge ? 'bold' : 'normal',
                            marginTop: '2px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
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
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* 4. Dropdown Menus */}
      <div className="header-actions-area">
        {/* Theme Switcher Toggle */}
        <button
          className="action-icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <i className="fa-solid fa-sun" style={{ color: '#F59E0B' }} />
          ) : (
            <i className="fa-solid fa-moon" style={{ color: '#6366F1' }} />
          )}
        </button>

        {/* Fanpage Shortcuts Menu */}
        <div className="header-menu-wrapper" ref={pagesRef}>
          <button
            className={`action-icon-btn ${showPagesMenu ? 'active' : ''}`}
            onClick={() => {
              setShowPagesMenu(!showPagesMenu);
            }}
            title="My Pages"
          >
            <i className="fa-solid fa-flag" />
          </button>

          {showPagesMenu && (
            <div className="header-dropdown-panel right-aligned">
              <div className="dropdown-panel-title">My Fanpages</div>
              <button
                className="panel-action-btn"
                onClick={() => {
                  navigate('/pages/create');
                  setShowPagesMenu(false);
                }}
              >
                <i className="fa-solid fa-circle-plus" />
                <span>Create new Page</span>
              </button>

              <div className="panel-list-scroll">
                {myPages.length === 0 ? (
                  <div className="panel-empty-info">You do not manage any pages yet.</div>
                ) : (
                  myPages.map((page) => (
                    <div
                      key={page.id}
                      className="panel-list-item"
                      onClick={() => {
                        navigate(`/pages/${page.id}`);
                        setShowPagesMenu(false);
                      }}
                    >
                      <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '9px' }}>
                        {page.avatar ? (
                          <img src={page.avatar} alt="logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          page.page_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="panel-item-info">
                        <span className="panel-item-name">{page.page_name}</span>
                        <span className="panel-item-tag">@{page.username} • {page.role}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Social Notifications Menu */}
        <div className="header-menu-wrapper" ref={notificationsRef}>
          <button
            className={`action-icon-btn ${showNotificationsMenu ? 'active' : ''}`}
            onClick={() => {
              setShowNotificationsMenu(!showNotificationsMenu);
              if (!showNotificationsMenu) {
                loadNotifications();
              }
            }}
            title="Notifications"
            style={{ position: 'relative' }}
          >
            <i className="fa-solid fa-bell" />
            {unreadNotifCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'var(--error)',
                color: 'white',
                fontSize: '9px',
                fontWeight: 800,
                minWidth: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}>
                {unreadNotifCount}
              </span>
            )}
          </button>

          {showNotificationsMenu && (
            <div className="header-dropdown-panel right-aligned" style={{ minWidth: '320px' }}>
              <div className="dropdown-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Notifications</span>
                {unreadNotifCount > 0 && (
                  <span
                    onClick={() => markNotificationsRead()}
                    style={{ fontSize: '11px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Mark all read
                  </span>
                )}
              </div>

              <div className="panel-list-scroll" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div className="panel-empty-info">No notifications yet.</div>
                ) : (
                  notifications.map((notif) => {
                    const actorName = notif.actor_full_name || notif.actor_username;
                    let text = '';
                    if (notif.type === 'like') {
                      text = 'liked your post.';
                    } else if (notif.type === 'comment') {
                      text = 'commented on your post.';
                    } else if (notif.type === 'follow') {
                      text = 'started following you.';
                    } else if (notif.type === 'friend_request') {
                      text = 'sent you a friend request.';
                    } else if (notif.type === 'friend_accept') {
                      text = 'accepted your friend request.';
                    }

                    return (
                      <div
                        key={notif.id}
                        className="panel-list-item"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          background: !notif.is_read ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          transition: 'background 0.2s',
                          textAlign: 'left'
                        }}
                        onClick={() => {
                          setShowNotificationsMenu(false);
                          markNotificationsRead(notif.id);
                          if (notif.post_id) {
                            navigate(`/posts/${notif.post_id}`);
                          } else {
                            navigate(`/profile/${notif.actor_id}`);
                          }
                        }}
                      >
                        <div className="avatar" style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                          {notif.actor_avatar_url ? (
                            <img src={notif.actor_avatar_url} alt={actorName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            actorName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                            <span style={{ fontWeight: 600 }}>{actorName}</span> {text}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {new Date(notif.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {!notif.is_read && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            flexShrink: 0,
                            marginLeft: '4px'
                          }}></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Menu */}
        <div className="header-menu-wrapper" ref={profileRef}>
          <button
            className={`action-profile-trigger ${showProfileMenu ? 'active' : ''}`}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                currentUser?.username.charAt(0).toUpperCase()
              )}
            </div>
          </button>

          {showProfileMenu && (
            <div className="header-dropdown-panel right-aligned profile-panel-premium">
              {activeSubMenu === 'main' && (
                <>
                  {/* 2.1. Thông tin tài khoản */}
                  <div 
                    className="profile-panel-header" 
                    onClick={() => { 
                      navigate(`/profile/${currentUser?.id}`); 
                      setShowProfileMenu(false); 
                    }}
                  >
                    <div className="avatar" style={{ width: '40px', height: '40px' }}>
                      {currentUser?.avatar_url ? (
                        <img src={currentUser.avatar_url} alt="avatar" />
                      ) : (
                        currentUser?.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="profile-header-info">
                      <span className="name">{currentUser?.full_name || currentUser?.username}</span>
                      <span className="sub">{t('accountMenu.viewProfile')}</span>
                    </div>
                  </div>
                  <hr className="dropdown-divider" style={{ margin: '8px 0' }} />

                  {/* 2.2. Danh sách Fanpage/Page */}
                  <div className="menu-section-title">{t('accountMenu.managedPages')}</div>
                  <div className="menu-pages-list">
                    {myPages.length === 0 ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px' }}>{t('accountMenu.noPages')}</div>
                    ) : (
                      myPages.slice(0, 3).map((page) => (
                        <div key={page.id} className="menu-page-item" onClick={() => handleSwitchPage(page.id)}>
                          <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                            {page.avatar ? (
                              <img src={page.avatar} alt={page.page_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              page.page_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span>{page.page_name}</span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* 2.3. Xem tất cả trang cá nhân */}
                  <button
                    className="menu-action-item"
                    style={{ color: 'var(--primary)', fontWeight: 600, padding: '8px', fontSize: '12px' }}
                    onClick={() => {
                      navigate('/friends');
                      setShowProfileMenu(false);
                    }}
                  >
                    <span>{t('accountMenu.viewAllPages')}</span>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '9px' }}></i>
                  </button>
                  <hr className="dropdown-divider" style={{ margin: '8px 0' }} />

                  {/* 3. Danh sách chức năng */}
                  <button className="menu-action-item" onClick={() => setActiveSubMenu('settings')}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-gear"></i>
                      <span>{t('accountMenu.settingsPrivacy')}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                  </button>

                  <button className="menu-action-item" onClick={() => setActiveSubMenu('help')}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-circle-question"></i>
                      <span>{t('accountMenu.helpSupport')}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                  </button>

                  <button className="menu-action-item" onClick={() => setActiveSubMenu('display')}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-moon"></i>
                      <span>{t('accountMenu.displayAccessibility')}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                  </button>

                  <button className="menu-action-item" onClick={() => setShowFeedbackModal(true)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-comment-dots"></i>
                      <span>{t('accountMenu.giveFeedback')}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                  </button>

                  <button className="menu-action-item" onClick={() => setShowLogoutModal(true)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-right-from-bracket"></i>
                      <span>{t('accountMenu.logOut')}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                  </button>

                  {/* 4. Footer */}
                  <div className="menu-footer">
                    <a href="#privacy" className="menu-footer-link">{t('accountMenu.privacyFooter')}</a>
                    <span className="menu-footer-bullet">•</span>
                    <a href="#terms" className="menu-footer-link">{t('accountMenu.termsFooter')}</a>
                    <span className="menu-footer-bullet">•</span>
                    <a href="#ads" className="menu-footer-link">{t('accountMenu.adsFooter')}</a>
                    <span className="menu-footer-bullet">•</span>
                    <a href="#adchoices" className="menu-footer-link">{t('accountMenu.adchoicesFooter')}</a>
                    <span className="menu-footer-bullet">•</span>
                    <a href="#cookies" className="menu-footer-link">{t('accountMenu.cookiesFooter')}</a>
                    <span className="menu-footer-bullet">•</span>
                    <a href="#more" className="menu-footer-link">{t('accountMenu.moreFooter')}</a>
                  </div>
                </>
              )}

              {/* 3.1. Cài đặt và quyền riêng tư Submenu */}
              {activeSubMenu === 'settings' && (
                <>
                  <div className="menu-submenu-header">
                    <button className="menu-back-btn" onClick={() => setActiveSubMenu('main')}>
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <span className="menu-submenu-title">{t('accountMenu.settingsPrivacy')}</span>
                  </div>

                  <button className="menu-action-item" onClick={() => { setShowProfileMenu(false); navigate(`/profile/${currentUser?.id}`); }}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-user-gear"></i>
                      <span>{t('accountMenu.personalInfo')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => { setShowProfileMenu(false); navigate(`/profile/${currentUser?.id}`); }}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-shield-halved"></i>
                      <span>{t('accountMenu.accountSecurity')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => { setShowProfileMenu(false); navigate(`/profile/${currentUser?.id}`); }}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-key"></i>
                      <span>{t('accountMenu.changePassword')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Settings', 'Thiết lập Quyền riêng tư sẽ khả dụng trong phiên bản tới.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-lock"></i>
                      <span>{t('accountMenu.privacy')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Settings', 'Thiết lập Thông báo sẽ khả dụng trong phiên bản tới.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-bell"></i>
                      <span>{t('accountMenu.notifications')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => setActiveSubMenu('language')}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-language"></i>
                      <span>{t('accountMenu.language')}</span>
                    </div>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Settings', 'Xem Nhật ký hoạt động.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-list-check"></i>
                      <span>{t('accountMenu.activityLog')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Settings', 'Thiết lập tài khoản tổng quát.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-sliders"></i>
                      <span>{t('accountMenu.generalSettings')}</span>
                    </div>
                  </button>
                </>
              )}

              {/* 3.1.b. Ngôn ngữ Submenu */}
              {activeSubMenu === 'language' && (
                <>
                  <div className="menu-submenu-header">
                    <button className="menu-back-btn" onClick={() => setActiveSubMenu('settings')}>
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <span className="menu-submenu-title">{t('accountMenu.selectLanguage')}</span>
                  </div>

                  <button 
                    className="menu-action-item" 
                    onClick={() => {
                      setLanguage('vi');
                      showToast('Language Changed', 'Đã chuyển đổi sang Tiếng Việt.', false);
                    }}
                    style={{ justifyContent: 'space-between' }}
                  >
                    <div className="menu-action-left">
                      <i className="fa-solid fa-flag"></i>
                      <span>{t('accountMenu.languageVi')}</span>
                    </div>
                    {language === 'vi' && <i className="fa-solid fa-check" style={{ color: 'var(--primary)' }}></i>}
                  </button>

                  <button 
                    className="menu-action-item" 
                    onClick={() => {
                      setLanguage('en');
                      showToast('Language Changed', 'Switched to English successfully.', false);
                    }}
                    style={{ justifyContent: 'space-between' }}
                  >
                    <div className="menu-action-left">
                      <i className="fa-solid fa-flag"></i>
                      <span>{t('accountMenu.languageEn')}</span>
                    </div>
                    {language === 'en' && <i className="fa-solid fa-check" style={{ color: 'var(--primary)' }}></i>}
                  </button>
                </>
              )}

              {/* 3.2. Trợ giúp và hỗ trợ Submenu */}
              {activeSubMenu === 'help' && (
                <>
                  <div className="menu-submenu-header">
                    <button className="menu-back-btn" onClick={() => setActiveSubMenu('main')}>
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <span className="menu-submenu-title">{t('accountMenu.helpSupport')}</span>
                  </div>

                  <button className="menu-action-item" onClick={() => showToast('Help', 'Đang chuyển đến Trung tâm trợ giúp...', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-life-ring"></i>
                      <span>{t('accountMenu.helpCenter')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => { setShowFeedbackModal(true); setFeedbackType('bug'); }}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>{t('accountMenu.reportBug')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Help', 'Đang liên hệ đại diện hỗ trợ khách hàng...', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-envelope"></i>
                      <span>{t('accountMenu.contactSupport')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Help', 'Điều khoản sử dụng.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-file-contract"></i>
                      <span>{t('accountMenu.termsOfUse')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Help', 'Chính sách bảo mật.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-user-shield"></i>
                      <span>{t('accountMenu.privacyPolicy')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Help', 'Các câu hỏi thường gặp (FAQ).', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-circle-info"></i>
                      <span>{t('accountMenu.faq')}</span>
                    </div>
                  </button>
                </>
              )}

              {/* 3.3. Màn hình và trợ năng Submenu */}
              {activeSubMenu === 'display' && (
                <>
                  <div className="menu-submenu-header">
                    <button className="menu-back-btn" onClick={() => setActiveSubMenu('main')}>
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <span className="menu-submenu-title">{t('accountMenu.displayAccessibility')}</span>
                  </div>

                  <div className="menu-display-row" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
                    <div className="display-row-left">
                      <i className="fa-solid fa-moon"></i>
                      <span>{t('accountMenu.darkMode')}</span>
                    </div>
                    <div 
                      className={`custom-toggle-switch ${theme === 'dark' ? 'active' : ''}`} 
                      onClick={toggleTheme}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="toggle-handle"></div>
                    </div>
                  </div>

                  <button className="menu-action-item" onClick={() => showToast('Accessibility', 'Tính năng Auto Theme.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>{t('accountMenu.autoTheme')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Accessibility', 'Điều chỉnh Font Size.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-font"></i>
                      <span>{t('accountMenu.fontSize')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Accessibility', 'Tùy chỉnh các trợ năng khác.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-universal-access"></i>
                      <span>{t('accountMenu.accessibility')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Accessibility', 'Motion Effect toggle.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-film"></i>
                      <span>{t('accountMenu.motionEffect')}</span>
                    </div>
                  </button>

                  <button className="menu-action-item" onClick={() => showToast('Accessibility', 'Danh sách phím tắt hệ thống.', false)}>
                    <div className="menu-action-left">
                      <i className="fa-solid fa-keyboard"></i>
                      <span>{t('accountMenu.keyboardShortcut')}</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 3.5. Xác nhận đăng xuất Popup modal */}
        {showLogoutModal && (
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
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s'
            }}>
              <div style={{ padding: '20px 20px 10px 20px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>{t('accountMenu.confirmLogoutTitle')}</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                  {t('accountMenu.confirmLogoutDesc')}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 20px', background: 'rgba(0,0,0,0.1)', borderTop: '1px solid var(--panel-border)' }}>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    padding: '8px 16px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {t('accountMenu.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  style={{
                    background: 'var(--error)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {t('accountMenu.logOut')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3.4. Đóng góp ý kiến Popup modal */}
        {showFeedbackModal && (
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
              maxWidth: '480px',
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
                padding: '16px 20px',
                borderBottom: '1px solid var(--panel-border)'
              }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>{t('accountMenu.feedbackTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSubmitFeedback} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left' }}>{t('accountMenu.feedbackType')}</label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value as any)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  >
                    <option value="general" style={{ background: '#0c0f1d' }}>{t('accountMenu.typeGeneral')}</option>
                    <option value="bug" style={{ background: '#0c0f1d' }}>{t('accountMenu.typeBug')}</option>
                    <option value="feature" style={{ background: '#0c0f1d' }}>{t('accountMenu.typeFeature')}</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left' }}>{t('accountMenu.feedbackText')}</label>
                  <textarea
                    required
                    placeholder={t('accountMenu.placeholderText')}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '8px',
                      padding: '12px',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left' }}>{t('accountMenu.feedbackAttachment')}</label>
                  <input
                    type="url"
                    placeholder="https://example.com/screenshot.jpg"
                    value={feedbackAttachment}
                    onChange={(e) => setFeedbackAttachment(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-keyboard"></i>
                  <span>{t('accountMenu.shortcutHint')}</span>
                </div>

                {/* Modal Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      padding: '8px 16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    {t('accountMenu.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="primary-btn"
                    style={{
                      width: 'auto',
                      padding: '8px 20px',
                      fontSize: '13px',
                      borderRadius: '8px',
                      fontWeight: 600
                    }}
                  >
                    {t('accountMenu.submitFeedback')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
