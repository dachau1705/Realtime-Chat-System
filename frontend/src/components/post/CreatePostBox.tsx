import React, { useState, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { uploadMedia } from '../../services/api';
import { useCreatePostMutation } from '../../hooks/useFeedQuery';

export function CreatePostBox() {
  const { token, showToast, currentUser } = useChat();
  const [content, setContent] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          showToast('Error', `File ${file.name} exceeds 10MB limit`, true);
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
      { content: content.trim(), mediaUrls: imageUrls },
      {
        onSuccess: () => {
          setContent('');
          setImageUrls([]);
          showToast('Success', 'Post published successfully!', false);
        },
        onError: (err: any) => {
          showToast('Publish Failed', err.message || 'Failed to create post', true);
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
        <textarea
          placeholder={`What's on your mind, ${currentUser?.full_name || currentUser?.username || 'friend'}?`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          style={{
            flexGrow: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-main)',
            fontSize: '14.5px',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.5',
            paddingTop: '8px'
          }}
          disabled={createPostMutation.isPending}
        />
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
            <span>Photo</span>
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
            <span>Video</span>
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
            <span>Feeling</span>
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
          {createPostMutation.isPending ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Share'}
        </button>
      </div>
    </div>
  );
}
