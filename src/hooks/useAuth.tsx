import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { AuthContextType, User } from '../types';
import { 
  getPublicKey, 
  getUserProfile, 
  isNostrAvailable,
  getStoredPrivateKey,
  clearSessionPrivateKey,
  storePrivateKey,
  isValidNsec,
  hasStoredPrivateKey
} from '../utils/nostr';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginMethod, setLoginMethod] = useState<'extension' | 'nsec' | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false); // For nsec users who need to unlock

  useEffect(() => {
    // Check if user was previously logged in with extension
    const savedPubkey = localStorage.getItem('sakura_pubkey');
    const savedLoginMethod = localStorage.getItem('sakura_login_method') as 'extension' | 'nsec' | null;
    
    if (savedPubkey && savedLoginMethod === 'extension' && isNostrAvailable()) {
      setLoginMethod('extension');
      loadUser(savedPubkey, 'extension');
      return;
    }
    
    // Check if user has stored private key
    if (hasStoredPrivateKey() && savedLoginMethod === 'nsec') {
      setLoginMethod('nsec');
      setNeedsPassword(true); // User needs to enter password to unlock
      setLoading(false);
      return;
    }
    
    setLoading(false);
  }, []);

  const loadUser = useCallback(async (pubkey: string, method: 'extension' | 'nsec') => {
    try {
      console.log('Loading user profile for:', pubkey.slice(0, 8) + '...', 'via', method);
      const profile = await getUserProfile(pubkey);
      console.log('Profile loaded:', { 
        displayName: profile.displayName, 
        hasPicture: !!profile.picture,
        pictureUrl: profile.picture ? (profile.picture.length > 50 ? profile.picture.slice(0, 50) + '...' : profile.picture) : 'none'
      });
      
      const userData: User = {
        pubkey,
        loginMethod: method,
        ...profile,
      };
      setUser(userData);
      setLoginMethod(method);
      localStorage.setItem('sakura_pubkey', pubkey);
      localStorage.setItem('sakura_login_method', method);
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('sakura_pubkey');
      localStorage.removeItem('sakura_login_method');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async () => {
    if (!isNostrAvailable()) {
      throw new Error('Nostr extension not found. Please install Alby, nos2x, or another Nostr extension.');
    }

    setLoading(true);
    try {
      const pubkey = await getPublicKey();
      await loadUser(pubkey, 'extension');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [loadUser]);

  const logout = useCallback(() => {
    setUser(null);
    setLoginMethod(null);
    setNeedsPassword(false);
    localStorage.removeItem('sakura_pubkey');
    localStorage.removeItem('sakura_login_method');
    clearSessionPrivateKey(); // Clear session key but keep encrypted storage
  }, []);

  const loginWithPrivateKey = useCallback(async (nsec: string, password: string) => {
    if (!isValidNsec(nsec)) {
      throw new Error('Invalid nsec format. Please check your private key.');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    setLoading(true);
    setNeedsPassword(false);
    try {
      // Store the private key securely with user password
      storePrivateKey(nsec, password);
      
      // Now retrieve it to set the session key (this will decrypt and store in memory)
      const storedKey = getStoredPrivateKey(password);
      if (!storedKey) {
        throw new Error('Failed to retrieve stored key after saving');
      }
      
      // Load user profile
      await loadUser(storedKey.publicKey, 'nsec');
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [loadUser]);

  const unlockWithPassword = useCallback(async (password: string) => {
    if (!password) {
      throw new Error('Password is required');
    }

    setLoading(true);
    setNeedsPassword(false);
    try {
      // Try to decrypt stored private key with password
      const storedKey = getStoredPrivateKey(password);
      if (!storedKey) {
        throw new Error('Invalid password');
      }
      
      // Load user profile
      await loadUser(storedKey.publicKey, 'nsec');
    } catch (error) {
      setLoading(false);
      setNeedsPassword(true);
      throw error;
    }
  }, [loadUser]);

  const getSigningMethod = useCallback((): 'extension' | 'nsec' | null => {
    return loginMethod;
  }, [loginMethod]);

  const refreshUserProfile = useCallback(async () => {
    if (user && loginMethod) {
      await loadUser(user.pubkey, loginMethod);
    }
  }, [user, loginMethod, loadUser]);

  const value: AuthContextType = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    login,
    loginWithPrivateKey,
    unlockWithPassword,
    logout,
    loading,
    needsPassword,
    getSigningMethod,
    refreshUserProfile,
  }), [user, login, loginWithPrivateKey, unlockWithPassword, logout, loading, needsPassword, getSigningMethod, refreshUserProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
