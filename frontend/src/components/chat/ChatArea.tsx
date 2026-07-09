import { useState, useEffect, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { uploadMedia } from '../../services/api';
import { ChatRightSidebar } from './ChatRightSidebar';
import { useLanguage } from '../../context/LanguageContext';

export function ChatArea() {
  const { t } = useLanguage();
  const {
    currentRoomId,
    currentUser,
    otherUser,
    conversations,
    messages,
    socketConnected,
    typingStatusText,
    submitMessage,
    toggleSocketConnection,
    sendTypingStatus,
    token
  } = useChat();

  const [inputVal, setInputVal] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState<boolean>(false);

  // Collapsible Right Sidebar state
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(true);
  // Persistent Chat Theme state
  const [chatTheme, setChatTheme] = useState<string>('default');

  useEffect(() => {
    if (currentRoomId) {
      const savedTheme = localStorage.getItem(`chat_theme_${currentRoomId}`) || 'default';
      setChatTheme(savedTheme);
    }
  }, [currentRoomId]);

  const handleThemeChange = (newTheme: string) => {
    setChatTheme(newTheme);
    if (currentRoomId) {
      localStorage.setItem(`chat_theme_${currentRoomId}`, newTheme);
    }
  };

  const stickers = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👏', '🚀', '💯', '✨'];

  // Auto-scroll messages thread to the bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputVal.trim()) return;
    submitMessage(inputVal.trim(), 'text');
    setInputVal('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleKeyDown = () => {
    sendTypingStatus(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyUp = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      setUploading(true);
      const result = await uploadMedia(token, file);
      submitMessage(file.name, 'image', result.url);
    } catch (err: any) {
      console.error('File upload failed', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleStickerClick = (sticker: string) => {
    submitMessage(sticker, 'sticker', sticker);
    setShowStickerPicker(false);
  };

  const hasRoom = !!currentRoomId;
  const activeConv = conversations.find(c => c.id === currentRoomId);
  const displayName = activeConv?.is_group
    ? (activeConv.name || 'Group Chat')
    : otherUser
      ? `Chatting with ${otherUser.full_name || otherUser.username}`
      : activeConv
        ? (activeConv.member_full_names?.[0] || activeConv.member_usernames?.[0] || 'Conversation')
        : 'Conversation';

  const isOnline = activeConv?.is_group ? false : (activeConv?.is_online || otherUser?.is_online);

  const displayStatus = activeConv?.is_group
    ? `Group Chat • ${activeConv.member_ids.length + 1} members`
    : isOnline
      ? 'Online'
      : 'Offline';

  return (
    <div className="chat-viewport-wrapper">
      <div className="chat-area">
        <div className="chat-header">
          <div className="active-chat-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeConv?.is_group && activeConv.avatar_url && (
              <div className="avatar" style={{ width: '38px', height: '38px', flexShrink: 0 }}>
                <img src={activeConv.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              </div>
            )}
            <div>
              <div className="active-chat-name" id="roomTitle">
                {displayName}
              </div>
              <div className="active-chat-status" id="roomStatus">
                {displayStatus}
              </div>
            </div>
          </div>

          <div className="chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="network-controls">
              <div className="network-indicator">
                <div className={`net-dot ${socketConnected ? '' : 'disconnected'}`} id="socketNetDot"></div>
                <span id="socketStatusText">{socketConnected ? 'Online' : 'Offline'}</span>
              </div>
              <button className="net-btn" id="simulateDropBtn" onClick={toggleSocketConnection} title="Toggle client network state">
                <i className={`fa-solid ${socketConnected ? 'fa-plug-circle-xmark' : 'fa-plug'}`}></i> {socketConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>

            {hasRoom && (
              <button 
                className={`sidebar-toggle-btn ${showRightSidebar ? 'active' : ''}`}
                onClick={() => setShowRightSidebar(!showRightSidebar)}
                title="Conversation Details"
                style={{
                  background: showRightSidebar ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: '1px solid var(--panel-border)',
                  color: showRightSidebar ? 'var(--primary)' : 'var(--text-muted)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-circle-info" style={{ fontSize: '18px' }}></i>
              </button>
            )}
          </div>
        </div>

        <div className={`message-history theme-${chatTheme}`} id="messagesContainer">
          {!hasRoom ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto', padding: '40px' }}>
              <i className="fa-regular fa-comment-dots" style={{ fontSize: '48px', color: 'var(--panel-border)', marginBottom: '16px', display: 'block' }}></i>
              <p>Select a user and start messaging.</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto', padding: '40px' }}>
              <p>No messages yet. Say hello to {otherUser?.username}!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUser?.id;
              const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              let tickClass = '';
              let colorClass = '';
              if (isMe) {
                if (msg.status === 'pending') {
                  tickClass = 'fa-check';
                  colorClass = 'sent';
                } else if (msg.status === 'sent') {
                  tickClass = 'fa-check';
                  colorClass = 'sent';
                } else if (msg.status === 'delivered') {
                  tickClass = 'fa-check-double';
                  colorClass = 'delivered';
                } else if (msg.status === 'seen') {
                  tickClass = 'fa-check-double';
                  colorClass = 'seen';
                }
              }

              const isSticker = msg.type === 'sticker';
              const rowClass = `msg-row ${isMe ? 'sent' : 'received'} ${msg.status === 'pending' ? 'pending' : ''} ${isSticker ? 'sticker-row' : ''}`;

              const renderMessageContent = () => {
                if (msg.type === 'image') {
                  return (
                    <div className="msg-media-container" style={{ position: 'relative' }}>
                      <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={msg.media_url} 
                          alt="Uploaded media" 
                          className="msg-media-img" 
                          style={{ maxWidth: '250px', maxHeight: '250px', borderRadius: '12px', display: 'block', cursor: 'zoom-in' }} 
                        />
                      </a>
                    </div>
                  );
                } else if (isSticker) {
                  return (
                    <div className="msg-sticker" style={{ fontSize: '64px', lineHeight: 1, padding: '4px' }}>
                      {msg.media_url || msg.content}
                    </div>
                  );
                } else {
                  return <div className="msg-text">{msg.content}</div>;
                }
              };

              return (
                <div key={msg.id || index} className={rowClass} id={`msg-row-${msg.id || msg.client_message_id}`}>
                  {!isMe && activeConv?.is_group && (
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '3px',
                      marginLeft: '8px'
                    }}>
                      {msg.sender_full_name || msg.sender_username || 'Member'}
                    </div>
                  )}
                  <div className={isSticker ? "msg-bubble-sticker" : "msg-bubble"}>
                    {renderMessageContent()}
                    <div className="msg-meta">
                      <span>{time}</span>
                      {isMe && <i className={`fa-solid ${tickClass} msg-status-icon ${colorClass}`} id={`tick-${msg.id || msg.client_message_id}`}></i>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="typing-indicator-container" id="typingContainer">
          {typingStatusText}
        </div>

        <div className="chat-input-bar">
          <button 
            className="input-action-btn" 
            onClick={handleAttachClick} 
            disabled={!hasRoom || uploading}
            title="Attach Image"
            style={{ marginRight: '4px' }}
          >
            {uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-image"></i>}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*" 
            onChange={handleFileChange} 
          />

          <div className="sticker-picker-container" style={{ position: 'relative', marginRight: '4px' }}>
            <button 
              className="input-action-btn" 
              onClick={() => setShowStickerPicker(!showStickerPicker)} 
              disabled={!hasRoom}
              title="Stickers & Emojis"
            >
              <i className="fa-regular fa-face-smile"></i>
            </button>
            {showStickerPicker && (
              <div className="sticker-popover">
                <div className="sticker-grid">
                  {stickers.map((sticker, idx) => (
                    <button 
                      key={idx} 
                      className="sticker-item-btn" 
                      onClick={() => handleStickerClick(sticker)}
                    >
                      {sticker}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="input-wrapper">
            <input
              type="text"
              className="chat-input"
              id="messageInput"
              placeholder={t('chat.placeholderInput')}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onKeyPress={handleKeyPress}
              autoComplete="off"
              disabled={!hasRoom}
            />
          </div>
          <button className="send-btn" id="sendBtn" onClick={handleSend} disabled={!hasRoom}>
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
      {showRightSidebar && hasRoom && (
        <ChatRightSidebar chatTheme={chatTheme} onThemeChange={handleThemeChange} />
      )}
    </div>
  );
}

