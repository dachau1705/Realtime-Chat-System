import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Reel {
  id: string;
  video_url: string;
  likes_count: number;
}

interface ReelsGridProps {
  reels: Reel[];
  loading: boolean;
  limit?: number;
  emptyMessage?: string;
  loadingMessage?: string;
}

export const ReelsGrid: React.FC<ReelsGridProps> = ({
  reels,
  loading,
  limit,
  emptyMessage = 'Chưa có Reels nào.',
  loadingMessage = 'Đang tải reels...'
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="tab-panel-loader" style={{ padding: '20px 0' }}>
        <i className="fa-solid fa-spinner fa-spin"></i> {loadingMessage}
      </div>
    );
  }

  const displayedReels = limit ? reels.slice(0, limit) : reels;

  if (displayedReels.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: '12px',
      width: '100%'
    }}>
      {displayedReels.map((reel) => (
        <div
          key={reel.id}
          onClick={() => navigate(`/reels`)}
          style={{
            position: 'relative',
            aspectRatio: '9/16',
            borderRadius: '12px',
            overflow: 'hidden',
            cursor: 'pointer',
            background: '#000',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'transform 0.2s'
          }}
          className="photo-grid-item"
        >
          <video src={reel.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
          }}>
            <i className="fa-regular fa-heart"></i>
            <span>{reel.likes_count}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
