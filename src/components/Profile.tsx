import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { ProfileImage } from './ProfileImage';
import { ImageUpload } from './ImageUpload';
import { LoadingSpinnerCenter } from './LoadingSpinner';
import { shortenPubkey } from '../utils/nostr';
import { copyToClipboard } from '../utils/clipboard';
import type { UserServerList } from '../types';

interface ProfileProps {
  userServerList?: UserServerList | null;
}

export function Profile({ userServerList }: ProfileProps) {
  const { user, getSigningMethod, refreshUserProfile } = useAuth();
  const { profile, loading, error, saving, fetchUserProfile, saveUserProfile } = useUserProfile();
  
  // Form state for inline editing
  const [formData, setFormData] = useState({
    name: '',
    about: '',
    picture: '',
    arbitraryFields: {} as Record<string, any>
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user?.pubkey) {
      fetchUserProfile(user.pubkey);
    }
  }, [user?.pubkey, fetchUserProfile]);

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        about: profile.about || '',
        picture: profile.picture || '',
        arbitraryFields: profile.arbitraryFields || {}
      });
    } else if (user) {
      // Initialize with user data if no profile exists
      setFormData(prev => ({
        ...prev,
        picture: user.picture || '',
        arbitraryFields: {}
      }));
    }
  }, [profile, user]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleArbitraryFieldChange = (key: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      arbitraryFields: {
        ...prev.arbitraryFields,
        [key]: value
      }
    }));
    setHasChanges(true);
  };

  const addArbitraryField = () => {
    const key = prompt('Enter field name:');
    if (key && key.trim() && !formData.arbitraryFields[key.trim()]) {
      handleArbitraryFieldChange(key.trim(), '');
    }
  };

  const removeArbitraryField = (key: string) => {
    setFormData(prev => {
      const newArbitraryFields = { ...prev.arbitraryFields };
      delete newArbitraryFields[key];
      return {
        ...prev,
        arbitraryFields: newArbitraryFields
      };
    });
    setHasChanges(true);
  };

  const handleSaveProfile = useCallback(async () => {
    if (!user?.pubkey || !hasChanges) return;

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      console.error('No signing method available');
      return;
    }

    const profileData = formData;

    const savedProfile = await saveUserProfile(profileData, user.pubkey, signingMethod);
    if (savedProfile) {
      setHasChanges(false);
      // Refresh the user profile in the auth context
      await refreshUserProfile();
    }
  }, [formData, hasChanges, saveUserProfile, user?.pubkey, getSigningMethod, refreshUserProfile]);

  const displayName = formData.arbitraryFields.display_name || formData.name || user?.displayName || 'Anonymous';

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
        <p className="text-gray-600">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Your Profile</h2>
          {hasChanges && (
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
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
              onClick={() => user.pubkey && fetchUserProfile(user.pubkey)}
              className="mt-3 text-sm text-pink-600 hover:text-pink-700"
            >
              Try again
            </button>
          </div>
        )}

        {/* Main Profile Content - Two Column Layout */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column - Profile Picture */}
            <div className="lg:col-span-2 flex flex-col items-center space-y-4">
              <div className="relative group">
                <ImageUpload
                  onImageUploaded={(url) => handleFieldChange('picture', url)}
                  userServerList={userServerList || null}
                  maxSize={5 * 1024 * 1024} // 5MB for profile pictures
                >
                  <div className="relative w-32 h-32">
                    <ProfileImage
                      src={formData.picture}
                      alt={displayName}
                      fallbackText={displayName}
                      size="2xl"
                      className="shadow-lg transition-all duration-200 group-hover:shadow-xl"
                    />
                    {/* Upload overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">
                      <div className="text-white text-center">
                        <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89L8.982 4.5A2 2 0 0110.646 3.5h2.708a2 2 0 011.664.89L15.906 6.1A2 2 0 0017.57 7H18.5a2 2 0 012 2v9a2 2 0 01-2 2H5.5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div className="text-xs font-medium">Change</div>
                      </div>
                    </div>
                  </div>
                </ImageUpload>
              </div>
              
              {/* Picture URL Input */}
              <div className="w-full max-w-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Picture URL
                </label>
                <input
                  type="url"
                  value={formData.picture}
                  onChange={(e) => handleFieldChange('picture', e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Or click the image above to upload</p>
              </div>

              {/* Public Key Display */}
              <div className="w-full max-w-sm">
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Public Key
                  </label>
                  <button
                    onClick={() => copyToClipboard(user.pubkey)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-left text-sm font-mono hover:bg-gray-100 transition-colors"
                    title="Click to copy full public key"
                  >
                    {shortenPubkey(user.pubkey)}
                  </button>
                  <p className="mt-1 text-xs text-gray-500">Click to copy full public key</p>
                </div>
              </div>
            </div>

            {/* Right Column - Editable Fields */}
            <div className="lg:col-span-3 space-y-6">
              {/* Name (NIP-01) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
                <p className="mt-1 text-xs text-gray-500">Your name as defined in NIP-01</p>
              </div>

              {/* About (NIP-01) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  About
                </label>
                <textarea
                  value={formData.about}
                  onChange={(e) => handleFieldChange('about', e.target.value)}
                  placeholder="Tell people about yourself..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                />
                <p className="mt-1 text-xs text-gray-500">A description of yourself</p>
              </div>

              {/* Additional Fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Additional Fields
                  </label>
                  <button
                    type="button"
                    onClick={addArbitraryField}
                    className="text-sm text-pink-600 hover:text-pink-700 font-medium"
                  >
                    + Add Field
                  </button>
                </div>
                
                {Object.keys(formData.arbitraryFields).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(formData.arbitraryFields).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex items-center space-x-2 mb-1">
                          <label className="block text-sm font-medium text-gray-700">{key}</label>
                          <button
                            type="button"
                            onClick={() => removeArbitraryField(key)}
                            className="text-xs text-red-600 hover:text-red-700"
                            title="Remove field"
                          >
                            ×
                          </button>
                        </div>
                        {key === 'bot' ? (
                          <div className="flex items-center space-x-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={value === true}
                                onChange={(e) => handleArbitraryFieldChange(key, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                            </label>
                            <span className="text-sm text-gray-600">
                              {value === true ? 'This is a bot account' : 'This is not a bot account'}
                            </span>
                          </div>
                        ) : key === 'about' || key.toLowerCase().includes('bio') ? (
                          <textarea
                            value={value || ''}
                            onChange={(e) => handleArbitraryFieldChange(key, e.target.value)}
                            placeholder={`Enter ${key}...`}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value || ''}
                            onChange={(e) => handleArbitraryFieldChange(key, e.target.value)}
                            placeholder={`Enter ${key}...`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No additional fields. Click "Add Field" to add profile properties like display_name, website, nip05, lud16, etc.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  All fields beyond NIP-01 (name, about, picture) including NIP-24 fields and custom properties. Empty fields will be removed when saving.
                </p>
              </div>

              {/* Profile Status */}
              {profile && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    Profile last updated: {new Date(profile.created_at * 1000).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Debug Info (Development Only) */}
              {import.meta.env.DEV && profile?.event && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer font-medium">Debug Info</summary>
                  <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(profile.event, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}