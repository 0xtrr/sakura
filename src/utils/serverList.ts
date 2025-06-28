import type { UnsignedEvent, UserServerList, ServerListEvent } from '../types';

// BUD-03 User Server List utilities

/**
 * Normalizes a server URL to remove trailing slashes for consistent endpoint construction
 */
function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Extract SHA256 hash from a URL (as per BUD-03 spec)
 * Uses the last occurrence of a 64 character hex string
 */
export function extractSha256FromUrl(url: string): string | null {
  const matches = url.match(/[a-f0-9]{64}/gi);
  return matches ? matches[matches.length - 1] : null;
}

/**
 * Create a kind 10063 event for user's server list
 */
export async function createServerListEvent(
  servers: string[],
  pubkey: string
): Promise<UnsignedEvent> {
  return {
    kind: 10063,
    content: '',
    tags: servers.map(server => ['server', server]),
    created_at: Math.floor(Date.now() / 1000),
    pubkey,
  };
}

/**
 * Parse a kind 10063 event into a UserServerList
 */
export function parseServerListEvent(event: ServerListEvent): UserServerList {
  const servers = event.tags
    .filter(tag => tag[0] === 'server' && tag[1])
    .map(tag => tag[1]);

  console.log('🔍 parseServerListEvent: Raw event tags:', event.tags);
  console.log('🔍 parseServerListEvent: Parsed servers (in order):', servers);

  return {
    servers,
    pubkey: event.pubkey,
    created_at: event.created_at,
    event,
  };
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  url?: string;
  error?: string;
}

/**
 * Validate if a URL is a valid Blossom server URL
 */
export function validateServerUrl(url: string): ValidationResult {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return {
        valid: true,
        url: parsedUrl.toString()
      };
    } else {
      return {
        valid: false,
        error: 'URL must use HTTP or HTTPS protocol'
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Generate alternative URLs for a blob using user's server list
 * Used for fallback when original URL is not accessible
 */
export function generateFallbackUrls(
  originalUrl: string,
  userServerList: UserServerList
): string[] {
  const sha256 = extractSha256FromUrl(originalUrl);
  if (!sha256) return [];

  // Get file extension from original URL
  const urlPath = new URL(originalUrl).pathname;
  const extensionMatch = urlPath.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extensionMatch ? extensionMatch[0] : '';

  return userServerList.servers.map(serverUrl => {
    const baseUrl = normalizeBaseUrl(serverUrl);
    return `${baseUrl}/${sha256}${extension}`;
  });
}

/**
 * Try to fetch a blob from multiple fallback URLs
 */
export async function fetchWithFallback(
  originalUrl: string,
  fallbackUrls: string[]
): Promise<Response> {
  // Try original URL first
  try {
    const response = await fetch(originalUrl, { method: 'HEAD' });
    if (response.ok) {
      return fetch(originalUrl);
    }
  } catch (error) {
    console.warn('Original URL failed:', originalUrl, error);
  }

  // Try fallback URLs
  for (const url of fallbackUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return fetch(url);
      }
    } catch (error) {
      console.warn('Fallback URL failed:', url, error);
    }
  }

  throw new Error('All URLs failed');
}

/**
 * Get the default server preference order
 * Returns servers sorted by reliability/preference
 */
export function getDefaultServerOrder(servers: string[]): string[] {
  // In a real implementation, this could be based on:
  // - Historical uptime
  // - Response times
  // - User preferences
  // - Geographic proximity
  return [...servers]; // For now, maintain original order
}
