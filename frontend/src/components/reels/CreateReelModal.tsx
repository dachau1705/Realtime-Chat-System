import React, { useState, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { useLanguage } from '../../context/LanguageContext';
import { uploadMedia, createReel } from '../../services/api';

interface CreateReelModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateReelModal({ onClose, onSuccess }: CreateReelModalProps) {
  const { token, showToast } = useChat();
  const { t } = useLanguage();

  const [caption, setCaption] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      showToast('Error', 'Please select a valid video file', true);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      showToast('Error', 'Video exceeds 25MB limit', true);
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !videoFile) return;

    setLoading(true);
    try {
      setProgressMsg(t('reels.uploading'));
      // 1. Upload video file to server / Cloudinary
      const uploadRes = await uploadMedia(token, videoFile);

      setProgressMsg(t('story.publishing') || 'Publishing...');
      // 2. Save Reel details in database
      await createReel(token, uploadRes.url, caption.trim() || null);

      showToast(t('friends.addFriend') || 'Success', t('reels.publishSuccess'), false);
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(t('friends.delete') || 'Error', err.message || t('reels.publishError'), true);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 24px 38px 3px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          borderBottom: '1px solid var(--panel-border)'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
            {t('reels.createReel')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
            disabled={loading}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
          {/* File Input */}
          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {!videoPreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--panel-border)',
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                transition: 'background 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
              className="post-action-btn"
            >
              <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '32px', color: 'var(--primary)' }}></i>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                {t('reels.addReel')}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                MP4, WebM up to 25MB
              </span>
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center' }}>
              <video
                src={videoPreview}
                controls
                style={{ width: '100%', maxHeight: '240px', objectFit: 'contain' }}
              />
              <button
                type="button"
                onClick={() => {
                  setVideoFile(null);
                  setVideoPreview('');
                }}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px'
                }}
                disabled={loading}
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          )}

          {/* Caption Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('reels.captionPlaceholder')}
              rows={3}
              maxLength={280}
              disabled={loading}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--panel-border)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: 'white',
                fontSize: '13.5px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ alignSelf: 'flex-end', fontSize: '11px', color: 'var(--text-muted)' }}>
              {caption.length}/280
            </div>
          </div>

          {/* Submit / Cancel Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--panel-border)',
                borderRadius: '10px',
                color: 'var(--text-main)',
                padding: '10px 18px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 500
              }}
              disabled={loading}
            >
              {t('reels.cancel')}
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={loading || !videoFile}
              style={{
                width: 'auto',
                padding: '10px 20px',
                fontSize: '13px',
                borderRadius: '10px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>{progressMsg}</span>
                </>
              ) : (
                t('reels.postReelBtn')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
