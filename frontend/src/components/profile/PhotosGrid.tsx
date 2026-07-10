import React from 'react';

interface PhotosGridProps {
  photos: string[];
  loading: boolean;
  onPhotoClick: (url: string) => void;
  limit?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  gridTemplateColumns?: string;
}

export const PhotosGrid: React.FC<PhotosGridProps> = ({
  photos,
  loading,
  onPhotoClick,
  limit,
  emptyMessage = 'Chưa có ảnh nào.',
  loadingMessage = 'Đang tải ảnh...',
  gridTemplateColumns
}) => {
  if (loading) {
    return (
      <div className="tab-panel-loader" style={{ padding: '20px 0' }}>
        <i className="fa-solid fa-spinner fa-spin"></i> {loadingMessage}
      </div>
    );
  }

  const displayedPhotos = limit ? photos.slice(0, limit) : photos;

  if (displayedPhotos.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: gridTemplateColumns || 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: '12px',
      width: '100%'
    }}>
      {displayedPhotos.map((url, index) => (
        <div
          key={index}
          onClick={() => onPhotoClick(url)}
          style={{
            position: 'relative',
            aspectRatio: '1',
            borderRadius: '12px',
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease'
          }}
          className="photo-grid-item widget-grid-item"
        >
          <img
            src={url}
            alt={`Upload ${index}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};
