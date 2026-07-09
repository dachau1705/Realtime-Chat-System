import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../../hooks/useChat';
import { useLanguage } from '../../context/LanguageContext';
import {
  useGetPageDetail,
  useGetPagePosts,
  useGetPageMembers,
  useGetPageReviews,
  useGetPageSettings,
  useGetPageInsights,
  followPageApi,
  unfollowPageApi,
  createPagePostApi,
  managePageMembersApi,
  deletePageMemberApi,
  createPageReviewApi,
  updatePageSettingsApi
} from '../../utils/api';

interface PageProfile {
  id: string;
  page_name: string;
  username: string;
  slug: string;
  category_id: string;
  category_name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  avatar: string | null;
  cover_photo: string | null;
  followers_count: number;
  likes_count: number;
  posts_count: number;
  review_count: number;
  rating: string;
  userRole: string | null; // role of current user
  isFollowing: boolean;
}

interface PagePost {
  id: string;
  content: string;
  post_type: string;
  media_urls: string[];
  created_at: string;
  author_username: string;
  author_avatar: string | null;
}

interface PageMember {
  user_id: string;
  role: string;
  created_at: string;
  username: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface PageReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface PageSettings {
  allow_visitor_posts: boolean;
  allow_tagging: boolean;
  allow_mentions: boolean;
  profanity_filter_level: 'low' | 'medium' | 'high';
  age_restriction: number;
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
}

interface PageInsights {
  reach: number;
  followers: number;
  likes: number;
  posts: number;
  rating: string;
  reviews: number;
  demographics: { segment: string; percent: number }[];
}

export function PageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { token, showToast } = useChat();

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const page = useGetPageDetail(id, { refresh: refreshTrigger, enabled: !!token }) as any as PageProfile | null;
  const loading = !page;

  // Tabs: posts, about, members, settings, reviews, insights
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'members' | 'settings' | 'reviews' | 'insights'>('posts');

  // Tab Data hooks
  const posts = useGetPagePosts(id, { refresh: refreshTrigger, enabled: !!token && activeTab === 'posts' }) as any as PagePost[];
  const members = useGetPageMembers(id, { refresh: refreshTrigger, enabled: !!token && activeTab === 'members' }) as any as PageMember[];
  const reviews = useGetPageReviews(id, { refresh: refreshTrigger, enabled: !!token && activeTab === 'reviews' }) as any as PageReview[];
  const settingsData = useGetPageSettings(id, { refresh: refreshTrigger, enabled: !!token && activeTab === 'settings' }) as any as PageSettings | null;
  const insights = useGetPageInsights(id, { refresh: refreshTrigger, enabled: !!token && activeTab === 'insights' }) as any as PageInsights | null;

  const [settings, setSettings] = useState<PageSettings | null>(null);

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  // Action Inputs
  const [newPostContent, setNewPostContent] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('editor');
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');

  // Loading States
  const [actionLoading, setActionLoading] = useState(false);

