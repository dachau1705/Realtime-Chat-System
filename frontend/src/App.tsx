import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useChat } from './hooks/useChat';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ProfileScreen } from './components/ProfileScreen';
import { FeedPage } from './components/FeedPage';
import { PostDetailPage } from './components/PostDetailPage';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import PageCreationWizard from './components/PageCreationWizard';
import { PageDetail } from './components/PageDetail';

export default function App() {
  const { token, setToken, setCurrentUser, connectSocket, toasts, dismissToast, activeTab, setActiveTab } = useChat();
  const location = useLocation();

  // Session restoration on mount
  useEffect(() => {
    const cachedToken = sessionStorage.getItem('chatToken');
    const cachedUser = sessionStorage.getItem('chatUser');

    if (cachedToken && cachedUser) {
      const parsedUser = JSON.parse(cachedUser);
      setToken(cachedToken);
      setCurrentUser(parsedUser);
      connectSocket(cachedToken);
    }
  }, []);

  // Sync activeTab state with route path
  useEffect(() => {
    if (token) {
      if (location.pathname === '/') {
        if (activeTab !== 'feed') {
          setActiveTab('feed');
        }
      } else if (location.pathname === '/chat') {
        if (activeTab === 'feed') {
          setActiveTab('conversations');
        }
      }
    }
  }, [location.pathname, activeTab, setActiveTab, token]);

  return (
    <>
      {!token ? (
        <AuthModal />
      ) : (
        <div className="app-layout-wrapper">
          <Header />
          <div className="app-main-viewport" style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flexGrow: 1, flexShrink: 0 }}>
              <Routes>
                <Route path="/" element={
                  <div className="container">
                    <Sidebar />
                    <FeedPage />
                  </div>
                } />
                <Route path="/chat" element={
                  <div className="container">
                    <Sidebar />
                    <ChatArea />
                  </div>
                } />
                <Route path="/profile/:id" element={<ProfileScreen />} />
                <Route path="/posts/:id" element={<PostDetailPage />} />
                <Route path="/pages/create" element={<PageCreationWizard />} />
                <Route path="/pages/:id" element={<PageDetail />} />
              </Routes>
            </div>
            <Footer />
          </div>
        </div>
      )}

      {/* Toast Notification HUD */}
      <div className="toasts-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card ${toast.isError ? 'error' : ''}`}>
            <div className="toast-card-content">
              <div className="toast-card-title">{toast.title}</div>
              <div className="toast-card-message">{toast.message}</div>
            </div>
            <button
              className="toast-close-btn"
              onClick={() => dismissToast(toast.id)}
              aria-label="Close notification"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
