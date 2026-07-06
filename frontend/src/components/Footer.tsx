import { useNavigate } from 'react-router-dom';

export function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="shared-glass-footer">
      <div className="footer-links">
        <button className="footer-link-btn" onClick={() => navigate('/')}>Home</button>
        <button className="footer-link-btn" onClick={() => navigate('/chat')}>Chats</button>
        <span className="footer-separator">•</span>
        <a href="#help" className="footer-link-anchor">Help Center</a>
        <a href="#privacy" className="footer-link-anchor">Privacy Policy</a>
        <a href="#terms" className="footer-link-anchor">Terms of Service</a>
      </div>
      <div className="footer-copyright">
        © {new Date().getFullYear()} Antigravity Systems. All rights reserved. Built with TypeScript & React.
      </div>
    </footer>
  );
}
