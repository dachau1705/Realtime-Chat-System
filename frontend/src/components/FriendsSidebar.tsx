import { useChat } from '../hooks/useChat';
import { useNavigate } from 'react-router-dom';

interface FriendsSidebarProps {
  activeTab: 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists';
  setActiveTab: (tab: 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists') => void;
  selectedRequestId?: string;
}

export function FriendsSidebar({ activeTab, setActiveTab, selectedRequestId }: FriendsSidebarProps) {
  const { friendRequests, acceptRequest, declineRequest } = useChat();
  const navigate = useNavigate();

  if (activeTab === 'requests') {
    return (
      <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="sidebar-header" style={{ padding: '20px 16px 12px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--panel-border)' }}>
          <button 
            onClick={() => setActiveTab('home')} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%' }}
            className="action-icon-btn"
            title="Back to Friends"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.3px' }}>
              Friend Requests
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {friendRequests.length} request{friendRequests.length !== 1 ? 's' : ''} pending
            </span>
          </div>
        </div>

        <div className="conv-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', overflowY: 'auto', flexGrow: 1 }}>
          {friendRequests.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px', padding: '20px' }}>
              <i className="fa-solid fa-user-clock" style={{ fontSize: '32px', marginBottom: '12px', display: 'block', opacity: 0.4 }}></i>
              No pending requests
            </div>
          ) : (
            friendRequests.map((req) => {
              const isSelected = selectedRequestId === req.sender_id;
              return (
                <div 
                  key={req.sender_id} 
                  onClick={() => navigate(`/friends/requests/${req.sender_id}`)}
                  style={{ 
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)', 
                    padding: '14px', 
                    borderRadius: '16px', 
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--panel-border)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    gap: '12px', 
                    flexDirection: 'column',
                    transition: 'all 0.2s ease'
                  }}
                  className="friend-request-sidebar-item"
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {req.sender_avatar_url ? (
                      <img src={req.sender_avatar_url} alt="avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                        {req.sender_username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flexGrow: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.sender_username}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-user-group" style={{ fontSize: '9px', color: 'var(--primary)' }}></i>
                        <span>{((req.sender_username.charCodeAt(0) + req.sender_username.length) % 5) + 1} mutual friends</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        {req.sender_email}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        acceptRequest(req.sender_id); 
                        if (isSelected) navigate('/friends/requests');
                      }} 
                      style={{ flex: 1, padding: '8px 0', fontSize: '11.5px', fontWeight: 600, borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', transition: 'background 0.2s' }}
                      className="friends-action-btn-primary"
                    >
                      Confirm
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        declineRequest(req.sender_id); 
                        if (isSelected) navigate('/friends/requests');
                      }} 
                      style={{ flex: 1, padding: '8px 0', fontSize: '11.5px', fontWeight: 600, borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', cursor: 'pointer', transition: 'background 0.2s' }}
                      className="friends-action-btn-secondary"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sidebar-header" style={{ padding: '24px 20px 16px 20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.5px' }}>
          Friends
        </h2>
      </div>

      <div className="sidebar-tabs" style={{ padding: '12px 16px' }}>
        <button
          className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <i className="fa-solid fa-house" style={{ fontSize: '15px' }}></i>
          <span>Home</span>
        </button>

        <button
          className="tab-btn"
          onClick={() => setActiveTab('requests')}
        >
          <i className="fa-solid fa-user-clock" style={{ fontSize: '15px' }}></i>
          <span>Friend Requests</span>
          {friendRequests.length > 0 && (
            <span className="tab-btn-badge error-badge">
              {friendRequests.length}
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          <i className="fa-solid fa-user-plus" style={{ fontSize: '15px' }}></i>
          <span>Suggestions</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <i className="fa-solid fa-users" style={{ fontSize: '15px' }}></i>
          <span>All Friends</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'birthdays' ? 'active' : ''}`}
          onClick={() => setActiveTab('birthdays')}
        >
          <i className="fa-solid fa-cake-candles" style={{ fontSize: '15px' }}></i>
          <span>Birthdays</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'lists' ? 'active' : ''}`}
          onClick={() => setActiveTab('lists')}
        >
          <i className="fa-solid fa-list-ul" style={{ fontSize: '15px' }}></i>
          <span>Custom Lists</span>
        </button>
      </div>
    </div>
  );
}
