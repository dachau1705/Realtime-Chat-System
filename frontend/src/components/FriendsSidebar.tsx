import { useChat } from '../hooks/useChat';
import { useNavigate } from 'react-router-dom';

interface FriendsSidebarProps {
  activeTab: 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists';
  setActiveTab: (tab: 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists') => void;
  selectedRequestId?: string;
}

export function FriendsSidebar({ activeTab, setActiveTab, selectedRequestId }: FriendsSidebarProps) {
  const { friendRequests, sentRequests, acceptRequest, declineRequest } = useChat();
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
              {friendRequests.length} pending • {sentRequests.length} sent
            </span>
          </div>
        </div>

        <div className="conv-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', overflowY: 'auto', flexGrow: 1 }}>
          {/* Received Requests Section */}
          <div>
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Received ({friendRequests.length})
            </h3>
            {friendRequests.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '8px 0', textAlign: 'center' }}>
                No received requests
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {friendRequests.map((req) => {
                  const isSelected = selectedRequestId === req.sender_id;
                  return (
                    <div 
                      key={req.sender_id} 
                      onClick={() => navigate(`/friends/requests/${req.sender_id}`)}
                      style={{ 
                        background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--panel-border)', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        gap: '10px', 
                        flexDirection: 'column',
                        transition: 'all 0.2s ease'
                      }}
                      className="friend-request-sidebar-item"
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {req.sender_avatar_url ? (
                          <img src={req.sender_avatar_url} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                            {req.sender_username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0, flexGrow: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.sender_username}
                          </div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                            {req.sender_email}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            acceptRequest(req.sender_id); 
                            if (isSelected) navigate('/friends/requests');
                          }} 
                          style={{ flex: 1, padding: '6px 0', fontSize: '11px', fontWeight: 600, borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer' }}
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            declineRequest(req.sender_id); 
                            if (isSelected) navigate('/friends/requests');
                          }} 
                          style={{ flex: 1, padding: '6px 0', fontSize: '11px', fontWeight: 600, borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sent Requests Section */}
          <div style={{ marginTop: '12px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Sent ({sentRequests.length})
            </h3>
            {sentRequests.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', padding: '8px 0', textAlign: 'center' }}>
                No sent requests
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sentRequests.map((req) => {
                  const isSelected = selectedRequestId === req.receiver_id;
                  return (
                    <div 
                      key={req.receiver_id} 
                      onClick={() => navigate(`/friends/requests/${req.receiver_id}`)}
                      style={{ 
                        background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--panel-border)', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        gap: '10px', 
                        flexDirection: 'column',
                        transition: 'all 0.2s ease'
                      }}
                      className="friend-request-sidebar-item"
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {req.receiver_avatar_url ? (
                          <img src={req.receiver_avatar_url} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                            {req.receiver_username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0, flexGrow: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.receiver_username}
                          </div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                            {req.receiver_email}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            declineRequest(req.receiver_id); 
                            if (isSelected) navigate('/friends/requests');
                          }} 
                          style={{ flex: 1, padding: '6px 0', fontSize: '11px', fontWeight: 600, borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', cursor: 'pointer' }}
                        >
                          Cancel Request
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
