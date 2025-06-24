import { useState } from 'react';
import type { EnhancedError } from '../utils/errorHandling';
import { LoadingSpinner } from './LoadingSpinner';

interface EnhancedErrorDisplayProps {
  error: EnhancedError;
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function EnhancedErrorDisplay({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className = ''
}: EnhancedErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const getIcon = () => {
    switch (error.category) {
      case 'network':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        );
      case 'server':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        );
      case 'authentication':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'configuration':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getColorClasses = () => {
    switch (error.category) {
      case 'network':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'server':
        return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'authentication':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'configuration':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'validation':
        return 'bg-red-100 text-red-600 border-red-200';
      default:
        return 'bg-red-100 text-red-600 border-red-200';
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${getColorClasses()} ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {error.category.charAt(0).toUpperCase() + error.category.slice(1)} Error
            </h3>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-current opacity-60 hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <p className="mt-1 text-sm opacity-90">
            {error.userMessage}
          </p>
          
          {error.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium opacity-90 mb-2">Try these solutions:</p>
              <ul className="text-sm opacity-80 space-y-1">
                {error.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="mt-4 flex items-center space-x-3">
            {error.retryable && onRetry && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center px-3 py-1.5 border border-current rounded-md text-xs font-medium hover:bg-current hover:bg-opacity-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRetrying ? (
                  <>
                    <LoadingSpinner size="xs" className="mr-1.5" />
                    Retrying...
                  </>
                ) : (
                  'Try Again'
                )}
              </button>
            )}
            
            {showDetails && (
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs opacity-70 hover:opacity-100 transition-opacity"
              >
                {showTechnicalDetails ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
          
          {showTechnicalDetails && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              <div className="text-xs opacity-70 space-y-1">
                <div><strong>Time:</strong> {new Date(error.timestamp).toLocaleString()}</div>
                <div><strong>Original Error:</strong> {error.message}</div>
                {error.context && (
                  <div>
                    <strong>Context:</strong>
                    <pre className="mt-1 text-xs bg-current bg-opacity-10 p-2 rounded overflow-auto">
                      {JSON.stringify(error.context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}