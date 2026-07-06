import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../hooks/useChat';

interface UserSearchResult {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface MyPageItem {
  id: string;
  page_name: string;
  username: string;
  avatar: string | null;
  role: string;
}

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, currentUser, logout } = useChat();

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [myPages, setMyPages] = useState<MyPageItem[]>([]);
  const [showPagesMenu, setShowPagesMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Theme synchronization
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    setTheme(nextTheme);
  };

  // Debounced search logic
  useEffect(() => {
    if (!token || !searchQuery.trim()) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Failed to search users', err);
      } finally {
        setLoadingSearch(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, token]);

  // Fetch user pages
  const fetchMyPages = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/pages/my', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyPages(data);
      }
    } catch (err) {
      console.error('Failed to fetch user pages', err);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
      if (pagesRef.current && !pagesRef.current.contains(event.target as Node)) {
        setShowPagesMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="shared-glass-header">
      <div className="header-logo-section" onClick={() => navigate('/')}>
        <img 
          src={theme === 'light' ? '/logo/connectly-logo-light.jpg' : '/logo/connectly-logo-dark.jpg'} 
          alt="Logo" 
          className="header-logo-img" 
        />
        <span className="header-logo-title">Connectly</span>
      </div>

      {/* 2. Debounced User Search Engine */}
      <div className="header-search-container" ref={searchRef}>
        <div className="header-search-bar">
          <i className="fa-solid fa-magnifying-glass search-icon" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />
          {loadingSearch && <i className="fa-solid fa-spinner fa-spin search-loader" />}
        </div>

        {showSearchResults && searchQuery.trim() && (
          <div className="search-dropdown-menu">
            {searchResults.length === 0 ? (
              <div className="search-no-results">No users found match "{searchQuery}"</div>
            ) : (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="search-result-card"
                  onClick={() => {
                    navigate(`/profile/${user.id}`);
                    setShowSearchResults(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="user-fullname">{user.full_name || user.username}</div>
                    <div className="user-tag">@{user.username}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 3. Global Action Navigation */}
      <nav className="header-nav-shortcuts">
        <button
          className={`nav-shortcut-btn ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <i className="fa-solid fa-house" />
          <span>Feed</span>
        </button>
        <button
          className={`nav-shortcut-btn ${location.pathname === '/chat' ? 'active' : ''}`}
          onClick={() => navigate('/chat')}
        >
          <i className="fa-solid fa-comment-dots" />
          <span>Chats</span>
        </button>
      </nav>

      {/* 4. Dropdown Menus */}
      <div className="header-actions-area">
        {/* Theme Switcher Toggle */}
        <button
          className="action-icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <i className="fa-solid fa-sun" style={{ color: '#F59E0B' }} />
          ) : (
            <i className="fa-solid fa-moon" style={{ color: '#6366F1' }} />
          )}
        </button>

        {/* Fanpage Shortcuts Menu */}
        <div className="header-menu-wrapper" ref={pagesRef}>
          <button
            className={`action-icon-btn ${showPagesMenu ? 'active' : ''}`}
            onClick={() => {
              setShowPagesMenu(!showPagesMenu);
              if (!showPagesMenu) fetchMyPages();
            }}
            title="My Pages"
          >
            <i className="fa-solid fa-flag" />
          </button>

          {showPagesMenu && (
            <div className="header-dropdown-panel right-aligned">
              <div className="dropdown-panel-title">My Fanpages</div>
              <button
                className="panel-action-btn"
                onClick={() => {
                  navigate('/pages/create');
                  setShowPagesMenu(false);
                }}
              >
                <i className="fa-solid fa-circle-plus" />
                <span>Create new Page</span>
              </button>

              <div className="panel-list-scroll">
                {myPages.length === 0 ? (
                  <div className="panel-empty-info">You do not manage any pages yet.</div>
                ) : (
                  myPages.map((page) => (
                    <div
                      key={page.id}
                      className="panel-list-item"
                      onClick={() => {
                        navigate(`/pages/${page.id}`);
                        setShowPagesMenu(false);
                      }}
                    >
                      <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '9px' }}>
                        {page.avatar ? (
                          <img src={page.avatar} alt="logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          page.page_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="panel-item-info">
                        <span className="panel-item-name">{page.page_name}</span>
                        <span className="panel-item-tag">@{page.username} • {page.role}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Menu */}
        <div className="header-menu-wrapper" ref={profileRef}>
          <button
            className={`action-profile-trigger ${showProfileMenu ? 'active' : ''}`}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                currentUser?.username.charAt(0).toUpperCase()
              )}
            </div>
          </button>

          {showProfileMenu && (
            <div className="header-dropdown-panel right-aligned profile-panel">
              <div className="profile-panel-identity">
                <div className="identity-name">{currentUser?.full_name || currentUser?.username}</div>
                <div className="identity-email">@{currentUser?.username}</div>
              </div>
              <hr className="dropdown-divider" />
              <button
                className="panel-action-btn"
                onClick={() => {
                  navigate(`/profile/${currentUser?.id}`);
                  setShowProfileMenu(false);
                }}
              >
                <i className="fa-regular fa-user" />
                <span>My Profile</span>
              </button>
              <button className="panel-action-btn logout-action" onClick={handleLogout}>
                <i className="fa-solid fa-arrow-right-from-bracket" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
