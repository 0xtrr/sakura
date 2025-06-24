import { memo, useEffect, useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ProfileImage } from './ProfileImage';
import { LoadingSpinnerCenter } from './LoadingSpinner';
import { shortenPubkey } from '../utils/nostr';
import { copyToClipboard } from '../utils/clipboard';
import { useUserProfile, type UserProfile } from '../hooks/useUserProfile';
import { ProfileEditForm } from './ProfileEditForm';
import { useAuth } from '../hooks/useAuth';
import type { UserServerList } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  pubkey: string;
  isOwnProfile?: boolean;
  userServerList?: UserServerList | null;
}

const ProfileField = memo(function ProfileField({ 
  label, 
  value, 
  copyable = false 
}: { 
  label: string; 
  value: string | undefined; 
  copyable?: boolean; 
}) {
  if (!value) return null;

  const handleCopy = async () => {
    if (copyable && value) {
      const success = await copyToClipboard(value);
      if (success) {
        // You could add a toast notification here
        console.log(`Copied ${label}: ${value}`);
      }
    }
  };

  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-gray-600">{label}</dt>
      <dd className="text-sm text-gray-900">
        {copyable ? (
          <button
            onClick={handleCopy}
            className="font-mono hover:bg-gray-100 px-2 py-1 rounded text-left w-full transition-colors"
            title={`Click to copy ${label}`}
          >
            {value}
          </button>
        ) : (
          <span>{value}</span>
        )}
      </dd>
    </div>
  );
});

const BirthdayField = memo(function BirthdayField({ 
  birthday 
}: { 
  birthday: UserProfile['birthday'] 
}) {
  if (!birthday) return null;

  const formatBirthday = () => {
    const parts = [];
    if (birthday.month && birthday.day) {
      const date = new Date();
      date.setMonth(birthday.month - 1, birthday.day);
      parts.push(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));
    }
    if (birthday.year) {
      parts.push(birthday.year.toString());
    }
    return parts.join(', ') || 'Set';
  };

  return (
    <ProfileField 
      label="Birthday" 
      value={formatBirthday()} 
    />
  );
});

