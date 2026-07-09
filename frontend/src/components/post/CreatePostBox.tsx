import React, { useState, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { uploadMedia, fetchUserFriends, type UserFriend } from '../../services/api';
import { useCreatePostMutation } from '../../hooks/useFeedQuery';
import { useLanguage } from '../../context/LanguageContext';

export function CreatePostBox() {
  const { t } = useLanguage();
  const { token, showToast, currentUser } = useChat();
  const [content, setContent] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Privacy settings states
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'specific_friends' | 'except_friends' | 'only_me'>('public');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState<boolean>(false);
  const [friendsList, setFriendsList] = useState<UserFriend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState<boolean>(false);

  const loadFriends = async () => {
    if (!token || !currentUser || friendsList.length > 0) return;
    setLoadingFriends(true);
    try {
      const data = await fetchUserFriends(token, currentUser.id);
      setFriendsList(data);
    } catch (err) {
      console.error('Failed to load friends list for privacy selector', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleVisibilityChange = (val: 'public' | 'friends' | 'specific_friends' | 'except_friends' | 'only_me') => {
    setVisibility(val);
    setSelectedFriendIds([]); // reset selection
    if (val === 'specific_friends' || val === 'except_friends') {
      loadFriends();
    }
  };

  // Use the React Query optimistic mutation
  const createPostMutation = useCreatePostMutation(token || '', currentUser);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          showToast(t('friends.delete') || 'Error', `File ${file.name} exceeds 10MB limit`, true);
          continue;
        }
        const response = await uploadMedia(token, file);
        setImageUrls((prev) => [...prev, response.url]);
      }
    } catch (err: any) {
      showToast('Upload Failed', err.message || 'Failed to upload images', true);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!content.trim() && imageUrls.length === 0) return;

    createPostMutation.mutate(
      { 
        content: content.trim(), 
        mediaUrls: imageUrls,
        visibility,
        allowedUserIds: visibility === 'specific_friends' ? selectedFriendIds : [],
        blockedUserIds: visibility === 'except_friends' ? selectedFriendIds : []
      },
      {
        onSuccess: () => {
          setContent('');
          setImageUrls([]);
          setSelectedFriendIds([]);
          setVisibility('public');
          showToast(t('friends.addFriend') || 'Success', t('post.publishSuccess'), false);
        },
        onError: (err: any) => {
          showToast(t('post.publishError'), err.message || 'Failed to create post', true);
        }
      }
    );
  };

  const isBtnDisabled = createPostMutation.isPending || uploading || (!content.trim() && imageUrls.length === 0);

  return (
    <div className="create-post-box-premium" style={{
      background: 'var(--panel-bg)',
      border: '1px solid var(--panel-border)',
      borderRadius: '16px',
      padding: '16px',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div className="avatar" style={{ flexShrink: 0, width: '40px', height: '40px' }}>
          {currentUser?.avatar_url ? (
            <img src={currentUser.avatar_url} alt="My Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            currentUser?.username?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-main)' }}>
              {currentUser?.full_name || currentUser?.username}
            </span>
            
            {/* Privacy Selector Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '12px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                {visibility === 'public' && <><i className="fa-solid fa-earth-americas" style={{ fontSize: '10px' }} /> {t('post.public')}</>}
                {visibility === 'friends' && <><i className="fa-solid fa-user-group" style={{ fontSize: '10px' }} /> {t('post.friends')}</>}
                {visibility === 'specific_friends' && <><i className="fa-solid fa-user-check" style={{ fontSize: '10px' }} /> {t('post.specificFriends')}</>}
                {visibility === 'except_friends' && <><i className="fa-solid fa-user-slash" style={{ fontSize: '10px' }} /> {t('post.exceptFriends')}</>}
                {visibility === 'only_me' && <><i className="fa-solid fa-lock" style={{ fontSize: '10px' }} /> {t('post.onlyMe')}</>}
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '8px' }} />
              </button>

              {showVisibilityMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px',
                  minWidth: '180px'
                }}>
                  <button
                    type="button"
                    onClick={() => { handleVisibilityChange('public'); setShowVisibilityMenu(false); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '8px'
                    }}
                    className="post-action-btn"
                  >
                    <i className="fa-solid fa-earth-americas" style={{ width: '14px', textAlign: 'center' }} /> {t('post.public')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleVisibilityChange('friends'); setShowVisibilityMenu(false); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '8px'
                    }}
                    className="post-action-btn"
                  >
                    <i className="fa-solid fa-user-group" style={{ width: '14px', textAlign: 'center' }} /> {t('post.friends')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleVisibilityChange('specific_friends'); setShowVisibilityMenu(false); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '8px'
                    }}
                    className="post-action-btn"
                  >
                    <i className="fa-solid fa-user-check" style={{ width: '14px', textAlign: 'center' }} /> {t('post.specificFriends')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleVisibilityChange('except_friends'); setShowVisibilityMenu(false); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '8px'
                    }}
                    className="post-action-btn"
                  >
                    <i className="fa-solid fa-user-slash" style={{ width: '14px', textAlign: 'center' }} /> {t('post.exceptFriends')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleVisibilityChange('only_me'); setShowVisibilityMenu(false); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderRadius: '8px'
                    }}
                    className="post-action-btn"
                  >
                    <i className="fa-solid fa-lock" style={{ width: '14px', textAlign: 'center' }} /> {t('post.onlyMe')}
                  </button>
                </div>
              )}
            </div>
          </div>

          <textarea
            placeholder={t('post.whatsOnYourMind').replace('{name}', currentUser?.full_name || currentUser?.username || 'friend')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '14.5px',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              paddingTop: '4px'
            }}
            disabled={createPostMutation.isPending}
          />
        </div>
      </div>

      {imageUrls.length > 0 && (
        <div className="preview-image-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: '8px',
          marginTop: '8px'
        }}>
          {imageUrls.map((url, idx) => (
            <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden' }}>
              <img src={url} alt="upload-preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {(visibility === 'specific_friends' || visibility === 'except_friends') && (
        <div className="friend-selector-box" style={{
          background: 'rgba(0,0,0,0.12)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          animation: 'fadeIn 0.2s'
        }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
            {visibility === 'specific_friends' ? t('post.selectAllowedFriends') : t('post.selectBlockedFriends')}
          </div>
          {loadingFriends ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} /> {t('post.loadingFriends')}
            </div>
          ) : friendsList.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('post.noFriendsToSelect')}</div>
          ) : (
            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {friendsList.map(f => {
                const isChecked = selectedFriendIds.includes(f.id);
                return (
                  <label key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }} className="friend-select-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar" style={{ width: '26px', height: '26px', fontSize: '10px' }}>
                        {f.avatar_url ? <img src={f.avatar_url} alt={f.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : f.username.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>{f.full_name || f.username}</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={() => {
                        setSelectedFriendIds(prev => 
                          isChecked ? prev.filter(id => id !== f.id) : [...prev, f.id]
                        );
                      }}
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--primary)',
                        cursor: 'pointer'
                      }}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons & Submit */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid var(--panel-border)',
        paddingTop: '12px',
        marginTop: '4px'
      }}>
        {/* Attachment & Action items */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Photo/Video */}
          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              padding: '6px 8px',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            className="post-action-btn"
            disabled={uploading || createPostMutation.isPending}
          >
            {uploading ? (
              <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--primary)' }}></i>
            ) : (
              <i className="fa-regular fa-image" style={{ color: 'var(--success)', fontSize: '16px' }}></i>
            )}
            <span>{t('post.photo')}</span>
          </button>

          {/* Video Mock */}
          <button
            type="button"
            onClick={() => showToast('Feature Info', 'Video posting will be available in future releases', false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              padding: '6px 8px',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            className="post-action-btn"
            disabled={createPostMutation.isPending}
          >
            <i className="fa-solid fa-video" style={{ color: '#E42645', fontSize: '15px' }}></i>
            <span>{t('post.video')}</span>
          </button>

          {/* Feeling Mock */}
          <button
            type="button"
            onClick={() => showToast('Feature Info', 'Feeling selector will be available in future releases', false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              padding: '6px 8px',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            className="post-action-btn"
            disabled={createPostMutation.isPending}
          >
            <i className="fa-regular fa-face-smile" style={{ color: '#EAB026', fontSize: '16px' }}></i>
            <span>{t('post.feeling')}</span>
          </button>
        </div>

        {/* Post Submit Button */}
        <button
          onClick={handleSubmit}
          className="primary-btn"
          style={{
            width: 'auto',
            padding: '8px 20px',
            fontSize: '13px',
            borderRadius: '10px',
            fontWeight: 600
          }}
          disabled={isBtnDisabled}
        >
          {createPostMutation.isPending ? <i className="fa-solid fa-spinner fa-spin"></i> : t('post.share')}
        </button>
      </div>
    </div>
  );
}
