import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { PostCard } from './post/PostCard';
import { fetchPostDetails, fetchPostComments, commentOnPost, type Post, type Comment } from '../services/api';

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, showToast } = useChat();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);

  const loadPostAndComments = async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const postData = await fetchPostDetails(token, id);
      setPost(postData);
      
      setLoadingComments(true);
      const commentsData = await fetchPostComments(token, id);
      setComments(commentsData);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load post details', true);
    } finally {
      setLoading(false);
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    loadPostAndComments();
  }, [id, token]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const addedComment = await commentOnPost(token, id, newComment.trim());
      setComments((prev) => [...prev, addedComment]);
      setNewComment('');
      
      // Update local post comment count
      if (post) {
        setPost({
          ...post,
          comment_count: post.comment_count + 1
        });
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to add comment', true);
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

  if (loading) {
    return (
      <div className="profile-container" style={{ flexDirection: 'column', gap: '16px' }}>
        <div className="profile-spinner">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <div>Loading post details...</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="profile-container">
        <div className="profile-error-card">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <h3>Post Not Found</h3>
          <p>The post you are trying to view does not exist or has been deleted.</p>
          <button className="primary-btn" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container" style={{ overflowY: 'auto', padding: '24px' }}>
      <div className="profile-card advanced-layout" style={{ 
        maxWidth: '720px', 
        height: 'auto', 
        maxHeight: '92vh',
        padding: '24px', 
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto'
      }}>
        {/* Back Button Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px' }}>
          <button 
            onClick={() => navigate(-1)} 
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--panel-border)',
              color: 'var(--text-main)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title="Go back"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Post Details</h2>
        </div>

        {/* Primary Post Card */}
        <PostCard post={post} />

        {/* Comment Thread List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px' }}>
            Discussion ({comments.length})
          </h3>

          {loadingComments ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
              <i className="fa-solid fa-spinner fa-spin"></i> Syncing comments...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: '13.5px' }}>
              No comments on this post yet. Be the first to share your thoughts!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {comments.map((comment) => (
                <div key={comment.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div 
                    className="avatar" 
                    onClick={() => navigate(`/profile/${comment.user_id}`)}
                    style={{ width: '32px', height: '32px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {comment.avatar_url ? (
                      <img src={comment.avatar_url} alt={comment.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      comment.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '16px', 
                    padding: '10px 14px',
                    flexGrow: 1
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span 
                        style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                        onClick={() => navigate(`/profile/${comment.user_id}`)}
                      >
                        {comment.full_name || comment.username}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatTime(comment.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                      {comment.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment Thread Input */}
        <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--panel-border)', paddingTop: '16px', marginTop: '12px' }}>
          <input
            type="text"
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submittingComment}
            style={{
              flexGrow: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--panel-border)',
              borderRadius: '12px',
              padding: '12px 16px',
              color: 'var(--text-main)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            className="primary-btn"
            disabled={!newComment.trim() || submittingComment}
            style={{
              width: 'auto',
              padding: '12px 24px',
              fontSize: '13px',
              borderRadius: '12px'
            }}
          >
            {submittingComment ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Comment'}
          </button>
        </form>
      </div>
    </div>
  );
}
