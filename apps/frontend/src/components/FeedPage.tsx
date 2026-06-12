import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { CreatePostBox } from './CreatePostBox';
import { PostCard } from './PostCard';
import { 
  fetchFeed, 
  fetchSuggestions, 
  followUser,
  type Post, 
  type UserSuggestion
} from '../services/api';

export function FeedPage() {
  const navigate = useNavigate();
  const { token, showToast } = useChat();

  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [loadingFeed, setLoadingFeed] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(true);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const loadInitialFeed = async () => {
    if (!token) return;
    setLoadingFeed(true);
    try {
      const data = await fetchFeed(token);
      setPosts(data);
      setHasMore(data.length === 20); // API limit is 20
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load news feed', true);
    } finally {
      setLoadingFeed(false);
    }
  };

  const loadMorePosts = async () => {
    if (!token || loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    const oldestPost = posts[posts.length - 1];
    try {
      const data = await fetchFeed(token, oldestPost.created_at);
      if (data.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => [...prev, ...data]);
        setHasMore(data.length === 20);
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load older posts', true);
    } finally {
      setLoadingMore(false);
    }
  };

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
    loadInitialFeed();
    loadSuggestionsList();
  }, [token]);

  const handleFollowClick = async (targetUserId: string) => {
    if (!token || actionUserId) return;
    setActionUserId(targetUserId);
    try {
      await followUser(token, targetUserId);
      showToast('Success', 'Successfully followed user!', false);
      
      // Update local state
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
      
      // Refresh feed since we followed a new user
      loadInitialFeed();
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to follow user', true);
    } finally {
      setActionUserId(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom && hasMore && !loadingMore && !loadingFeed) {
      loadMorePosts();
    }
  };

  return (
    <div 
      className="feed-page-layout" 
      onScroll={handleScroll}
      style={{
        display: 'flex',
        flexGrow: 1,
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.05)',
        height: '100%'
      }}
    >
      {/* Feed Column */}
      <div 
        className="feed-column" 
        style={{
          flexGrow: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%'
        }}
      >
        <div style={{ width: '100%', maxWidth: '620px' }}>
          {/* Create Post Header */}
          <CreatePostBox onPostCreated={loadInitialFeed} />

          {/* Timeline Feed */}
          {loadingFeed ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px', color: 'var(--primary)', marginBottom: '12px' }}></i>
              <div>Syncing feed timeline...</div>
            </div>
          ) : posts.length === 0 ? (
            <div style={{
              background: 'var(--panel-bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              marginTop: '10px'
            }}>
              <i className="fa-solid fa-earth-americas" style={{ fontSize: '36px', opacity: '0.4', marginBottom: '12px', display: 'block' }}></i>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Your Feed is Empty</div>
              <div>Share a post or follow suggested friends on the right side panel to populate your feed!</div>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onPostDeleted={loadInitialFeed} />
              ))}

              {loadingMore && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                  Loading more posts...
                </div>
              )}

              {!hasMore && posts.length > 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', padding: '24px 0', opacity: 0.5 }}>
                  You have caught up with all updates!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar suggestions Column */}
      <div 
        className="suggestions-column" 
        style={{
          width: '280px',
          borderLeft: '1px solid var(--panel-border)',
          background: 'rgba(0, 0, 0, 0.1)',
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-user-plus" style={{ color: 'var(--primary)' }}></i> Suggested Friends
        </h3>

        {loadingSuggestions ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>
            <i className="fa-solid fa-spinner fa-spin"></i> Loading suggestions...
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>
            No suggestions available.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {suggestions.map((user) => (
              <div 
                key={user.id} 
                className="suggestion-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  gap: '8px'
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
                    {user.mutual_friends_count > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {user.mutual_friends_count} mutual friend{user.mutual_friends_count > 1 ? 's' : ''}
                      </div>
                    )}
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
                  {actionUserId === user.id ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
