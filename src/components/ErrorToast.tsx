import { useState, useEffect } from 'react';
import type { EnhancedError } from '../utils/errorHandling';
import { EnhancedErrorDisplay } from './EnhancedErrorDisplay';

interface ToastError extends EnhancedError {
  id: string;
  autoHide: boolean;
  duration: number;
}

interface ErrorToastManagerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxToasts?: number;
}

// Global toast state
let toastId = 0;
const toastSubscribers = new Set<(toasts: ToastError[]) => void>();
let currentToasts: ToastError[] = [];

// Global toast management functions
export const addErrorToast = (error: EnhancedError, options?: {
  autoHide?: boolean;
  duration?: number;
}) => {
  const toast: ToastError = {
    ...error,
    id: `toast-${++toastId}`,
    autoHide: options?.autoHide ?? true,
    duration: options?.duration ?? getDefaultDuration(error.category)
  };
  
  currentToasts = [...currentToasts, toast];
  toastSubscribers.forEach(fn => fn(currentToasts));
  
  return toast.id;
};

export const removeErrorToast = (id: string) => {
  currentToasts = currentToasts.filter(toast => toast.id !== id);
  toastSubscribers.forEach(fn => fn(currentToasts));
};

export const clearAllErrorToasts = () => {
  currentToasts = [];
  toastSubscribers.forEach(fn => fn(currentToasts));
};

function getDefaultDuration(category: string): number {
  switch (category) {
    case 'network':
    case 'server':
      return 8000; // Longer for retryable errors
    case 'validation':
      return 6000; // Medium for user input errors
    case 'authentication':
    case 'configuration':
      return 0; // Don't auto-hide important setup errors
    default:
      return 5000;
  }
}

export function ErrorToastManager({ 
  position = 'top-right',
  maxToasts = 5 
}: ErrorToastManagerProps) {
  const [toasts, setToasts] = useState<ToastError[]>([]);

  useEffect(() => {
    const updateToasts = (newToasts: ToastError[]) => {
      // Limit the number of toasts
      setToasts(newToasts.slice(-maxToasts));
    };
    
    toastSubscribers.add(updateToasts);
    
    return () => {
      toastSubscribers.delete(updateToasts);
    };
  }, [maxToasts]);

  useEffect(() => {
    // Auto-hide toasts with timeouts
    const timeouts = toasts
      .filter(toast => toast.autoHide && toast.duration > 0)
      .map(toast => {
        return setTimeout(() => {
          removeErrorToast(toast.id);
        }, toast.duration);
      });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [toasts]);

  const getPositionClasses = () => {
    const base = 'fixed z-50 flex flex-col gap-2 p-4 pointer-events-none';
    
    switch (position) {
      case 'top-right':
        return `${base} top-0 right-0`;
      case 'top-left':
        return `${base} top-0 left-0`;
      case 'bottom-right':
        return `${base} bottom-0 right-0`;
      case 'bottom-left':
        return `${base} bottom-0 left-0`;
      default:
        return `${base} top-0 right-0`;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className={getPositionClasses()}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto transform transition-all duration-300 ease-in-out"
        >
          <EnhancedErrorDisplay
            error={toast}
            onDismiss={() => removeErrorToast(toast.id)}
            showDetails={false}
            className="max-w-sm shadow-lg"
          />
        </div>
      ))}
    </div>
  );
}

// Convenience hook for using error toasts
export function useErrorToast() {
  const showError = async (error: Error | EnhancedError, context?: Record<string, unknown>) => {
    let enhancedError: EnhancedError;
    
    if ('category' in error) {
      enhancedError = error as EnhancedError;
    } else {
      const { enhanceError } = await import('../utils/errorHandling');
      enhancedError = enhanceError(error as Error, context);
    }
    
    return addErrorToast(enhancedError);
  };

  const showRetryableError = async (
    error: Error | EnhancedError, 
    _onRetry: () => Promise<void>,
    context?: Record<string, unknown>
  ) => {
    let enhancedError: EnhancedError;
    
    if ('category' in error) {
      enhancedError = error as EnhancedError;
    } else {
      const { enhanceError } = await import('../utils/errorHandling');
      enhancedError = enhanceError(error as Error, context);
    }
    
    // For retryable errors, don't auto-hide
    return addErrorToast(enhancedError, { autoHide: false });
  };

  return {
    showError,
    showRetryableError,
    clearAll: clearAllErrorToasts,
    remove: removeErrorToast
  };
}