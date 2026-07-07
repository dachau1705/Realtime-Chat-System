import React, { createContext, useState, useEffect, useContext } from 'react';
import { getToken, saveToken, deleteToken } from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';
import api from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  loading: boolean;
  login: (token: string, user: any) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const savedToken = await getToken();
        if (savedToken) {
          setToken(savedToken);
          // Test token / fetch profile
          const profileRes = await api.get('/feed', {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          // If succeeds, retrieve current user info (we can load from standard user detail endpoint,
          // but since profile/suggestions works, we know token is valid. In a real app we fetch /me.
          // Let's call /api/users/me or extract from token payload).
          // Let's extract user info from JWT payload!
          const payload = JSON.parse(atob(savedToken.split('.')[1]));
          setUser({ id: payload.userId, username: payload.username });
          setIsAuthenticated(true);
          await connectSocket();
        }
      } catch (err) {
        console.warn('Stale session or network issue', err);
        await deleteToken();
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  const login = async (newToken: string, userData: any) => {
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
    await saveToken(newToken);
    await connectSocket();
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    await deleteToken();
    disconnectSocket();
  };

  const updateUser = (updatedUser: any) => {
    setUser((prev: any) => ({ ...prev, ...updatedUser }));
  };

  // Helper polyfill for JWT decode (atob) since React Native doesn't have it natively
  function atob(input: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';
    for (let i = 0; i < str.length; i += 4) {
      const chunk = str.slice(i, i + 4);
      let bytes = 0;
      for (let j = 0; j < chunk.length; j++) {
        const val = chars.indexOf(chunk[j]);
        if (val !== -1) {
          bytes = (bytes << 6) | val;
        }
      }
      const len = chunk.length - 1;
      if (len === 1) {
        output += String.fromCharCode((bytes >> 4) & 255);
      } else if (len === 2) {
        output += String.fromCharCode((bytes >> 10) & 255, (bytes >> 2) & 255);
      } else if (len === 3) {
        output += String.fromCharCode((bytes >> 16) & 255, (bytes >> 8) & 255, bytes & 255);
      }
    }
    return output;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
