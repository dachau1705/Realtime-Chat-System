import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { FeedContainer } from './FeedContainer';
import { fetchSuggestions, followUser, type UserSuggestion } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export function FeedPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { token, showToast, users } = useChat();

  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const loadSuggestionsList = async () => {
    if (!token) return;
    setLoadingSuggestions(true);
    try {
      const data = await fetchSuggestions(token);
      setSuggestions(data);
    } catch (err: any) {
      console.error('Failed to load suggestions list', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    loadSuggestionsList();
  }, [token]);

  const handleFollowClick = async (targetUserId: string) => {
    if (!token || actionUserId) return;
    setActionUserId(targetUserId);
    try {
      await followUser(token, targetUserId);
      showToast(t('common.success') || 'Success', t('feed.followSuccess'), false);
      
      // Remove followed user from local suggestions list
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || t('feed.followError'), true);
    } finally {
      setActionUserId(null);
    }
  };

  // Extract a few online users (friends) from our chat context user list to render in the right panel
  const onlineUsers = users.slice(0, 5);

  // Trending hashtags mockup
  const trendingTopics = [
    { tag: '#React19', postsCount: '15.4K posts' },
    { tag: '#ZustandState', postsCount: '8.2K posts' },
    { tag: '#WebSockets', postsCount: '22.1K posts' },
    { tag: '#KafkaScalability', postsCount: '4.7K posts' },
    { tag: '#NextJS15', postsCount: '18.9K posts' }
  ];

  return (
    <div 
      className="feed-page-layout" 
      style={{
        display: 'flex',
        flexGrow: 1,
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.02)',
        height: '100%',
        width: '100%'
      }}
    >
      {/* 1. Feed Center Column */}
      <div 
        className="feed-column" 
        style={{
          flexGrow: 1,
          padding: '20px 24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%'
        }}
      >
        <FeedContainer />
      </div>

      {/* 2. Right Sidebar Column */}
      <div 
        className="right-sidebar-column" 
        style={{
          width: '320px',
          borderLeft: '1px solid var(--panel-border)',
          background: 'var(--panel-bg)',
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          flexShrink: 0,
          boxShadow: '-2px 0 10px rgba(0,0,0,0.02)'
        }}
      >
        {/* Suggested Friends Section */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', marginBottom: '14px' }}>
            <i className="fa-solid fa-user-plus" style={{ color: 'var(--primary)' }}></i> {t('feed.suggestedFriends')}
          </h3>

          {loadingSuggestions ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', textAlign: 'center', padding: '12px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> {t('feed.loadingSuggestions')}
            </div>
          ) : suggestions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', textAlign: 'center', padding: '12px' }}>
              {t('feed.noSuggestions')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {suggestions.map((user) => (
                <div 
                  key={user.id} 
                  className="suggestion-item-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--panel-bg)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    gap: '8px',
                    transition: 'background 0.2s'
                  }}
                >
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => navigate(`/profile/${user.id}`)}
                  >
                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px', flexShrink: 0 }}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ 
                        fontSize: '12.5px', 
                        fontWeight: 600, 
                        color: 'var(--text-main)', 
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {user.full_name || user.username}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {user.mutual_friends_count > 0 ? `${user.mutual_friends_count} mutual friends` : `@${user.username}`}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFollowClick(user.id)}
                    disabled={actionUserId === user.id}
                    className="primary-btn"
                    style={{
                      width: 'auto',
                      padding: '6px 12px',
                      fontSize: '11px',
                      borderRadius: '8px',
                      flexShrink: 0
                    }}
                  >
                    {actionUserId === user.id ? <i className="fa-solid fa-spinner fa-spin"></i> : t('feed.follow')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trending Section */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', marginBottom: '14px' }}>
            <i className="fa-solid fa-fire" style={{ color: '#E42645' }}></i> {t('feed.trendingTopics')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {trendingTopics.map((topic, i) => (
              <div 
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}
                className="trending-item"
                onClick={() => showToast('Hashtag Filter', `Filtering by ${topic.tag} will be available in future releases.`, false)}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{topic.tag}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{topic.postsCount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Online Friends Section */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', marginBottom: '14px' }}>
            <i className="fa-solid fa-circle" style={{ color: 'var(--success)', fontSize: '10px' }}></i> {t('feed.activeFriends')}
          </h3>
          {onlineUsers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '6px' }}>
              {t('feed.noFriendsOnline')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {onlineUsers.map((user) => (
                <div 
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  className="online-user-row"
                  onClick={() => navigate(`/profile/${user.id}`)}
                >
                  <div style={{ position: 'relative' }}>
                    <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '11px' }}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Status Dot */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-1px',
                      right: '-1px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--success)',
                      border: '2px solid var(--panel-bg)'
                    }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>
                    {user.full_name || user.username}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
