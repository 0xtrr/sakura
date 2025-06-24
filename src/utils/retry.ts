/**
 * Retry utility with exponential backoff and jitter
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // in milliseconds
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  shouldRetry: (error: Error) => {
    // Default: retry on network errors, server errors, and timeouts
    const message = error.message.toLowerCase();
    return (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
        totalTime: Date.now() - startTime
      };
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if this is the last attempt or if error is not retryable
      if (attempt === opts.maxAttempts || !opts.shouldRetry?.(lastError)) {
        break;
      }
      
      // Call retry callback if provided
      opts.onRetry?.(attempt, lastError);
      
      // Calculate delay with exponential backoff and optional jitter
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }
  
  return {
    success: false,
    error: lastError!,
    attempts: opts.maxAttempts,
    totalTime: Date.now() - startTime
  };
}

/**
 * Calculate delay for next retry attempt
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  // Calculate exponential backoff
  const exponentialDelay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);
  
  // Apply maximum delay cap
  let delay = Math.min(exponentialDelay, options.maxDelay);
  
  // Add jitter to prevent thundering herd
  if (options.jitter) {
    // Add random jitter ±25%
    const jitterAmount = delay * 0.25;
    delay += (Math.random() - 0.5) * 2 * jitterAmount;
  }
  
  return Math.max(delay, 0);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Specialized retry for network operations
 */
export async function retryNetworkOperation<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    onRetry: (attempt, error) => {
      console.warn(`Retry attempt ${attempt} for ${context || 'network operation'}:`, error.message);
    },
    shouldRetry: (error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')
      );
    }
  });
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.result!;
}

/**
 * Specialized retry for server operations
 */
export async function retryServerOperation<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    onRetry: (attempt, error) => {
      console.warn(`Retry attempt ${attempt} for ${context || 'server operation'}:`, error.message);
    },
    shouldRetry: (error) => {
      const message = error.message.toLowerCase();
      return (
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('timeout')
      );
    }
  });
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.result!;
}

/**
 * Specialized retry for relay operations
 */
export async function retryRelayOperation<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    onRetry: (attempt, error) => {
      console.warn(`Retry attempt ${attempt} for ${context || 'relay operation'}:`, error.message);
    },
    shouldRetry: () => {
      // Relay operations are generally safe to retry
      return true;
    }
  });
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.result!;
}