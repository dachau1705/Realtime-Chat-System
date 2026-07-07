import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { useLikeMutation, useDeletePostMutation } from '../../hooks/useFeedQuery';
import { commentOnPost, fetchPostComments, type Post, type Comment } from '../../services/api';

interface PostCardProps {
  post: Post;
  onPostDeleted?: () => void;
}

export const PostCard = React.memo(({ post, onPostDeleted }: PostCardProps) => {
  const navigate = useNavigate();
  const { token, currentUser, showToast } = useChat();

  const likeMutation = useLikeMutation(token || '');
  const deleteMutation = useDeletePostMutation(token || '');

  const [showComments, setShowComments] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);

  // Reaction action
  const handleLikeToggle = () => {
    if (!token) return;
    const nextReactionType = post.has_reacted ? null : 'like';
    likeMutation.mutate({ postId: post.id, reactionType: nextReactionType });
  };

  // Delete action
  const handleDeletePost = () => {
    if (!token) return;
    if (confirm('Delete this post permanently?')) {
      deleteMutation.mutate(post.id, {
        onSuccess: () => {
          showToast('Success', 'Post deleted successfully', false);
          onPostDeleted?.();
        },
        onError: (err: any) => {
          showToast('Error', err.message || 'Failed to delete post', true);
        }
      });
    }
  };

  const loadComments = async () => {
    if (!token) return;
    setLoadingComments(true);
    try {
      const data = await fetchPostComments(token, post.id);
      setComments(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load comments', true);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    const nextState = !showComments;
    setShowComments(nextState);
    if (nextState && comments.length === 0) {
      loadComments();
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    const content = newComment.trim();
    try {
      const addedComment = await commentOnPost(token, post.id, content);
      setComments((prev) => [...prev, addedComment]);
      setNewComment('');
      // Force refreshing the cache of feed to sync comment count
      // Wait, we don't have to reload feed, we can let queryClient handle it or increment it
      // Let's do inline comment count sync on queryClient if desired
      // We can also let onSettled invalidations update the server count
    } catch (err: any) {
      showToast('Comment Failed', err.message || 'Failed to post comment', true);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const renderImages = () => {
    const count = post.media_urls.length;
    if (count === 0) return null;

    let gridStyle: React.CSSProperties = {
      display: 'grid',
      gap: '8px',
      marginTop: '12px',
      borderRadius: '12px',
      overflow: 'hidden'
    };

    if (count === 1) {
      return (
        <div style={{ marginTop: '12px', borderRadius: '12px', overflow: 'hidden' }}>
          <img 
            src={post.media_urls[0]} 
            alt="Post media" 
            loading="lazy"
            style={{ width: '100%', maxHeight: '450px', objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => navigate(`/posts/${post.id}`)}
          />
        </div>
      );
    } else if (count === 2) {
      gridStyle.gridTemplateColumns = '1fr 1fr';
    } else if (count === 3) {
      gridStyle.gridTemplateColumns = '2fr 1fr';
      gridStyle.gridTemplateRows = '1fr 1fr';
    } else {
      gridStyle.gridTemplateColumns = '1fr 1fr';
      gridStyle.gridTemplateRows = '1fr 1fr';
    }

    return (
      <div style={gridStyle}>
        {post.media_urls.slice(0, 4).map((url, idx) => {
          const isMoreThanFour = count > 4 && idx === 3;
          return (
            <div 
              key={idx} 
              style={{ 
                position: 'relative', 
                gridRow: count === 3 && idx === 0 ? 'span 2' : 'span 1',
                aspectRatio: count === 2 ? '1' : '1.3',
                overflow: 'hidden'
              }}
              onClick={() => navigate(`/posts/${post.id}`)}
            >
              <img 
                src={url} 
                alt={`Post media ${idx}`} 
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', filter: isMoreThanFour ? 'brightness(0.4)' : 'none' }} 
              />
              {isMoreThanFour && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  pointerEvents: 'none'
                }}>
                  +{count - 3}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="post-card-premium" style={{
      background: 'var(--panel-bg)',
      border: '1px solid var(--panel-border)',
      borderRadius: '16px',
      padding: '18px',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.2s ease, border-color 0.2s ease',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    }}>
      {/* Post Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div 
            className="avatar" 
            onClick={() => navigate(`/profile/${post.user_id}`)}
            style={{ cursor: 'pointer', width: '38px', height: '38px' }}
          >
            {post.avatar_url ? (
              <img src={post.avatar_url} alt={post.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              post.username.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div 
              style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text-main)', cursor: 'pointer' }}
              onClick={() => navigate(`/profile/${post.user_id}`)}
            >
              {post.full_name || post.username}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>@{post.username}</span>
              <span>•</span>
              <span>{formatTime(post.created_at)}</span>
              <span>•</span>
              {post.visibility === 'public' && <i className="fa-solid fa-earth-americas" title="Public" style={{ fontSize: '10px' }} />}
              {post.visibility === 'friends' && <i className="fa-solid fa-user-group" title="Friends" style={{ fontSize: '10px' }} />}
              {post.visibility === 'specific_friends' && <i className="fa-solid fa-user-check" title="Specific Friends" style={{ fontSize: '10px' }} />}
              {post.visibility === 'except_friends' && <i className="fa-solid fa-user-slash" title="Friends Except" style={{ fontSize: '10px' }} />}
              {post.visibility === 'only_me' && <i className="fa-solid fa-lock" title="Only Me" style={{ fontSize: '10px' }} />}
            </div>
          </div>
        </div>

        {currentUser?.id === post.user_id && (
          <button 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '6px' }}
            onClick={handleDeletePost}
            disabled={deleteMutation.isPending}
            title="Delete post"
          >
            <i className="fa-regular fa-trash-can" style={{ color: 'var(--error)' }}></i>
          </button>
        )}
      </div>

      {/* Post Content */}
      {post.content && (
        <div 
          onClick={() => navigate(`/posts/${post.id}`)}
          style={{ 
            marginTop: '12px', 
            fontSize: '14.5px', 
            color: 'var(--text-main)', 
            whiteSpace: 'pre-wrap', 
            lineHeight: '1.5',
            cursor: 'pointer'
          }}
        >
          {post.content}
        </div>
      )}

      {/* Post Images */}
      {renderImages()}

      {/* Counts HUD */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--panel-border)',
        fontSize: '12.5px',
        color: 'var(--text-muted)'
      }}>
        <span>
          <i className="fa-solid fa-heart" style={{ color: 'var(--error)', marginRight: '4px' }}></i>
          {post.reaction_count} like{post.reaction_count !== 1 ? 's' : ''}
        </span>
        <span style={{ cursor: 'pointer' }} onClick={handleToggleComments}>
          {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Post Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: showComments ? '1px solid var(--panel-border)' : 'none'
      }}>
        <button
          onClick={handleLikeToggle}
          style={{
            background: 'transparent',
            border: 'none',
            color: post.has_reacted ? 'var(--error)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            transition: 'all 0.15s'
          }}
        >
          <i className={post.has_reacted ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
          {post.has_reacted ? 'Liked' : 'Like'}
        </button>

        <button
          onClick={handleToggleComments}
          style={{
            background: 'transparent',
            border: 'none',
            color: showComments ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            transition: 'all 0.15s'
          }}
        >
          <i className="fa-regular fa-message"></i>
          Comment
        </button>
      </div>

      {/* Inline Comments Area */}
      {showComments && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          {loadingComments ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>
              <i className="fa-solid fa-spinner fa-spin"></i> Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>
              No comments yet. Write one below!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {comments.map((comment) => (
                <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div 
                    className="avatar" 
                    onClick={() => navigate(`/profile/${comment.user_id}`)}
                    style={{ width: '28px', height: '28px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {comment.avatar_url ? (
                      <img src={comment.avatar_url} alt={comment.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      comment.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ 
                    background: 'rgba(255, 255, 255, 0.04)', 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '12px', 
                    padding: '8px 12px',
                    flexGrow: 1
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span 
                        style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                        onClick={() => navigate(`/profile/${comment.user_id}`)}
                      >
                        {comment.full_name || comment.username}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatTime(comment.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                      {comment.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Comment Input */}
      <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input
          type="text"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={submittingComment}
          style={{
            flexGrow: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--panel-border)',
            borderRadius: '10px',
            padding: '8px 12px',
            color: 'var(--text-main)',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
        />
        <button
          type="submit"
          className="primary-btn"
          disabled={!newComment.trim() || submittingComment}
          style={{
            width: 'auto',
            padding: '8px 14px',
            fontSize: '12px',
            borderRadius: '10px'
          }}
        >
          {submittingComment ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Reply'}
        </button>
      </form>
    </div>
  );
}, (prevProps, nextProps) => {
  // Compare values to prevent unnecessary re-renders in virtual lists
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.reaction_count === nextProps.post.reaction_count &&
    prevProps.post.comment_count === nextProps.post.comment_count &&
    prevProps.post.has_reacted === nextProps.post.has_reacted &&
    prevProps.post.content === nextProps.post.content &&
    prevProps.post.media_urls.join(',') === nextProps.post.media_urls.join(',') &&
    prevProps.post.avatar_url === nextProps.post.avatar_url &&
    prevProps.post.username === nextProps.post.username &&
    prevProps.post.full_name === nextProps.post.full_name &&
    prevProps.post.visibility === nextProps.post.visibility
  );
});

PostCard.displayName = 'PostCard';
