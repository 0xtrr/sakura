import { useAuth } from '../hooks/useAuth';
import { shortenPubkey } from '../utils/nostr';
import { ProfileImage } from './ProfileImage';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <div className="inline-flex items-center justify-center w-8 h-8 bg-pink-600 rounded-lg mr-2 sm:mr-3">
            <svg
              className="w-5 h-5 text-white"
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
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Sakura</h1>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center">
            <ProfileImage
              src={user?.picture}
              alt={user?.displayName || 'Profile'}
              fallbackText={user?.displayName || 'User'}
              size="md"
              className="mr-2 sm:mr-3"
            />
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-gray-900">
                {user?.displayName || 'User'}
              </div>
              <div className="text-xs text-gray-500">
                {user?.pubkey ? shortenPubkey(user.pubkey) : ''}
              </div>
            </div>
            <div className="sm:hidden">
              <div className="text-sm font-medium text-gray-900">
                {user?.displayName || 'User'}
              </div>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Logout"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
