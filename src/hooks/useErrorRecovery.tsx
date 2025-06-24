import { useState, useCallback, useRef } from 'react';
import type { EnhancedError } from '../utils/errorHandling';
import { enhanceError, logError } from '../utils/errorHandling';

interface ErrorRecoveryState {
  errors: EnhancedError[];
  recoveryAttempts: Map<string, number>;
  isRecovering: boolean;
}

interface RecoveryStrategy {
  maxAttempts: number;
  strategy: 'retry' | 'fallback' | 'degrade';
  fallbackAction?: () => Promise<void>;
  degradeAction?: () => Promise<void>;
}

export function useErrorRecovery() {
  const [state, setState] = useState<ErrorRecoveryState>({
    errors: [],
    recoveryAttempts: new Map(),
    isRecovering: false
  });
  
  const strategiesRef = useRef<Map<string, RecoveryStrategy>>(new Map());

  const registerRecoveryStrategy = useCallback((
    errorType: string,
    strategy: RecoveryStrategy
  ) => {
    strategiesRef.current.set(errorType, strategy);
  }, []);

  const handleError = useCallback(async (
    error: Error,
    context?: Record<string, unknown>,
    operationType?: 'server' | 'network' | 'relay'
  ): Promise<boolean> => {
    const enhancedErr = enhanceError(error, context);
    logError(enhancedErr);
    
    // Add to error list
    setState(prev => ({
      ...prev,
      errors: [...prev.errors.slice(-4), enhancedErr] // Keep last 5 errors
    }));
    
    // Check if we should attempt recovery
    const errorKey = `${enhancedErr.category}-${operationType || 'general'}`;
    const strategy = strategiesRef.current.get(errorKey);
    
    if (!strategy || !enhancedErr.retryable) {
      return false; // No recovery possible
    }
    
    const currentAttempts = state.recoveryAttempts.get(errorKey) || 0;
    
    if (currentAttempts >= strategy.maxAttempts) {
      // Max attempts reached, try fallback or degradation
      if (strategy.strategy === 'fallback' && strategy.fallbackAction) {
        try {
          await strategy.fallbackAction();
          return true;
        } catch {
          return false;
        }
      } else if (strategy.strategy === 'degrade' && strategy.degradeAction) {
        try {
          await strategy.degradeAction();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
    
    // Attempt recovery based on operation type
    setState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: new Map(prev.recoveryAttempts).set(errorKey, currentAttempts + 1)
    }));
    
    try {
      // The actual retry logic should be handled by the calling code
      // This hook just manages the recovery state and strategies
      return true;
    } finally {
      setState(prev => ({
        ...prev,
        isRecovering: false
      }));
    }
  }, [state.recoveryAttempts]);

  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: [],
      recoveryAttempts: new Map()
    }));
  }, []);

  const clearError = useCallback((timestamp: number) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(err => err.timestamp !== timestamp)
    }));
  }, []);

  return {
    errors: state.errors,
    isRecovering: state.isRecovering,
    handleError,
    registerRecoveryStrategy,
    clearErrors,
    clearError
  };
}

/**
 * Hook for graceful degradation when servers are unavailable
 */
export function useGracefulDegradation() {
  const [degradationLevel, setDegradationLevel] = useState<'none' | 'partial' | 'minimal'>('none');
  const [unavailableServices, setUnavailableServices] = useState<Set<string>>(new Set());

  const markServiceUnavailable = useCallback((serviceName: string) => {
    setUnavailableServices(prev => new Set(prev).add(serviceName));
    
    // Determine degradation level based on unavailable services
    const newUnavailable = new Set(unavailableServices).add(serviceName);
    
    if (newUnavailable.has('primary-server') && newUnavailable.has('backup-server')) {
      setDegradationLevel('minimal');
    } else if (newUnavailable.size > 0) {
      setDegradationLevel('partial');
    }
  }, [unavailableServices]);

  const markServiceAvailable = useCallback((serviceName: string) => {
    setUnavailableServices(prev => {
      const newSet = new Set(prev);
      newSet.delete(serviceName);
      
      // Update degradation level
      if (newSet.size === 0) {
        setDegradationLevel('none');
      } else if (newSet.has('primary-server') && newSet.has('backup-server')) {
        setDegradationLevel('minimal');
      } else {
        setDegradationLevel('partial');
      }
      
      return newSet;
    });
  }, []);

  const getAvailableFeatures = useCallback(() => {
    switch (degradationLevel) {
      case 'none':
        return ['upload', 'download', 'delete', 'list', 'profile-edit'];
      case 'partial':
        return ['download', 'list', 'profile-view'];
      case 'minimal':
        return ['profile-view'];
      default:
        return [];
    }
  }, [degradationLevel]);

  return {
    degradationLevel,
    unavailableServices: Array.from(unavailableServices),
    markServiceUnavailable,
    markServiceAvailable,
    getAvailableFeatures
  };
}