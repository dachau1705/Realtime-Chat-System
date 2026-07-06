import { type Story } from '../../services/api';

interface StoryCardProps {
  story: Story;
  isCreateCard?: boolean;
  currentUserAvatar?: string | null;
  onClick?: () => void;
}

export function StoryCard({ story, isCreateCard = false, currentUserAvatar, onClick }: StoryCardProps) {
  if (isCreateCard) {
    return (
      <div 
        className="story-card create-story-card" 
        onClick={onClick}
        style={{
          width: '112px',
          height: '200px',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ height: '145px', overflow: 'hidden' }}>
          <img 
            src={currentUserAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'} 
            alt="My Profile" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
            className="story-thumbnail"
          />
        </div>
        <div style={{ 
          height: '55px', 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '0 4px',
          background: 'var(--panel-bg)'
        }}>
          <div 
            style={{
              position: 'absolute',
              top: '-16px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--primary)',
              border: '4px solid var(--panel-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            <i className="fa-solid fa-plus"></i>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginTop: '14px', textAlign: 'center' }}>
            Create Story
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="story-card" 
      onClick={onClick}
      style={{
        width: '112px',
        height: '200px',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Background Story Thumbnail */}
      <img 
        src={story.thumbnailUrl} 
        alt={`${story.username}'s story`} 
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
        className="story-thumbnail"
      />

      {/* Dark overlay for text readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)',
        pointerEvents: 'none'
      }} />

      {/* Absolute user avatar with ring indicator */}
      <div 
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: story.isViewed ? '2px solid rgba(255,255,255,0.6)' : '3px solid var(--primary)',
          overflow: 'hidden',
          background: 'var(--panel-bg)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        }}
      >
        <img 
          src={story.userAvatar || 'https://via.placeholder.com/150'} 
          alt={story.username} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>

      {/* Absolute user label */}
      <span 
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          color: 'white',
          fontSize: '11px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)'
        }}
      >
        {story.username}
      </span>
    </div>
  );
}
