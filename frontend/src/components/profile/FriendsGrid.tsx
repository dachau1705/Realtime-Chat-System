import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Friend {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_mutual?: boolean;
}

interface FriendsGridProps {
  friends: Friend[];
  loading: boolean;
  limit?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  gridTemplateColumns?: string;
  showMutualLabel?: boolean;
  avatarSize?: string;
}

export const FriendsGrid: React.FC<FriendsGridProps> = ({
  friends,
  loading,
  limit,
  emptyMessage = 'Chưa có bạn bè.',
  loadingMessage = 'Đang tải bạn bè...',
  gridTemplateColumns,
  showMutualLabel = false,
  avatarSize = '44px'
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="tab-panel-loader" style={{ padding: '20px 0' }}>
        <i className="fa-solid fa-spinner fa-spin"></i> {loadingMessage}
      </div>
    );
  }

  const displayedFriends = limit ? friends.slice(0, limit) : friends;

  if (displayedFriends.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div 
      className={gridTemplateColumns ? '' : 'friends-grid-list'} 
      style={gridTemplateColumns ? {
        display: 'grid',
        gridTemplateColumns,
        gap: '10px'
      } : undefined}
    >
      {displayedFriends.map((friend) => (
        <div
          key={friend.id}
          className="friend-grid-card"
          onClick={() => navigate(`/profile/${friend.id}`)}
          style={gridTemplateColumns ? { padding: '8px', cursor: 'pointer', textAlign: 'center', display: 'block', border: 'none', background: 'none' } : undefined}
        >
          {friend.avatar_url ? (
            <img
              src={friend.avatar_url}
              alt={friend.username}
              className="friend-card-avatar"
              style={gridTemplateColumns ? {
                width: '100%',
                aspectRatio: '1',
                borderRadius: '8px',
                objectFit: 'cover',
                height: 'auto'
              } : { width: avatarSize, height: avatarSize }}
            />
          ) : (
            <div
              className="friend-card-avatar-placeholder"
              style={gridTemplateColumns ? {
                width: '100%',
                aspectRatio: '1',
                borderRadius: '8px',
                height: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--primary)',
                color: 'white',
                fontWeight: 700,
                fontSize: '18px'
              } : { width: avatarSize, height: avatarSize }}
            >
              {friend.username.charAt(0).toUpperCase()}
            </div>
          )}
          {gridTemplateColumns ? (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-main)',
              marginTop: '4px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {friend.full_name || friend.username}
            </div>
          ) : (
            <div className="friend-card-info">
              <div className="friend-card-name">{friend.full_name || friend.username}</div>
              <div className="friend-card-sub style-muted">
                {showMutualLabel && friend.is_mutual ? 'Bạn chung' : `@${friend.username}`}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