export const ProfileModal = memo(function ProfileModal({
  isOpen,
  onClose,
  pubkey,
  isOwnProfile = false,
  userServerList
}: ProfileModalProps) {
  const { profile, loading, error, saving, fetchUserProfile, saveUserProfile } = useUserProfile();
  const { getSigningMethod, refreshUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen && pubkey) {
      fetchUserProfile(pubkey);
      setIsEditing(false); // Reset editing state when modal opens
    }
  }, [isOpen, pubkey, fetchUserProfile]);

  const handleSaveProfile = useCallback(async (profileData: Omit<UserProfile, 'pubkey' | 'created_at' | 'event'>) => {
    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      console.error('No signing method available');
      return;
    }

    const savedProfile = await saveUserProfile(profileData, pubkey, signingMethod);
    if (savedProfile) {
      setIsEditing(false);
      // Refresh the user profile in the header if this is the user's own profile
      if (isOwnProfile) {
        await refreshUserProfile();
      }
    }
  }, [saveUserProfile, pubkey, getSigningMethod, isOwnProfile, refreshUserProfile]);

  const handleEditProfile = useCallback(() => {
    setIsEditing(true);
  }, []);

  const displayName = profile?.display_name || profile?.name || 'Anonymous';

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-xl font-semibold text-gray-900">
                Profile
              </Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="py-8">
                <LoadingSpinnerCenter text="Loading profile..." />
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="py-8 text-center">
                <div className="text-red-600 mb-2">Failed to load profile</div>
                <div className="text-sm text-gray-500">{error}</div>
                <button
                  onClick={() => fetchUserProfile(pubkey)}
                  className="mt-3 text-sm text-pink-600 hover:text-pink-700"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Profile Content */}
            {profile && !loading && !isEditing && (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="text-center">
                  {/* Banner */}
                  {profile.banner && (
                    <div className="mb-4 -mx-6 -mt-6">
                      <img
                        src={profile.banner}
                        alt="Profile banner"
                        className="w-full h-32 object-cover rounded-t-lg"
                      />
                    </div>
                  )}

                  {/* Avatar */}
                  <div className="mb-4">
                    <ProfileImage
                      src={profile.picture}
                      alt={displayName}
                      fallbackText={displayName}
                      size="lg"
                      className="mx-auto border-4 border-white shadow-lg"
                    />
                  </div>

                  {/* Name and Bot Badge */}
                  <div className="mb-2">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center justify-center gap-2">
                      {displayName}
                      {profile.bot && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          🤖 Bot
                        </span>
                      )}
                    </h2>
                    {profile.name && profile.display_name && profile.name !== profile.display_name && (
                      <p className="text-sm text-gray-600">@{profile.name}</p>
                    )}
                  </div>
                </div>

                {/* About */}
                {profile.about && (
                  <div className="text-center">
                    <p className="text-gray-700 whitespace-pre-wrap">{profile.about}</p>
                  </div>
                )}

                {/* Profile Details */}
                <dl className="space-y-4">
                  {/* Website */}
                  {profile.website && (
                    <div className="space-y-1">
                      <dt className="text-sm font-medium text-gray-600">Website</dt>
                      <dd className="text-sm">
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-600 hover:text-pink-700 break-all"
                        >
                          {profile.website}
                        </a>
                      </dd>
                    </div>
                  )}

                  {/* Birthday */}
                  <BirthdayField birthday={profile.birthday} />

                  {/* Public Key */}
                  <ProfileField 
                    label="Public Key" 
                    value={shortenPubkey(profile.pubkey)} 
                    copyable 
                  />

                  {/* Full Public Key (Collapsible) */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 select-none">
                      Full Public Key
                      <span className="ml-1 group-open:rotate-90 transition-transform inline-block">▶</span>
                    </summary>
                    <div className="mt-2">
                      <button
                        onClick={() => copyToClipboard(profile.pubkey)}
                        className="font-mono text-xs text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded w-full text-left break-all transition-colors"
                        title="Click to copy full public key"
                      >
                        {profile.pubkey}
                      </button>
                    </div>
                  </details>

                  {/* Profile Created */}
                  <ProfileField 
                    label="Profile Updated" 
                    value={new Date(profile.created_at * 1000).toLocaleString()} 
                  />
                </dl>

                {/* Edit Profile Button (Only for own profile) */}
                {isOwnProfile && (
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={handleEditProfile}
                      className="w-full px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
                    >
                      Edit Profile
                    </button>
                  </div>
                )}

                {/* Debug Info (Development Only) */}
                {import.meta.env.DEV && profile.event && (
                  <details className="mt-6 text-xs text-gray-500">
                    <summary className="cursor-pointer font-medium">Debug Info</summary>
                    <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(profile.event, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* No Profile Found */}
            {!profile && !loading && !error && !isEditing && (
              <div className="py-8 text-center">
                <div className="text-gray-600 mb-4">No profile found</div>
                {isOwnProfile ? (
                  <div>
                    <div className="text-sm text-gray-500 mb-4">
                      Create your profile to let others know about you.
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors"
                    >
                      Create Profile
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    This user hasn't set up their profile yet.
                  </div>
                )}
              </div>
            )}

            {/* Create Profile Form for New Users */}
            {!profile && !loading && !error && isEditing && (
              <div>
                <div className="text-center mb-6">
                  <div className="text-gray-600 mb-2">Create Your Profile</div>
                  <div className="text-sm text-gray-500">
                    Set up your Nostr profile to personalize your experience.
                  </div>
                </div>
                <ProfileEditForm
                  initialProfile={null}
                  onSave={handleSaveProfile}
                  onCancel={() => setIsEditing(false)}
                  saving={saving}
                  error={error}
                  userServerList={userServerList}
                />
              </div>
            )}

            {/* Edit Existing Profile Form */}
            {profile && !loading && isEditing && (
              <div>
                <div className="text-center mb-6">
                  <div className="text-gray-600 mb-2">Edit Your Profile</div>
                  <div className="text-sm text-gray-500">
                    Update your Nostr profile information.
                  </div>
                </div>
                <ProfileEditForm
                  initialProfile={profile}
                  onSave={handleSaveProfile}
                  onCancel={() => setIsEditing(false)}
                  saving={saving}
                  error={error}
                  userServerList={userServerList}
                />
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});