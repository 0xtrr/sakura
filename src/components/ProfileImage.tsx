import { useState, memo } from 'react';

interface ProfileImageProps {
  src?: string;
  alt: string;
  fallbackText: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const ProfileImage = memo(function ProfileImage({ 
  src, 
  alt, 
  fallbackText, 
  size = 'md', 
  className = '' 
}: ProfileImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!src);

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-20 h-20 text-lg',
    '2xl': 'w-32 h-32 text-2xl',
  };

  const sizeClass = sizeClasses[size];

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  // Show fallback if no src, image failed, or still loading
  const showFallback = !src || imageError || imageLoading;

  return (
    <div className={`relative ${sizeClass} ${className} rounded-full`}>
      {src && !imageError && (
        <img
          src={src}
          alt={alt}
          className={`${sizeClass} rounded-full object-cover ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          } transition-opacity duration-200`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
      
      {showFallback && (
        <div 
          className={`${sizeClass} bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center ${
            imageLoading ? 'opacity-100' : 'opacity-100'
          } transition-opacity duration-200`}
        >
          {imageLoading ? (
            <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
          ) : (
            <span className="text-white font-medium">
              {fallbackText.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
