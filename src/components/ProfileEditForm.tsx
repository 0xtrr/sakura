import { memo, useState, useCallback } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import type { UserProfile } from '../hooks/useUserProfile';
import { isImage, validateFile, removeExifData, ExifRemovalError } from '../utils/fileUtils';
import { createBlossomAPI } from '../services/blossom';
import { useAuth } from '../hooks/useAuth';
import { retryServerOperation } from '../utils/retry';
import { enhanceError, logError } from '../utils/errorHandling';
import { useErrorToast } from '../components/ErrorToast';
import type { UserServerList } from '../types';

interface ProfileEditFormProps {
  initialProfile?: UserProfile | null;
  onSave: (profileData: Omit<UserProfile, 'pubkey' | 'created_at' | 'event'>) => Promise<void>;
  onCancel?: () => void;
  saving: boolean;
  error: string | null;
  userServerList?: UserServerList | null; // Optional, will use defaults if not provided
}

export const ProfileEditForm = memo(function ProfileEditForm({
  initialProfile,
  onSave,
  onCancel,
  saving,
  error,
  userServerList = null
}: ProfileEditFormProps) {
  const { getSigningMethod } = useAuth();
  const { showError } = useErrorToast();

  // Form state
  const [formData, setFormData] = useState({
    name: initialProfile?.name || '',
    display_name: initialProfile?.display_name || '',
    about: initialProfile?.about || '',
    picture: initialProfile?.picture || '',
    website: initialProfile?.website || '',
    banner: initialProfile?.banner || '',
    bot: initialProfile?.bot || false,
    birthday: {
      year: initialProfile?.birthday?.year?.toString() || '',
      month: initialProfile?.birthday?.month?.toString() || '',
      day: initialProfile?.birthday?.day?.toString() || ''
    }
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    // Validate URLs
    if (formData.picture && formData.picture.trim()) {
      try {
        new URL(formData.picture);
      } catch {
        errors.picture = 'Please enter a valid URL for profile picture';
      }
    }
    
    if (formData.website && formData.website.trim()) {
      try {
        new URL(formData.website);
      } catch {
        errors.website = 'Please enter a valid URL for website';
      }
    }
    
    if (formData.banner && formData.banner.trim()) {
      try {
        new URL(formData.banner);
      } catch {
        errors.banner = 'Please enter a valid URL for banner image';
      }
    }

    // Validate birthday
    const { year, month, day } = formData.birthday;
    if (year || month || day) {
      if (year && (parseInt(year, 10) < 1900 || parseInt(year, 10) > new Date().getFullYear())) {
        errors.birthday = 'Please enter a valid year (1900-current)';
      }
      if (month && (parseInt(month, 10) < 1 || parseInt(month, 10) > 12)) {
        errors.birthday = 'Please enter a valid month (1-12)';
      }
      if (day && (parseInt(day, 10) < 1 || parseInt(day, 10) > 31)) {
        errors.birthday = 'Please enter a valid day (1-31)';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Prepare profile data
    const profileData: Omit<UserProfile, 'pubkey' | 'created_at' | 'event'> = {
      // Only include non-empty values
      ...(formData.name.trim() && { name: formData.name.trim() }),
      ...(formData.display_name.trim() && { display_name: formData.display_name.trim() }),
      ...(formData.about.trim() && { about: formData.about.trim() }),
      ...(formData.picture.trim() && { picture: formData.picture.trim() }),
      ...(formData.website.trim() && { website: formData.website.trim() }),
      ...(formData.banner.trim() && { banner: formData.banner.trim() }),
      bot: formData.bot,
    };

    // Add birthday if any field is filled
    const { year, month, day } = formData.birthday;
    if (year || month || day) {
      profileData.birthday = {
        ...(year && { year: parseInt(year, 10) }),
        ...(month && { month: parseInt(month, 10) }),
        ...(day && { day: parseInt(day, 10) }),
      };
    }

    await onSave(profileData);
  }, [formData, validateForm, onSave]);

  const updateField = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [validationErrors]);

  const updateBirthdayField = useCallback((field: 'year' | 'month' | 'day', value: string) => {
    setFormData(prev => ({
      ...prev,
      birthday: {
        ...prev.birthday,
        [field]: value
      }
    }));
    
    // Clear birthday validation error
    if (validationErrors.birthday) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.birthday;
        return newErrors;
      });
    }
  }, [validationErrors]);

  const uploadToPrimaryServer = useCallback(async (file: File): Promise<string> => {
    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      throw new Error('No signing method available. Please login again.');
    }

    // Validate file first
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    // Remove EXIF data if file is an image
    let processedFile = file;
    if (file.type.startsWith('image/')) {
      try {
        processedFile = await removeExifData(file);
      } catch (error) {
        if (error instanceof ExifRemovalError) {
          // Show user confirmation dialog for profile image privacy
          const proceed = window.confirm(
            `⚠️ Privacy Warning: Failed to remove metadata from your profile image.\n\n` +
            `Your image may contain sensitive information like:\n` +
            `• GPS location where the photo was taken\n` +
            `• Camera/device information\n` +
            `• Date and time details\n\n` +
            `Do you want to continue uploading this image as your profile picture?\n\n` +
            `Click "Cancel" to choose a different image, or "OK" to proceed with this image.`
          );
          
          if (!proceed) {
            throw new Error('Upload cancelled due to privacy concerns. Please choose a different image.');
          }
          
          console.warn('User chose to proceed with profile image despite EXIF removal failure:', error.message);
          processedFile = file;
        } else {
          throw new Error('Failed to process image');
        }
      }
    }

    // Ensure user has configured servers
    if (!userServerList || userServerList.servers.length === 0) {
      throw new Error('No Blossom servers configured. Please configure your servers in Settings first.');
    }

    // Use the first (primary) server from user's configured list
    const serverUrl = userServerList.servers[0];
    console.log(`Uploading profile image to user's primary server: ${serverUrl}`);

    // Create API instance for the primary server
    const blossomAPI = createBlossomAPI({
      url: serverUrl,
      name: new URL(serverUrl).hostname,
      description: 'Primary server'
    });

    // Upload to the primary server only with retry logic
    const result = await retryServerOperation(
      () => blossomAPI.uploadFile(processedFile, signingMethod),
      `profile image upload to ${serverUrl}`
    );
    return result.url;
  }, [getSigningMethod, userServerList]);

  const handleImageUpload = useCallback(async (file: File, field: 'picture' | 'banner') => {
    if (!isImage(file.type)) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: 'Please select an image file'
      }));
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadToPrimaryServer(file);
      setFormData(prev => ({
        ...prev,
        [field]: url
      }));
      
      // Clear any validation errors for this field
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    } catch (error) {
      const enhancedErr = enhanceError(error as Error, {
        operation: 'profile_image_upload',
        field,
        serverList: userServerList?.servers
      });
      
      logError(enhancedErr);
      showError(enhancedErr);
      
      setValidationErrors(prev => ({
        ...prev,
        [field]: enhancedErr.userMessage
      }));
    } finally {
      setIsUploading(false);
    }
  }, [uploadToPrimaryServer, showError, userServerList?.servers, validationErrors]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, field: 'picture' | 'banner') => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file, field);
    }
  }, [handleImageUpload]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
        
        {/* Display Name */}
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
            Display Name
          </label>
          <input
            type="text"
            id="display_name"
            value={formData.display_name}
            onChange={(e) => updateField('display_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
            placeholder="Your display name"
            maxLength={50}
          />
          <p className="text-xs text-gray-500 mt-1">Your public display name (can include emojis, spaces)</p>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
            placeholder="username"
            maxLength={30}
          />
          <p className="text-xs text-gray-500 mt-1">Short username (letters, numbers, underscore)</p>
        </div>

        {/* About */}
        <div>
          <label htmlFor="about" className="block text-sm font-medium text-gray-700 mb-1">
            About
          </label>
          <textarea
            id="about"
            value={formData.about}
            onChange={(e) => updateField('about', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
            placeholder="Tell others about yourself..."
            maxLength={300}
          />
          <p className="text-xs text-gray-500 mt-1">{formData.about.length}/300 characters</p>
        </div>
      </div>

      {/* Images */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Images</h3>
        
        {/* Profile Picture */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Profile Picture
          </label>
          
          {/* Current picture preview */}
          {formData.picture && (
            <div className="mb-3">
              <img
                src={formData.picture}
                alt="Profile preview"
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
              />
            </div>
          )}
          
          {/* Upload option */}
          <div className="mb-3">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileInputChange(e, 'picture')}
                disabled={isUploading}
                className="hidden"
              />
              <span className={`inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                {isUploading ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Image
                  </>
                )}
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Or upload an image file (JPG, PNG, GIF)</p>
          </div>
          
          {/* URL input as alternative */}
          <div>
            <label htmlFor="picture-url" className="block text-xs font-medium text-gray-600 mb-1">
              Or enter image URL
            </label>
            <input
              type="url"
              id="picture-url"
              value={formData.picture}
              onChange={(e) => updateField('picture', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 text-sm ${
                validationErrors.picture ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
          
          {validationErrors.picture && (
            <p className="text-xs text-red-600 mt-1">{validationErrors.picture}</p>
          )}
        </div>

        {/* Banner */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Banner Image
          </label>
          
          {/* Current banner preview */}
          {formData.banner && (
            <div className="mb-3">
              <img
                src={formData.banner}
                alt="Banner preview"
                className="w-full h-24 rounded-lg object-cover border-2 border-gray-200"
              />
            </div>
          )}
          
          {/* Upload option */}
          <div className="mb-3">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileInputChange(e, 'banner')}
                disabled={isUploading}
                className="hidden"
              />
              <span className={`inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}>
                {isUploading ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Banner
                  </>
                )}
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Upload a wide banner image (recommended: ~1024x768)</p>
          </div>
          
          {/* URL input as alternative */}
          <div>
            <label htmlFor="banner-url" className="block text-xs font-medium text-gray-600 mb-1">
              Or enter banner URL
            </label>
            <input
              type="url"
              id="banner-url"
              value={formData.banner}
              onChange={(e) => updateField('banner', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 text-sm ${
                validationErrors.banner ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://example.com/banner.jpg"
            />
          </div>
          
          {validationErrors.banner && (
            <p className="text-xs text-red-600 mt-1">{validationErrors.banner}</p>
          )}
        </div>
      </div>

      {/* Additional Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Additional Information</h3>
        
        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            type="url"
            id="website"
            value={formData.website}
            onChange={(e) => updateField('website', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 ${
              validationErrors.website ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="https://yourwebsite.com"
          />
          {validationErrors.website && (
            <p className="text-xs text-red-600 mt-1">{validationErrors.website}</p>
          )}
        </div>

        {/* Birthday */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Birthday (Optional)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={formData.birthday.year}
              onChange={(e) => updateBirthdayField('year', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              placeholder="Year"
              min="1900"
              max={new Date().getFullYear()}
            />
            <input
              type="number"
              value={formData.birthday.month}
              onChange={(e) => updateBirthdayField('month', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              placeholder="Month"
              min="1"
              max="12"
            />
            <input
              type="number"
              value={formData.birthday.day}
              onChange={(e) => updateBirthdayField('day', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              placeholder="Day"
              min="1"
              max="31"
            />
          </div>
          {validationErrors.birthday && (
            <p className="text-xs text-red-600 mt-1">{validationErrors.birthday}</p>
          )}
        </div>

        {/* Bot checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="bot"
            checked={formData.bot}
            onChange={(e) => updateField('bot', e.target.checked)}
            className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
          />
          <label htmlFor="bot" className="ml-2 block text-sm text-gray-700">
            This is a bot account
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-md transition-colors disabled:opacity-50"
        >
          {saving && <LoadingSpinner size="xs" color="white" className="mr-2" />}
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
});