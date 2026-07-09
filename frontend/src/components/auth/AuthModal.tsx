import { useState, useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { login as apiLogin, register as apiRegister, seedDatabase, checkBackendHealth } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export function AuthModal() {
  const { t } = useLanguage();
  const { connectSocket, setToken, setCurrentUser, setOtherUser } = useChat();
  
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [isBackendOffline, setIsBackendOffline] = useState<boolean>(false);
  
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [registerUsername, setRegisterUsername] = useState<string>('');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Health check on render
  useEffect(() => {
    checkBackendHealth()
      .then(() => setIsBackendOffline(false))
      .catch(() => setIsBackendOffline(true));
  }, []);

  const completeAuth = (token: string, user: any) => {
    sessionStorage.setItem('chatToken', token);
    sessionStorage.setItem('chatUser', JSON.stringify(user));
    setToken(token);
    setCurrentUser(user);
    connectSocket(token);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    console.log('[OUTGOING] LOGIN_REQUEST:', { username: loginUsername });

    try {
      const data = await apiLogin(loginUsername, loginPassword);
      console.log('[INCOMING] LOGIN_SUCCESS:', { user: data.user });
      completeAuth(data.token, data.user);
    } catch (err: any) {
      console.log('[INCOMING] LOGIN_FAILED:', err.message);
      setLoginError(err.message);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    console.log('[OUTGOING] REGISTER_REQUEST:', { username: registerUsername, email: registerEmail });

    try {
      const data = await apiRegister(registerUsername, registerEmail, registerPassword);
      console.log('[INCOMING] REGISTER_SUCCESS:', { user: data.user });
      completeAuth(data.token, data.user);
    } catch (err: any) {
      console.log('[INCOMING] REGISTER_FAILED:', err.message);
      setRegisterError(err.message);
    }
  };

  const quickStart = async (role: 'alice' | 'bob') => {
    console.log('[INFO] PROFILE SELECT:', `Loading test credentials for role: ${role}`);
    
    try {
      const data = await seedDatabase();
      console.log('[INCOMING] API_SEED_SUCCESS:', { alice: data.alice.username, bob: data.bob.username });

      let user, token;
      if (role === 'alice') {
        user = data.alice;
        token = data.aliceToken;
        setOtherUser(data.bob);
      } else {
        user = data.bob;
        token = data.bobToken;
        setOtherUser(data.alice);
      }
      completeAuth(token, user);
    } catch (err: any) {
      console.log('[INFO] API_SEED_OFFLINE:', `Backend server offline/failed (${err.message}). Generating fallback parameters...`);

      const user = role === 'alice'
        ? { id: '00000000-0000-0000-0000-000000000001', username: 'alice', email: 'alice@example.com' }
        : { id: '00000000-0000-0000-0000-000000000002', username: 'bob', email: 'bob@example.com' };

      const otherUser = role === 'alice'
        ? { id: '00000000-0000-0000-0000-000000000002', username: 'bob', email: 'bob@example.com' }
        : { id: '00000000-0000-0000-0000-000000000001', username: 'alice', email: 'alice@example.com' };

      const token = 'mock-fallback-token';
      setOtherUser(otherUser);
      completeAuth(token, user);
    }
  };

  return (
    <div id="loginModal" className="modal" style={{ display: 'flex' }}>
      <div className="modal-content">
        {!isRegisterMode ? (
          <div id="loginFormSection">
            <h1>{t('auth.welcomeBack')}</h1>
            <p>{t('auth.welcomeDesc')}</p>

            {isBackendOffline && (
              <div id="fallbackNotice" style={{ display: 'block', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: '12px', padding: '12px', marginBottom: '20px', textAlign: 'left', fontSize: '13px' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--warning)', marginRight: '6px' }}></i>
                {t('auth.fallbackNotice')}
              </div>
            )}

            {loginError && (
              <div id="loginError" style={{ display: 'block', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: '#f87171', borderRadius: '12px', padding: '12px', marginBottom: '20px', textAlign: 'left', fontSize: '13px' }}>
                <i className="fa-solid fa-circle-xmark" style={{ marginRight: '6px' }}></i>
                <span>{loginError}</span>
              </div>
            )}

            <form id="loginForm" onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label htmlFor="loginUsername">{t('auth.username')}</label>
                <input
                  type="text"
                  id="loginUsername"
                  className="form-input"
                  placeholder="e.g. alice"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="loginPassword">{t('auth.password')}</label>
                <input
                  type="password"
                  id="loginPassword"
                  className="form-input"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="primary-btn">
                <i className="fa-solid fa-right-to-bracket"></i> {t('auth.signIn')}
              </button>
            </form>

            <div className="toggle-link">
              {t('auth.noAccount')}{' '}
              <span style={{ cursor: 'pointer' }} onClick={() => setIsRegisterMode(true)}>
                {t('auth.registerHere')}
              </span>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--panel-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{t('auth.orQuickStart')}</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="setup-btn" style={{ flex: 1, padding: '10px 14px', fontSize: '13px', borderRadius: '10px', cursor: 'pointer' }} onClick={() => quickStart('alice')}>
                  <span>Alice</span> <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px' }}></i>
                </button>
                <button className="setup-btn" style={{ flex: 1, padding: '10px 14px', fontSize: '13px', borderRadius: '10px', cursor: 'pointer' }} onClick={() => quickStart('bob')}>
                  <span>Bob</span> <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px' }}></i>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div id="registerFormSection">
            <h1>{t('auth.createAccount')}</h1>
            <p>{t('auth.createAccountDesc')}</p>

            {registerError && (
              <div id="registerError" style={{ display: 'block', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: '#f87171', borderRadius: '12px', padding: '12px', marginBottom: '20px', textAlign: 'left', fontSize: '13px' }}>
                <i className="fa-solid fa-circle-xmark" style={{ marginRight: '6px' }}></i>
                <span>{registerError}</span>
              </div>
            )}

            <form id="registerForm" onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label htmlFor="registerUsername">{t('auth.username')}</label>
                <input
                  type="text"
                  id="registerUsername"
                  className="form-input"
                  placeholder="e.g. charlie"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="registerEmail">{t('auth.email')}</label>
                <input
                  type="email"
                  id="registerEmail"
                  className="form-input"
                  placeholder="charlie@example.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="registerPassword">{t('auth.password')}</label>
                <input
                  type="password"
                  id="registerPassword"
                  className="form-input"
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="primary-btn">
                <i className="fa-solid fa-user-plus"></i> {t('auth.signUp')}
              </button>
            </form>

            <div className="toggle-link">
              {t('auth.hasAccount')}{' '}
              <span style={{ cursor: 'pointer' }} onClick={() => setIsRegisterMode(false)}>
                {t('auth.signInHere')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
