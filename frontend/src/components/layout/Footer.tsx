import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

export function Footer() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <footer className="shared-glass-footer">
      <div className="footer-links">
        <button className="footer-link-btn" onClick={() => navigate('/')}>{t('footer.home')}</button>
        <button className="footer-link-btn" onClick={() => navigate('/chat')}>{t('footer.chats')}</button>
        <span className="footer-separator">•</span>
        <a href="#help" className="footer-link-anchor">{t('footer.helpCenter')}</a>
        <a href="#privacy" className="footer-link-anchor">{t('footer.privacyPolicy')}</a>
        <a href="#terms" className="footer-link-anchor">{t('footer.termsOfService')}</a>
      </div>
      <div className="footer-copyright">
        {t('footer.copyright').replace('{year}', String(new Date().getFullYear()))}
      </div>
    </footer>
  );
}
