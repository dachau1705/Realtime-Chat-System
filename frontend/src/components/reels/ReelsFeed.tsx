import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { useLanguage } from '../../context/LanguageContext';
import { fetchReelsFeed, likeReel, fetchReelComments, commentOnReel, deleteReel, type Reel, type ReelComment } from '../../services/api';
import { CreateReelModal } from './CreateReelModal';
import { useNavigate } from 'react-router-dom';

export function ReelsFeed() {
  const { token, currentUser, showToast } = useChat();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);

  // Comments drawer states
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);

  // Video ref array for playback management
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const loadFeed = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchReelsFeed(token, 20, 0);
      setReels(data);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load Reels feed', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [token]);

  // Handle active video playback on scroll / active index change
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (video) {
        video.muted = isMuted;
        if (idx === activeIdx && !drawerOpen) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    });
  }, [activeIdx, reels, isMuted, drawerOpen]);

  const handleVideoClick = (idx: number) => {
    const video = videoRefs.current[idx];
    if (video) {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  };

  const handleLike = async (idx: number) => {
    if (!token) return;
    const targetReel = reels[idx];
    try {
      const res = await likeReel(token, targetReel.id);
      setReels(prev => prev.map((r, i) => i === idx ? { ...r, has_liked: res.liked, likes_count: res.likes_count } : r));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to react to Reel', true);
    }
  };

  const handleCopyLink = (reel: Reel) => {
    const shareUrl = `${window.location.origin}/reels?id=${reel.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('Copied', t('reels.linkCopied'), false);
    });
  };

  const handleDelete = async (idx: number) => {
    if (!token || !window.confirm(t('reels.deleteConfirm'))) return;
    const targetReel = reels[idx];
    try {
      await deleteReel(token, targetReel.id);
      showToast('Success', t('reels.deleteSuccess'), false);
      setReels(prev => prev.filter((_, i) => i !== idx));
      if (activeIdx >= reels.length - 1 && activeIdx > 0) {
        setActiveIdx(activeIdx - 1);
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to delete Reel', true);
    }
  };

  // Comments loading drawer logic
  const openCommentsDrawer = async (reel: Reel) => {
    if (!token) return;
    setDrawerOpen(true);
    setLoadingComments(true);
    try {
      const commentsData = await fetchReelComments(token, reel.id);
      setComments(commentsData);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load comments', true);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCommentText.trim() || submittingComment) return;

    const activeReel = reels[activeIdx];
    setSubmittingComment(true);
    try {
      const addedComment = await commentOnReel(token, activeReel.id, newCommentText.trim());
      setComments(prev => [...prev, addedComment]);
      setNewCommentText('');
      
      // Update comment count on reels array
      setReels(prev => prev.map((r, i) => i === activeIdx ? { ...r, comments_count: r.comments_count + 1 } : r));
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to add comment', true);
    } finally {
      setSubmittingComment(false);
    }
  };

  const currentReel = reels[activeIdx];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: 'calc(100vh - 72px)',
      background: 'rgba(0,0,0,0.05)',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Add Reel Button top right */}
      <button
        onClick={() => setCreateModalOpen(true)}
        className="primary-btn"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: 'auto',
          zIndex: 100,
          padding: '10px 18px',
          borderRadius: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <i className="fa-solid fa-plus"></i>
        <span>{t('reels.createReel')}</span>
      </button>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--primary)' }}></i>
          <span>{t('story.loadingStories') || 'Loading...'}</span>
        </div>
      ) : reels.length === 0 ? (
        <div className="profile-error-card" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
          <i className="fa-solid fa-clapperboard" style={{ fontSize: '48px', color: 'var(--primary)', marginBottom: '16px' }}></i>
          <h3>{t('reels.reelsTitle')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginBottom: '20px' }}>
            {t('reels.noReels')}
          </p>
          <button className="primary-btn" onClick={() => setCreateModalOpen(true)}>
            {t('reels.createReel')}
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '24px',
          height: '100%',
          width: '100%',
          maxWidth: drawerOpen ? '840px' : '480px',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'max-width 0.3s ease'
        }}>
          {/* Main Reel Viewport Card */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '420px',
            height: '92vh',
            maxHeight: '680px',
            background: '#000',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center'
          }}>
            {/* Horizontal or Vertical scroll layout */}
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transform: `translateY(-${activeIdx * 100}%)`,
              transition: 'transform 0.4s cubic-bezier(0.1, 0.76, 0.55, 0.94)'
            }}>
              {reels.map((reel, idx) => (
                <div
                  key={reel.id}
                  style={{
                    width: '100%',
                    height: '100%',
                    flexShrink: 0,
                    position: 'relative',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <video
                    ref={el => { videoRefs.current[idx] = el; }}
                    src={reel.video_url}
                    loop
                    playsInline
                    onClick={() => handleVideoClick(idx)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  />

                  {/* Sound overlay controls */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    style={{
                      position: 'absolute',
                      top: '20px',
                      left: '20px',
                      background: 'rgba(0,0,0,0.5)',
                      border: 'none',
                      color: 'white',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      zIndex: 10
                    }}
                  >
                    {isMuted ? <i className="fa-solid fa-volume-xmark"></i> : <i className="fa-solid fa-volume-high"></i>}
                  </button>

                  {/* Overlay Bottom User Meta info */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '24px 20px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    color: 'white',
                    paddingRight: '72px'
                  }}>
                    {/* User profile details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        className="avatar"
                        onClick={() => navigate(`/profile/${reel.user_id}`)}
                        style={{ width: '36px', height: '36px', border: '2px solid white', cursor: 'pointer', fontSize: '13px' }}
                      >
                        {reel.avatar_url ? (
                          <img src={reel.avatar_url} alt={reel.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          reel.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                          onClick={() => navigate(`/profile/${reel.user_id}`)}
                          style={{ fontWeight: 650, fontSize: '13.5px', textShadow: '0 1px 3px rgba(0,0,0,0.5)', cursor: 'pointer' }}
                        >
                          {reel.full_name || reel.username}
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                          @{reel.username}
                        </span>
                      </div>
                    </div>

                    {/* Caption content */}
                    {reel.caption && (
                      <p style={{
                        fontSize: '12.5px',
                        lineHeight: '1.45',
                        margin: 0,
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                        wordBreak: 'break-word',
                        maxHeight: '75px',
                        overflowY: 'auto'
                      }}>
                        {reel.caption}
                      </p>
                    )}
                  </div>

                  {/* Side HUD floating buttons */}
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    bottom: '32px',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px'
                  }}>
                    {/* Like reel action */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => handleLike(idx)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: reel.has_liked ? 'var(--error)' : 'rgba(0,0,0,0.5)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          transition: 'background 0.2s'
                        }}
                      >
                        <i className="fa-solid fa-heart"></i>
                      </button>
                      <span style={{ color: 'white', fontSize: '11.5px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                        {reel.likes_count}
                      </span>
                    </div>

                    {/* Comment Drawer opener */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => openCommentsDrawer(reel)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.5)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}
                      >
                        <i className="fa-solid fa-comment"></i>
                      </button>
                      <span style={{ color: 'white', fontSize: '11.5px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                        {reel.comments_count}
                      </span>
                    </div>

                    {/* Copy Share Link */}
                    <button
                      onClick={() => handleCopyLink(reel)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                      }}
                      title={t('reels.copyLinkBtn')}
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>

                    {/* Delete owner Reel */}
                    {reel.user_id === currentUser?.id && (
                      <button
                        onClick={() => handleDelete(idx)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'rgba(235, 87, 87, 0.2)',
                          border: '1px solid rgba(235, 87, 87, 0.4)',
                          color: '#EB5757',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px'
                        }}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Vertical Scroll Nav Arrow Keys */}
            <div style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              zIndex: 10
            }}>
              {activeIdx > 0 && (
                <button
                  onClick={() => setActiveIdx(activeIdx - 1)}
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    color: 'white',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <i className="fa-solid fa-chevron-up"></i>
                </button>
              )}
              {activeIdx < reels.length - 1 && (
                <button
                  onClick={() => setActiveIdx(activeIdx + 1)}
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    color: 'white',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <i className="fa-solid fa-chevron-down"></i>
                </button>
              )}
            </div>
          </div>

          {/* Comments Sliding Drawer Component */}
          {drawerOpen && currentReel && (
            <div style={{
              width: '100%',
              maxWidth: '380px',
              height: '92vh',
              maxHeight: '680px',
              background: 'var(--panel-bg)',
              border: '1px solid var(--panel-border)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              animation: 'fadeIn 0.2s',
              overflow: 'hidden'
            }}>
              {/* Drawer Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderBottom: '1px solid var(--panel-border)'
              }}>
                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {t('reels.commentsTitle')} ({comments.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Comments Roster */}
              <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loadingComments ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />
                    {t('post.loadingComments')}
                  </div>
                ) : comments.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '12.5px' }}>
                    {t('post.noComments')}
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div
                        className="avatar"
                        onClick={() => {
                          setDrawerOpen(false);
                          navigate(`/profile/${comment.user_id}`);
                        }}
                        style={{ width: '28px', height: '28px', fontSize: '10px', cursor: 'pointer', flexShrink: 0 }}
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
                        borderRadius: '12px',
                        padding: '8px 12px',
                        flexGrow: 1
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            onClick={() => {
                              setDrawerOpen(false);
                              navigate(`/profile/${comment.user_id}`);
                            }}
                            style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
                          >
                            {comment.full_name || comment.username}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-main)', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input form */}
              <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--panel-border)', padding: '12px' }}>
                <input
                  type="text"
                  placeholder={t('reels.writeComment')}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  disabled={submittingComment}
                  style={{
                    flexGrow: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!newCommentText.trim() || submittingComment}
                  style={{ width: 'auto', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600 }}
                >
                  {submittingComment ? <i className="fa-solid fa-spinner fa-spin"></i> : t('reels.commentBtn')}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Upload Reels Modal Launcher */}
      {createModalOpen && (
        <CreateReelModal
          onClose={() => setCreateModalOpen(false)}
          onSuccess={loadFeed}
        />
      )}
    </div>
  );
}
