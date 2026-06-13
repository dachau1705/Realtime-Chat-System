import React, { useState, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { createPost, uploadMedia } from '../services/api';

interface CreatePostBoxProps {
  onPostCreated: () => void;
}

export function CreatePostBox({ onPostCreated }: CreatePostBoxProps) {
  const { token, showToast, currentUser } = useChat();
  const [content, setContent] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    setSubmitting(true);
    try {
      await createPost(token, content.trim(), imageUrls);
      setContent('');
      setImageUrls([]);
      showToast('Success', 'Post published successfully!', false);
      onPostCreated();
    } catch (err: any) {
      showToast('Publish Failed', err.message || 'Failed to create post', true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-post-box" style={{
      background: 'var(--panel-bg)',
      border: '1px solid var(--panel-border)',
      borderRadius: '16px',
      padding: '16px',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div className="avatar" style={{ flexShrink: 0 }}>
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
            fontSize: '14px',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.5'
          }}
          disabled={submitting}
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

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid var(--panel-border)',
        paddingTop: '12px',
        marginTop: '4px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
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
            className="input-action-btn"
            title="Attach Photos"
            disabled={uploading || submitting}
          >
            {uploading ? (
              <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--primary)' }}></i>
            ) : (
              <i className="fa-regular fa-image" style={{ color: 'var(--success)' }}></i>
            )}
          </button>
        </div>

        <button
          onClick={handleSubmit}
          className="primary-btn"
          style={{
            width: 'auto',
            padding: '8px 24px',
            fontSize: '13px',
            borderRadius: '10px'
          }}
          disabled={submitting || uploading || (!content.trim() && imageUrls.length === 0)}
        >
          {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Post'}
        </button>
      </div>
    </div>
  );
}
