import { memo } from 'react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}

export const LoadingSpinner = memo(function LoadingSpinner({ 
  size = 'md', 
  color = 'primary',
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4', 
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const colorClasses = {
    primary: 'border-pink-600',
    white: 'border-white',
    gray: 'border-gray-500'
  };

  return (
    <div 
      className={`animate-spin rounded-full border-b-2 ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
});

interface LoadingSpinnerCenterProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  text?: string;
  className?: string;
}

export const LoadingSpinnerCenter = memo(function LoadingSpinnerCenter({
  size = 'lg',
  color = 'primary', 
  text = 'Loading...',
  className = ''
}: LoadingSpinnerCenterProps) {
  return (
    <div className={`text-center ${className}`}>
      <LoadingSpinner size={size} color={color} className="mx-auto mb-4" />
      {text && <p className="text-gray-600">{text}</p>}
    </div>
  );
});

// SVG-based spinner for more complex animations
interface LoadingSpinnerSVGProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinnerSVG = memo(function LoadingSpinnerSVG({
  size = 'md',
  className = ''
}: LoadingSpinnerSVGProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8'
  };

  return (
    <svg 
      className={`animate-spin ${sizeClasses[size]} ${className}`} 
      fill="none" 
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
      <span className="sr-only">Loading...</span>
    </svg>
  );
});