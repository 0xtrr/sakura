/**
 * Enhanced error handling system with user-friendly messages and recovery suggestions
 */

export type ErrorCategory = 
  | 'network'
  | 'authentication' 
  | 'server'
  | 'validation'
  | 'configuration'
  | 'permission'
  | 'unknown';

export interface EnhancedError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  suggestions: string[];
  retryable: boolean;
  originalError: Error;
  timestamp: number;
  context?: Record<string, unknown>;
}

/**
 * Classify errors into categories for better handling
 */
export function classifyError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  
  if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
    return 'network';
  }
  
  if (message.includes('unauthorized') || message.includes('authentication') || message.includes('signing')) {
    return 'authentication';
  }
  
  if (message.includes('server') || message.includes('500') || message.includes('503')) {
    return 'server';
  }
  
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return 'validation';
  }
  
  if (message.includes('config') || message.includes('relay') || message.includes('blossom')) {
    return 'configuration';
  }
  
  if (message.includes('permission') || message.includes('forbidden') || message.includes('401')) {
    return 'permission';
  }
  
  return 'unknown';
}

/**
 * Create enhanced error with user-friendly messaging
 */
export function enhanceError(error: Error, context?: Record<string, unknown>): EnhancedError {
  const category = classifyError(error);
  
  const enhanced: EnhancedError = {
    category,
    message: error.message,
    userMessage: getUserMessage(category, error),
    suggestions: getSuggestions(category, error),
    retryable: isRetryable(category, error),
    originalError: error,
    timestamp: Date.now(),
    context
  };
  
  return enhanced;
}

/**
 * Get user-friendly error messages
 */
function getUserMessage(category: ErrorCategory, error: Error): string {
  switch (category) {
    case 'network':
      return 'Connection issue detected. Please check your internet connection.';
    
    case 'authentication':
      return 'Authentication failed. Please check your Nostr extension or private key.';
    
    case 'server':
      if (error.message.includes('Blossom')) {
        return 'Your media server is temporarily unavailable.';
      }
      return 'Server is experiencing issues. This is usually temporary.';
    
    case 'validation':
      return 'The information provided is invalid. Please check your input.';
    
    case 'configuration':
      if (error.message.includes('relay')) {
        return 'Your relay configuration needs attention.';
      }
      if (error.message.includes('server')) {
        return 'Your server configuration needs to be set up.';
      }
      return 'Your configuration needs attention.';
    
    case 'permission':
      return 'Permission denied. Please check your access rights.';
    
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Get recovery suggestions based on error type
 */
function getSuggestions(category: ErrorCategory, error: Error): string[] {
  switch (category) {
    case 'network':
      return [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again',
        'Check if the service is working from another device'
      ];
    
    case 'authentication':
      return [
        'Make sure your Nostr extension is unlocked',
        'Check if your private key is correct',
        'Try logging out and logging back in',
        'Restart your browser if using an extension'
      ];
    
    case 'server':
      if (error.message.includes('Blossom')) {
        return [
          'Try using a different server from your list',
          'Check if your server is online',
          'Wait a few minutes and try again',
          'Contact your server administrator'
        ];
      }
      return [
        'Wait a few minutes and try again',
        'Check service status',
        'Try refreshing the page'
      ];
    
    case 'validation':
      return [
        'Check that all required fields are filled',
        'Verify the format of URLs and inputs',
        'Make sure file types are supported',
        'Check file size limits'
      ];
    
    case 'configuration':
      if (error.message.includes('relay')) {
        return [
          'Go to Settings to configure your relays',
          'Try adding different relays',
          'Check if your relays are online',
          'Import a relay list from another Nostr client'
        ];
      }
      if (error.message.includes('server')) {
        return [
          'Go to Settings to configure your Blossom servers',
          'Add at least one working server',
          'Test server connectivity',
          'Check server documentation'
        ];
      }
      return [
        'Review your settings configuration',
        'Reset to default settings if needed',
        'Check the help documentation'
      ];
    
    case 'permission':
      return [
        'Check if you have the necessary permissions',
        'Try logging out and back in',
        'Contact the administrator if needed'
      ];
    
    default:
      return [
        'Try refreshing the page',
        'Clear your browser cache',
        'Try again in a few minutes',
        'Contact support if the issue persists'
      ];
  }
}

/**
 * Determine if an error is retryable
 */
function isRetryable(category: ErrorCategory, error: Error): boolean {
  switch (category) {
    case 'network':
    case 'server':
      return true;
    
    case 'authentication':
      // Some auth errors are retryable (temporary extension issues)
      return error.message.includes('extension') || error.message.includes('timeout');
    
    case 'validation':
    case 'configuration':
    case 'permission':
      return false;
    
    default:
      return true;
  }
}

/**
 * Log error for monitoring (could be sent to external service)
 */
export function logError(enhancedError: EnhancedError): void {
  console.error('Enhanced Error:', {
    category: enhancedError.category,
    userMessage: enhancedError.userMessage,
    originalError: enhancedError.originalError,
    context: enhancedError.context,
    timestamp: new Date(enhancedError.timestamp).toISOString()
  });
  
  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or a custom endpoint
}

/**
 * Create error with specific context
 */
export function createContextualError(
  message: string, 
  _category: ErrorCategory, 
  context?: Record<string, unknown>
): EnhancedError {
  const error = new Error(message);
  return enhanceError(error, context);
}