  const handleFollowToggle = async () => {
    if (!token || !page) return;
    try {
      const res = page.isFollowing ? await unfollowPageApi(page.id) : await followPageApi(page.id);
      if (res.data && res.data.status !== false) {
        showToast('Success', `Successfully ${page.isFollowing ? 'unfollow' : 'follow'}ed page!`, false);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !token || !id) return;

    setActionLoading(true);
    try {
      const res = await createPagePostApi(id, { content: newPostContent.trim() });
      if (res.data && res.data.status !== false) {
        setNewPostContent('');
        showToast('Success', 'Post published to Page feed.', false);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast('Failed', 'Could not submit post.', true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmail.trim() || !token || !id) return;

    setActionLoading(true);
    try {
      const res = await managePageMembersApi(id, { targetEmail: assignEmail.trim(), role: assignRole });
      if (res.data && res.data.status !== false) {
        setAssignEmail('');
        showToast('Success', res.data.message || 'Staff assigned successfully.', false);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast('Assignment Failed', res.data?.mess || 'Failed to assign role.', true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!token || !id) return;
    if (!window.confirm('Are you sure you want to revoke this staff role?')) return;

    try {
      const res = await deletePageMemberApi(id, userId);
      if (res.data && res.data.status !== false) {
        showToast('Success', 'Staff access revoked.', false);
        setRefreshTrigger(prev => prev + 1);
      } else {
        showToast('Revoke Failed', res.data?.mess || 'Could not remove member.', true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id) return;

    setActionLoading(true);
    try {
      const res = await createPageReviewApi(id, { rating: newRating, reviewText: newReviewText.trim() });
      if (res.data && res.data.status !== false) {
        setNewReviewText('');
        showToast('Success', 'Thank you for your rating review!', false);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !settings) return;

    setActionLoading(true);
    try {
      const res = await updatePageSettingsApi(id, {
        allowVisitorPosts: settings.allow_visitor_posts,
        allowTagging: settings.allow_tagging,
        allowMentions: settings.allow_mentions,
        profanityFilterLevel: settings.profanity_filter_level,
        ageRestriction: settings.age_restriction,
        autoReplyEnabled: settings.auto_reply_enabled,
        autoReplyMessage: settings.auto_reply_message
      });
      if (res.data && res.data.status !== false) {
        showToast('Success', 'Page settings saved successfully.', false);
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-container loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="profile-spinner"><i className="fa-solid fa-spinner fa-spin" /><span>{t('pages.loadingPage')}</span></div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="profile-container error" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="profile-error-card">
          <i className="fa-solid fa-circle-exclamation" />
          <h3>{t('pages.pageNotFound')}</h3>
          <p>{t('pages.pageNotFoundDesc')}</p>
          <button className="primary-btn" onClick={() => navigate('/')}>{t('pages.returnHome')}</button>
        </div>
      </div>
    );
  }

  const isStaff = page.userRole && ['owner', 'admin', 'editor', 'moderator', 'advertiser', 'analyst'].includes(page.userRole);
  const isAdmin = page.userRole && ['owner', 'admin'].includes(page.userRole);
  const canPost = page.userRole && ['owner', 'admin', 'editor'].includes(page.userRole);

  return (
    <div className="profile-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '24px 0 0 0' }}>
      <div className="profile-card advanced-layout" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Cover Photo */}
        <div className="profile-cover-section">
          {page.cover_photo ? (
            <img src={page.cover_photo} alt="Cover" className="profile-cover-img" />
          ) : (
            <div className="profile-cover-placeholder" />
          )}
          <button className="profile-back-btn" onClick={() => navigate('/')}>
            <i className="fa-solid fa-arrow-left" />
          </button>
        </div>

        {/* Page Identity Header */}
        <div className="profile-meta-section">
          <div className="profile-avatar-container">
            {page.avatar ? (
              <img src={page.avatar} alt="Logo" className="profile-avatar-img" />
            ) : (
              <div className="profile-avatar-letter">{page.page_name.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="profile-header-details">
            <div className="profile-display-name">{page.page_name}</div>
            <div className="profile-username-tag">
              @{page.username} • <span className="status-badge self" style={{ padding: '2px 8px', fontSize: '10px' }}>{page.category_name}</span>
            </div>
            <div className="profile-bio-text">{page.description || 'No description provided.'}</div>
          </div>
          <div className="profile-header-actions">
            <div className="profile-action-group">
              <button className={`primary-btn ${page.isFollowing ? 'edit-profile-btn' : ''}`} onClick={handleFollowToggle}>
                {page.isFollowing ? t('pages.unfollow') : t('pages.follow')}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="profile-tabs-nav">
          <button className={`profile-tab-link ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>{t('pages.posts')}</button>
          <button className={`profile-tab-link ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>{t('pages.about')}</button>
          <button className={`profile-tab-link ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>{t('pages.reviews')} ({page.review_count})</button>
          
          {isStaff && (
            <button className={`profile-tab-link ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')}>{t('pages.insights')}</button>
          )}
          {isAdmin && (
            <>
              <button className={`profile-tab-link ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>{t('pages.members')}</button>
              <button className={`profile-tab-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>{t('pages.settings')}</button>
            </>
          )}
        </div>

        {/* Tab Panel Viewport */}
        <div className="profile-tab-panel" style={{ flexGrow: 1, minHeight: '300px' }}>
          
          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="about-info-grid">
              <div className="about-info-item">
                <div className="about-info-icon"><i className="fa-solid fa-circle-info" /></div>
                <div className="about-info-value">
                  <span className="info-title">Category</span>
                  <span className="info-desc">{page.category_name}</span>
                </div>
              </div>
              {page.email && (
                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-regular fa-envelope" /></div>
                  <div className="about-info-value">
                    <span className="info-title">Email</span>
                    <span className="info-desc">{page.email}</span>
                  </div>
                </div>
              )}
              {page.phone && (
                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-phone" /></div>
                  <div className="about-info-value">
                    <span className="info-title">{t('pages.phoneNumber')}</span>
                    <span className="info-desc">{page.phone}</span>
                  </div>
                </div>
              )}
              {page.website && (
                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-globe" /></div>
                  <div className="about-info-value">
                    <span className="info-title">Website</span>
                    <span className="info-desc"><a href={page.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>{page.website}</a></span>
                  </div>
                </div>
              )}
              {page.location && (
                <div className="about-info-item">
                  <div className="about-info-icon"><i className="fa-solid fa-map-pin" /></div>
                  <div className="about-info-value">
                    <span className="info-title">{t('pages.physicalAddress')}</span>
                    <span className="info-desc">{page.location}</span>
                  </div>
                </div>
              )}
              <div className="about-info-item">
                <div className="about-info-icon"><i className="fa-solid fa-chart-simple" /></div>
                <div className="about-info-value">
                  <span className="info-title">Page Stats</span>
                  <span className="info-desc">{page.followers_count} Followers • {page.likes_count} Likes</span>
                </div>
              </div>
            </div>
          )}

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
              
              {/* Compose box */}
              {canPost && (
                <div className="create-post-box shadow-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '16px' }}>
                  <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <textarea
                      placeholder={t('pages.publishAs').replace('{name}', page.page_name)}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      style={{ width: '100%', height: '80px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '13.5px', resize: 'none' }}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--panel-border)', paddingTop: '10px' }}>
                      <button type="submit" disabled={actionLoading} className="primary-btn" style={{ width: 'auto', padding: '6px 16px', borderRadius: '8px' }}>
                        {actionLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('pages.publishBtn')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Feed */}
              {posts.length === 0 ? (
                <div className="tab-panel-empty">{t('pages.noPosts')}</div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="post-card post-card-premium" style={{ border: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                        {page.avatar ? (
                          <img src={page.avatar} alt="logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          page.page_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{page.page_name}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>@{page.username} • {new Date(post.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{post.content}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px', margin: '0 auto' }}>
              
              {/* Rating metrics summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                <div style={{ textAlign: 'center', borderRight: '1px solid var(--panel-border)', paddingRight: '20px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)' }}>{page.rating}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('pages.outOfStars')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{t('pages.communityReviews')}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Total of {page.review_count} community reviews submitted.</div>
                </div>
              </div>

              {/* Submit Review Box */}
              <div className="create-post-box shadow-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '16px' }}>
                <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{t('pages.submitReview')}</div>
                  
                  {/* Rating Stars Select */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <i className={`fa-star ${star <= newRating ? 'fa-solid' : 'fa-regular'}`} style={{ color: star <= newRating ? '#F59E0B' : 'var(--text-muted)', fontSize: '20px' }} />
                      </button>
                    ))}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{t('pages.ratingStars').replace('{stars}', String(newRating))}</span>
                  </div>

                  <textarea
                    placeholder={t('pages.tellExperience')}
                    value={newReviewText}
                    onChange={(e) => setNewReviewText(e.target.value)}
                    style={{ width: '100%', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '10px', color: 'var(--text-main)', fontSize: '13px', outline: 'none', resize: 'none' }}
                    required
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" disabled={actionLoading} className="primary-btn" style={{ width: 'auto', padding: '6px 16px', borderRadius: '8px' }}>
                      {actionLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('pages.submitReviewBtn')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <div className="tab-panel-empty">{t('pages.noReviews')}</div>
              ) : (
                reviews.map(rev => (
                  <div key={rev.id} style={{ display: 'flex', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--panel-border)', borderRadius: '16px' }}>
                    <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '14px', flexShrink: 0 }}>
                      {rev.avatar_url ? (
                        <img src={rev.avatar_url} alt="user" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        rev.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{rev.full_name || rev.username}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(rev.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '2px', margin: '4px 0' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <i key={star} className={`fa-star ${star <= rev.rating ? 'fa-solid' : 'fa-regular'}`} style={{ color: star <= rev.rating ? '#F59E0B' : 'var(--text-muted)', fontSize: '11px' }} />
                        ))}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '6px' }}>{rev.review_text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Assign staff form */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                <form onSubmit={handleAssignRole} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flexGrow: 1, minWidth: '220px' }}>
                    <label className="info-title" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('pages.addStaffEmail')}</label>
                    <input
                      type="email"
                      placeholder="e.g. member@email.com"
                      value={assignEmail}
                      onChange={(e) => setAssignEmail(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '13px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div style={{ width: '140px' }}>
                    <label className="info-title" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('pages.role')}</label>
                    <select
                      value={assignRole}
                      onChange={(e) => setAssignRole(e.target.value)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '13px', outline: 'none' }}
                    >
                      <option value="admin" style={{ background: '#0c0f1d' }}>Admin</option>
                      <option value="editor" style={{ background: '#0c0f1d' }}>Editor</option>
                      <option value="moderator" style={{ background: '#0c0f1d' }}>Moderator</option>
                      <option value="advertiser" style={{ background: '#0c0f1d' }}>Advertiser</option>
                      <option value="analyst" style={{ background: '#0c0f1d' }}>Analyst</option>
                    </select>
                  </div>
                  <button type="submit" disabled={actionLoading} className="primary-btn" style={{ width: 'auto', padding: '8px 20px', borderRadius: '8px', height: '36px' }}>
                    {t('pages.assign')}
                  </button>
                </form>
              </div>

              {/* Members grid list */}
              <div className="friends-grid-list">
                {members.map(member => (
                  <div key={member.user_id} className="friend-grid-card" style={{ cursor: 'default' }}>
                    <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="member" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        member.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="friend-card-info">
                      <div className="friend-card-name">{member.full_name || member.username}</div>
                      <div className="friend-card-sub" style={{ textTransform: 'capitalize' }}>{member.role}</div>
                    </div>
                    {member.role !== 'owner' && (
                      <button
                        className="toast-close-btn"
                        onClick={() => handleRemoveMember(member.user_id)}
                        style={{ color: 'var(--error)' }}
                        title="Remove Member"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && isAdmin && settings && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.allow_visitor_posts}
                      onChange={(e) => setSettings({ ...settings, allow_visitor_posts: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    {t('pages.allowVisitorPosts')}
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.allow_tagging}
                      onChange={(e) => setSettings({ ...settings, allow_tagging: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    {t('pages.allowTagging')}
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.allow_mentions}
                      onChange={(e) => setSettings({ ...settings, allow_mentions: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    {t('pages.allowMentions')}
                  </label>

                  <div style={{ marginTop: '10px' }}>
                    <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.profanityFilter')}</label>
                    <select
                      value={settings.profanity_filter_level}
                      onChange={(e) => setSettings({ ...settings, profanity_filter_level: e.target.value as any })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '13.5px', outline: 'none' }}
                    >
                      <option value="low" style={{ background: '#0c0f1d' }}>Low</option>
                      <option value="medium" style={{ background: '#0c0f1d' }}>Medium</option>
                      <option value="high" style={{ background: '#0c0f1d' }}>High</option>
                    </select>
                  </div>

                  <div>
                    <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.ageRestriction')}</label>
                    <input
                      type="number"
                      value={settings.age_restriction}
                      onChange={(e) => setSettings({ ...settings, age_restriction: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '13.5px', outline: 'none' }}
                    />
                  </div>

                  <hr className="dropdown-divider" style={{ margin: '16px 0' }} />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.auto_reply_enabled}
                      onChange={(e) => setSettings({ ...settings, auto_reply_enabled: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    {t('pages.enableAutoReply')}
                  </label>

                  {settings.auto_reply_enabled && (
                    <div>
                      <label className="info-title" style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('pages.autoReplyContent')}</label>
                      <textarea
                        value={settings.auto_reply_message || ''}
                        onChange={(e) => setSettings({ ...settings, auto_reply_message: e.target.value })}
                        style={{ width: '100%', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-main)', fontSize: '13.5px', outline: 'none', resize: 'none' }}
                      />
                    </div>
                  )}

                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                  <button type="submit" disabled={actionLoading} className="primary-btn" style={{ width: 'auto', padding: '10px 24px', borderRadius: '10px' }}>
                    {actionLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('pages.saveSettings')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && isStaff && insights && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Core analytics card figures */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('pages.weeklyReach')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginTop: '8px' }}>{insights.reach.toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}><i className="fa-solid fa-arrow-trend-up" /> +14.2% from last week</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Followers Count</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>{insights.followers}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Likes</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>{insights.likes}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Reviews</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#F59E0B', marginTop: '8px' }}>{insights.rating} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>({insights.reviews})</span></div>
                </div>
              </div>

              {/* Demographics split */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>{t('pages.audienceDemo')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {insights.demographics.map((demo, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '120px' }}>{demo.segment}</span>
                      <div style={{ flexGrow: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${demo.percent}%`, height: '100%', background: 'var(--primary)' }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', minWidth: '40px', textAlign: 'right' }}>{demo.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
