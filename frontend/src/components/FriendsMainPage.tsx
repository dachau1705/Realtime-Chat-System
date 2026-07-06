import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FriendsSidebar } from './FriendsSidebar';
import { FriendsPage } from './FriendsPage';

export function FriendsMainPage() {
  const { requestId } = useParams<{ requestId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on path
  const getTabFromPath = (pathname: string): 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists' => {
    if (pathname.startsWith('/friends/requests')) return 'requests';
    if (pathname.startsWith('/friends/suggestions')) return 'suggestions';
    if (pathname.startsWith('/friends/all')) return 'all';
    if (pathname.startsWith('/friends/birthdays')) return 'birthdays';
    if (pathname.startsWith('/friends/lists')) return 'lists';
    return 'home';
  };

  const activeTab = getTabFromPath(location.pathname);

  const setActiveTab = (tab: 'home' | 'requests' | 'suggestions' | 'all' | 'birthdays' | 'lists') => {
    if (tab === 'home') navigate('/friends');
    else navigate(`/friends/${tab}`);
  };

  return (
    <div className="container">
      <FriendsSidebar activeTab={activeTab} setActiveTab={setActiveTab} selectedRequestId={requestId} />
      <FriendsPage activeTab={activeTab} setActiveTab={setActiveTab} selectedRequestId={requestId} />
    </div>
  );
}
export default FriendsMainPage;
