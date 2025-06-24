import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isNostrAvailable, isValidNsec } from '../utils/nostr';

export function LoginScreen() {
  const { login, loginWithPrivateKey, unlockWithPassword, needsPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivateKeyForm, setShowPrivateKeyForm] = useState(false);
  const [nsecInput, setNsecInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleExtensionLogin = async () => {
    if (!isNostrAvailable()) {
      setError('No Nostr extension found. Please install Alby, nos2x, or another Nostr extension.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePrivateKeyLogin = async () => {
    if (!nsecInput.trim()) {
      setError('Please enter your private key (nsec)');
      return;
    }

    if (!passwordInput.trim()) {
      setError('Please enter a password to encrypt your private key');
      return;
    }

    if (passwordInput.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!isValidNsec(nsecInput.trim())) {
      setError('Invalid nsec format. Please check your private key.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loginWithPrivateKey(nsecInput.trim(), passwordInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUnlock = async () => {
    if (!passwordInput.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await unlockWithPassword(passwordInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-pink-600 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sakura</h1>
          <p className="text-gray-600">
            A decentralized media platform powered by Nostr and Blossom
          </p>
        </div>

        <div className="card">
          {needsPassword ? (
            // Password Unlock for existing users
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-600 text-sm">
                  Enter your password to unlock your stored private key.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordUnlock()}
                />
              </div>

              <button
                onClick={handlePasswordUnlock}
                disabled={loading || !passwordInput.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Unlocking...
                  </div>
                ) : (
                  'Unlock'
                )}
              </button>

              <button
                onClick={() => {
                  setError(null);
                  setPasswordInput('');
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Forgot Password? Use Different Method
              </button>
            </>
          ) : !showPrivateKeyForm ? (
            // Extension Login
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Connect with Nostr
                </h2>
                <p className="text-gray-600 text-sm">
                  Sign in using your Nostr browser extension to manage your media files.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleExtensionLogin}
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </div>
                ) : (
                  'Connect with Nostr Extension'
                )}
              </button>

              <div className="text-center">
                <span className="text-gray-500 text-sm">or</span>
              </div>

              <button
                onClick={() => setShowPrivateKeyForm(true)}
                className="w-full mt-4 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Use Private Key (nsec)
              </button>
            </>
          ) : (
            // Private Key Login (New Users)
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Enter Private Key
                </h2>
                <p className="text-gray-600 text-sm">
                  Enter your Nostr private key and choose a password to encrypt it.
                  Your key will be secured with AES-256 encryption.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="nsec" className="block text-sm font-medium text-gray-700 mb-2">
                  Private Key (nsec...)
                </label>
                <input
                  id="nsec"
                  type="password"
                  value={nsecInput}
                  onChange={(e) => setNsecInput(e.target.value)}
                  placeholder="nsec1..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your private key starts with "nsec1" and is used to access your Nostr identity.
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="encryption-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Encryption Password
                </label>
                <input
                  id="encryption-password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Choose a strong password (min 8 chars)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This password will be used to encrypt your private key. Make it strong and memorable.
                </p>
              </div>

              <button
                onClick={handlePrivateKeyLogin}
                disabled={loading || !nsecInput.trim() || !passwordInput.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in with Private Key'
                )}
              </button>

              <button
                onClick={() => {
                  setShowPrivateKeyForm(false);
                  setNsecInput('');
                  setPasswordInput('');
                  setError(null);
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Back to Extension Login
              </button>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-blue-800 text-sm font-medium">🔐 Strong Encryption</p>
                    <p className="text-blue-700 text-xs mt-1">
                      Your private key will be encrypted with AES-256 using PBKDF2 key derivation. 
                      Only you know the password - we cannot recover it if forgotten.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {!showPrivateKeyForm && !needsPassword && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Supported Extensions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="https://getalby.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white font-bold text-sm">A</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">Alby</span>
                </a>
                <a
                  href="https://github.com/fiatjaf/nos2x"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white font-bold text-sm">N</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700">nos2x</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}