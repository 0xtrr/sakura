/**
 * Request deduplication utility to prevent multiple identical requests
 * Useful for avoiding duplicate auth event creation and API calls
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Execute a request or return existing promise if request is already pending
   */
  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.REQUEST_TIMEOUT
  ): Promise<T> {
    // Clean up expired requests
    this.cleanup();

    const existing = this.pendingRequests.get(key);
    if (existing && Date.now() - existing.timestamp < ttl) {
      console.log(`🔄 Reusing pending request for: ${key}`);
      return existing.promise;
    }

    console.log(`🚀 Creating new request for: ${key}`);
    const promise = requestFn().finally(() => {
      // Clean up after completion
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  /**
   * Clear a specific request from cache
   */
  invalidate(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Clean up expired requests
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Get current cache stats for debugging
   */
  getStats(): { pending: number; keys: string[] } {
    return {
      pending: this.pendingRequests.size,
      keys: Array.from(this.pendingRequests.keys())
    };
  }
}

// Global instance for request deduplication
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Helper for creating deduplication keys
 */
export function createRequestKey(parts: (string | number | boolean | null | undefined)[]): string {
  return parts
    .filter(part => part !== null && part !== undefined)
    .map(part => String(part))
    .join('|');
}

/**
 * Hook for using request deduplication in React components
 */
export function useRequestDeduplication() {
  return {
    deduplicate: requestDeduplicator.deduplicate.bind(requestDeduplicator),
    invalidate: requestDeduplicator.invalidate.bind(requestDeduplicator),
    clear: requestDeduplicator.clear.bind(requestDeduplicator),
    createKey: createRequestKey,
    getStats: requestDeduplicator.getStats.bind(requestDeduplicator)
  };
}
