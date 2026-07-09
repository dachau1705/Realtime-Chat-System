import { useState, useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { useLanguage } from '../../context/LanguageContext';

interface ChatRightSidebarProps {
  chatTheme: string;
  onThemeChange: (theme: string) => void;
}

export function ChatRightSidebar({ chatTheme, onThemeChange }: ChatRightSidebarProps) {
  const { t } = useLanguage();
  const {
    currentRoomId,
    currentUser,
    otherUser,
    conversations,
    messages
  } = useChat();

  const [expandedSections, setExpandedSections] = useState({
    info: true,
    customization: true,
    members: false,
    shared: false
  });

  const [muted, setMuted] = useState<boolean>(false);
  const [sharedTab, setSharedTab] = useState<'media' | 'files' | 'links'>('media');

  // Message Search states
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeConv = conversations.find(c => c.id === currentRoomId);

  // Filter messages based on search query
  const filteredMessages = messages.filter(msg => {
    if (!msg.content || msg.type === 'image' || msg.type === 'sticker') return false;
    return msg.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleScrollToMessage = (id: string, clientMessageId?: string) => {
    const targetId = id || clientMessageId;
    if (!targetId) return;
    const element = document.getElementById(`msg-row-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-flash');
      setTimeout(() => {
        element.classList.remove('highlight-flash');
      }, 2000);
    }
  };

  // Load mute status on mount or room switch
  useEffect(() => {
    if (currentRoomId) {
      const isMuted = localStorage.getItem(`chat_mute_${currentRoomId}`) === 'true';
      setMuted(isMuted);
    }
  }, [currentRoomId]);

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (currentRoomId) {
      localStorage.setItem(`chat_mute_${currentRoomId}`, String(nextMuted));
    }
  };

  const toggleSection = (section: 'info' | 'customization' | 'members' | 'shared') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!currentRoomId || !activeConv) {
    return (
      <div className="chat-right-sidebar empty">
        <p>No active conversation selected</p>
      </div>
    );
  }

  // Determine chat name, avatar, and type details
  const displayName = activeConv.is_group
    ? (activeConv.name || 'Group Chat')
    : otherUser
      ? (otherUser.full_name || otherUser.username)
      : (activeConv.member_full_names?.[0] || activeConv.member_usernames?.[0] || 'Chat');

  const chatAvatar = activeConv.is_group && activeConv.avatar_url
    ? activeConv.avatar_url
    : !activeConv.is_group && activeConv.member_avatar_urls?.[0]
      ? activeConv.member_avatar_urls[0]
      : '';

  const subtitle = activeConv.is_group
    ? `Group Chat • ${activeConv.member_ids.length + 1} members`
    : 'Direct Conversation';

  // Gather members
  const memberList = [];
  if (activeConv.is_group) {
    // Add current user
    if (currentUser) {
      memberList.push({
        id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.full_name,
        avatar: currentUser.avatar_url,
        role: 'Creator'
      });
    }
    // Add other members
    activeConv.member_ids.forEach((id, index) => {
      memberList.push({
        id,
        username: activeConv.member_usernames[index] || 'Member',
        fullName: activeConv.member_full_names?.[index] || null,
        avatar: activeConv.member_avatar_urls?.[index] || '',
        role: 'Member'
      });
    });
  } else {
    // Direct chat members
    if (currentUser) {
      memberList.push({
        id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.full_name,
        avatar: currentUser.avatar_url,
        role: 'You'
      });
    }
    if (otherUser) {
      memberList.push({
        id: otherUser.id,
        username: otherUser.username,
        fullName: otherUser.full_name,
        avatar: otherUser.avatar_url || activeConv.member_avatar_urls?.[0],
        role: 'Friend'
      });
    }
  }

  // Shared items extraction from messages history
  const sharedMedia: string[] = [];
  const sharedFiles: Array<{ name: string; url: string; time: string }> = [];
  const sharedLinks: Array<{ text: string; url: string; time: string }> = [];

  const urlRegex = /(https?:\/\/[^\s]+)/gi;

  messages.forEach(msg => {
    if (msg.type === 'image' && msg.media_url) {
      sharedMedia.push(msg.media_url);
    } else if (msg.media_url) {
      // Any other media files or documents uploaded
      sharedFiles.push({
        name: msg.content || 'Attached File',
        url: msg.media_url,
        time: new Date(msg.created_at).toLocaleDateString()
      });
    }

    // Extract links from text message content
    if (msg.content && msg.type !== 'image' && msg.type !== 'sticker') {
      const links = msg.content.match(urlRegex);
      if (links) {
        links.forEach(link => {
          sharedLinks.push({
            text: link,
            url: link,
            time: new Date(msg.created_at).toLocaleDateString()
          });
        });
      }
    }
  });

  return (
    <div className="chat-right-sidebar">
      {/* 1. Thông tin đoạn chat (Chat Info) */}
      <div className="sidebar-section info-section">
        <div className="section-header-static">
          <div className="sidebar-chat-avatar">
            {chatAvatar ? (
              <img src={chatAvatar} alt={displayName} />
            ) : (
              <div className="avatar-fallback">{displayName.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <h3 className="sidebar-chat-name">{displayName}</h3>
          <span className="sidebar-chat-subtitle">{subtitle}</span>
        </div>
      </div>

      {/* Accordion List wrapper */}
      <div className="sidebar-accordion-wrapper">
        {/* 2. Tùy chỉnh đoạn chat (Chat Customization) */}
        <div className={`accordion-item ${expandedSections.customization ? 'open' : ''}`}>
          <button className="accordion-title-btn" onClick={() => toggleSection('customization')}>
            <span><i className="fa-solid fa-gears icon-prefix"></i> {t('accountMenu.settingsPrivacy')}</span>
            <i className={`fa-solid fa-chevron-down chevron ${expandedSections.customization ? 'rotate' : ''}`}></i>
          </button>
          
          {expandedSections.customization && (
            <div className="accordion-content">
              {/* Theme customizer selector */}
              <div className="customize-option">
                <label className="option-label">{t('chat.themeSelector')}</label>
                <div className="theme-circles-grid">
                  {[
                    { id: 'default', color: 'var(--panel-bg)', label: 'Default' },
                    { id: 'ocean', color: 'linear-gradient(135deg, #0b2545, #134074)', label: 'Ocean' },
                    { id: 'sunset', color: 'linear-gradient(135deg, #31102f, #581c87)', label: 'Sunset' },
                    { id: 'emerald', color: 'linear-gradient(135deg, #064e3b, #065f46)', label: 'Emerald' },
                    { id: 'midnight', color: 'linear-gradient(135deg, #09090b, #27272a)', label: 'Dark' }
                  ].map(themeItem => (
                    <button
                      key={themeItem.id}
                      className={`theme-circle-btn ${chatTheme === themeItem.id ? 'active' : ''}`}
                      style={{ background: themeItem.color }}
                      onClick={() => onThemeChange(themeItem.id)}
                      title={themeItem.label}
                    />
                  ))}
                </div>
              </div>

              {/* Mute alerts option */}
              <div className="customize-action-row" onClick={toggleMute}>
                <div className="action-details">
                  <i className={`fa-solid ${muted ? 'fa-bell-slash text-error' : 'fa-bell'}`}></i>
                  <span>{t('chat.muteNotifications')}</span>
                </div>
                <div className={`custom-toggle-switch ${muted ? 'active' : ''}`}>
                  <div className="toggle-handle"></div>
                </div>
              </div>

              {/* Search option */}
              <div className="customize-action-row" onClick={() => setShowSearch(!showSearch)} style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px', marginTop: '4px' }}>
                <div className="action-details">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <span>{t('chat.searchPlaceholder')}</span>
                </div>
                <i className={`fa-solid fa-chevron-down chevron ${showSearch ? 'rotate' : ''}`} style={{ fontSize: '10px', color: 'var(--text-muted)' }}></i>
              </div>

              {showSearch && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }} className="search-in-chat-container">
                  <div className="modal-search-wrapper" style={{ position: 'relative' }}>
                    <i className="fa-solid fa-magnifying-glass search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px' }}></i>
                    <input
                      type="text"
                      placeholder={t('chat.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="modal-search-input"
                      style={{ paddingLeft: '34px', width: '100%', paddingRight: '12px' }}
                      autoFocus
                    />
                  </div>
                  {searchQuery.trim() && (
                    <div className="sidebar-search-results" style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      marginTop: '6px',
                      padding: '4px'
                    }}>
                      {filteredMessages.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>No messages found</div>
                      ) : (
                        filteredMessages.map(msg => (
                          <div
                            key={msg.id}
                            onClick={() => handleScrollToMessage(msg.id, msg.client_message_id)}
                            style={{
                              padding: '8px',
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid var(--panel-border)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                              textAlign: 'left'
                            }}
                            className="search-result-item"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                              <span style={{ fontWeight: 600 }}>{msg.sender_id === currentUser?.id ? 'You' : (msg.sender_username || 'Friend')}</span>
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {msg.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Thành viên đoạn chat (Chat Members) - Group Chat only */}
        {activeConv.is_group && (
          <div className={`accordion-item ${expandedSections.members ? 'open' : ''}`}>
            <button className="accordion-title-btn" onClick={() => toggleSection('members')}>
              <span><i className="fa-solid fa-users-gear icon-prefix"></i> {t('chat.membersList')}</span>
              <i className={`fa-solid fa-chevron-down chevron ${expandedSections.members ? 'rotate' : ''}`}></i>
            </button>

            {expandedSections.members && (
              <div className="accordion-content no-padding">
                <div className="members-list-container">
                  {memberList.map(member => (
                    <div key={member.id} className="sidebar-member-item">
                      <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                        {member.avatar ? <img src={member.avatar} alt={member.username} /> : member.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="member-info">
                        <span className="member-name">{member.fullName || member.username}</span>
                        <span className="member-username">@{member.username}</span>
                      </div>
                      <span className={`member-role-badge ${member.role === 'Creator' || member.role === 'You' ? 'highlight' : ''}`}>
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. File phương tiện, file, liên kết được chia sẻ (Shared Files) */}
        <div className={`accordion-item ${expandedSections.shared ? 'open' : ''}`}>
          <button className="accordion-title-btn" onClick={() => toggleSection('shared')}>
            <span><i className="fa-solid fa-folder-open icon-prefix"></i> {t('chat.sharedFiles')}</span>
            <i className={`fa-solid fa-chevron-down chevron ${expandedSections.shared ? 'rotate' : ''}`}></i>
          </button>

          {expandedSections.shared && (
            <div className="accordion-content no-padding">
              {/* Tabs selector */}
              <div className="shared-sub-tabs">
                <button 
                  className={`sub-tab-btn ${sharedTab === 'media' ? 'active' : ''}`}
                  onClick={() => setSharedTab('media')}
                >
                  {t('chat.media')}
                </button>
                <button 
                  className={`sub-tab-btn ${sharedTab === 'files' ? 'active' : ''}`}
                  onClick={() => setSharedTab('files')}
                >
                  {t('chat.files')}
                </button>
                <button 
                  className={`sub-tab-btn ${sharedTab === 'links' ? 'active' : ''}`}
                  onClick={() => setSharedTab('links')}
                >
                  {t('chat.links')}
                </button>
              </div>

              {/* Scrollable list contents */}
              <div className="shared-tab-viewpane">
                {sharedTab === 'media' && (
                  <div className="shared-media-grid">
                    {sharedMedia.length === 0 ? (
                      <div className="empty-shared-info">{t('chat.noMedia')}</div>
                    ) : (
                      sharedMedia.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="media-grid-item">
                          <img src={url} alt="Shared media thumbnail" />
                        </a>
                      ))
                    )}
                  </div>
                )}

                {sharedTab === 'files' && (
                  <div className="shared-files-list">
                    {sharedFiles.length === 0 ? (
                      <div className="empty-shared-info">{t('chat.noFiles')}</div>
                    ) : (
                      sharedFiles.map((file, idx) => (
                        <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="shared-file-row">
                          <i className="fa-solid fa-file-invoice"></i>
                          <div className="file-meta">
                            <span className="file-name" title={file.name}>{file.name}</span>
                            <span className="file-date">{file.time}</span>
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                )}

                {sharedTab === 'links' && (
                  <div className="shared-links-list">
                    {sharedLinks.length === 0 ? (
                      <div className="empty-shared-info">{t('chat.noLinks')}</div>
                    ) : (
                      sharedLinks.map((link, idx) => (
                        <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="shared-link-row">
                          <i className="fa-solid fa-link"></i>
                          <div className="link-meta">
                            <span className="link-text" title={link.text}>{link.text}</span>
                            <span className="link-date">{link.time}</span>
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
