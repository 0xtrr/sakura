import type { BlossomBlob, BlossomUploadResponse, BlossomServer } from '../types';
import { createBlossomAuthEvent, encodeAuthEvent } from '../utils/nostr';
import { generateFallbackUrls, fetchWithFallback, extractSha256FromUrl } from '../utils/serverList';
import { calculateSHA256 } from '../utils/fileUtils';
import { serverListService } from './serverList';
import { requestDeduplicator, createRequestKey } from '../utils/requestDeduplication';
import type { UserServerList } from '../types';

/**
 * Normalizes a server URL to remove trailing slashes for consistent endpoint construction
 */
function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export class BlossomAPI {
  protected server: BlossomServer;

  constructor(server: BlossomServer) {
    this.server = server;
  }

  /**
   * Uploads a file to the Blossom server following BUD-02 specification
   */
  async uploadFile(file: File, signingMethod: 'extension' | 'nsec'): Promise<BlossomUploadResponse> {
    // Normalize URL to avoid double slashes
    const baseUrl = normalizeBaseUrl(this.server.url);
    const url = `${baseUrl}/upload`;
    
    try {
      // Calculate file hash for auth event
      const fileHash = await calculateSHA256(file);
      
      // Create auth event for upload with required tags
      const authEvent = await createBlossomAuthEvent('upload', signingMethod, fileHash, `Upload ${file.name}`);
      const authHeader = encodeAuthEvent(authEvent);

      // Convert file to ArrayBuffer for binary upload
      const fileBuffer = await file.arrayBuffer();

      const response = await fetch(url, {
        method: 'PUT', // BUD-02 specifies PUT method
        headers: {
          'Authorization': `Nostr ${authHeader}`,
          'Content-Type': file.type || 'application/octet-stream',
          'Content-Length': file.size.toString(),
        },
        body: fileBuffer, // Send raw binary data
      });

      if (!response.ok) {
        let errorMessage = `Upload failed: ${response.status}`;
        
        // Extract X-Reason header if present (BUD-01 spec)
        const reasonHeader = response.headers.get('X-Reason');
        if (reasonHeader) {
          errorMessage += ` - ${reasonHeader}`;
        } else {
          // Fallback to response text if no X-Reason header
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage += ` - ${errorText}`;
            }
          } catch {
            // Ignore errors when reading response text
          }
        }
        
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Lists user's blobs
   */
  async listBlobs(pubkey: string, signingMethod: 'extension' | 'nsec'): Promise<BlossomBlob[]> {
    // Normalize URL to avoid double slashes
    const baseUrl = normalizeBaseUrl(this.server.url);
    const url = `${baseUrl}/list/${pubkey}`;
    
    try {
      const authEvent = await createBlossomAuthEvent('list', signingMethod, undefined, 'List Blobs');
      const authHeader = encodeAuthEvent(authEvent);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Nostr ${authHeader}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list blobs: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('List blobs error:', error);
      throw error;
    }
  }

  /**
   * Deletes a blob
   */
  async deleteBlob(sha256: string, signingMethod: 'extension' | 'nsec'): Promise<void> {
    // Normalize URL to avoid double slashes
    const baseUrl = normalizeBaseUrl(this.server.url);
    const url = `${baseUrl}/${sha256}`;
    
    try {
      const authEvent = await createBlossomAuthEvent('delete', signingMethod, sha256, `Delete ${sha256}`);
      const authHeader = encodeAuthEvent(authEvent);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Nostr ${authHeader}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete blob: ${response.status}`);
      }
    } catch (error) {
      console.error('Delete blob error:', error);
      throw error;
    }
  }

  /**
   * Mirror a blob from another server (BUD-04)
   * According to BUD-04: auth event must include blob hash in 'x' tag
   */
  async mirrorBlob(sourceUrl: string, signingMethod: 'extension' | 'nsec'): Promise<BlossomUploadResponse> {
    // Normalize URL to avoid double slashes
    const baseUrl = normalizeBaseUrl(this.server.url);
    const url = `${baseUrl}/mirror`;
    
    try {
      // Extract hash from source URL (required for BUD-04 auth event)
      const blobHash = extractSha256FromUrl(sourceUrl);
      if (!blobHash) {
        throw new Error('Cannot extract blob hash from source URL. BUD-04 requires hash in URL.');
      }

      // Create auth event with blob hash (BUD-04 requirement)
      const authEvent = await createBlossomAuthEvent('upload', signingMethod, blobHash, `Mirror blob ${blobHash}`);
      const authHeader = encodeAuthEvent(authEvent);

      console.log(`🪞 Mirroring blob ${blobHash} from ${sourceUrl} to ${this.server.url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Nostr ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: sourceUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mirror failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Successfully mirrored blob ${blobHash} to ${this.server.url}`);
      return result;
    } catch (error) {
      console.error('Mirror error:', error);
      throw error;
    }
  }

  /**
   * Gets blob info
   */
  async getBlobInfo(sha256: string): Promise<BlossomBlob> {
    // Normalize URL to avoid double slashes
    const baseUrl = normalizeBaseUrl(this.server.url);
    const url = `${baseUrl}/${sha256}`;
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
      });

      if (!response.ok) {
        throw new Error(`Failed to get blob info: ${response.status}`);
      }

      const size = parseInt(response.headers.get('content-length') || '0');
      const type = response.headers.get('content-type') || 'application/octet-stream';

      return {
        sha256,
        size,
        type,
        url,
        uploaded: Math.floor(Date.now() / 1000), // Convert to Unix timestamp (seconds)
      };
    } catch (error) {
      console.error('Get blob info error:', error);
      throw error;
    }
  }

  /**
   * Gets server info
   */
  async getServerInfo(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(this.server.url);
      
      if (!response.ok) {
        throw new Error(`Failed to get server info: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get server info error:', error);
      throw error;
    }
  }
}

/**
 * Enhanced Blossom API with BUD-03 server list support
 */
export class EnhancedBlossomAPI extends BlossomAPI {
  private userServerList?: UserServerList;

  constructor(server: BlossomServer, userServerList?: UserServerList) {
    super(server);
    this.userServerList = userServerList;
  }

  /**
   * Fetch and set user's server list from Nostr relays
   */
  async fetchUserServerList(pubkey: string): Promise<UserServerList | null> {
    try {
      // Try to fetch from relays first
      const serverList = await serverListService.getUserServerList(pubkey);
      
      if (serverList) {
        this.userServerList = serverList;
        console.log(`Loaded ${serverList.servers.length} servers from user's BUD-03 list`);
        return serverList;
      } else {
        // No server list found - return null to trigger onboarding
        console.log('No user server list found');
        this.userServerList = undefined;
        return null;
      }
    } catch (error) {
      console.error('Failed to fetch user server list:', error);
      // Return null to trigger onboarding instead of using defaults
      this.userServerList = undefined;
      return null;
    }
  }

  /**
   * Set the user's server list for fallback functionality
   */
  setUserServerList(serverList: UserServerList) {
    this.userServerList = serverList;
  }

  /**
   * Enhanced blob retrieval with fallback support
   */
  async getBlobWithFallback(url: string): Promise<Response> {
    if (!this.userServerList) {
      return fetch(url);
    }

    const fallbackUrls = generateFallbackUrls(url, this.userServerList);
    return fetchWithFallback(url, fallbackUrls);
  }

  /**
   * List blobs from ALL servers in user's server list
   * Merges results and tracks which servers have each file
   * Optimized to reuse a single authorization event across all servers
   * Uses request deduplication to prevent multiple identical requests
   */
  async listBlobsFromAllServers(pubkey: string, signingMethod: 'extension' | 'nsec'): Promise<BlossomBlob[]> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      const blobs = await this.listBlobs(pubkey, signingMethod);
      return blobs.map(blob => ({
        ...blob,
        availableServers: [{ 
          serverUrl: this.server.url, 
          serverName: this.server.name,
          success: true 
        }]
      }));
    }

    // Create a unique key for this request to enable deduplication
    const requestKey = createRequestKey([
      'listBlobsFromAllServers',
      pubkey,
      signingMethod,
      JSON.stringify([...this.userServerList.servers].sort()) // Normalize server order
    ]);

    return requestDeduplicator.deduplicate(requestKey, async () => {
      console.log(`Fetching blobs from ALL ${this.userServerList!.servers.length} servers...`);

      // Deduplicate server URLs to prevent querying the same server multiple times
      const uniqueServers = [...new Set(this.userServerList!.servers)];
      console.log(`After deduplication: ${uniqueServers.length} unique servers`);

      // Create a single authorization event to reuse across all servers
      const authEvent = await createBlossomAuthEvent('list', signingMethod, undefined, 'List Blobs');
      const authHeader = encodeAuthEvent(authEvent);
      console.log('📝 Created single auth event for reuse across all servers');

      // Create promises to fetch from all servers using the same auth event
      const fetchPromises = uniqueServers.map(async (serverUrl): Promise<{
        serverUrl: string;
        serverName: string;
        blobs?: BlossomBlob[];
        error?: string;
        success: boolean;
      }> => {
        try {
          console.log(`Fetching blobs from: ${serverUrl}`);
          
          // Use the shared auth event instead of creating a new one per server
          const baseUrl = normalizeBaseUrl(serverUrl);
          const url = `${baseUrl}/list/${pubkey}`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Nostr ${authHeader}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to list blobs: ${response.status}`);
          }

          const blobs = await response.json();
          console.log(`✅ Successfully fetched ${blobs.length} blobs from: ${serverUrl}`);
          
          // Get server name from URL
          const serverName = new URL(serverUrl).hostname;
          
          return { 
            serverUrl, 
            serverName,
            blobs, 
            success: true 
          };
        } catch (error) {
          const serverName = new URL(serverUrl).hostname;
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch';
          console.warn(`❌ Failed to fetch from ${serverUrl}:`, error);
          return { 
            serverUrl, 
            serverName,
            error: errorMessage, 
            success: false 
          };
        }
      });

      // Wait for all fetch operations to complete
      const results = await Promise.allSettled(fetchPromises);

      // Process results and build server availability map
      const serverResults: Array<{
        serverUrl: string;
        serverName: string;
        blobs?: BlossomBlob[];
        error?: string;
        success: boolean;
      }> = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          serverResults.push(result.value);
        } else {
          // This shouldn't happen since we catch all errors above
          serverResults.push({
            serverUrl: 'unknown',
            serverName: 'unknown',
            error: result.reason,
            success: false
          });
        }
      });

      // Merge blobs and track server availability
      const blobMap = new Map<string, BlossomBlob>();

      serverResults.forEach((serverResult) => {
        if (serverResult.success && serverResult.blobs) {
          serverResult.blobs.forEach((blob) => {
            const existingBlob = blobMap.get(blob.sha256);
            
            if (existingBlob) {
              // Add this server to the availability list if not already present
              if (!existingBlob.availableServers) {
                existingBlob.availableServers = [];
              }
              
              // Check if this server is already in the list
              const serverAlreadyExists = existingBlob.availableServers.some(
                server => server.serverUrl === serverResult.serverUrl
              );
              
              if (!serverAlreadyExists) {
                existingBlob.availableServers.push({
                  serverUrl: serverResult.serverUrl,
                  serverName: serverResult.serverName,
                  success: true
                });
              } else {
                console.warn(`Duplicate server detected for blob ${blob.sha256}: ${serverResult.serverName}`);
              }
            } else {
              // First time seeing this blob
              blobMap.set(blob.sha256, {
                ...blob,
                availableServers: [{
                  serverUrl: serverResult.serverUrl,
                  serverName: serverResult.serverName,
                  success: true
                }]
              });
            }
          });
        }
      });

      // Also track failed servers for transparency
      const failedServers = serverResults.filter(r => !r.success);
      if (failedServers.length > 0) {
        console.log(`Failed to fetch from ${failedServers.length} servers:`, 
          failedServers.map(f => `${f.serverName}: ${f.error}`).join(', '));
      }

      const mergedBlobs = Array.from(blobMap.values());
      console.log(`Merged ${mergedBlobs.length} unique blobs from ${serverResults.filter(r => r.success).length} servers`);

      return mergedBlobs;
    });
  }

  /**
   * List blobs with sequential server fallback
   * Tries user's preferred servers one by one until success
   */
  async listBlobsEnhanced(pubkey: string, signingMethod: 'extension' | 'nsec'): Promise<BlossomBlob[]> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      return this.listBlobs(pubkey, signingMethod);
    }

    let lastError: Error | null = null;

    // Try each server in order of preference
    for (const serverUrl of this.userServerList.servers) {
      try {
        console.log(`Attempting to list blobs from: ${serverUrl}`);
        const tempAPI = new BlossomAPI({ url: serverUrl, name: 'temp' });
        const blobs = await tempAPI.listBlobs(pubkey, signingMethod);
        console.log(`Successfully listed ${blobs.length} blobs from: ${serverUrl}`);
        return blobs;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to list from ${serverUrl}:`, error);
        // Continue to next server
      }
    }

    // If all user servers failed, try the default server as last resort
    try {
      console.log('All user servers failed, trying default server...');
      return this.listBlobs(pubkey, signingMethod);
    } catch (error) {
      console.error('Default server also failed:', error);
      throw lastError || error;
    }
  }

  /**
   * Upload with sequential server fallback
   * Tries to upload to the first available server in user's list
   */
  async uploadWithFallback(file: File, signingMethod: 'extension' | 'nsec'): Promise<BlossomUploadResponse> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      return this.uploadFile(file, signingMethod);
    }

    let lastError: Error | null = null;

    // Try each server in order of preference
    for (const serverUrl of this.userServerList.servers) {
      try {
        console.log(`Attempting upload to: ${serverUrl}`);
        const tempAPI = new BlossomAPI({ url: serverUrl, name: 'temp' });
        const result = await tempAPI.uploadFile(file, signingMethod);
        console.log(`Successfully uploaded to: ${serverUrl}`);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to upload to ${serverUrl}:`, error);
        // Continue to next server
      }
    }

    // If all user servers failed, try the default server as last resort
    try {
      console.log('All user servers failed, trying default server...');
      return this.uploadFile(file, signingMethod);
    } catch (error) {
      console.error('Default server also failed:', error);
      throw lastError || error;
    }
  }

  /**
   * Upload to ALL servers in user's BUD-03 server list simultaneously
   * Returns results from all upload attempts, including failures
   */
  async uploadToAllServers(file: File, signingMethod: 'extension' | 'nsec'): Promise<{
    successful: Array<{ serverUrl: string; result: BlossomUploadResponse }>;
    failed: Array<{ serverUrl: string; error: Error }>;
    primaryResult: BlossomUploadResponse;
  }> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      const result = await this.uploadFile(file, signingMethod);
      return {
        successful: [{ serverUrl: this.server.url, result }],
        failed: [],
        primaryResult: result
      };
    }

    console.log(`Uploading to ALL ${this.userServerList.servers.length} servers simultaneously...`);

    // Create upload promises for all servers
    const uploadPromises = this.userServerList.servers.map(async (serverUrl): Promise<{ serverUrl: string; result?: BlossomUploadResponse; error?: Error; success: boolean }> => {
      try {
        console.log(`Starting upload to: ${serverUrl}`);
        const tempAPI = new BlossomAPI({ url: serverUrl, name: 'temp' });
        const result = await tempAPI.uploadFile(file, signingMethod);
        console.log(`✅ Successfully uploaded to: ${serverUrl}`);
        return { serverUrl, result, success: true };
      } catch (error) {
        console.warn(`❌ Failed to upload to ${serverUrl}:`, error);
        return { serverUrl, error: error as Error, success: false };
      }
    });

    // Wait for all uploads to complete
    const results = await Promise.allSettled(uploadPromises);

    // Separate successful and failed uploads
    const successful: Array<{ serverUrl: string; result: BlossomUploadResponse }> = [];
    const failed: Array<{ serverUrl: string; error: Error }> = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success && result.value.result) {
          successful.push({
            serverUrl: result.value.serverUrl,
            result: result.value.result
          });
        } else if (!result.value.success && result.value.error) {
          failed.push({
            serverUrl: result.value.serverUrl,
            error: result.value.error
          });
        }
      } else {
        // This shouldn't happen since we catch all errors above, but handle it anyway
        failed.push({
          serverUrl: 'unknown',
          error: new Error(result.reason)
        });
      }
    });

    console.log(`Upload complete: ${successful.length} successful, ${failed.length} failed`);

    // If no uploads succeeded, throw an error
    if (successful.length === 0) {
      const errorMsg = `Failed to upload to any server. Errors: ${failed.map(f => `${f.serverUrl}: ${f.error.message}`).join(', ')}`;
      throw new Error(errorMsg);
    }

    // Return the first successful result as primary, but include all results
    return {
      successful,
      failed,
      primaryResult: successful[0].result
    };
  }

  /**
   * Upload to PRIMARY server with fallback to other servers if it fails
   * Tries servers in order until one succeeds or all fail
   */
  async uploadWithFallbackSequential(file: File, signingMethod: 'extension' | 'nsec'): Promise<{
    result: BlossomUploadResponse;
    serverUrl: string;
    attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }>;
  }> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      const result = await this.uploadFile(file, signingMethod);
      return {
        result,
        serverUrl: this.server.url,
        attemptedServers: [{ serverUrl: this.server.url, success: true }]
      };
    }

    const attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }> = [];

    // Try each server in order of preference
    for (const serverUrl of this.userServerList.servers) {
      try {
        console.log(`Attempting upload to: ${serverUrl}`);
        const tempAPI = new BlossomAPI({ url: serverUrl, name: 'temp' });
        const result = await tempAPI.uploadFile(file, signingMethod);
        
        attemptedServers.push({ serverUrl, success: true });
        console.log(`✅ Successfully uploaded to: ${serverUrl}`);
        
        return {
          result,
          serverUrl,
          attemptedServers
        };
      } catch (error) {
        // Extract error details from response if available
        let errorMessage = error instanceof Error ? error.message : 'Upload failed';
        
        // Try to extract X-Reason header from error if it's a fetch error
        if (error instanceof Error && error.message.includes('Upload failed:')) {
          // The error message from uploadFile already contains status and response text
          errorMessage = error.message;
        }
        
        attemptedServers.push({ 
          serverUrl, 
          error: errorMessage, 
          success: false 
        });
        
        console.warn(`❌ Failed to upload to ${serverUrl}:`, error);
        // Continue to next server
      }
    }

    // If all servers failed, create a comprehensive error with attempt details
    const errorSummary = `Upload failed on all ${this.userServerList.servers.length} servers`;
    const errorDetails = attemptedServers
      .filter(s => !s.success)
      .map(s => `${new URL(s.serverUrl).hostname}: ${s.error}`)
      .join('; ');
    
    // Create a special error that includes the attempt details
    const comprehensiveError = new Error(`${errorSummary}. Errors: ${errorDetails}`) as Error & { 
      attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }> 
    };
    comprehensiveError.attemptedServers = attemptedServers;
    
    throw comprehensiveError;
  }

  /**
   * Delete blob with sequential server fallback
   * Optimized to reuse a single authorization event across all servers
   */
  async deleteBlobWithFallback(sha256: string, signingMethod: 'extension' | 'nsec'): Promise<void> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      return this.deleteBlob(sha256, signingMethod);
    }

    let lastError: Error | null = null;
    let successCount = 0;

    // Create a single authorization event to reuse across all servers
    const authEvent = await createBlossomAuthEvent('delete', signingMethod, sha256, `Delete ${sha256}`);
    const authHeader = encodeAuthEvent(authEvent);
    console.log('📝 Created single delete auth event for reuse across all servers');

    // Try to delete from all servers where the blob might exist
    for (const serverUrl of this.userServerList.servers) {
      try {
        console.log(`Attempting to delete from: ${serverUrl}`);
        
        // Use the shared auth event instead of creating a new one per server
        const baseUrl = normalizeBaseUrl(serverUrl);
        const url = `${baseUrl}/${sha256}`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Nostr ${authHeader}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to delete blob: ${response.status}`);
        }
        
        successCount++;
        console.log(`Successfully deleted from: ${serverUrl}`);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Failed to delete from ${serverUrl}:`, error);
        // Continue to try other servers
      }
    }

    // If we didn't delete from any server, throw the last error
    if (successCount === 0) {
      throw lastError || new Error('Failed to delete from any server');
    }
  }

  /**
   * Mirror a blob to all servers in the user's server list (BUD-04)
   * This ensures maximum decentralization by copying the blob to all available servers
   */
  async mirrorBlobToAllServers(sourceUrl: string, signingMethod: 'extension' | 'nsec'): Promise<{
    successful: Array<{ serverUrl: string; result: BlossomUploadResponse }>;
    failed: Array<{ serverUrl: string; error: Error }>;
    sourceServer: string;
  }> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      throw new Error('No user server list available. Cannot mirror to other servers.');
    }

    const blobHash = extractSha256FromUrl(sourceUrl);
    if (!blobHash) {
      throw new Error('Cannot extract blob hash from source URL for mirroring.');
    }

    // Determine source server to avoid mirroring to itself
    const sourceServer = new URL(sourceUrl).origin;
    const targetServers = this.userServerList.servers.filter(serverUrl => {
      const targetOrigin = new URL(serverUrl).origin;
      return targetOrigin !== sourceServer;
    });

    if (targetServers.length === 0) {
      throw new Error('No target servers available for mirroring (source server excluded).');
    }

    console.log(`🪞 Mirroring blob ${blobHash} from ${sourceServer} to ${targetServers.length} servers...`);

    // Create a single authorization event to reuse across all target servers
    const authEvent = await createBlossomAuthEvent('upload', signingMethod, blobHash, `Mirror blob ${blobHash}`);
    const authHeader = encodeAuthEvent(authEvent);
    console.log('📝 Created single mirror auth event for reuse across all target servers');

    // Create mirror promises for all target servers using the shared auth event
    const mirrorPromises = targetServers.map(async (serverUrl): Promise<{ serverUrl: string; result?: BlossomUploadResponse; error?: Error; success: boolean }> => {
      try {
        console.log(`🪞 Starting mirror to: ${serverUrl}`);
        
        // Use the shared auth event instead of creating a new one per server
        const baseUrl = normalizeBaseUrl(serverUrl);
        const url = `${baseUrl}/mirror`;
        
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Nostr ${authHeader}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: sourceUrl }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Mirror failed: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log(`✅ Successfully mirrored to: ${serverUrl}`);
        return { serverUrl, result, success: true };
      } catch (error) {
        console.warn(`❌ Failed to mirror to ${serverUrl}:`, error);
        return { serverUrl, error: error as Error, success: false };
      }
    });

    // Wait for all mirror operations to complete
    const results = await Promise.allSettled(mirrorPromises);

    // Separate successful and failed mirrors
    const successful: Array<{ serverUrl: string; result: BlossomUploadResponse }> = [];
    const failed: Array<{ serverUrl: string; error: Error }> = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success && result.value.result) {
          successful.push({
            serverUrl: result.value.serverUrl,
            result: result.value.result
          });
        } else if (!result.value.success && result.value.error) {
          failed.push({
            serverUrl: result.value.serverUrl,
            error: result.value.error
          });
        }
      } else {
        failed.push({
          serverUrl: 'unknown',
          error: new Error(result.reason)
        });
      }
    });

    console.log(`🪞 Mirror complete: ${successful.length} successful, ${failed.length} failed out of ${targetServers.length} servers`);

    return {
      successful,
      failed,
      sourceServer
    };
  }

  /**
   * Mirror a blob from one specific server to another (BUD-04)
   */
  async mirrorBlobBetweenServers(
    sourceUrl: string, 
    targetServerUrl: string, 
    signingMethod: 'extension' | 'nsec'
  ): Promise<BlossomUploadResponse> {
    const blobHash = extractSha256FromUrl(sourceUrl);
    if (!blobHash) {
      throw new Error('Cannot extract blob hash from source URL for mirroring.');
    }

    // Verify we're not mirroring to the same server
    const sourceServer = new URL(sourceUrl).origin;
    const targetServer = new URL(targetServerUrl).origin;
    
    if (sourceServer === targetServer) {
      throw new Error('Cannot mirror blob to the same server it already exists on.');
    }

    console.log(`🪞 Mirroring blob ${blobHash} from ${sourceServer} to ${targetServer}`);

    const tempAPI = new BlossomAPI({ url: targetServerUrl, name: 'temp' });
    return await tempAPI.mirrorBlob(sourceUrl, signingMethod);
  }

  /**
   * Check which servers in the user's list already have a specific blob
   */
  async checkBlobAvailability(blobHash: string): Promise<{
    available: string[];
    unavailable: string[];
    errors: Array<{ serverUrl: string; error: Error }>;
  }> {
    if (!this.userServerList || this.userServerList.servers.length === 0) {
      return { available: [], unavailable: [], errors: [] };
    }

    console.log(`🔍 Checking blob ${blobHash} availability across ${this.userServerList.servers.length} servers...`);

    const checkPromises = this.userServerList.servers.map(async (serverUrl) => {
      try {
        const baseUrl = normalizeBaseUrl(serverUrl);
        const response = await fetch(`${baseUrl}/${blobHash}`, { method: 'HEAD' });
        return { serverUrl, available: response.ok, error: null };
      } catch (error) {
        return { serverUrl, available: false, error: error as Error };
      }
    });

    const results = await Promise.allSettled(checkPromises);
    
    const available: string[] = [];
    const unavailable: string[] = [];
    const errors: Array<{ serverUrl: string; error: Error }> = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.available) {
          available.push(result.value.serverUrl);
        } else if (result.value.error) {
          errors.push({ serverUrl: result.value.serverUrl, error: result.value.error });
        } else {
          unavailable.push(result.value.serverUrl);
        }
      } else {
        errors.push({ serverUrl: 'unknown', error: new Error(result.reason) });
      }
    });

    console.log(`🔍 Availability check complete: ${available.length} have blob, ${unavailable.length} don't have blob, ${errors.length} errors`);

    return { available, unavailable, errors };
  }
}

// Default Blossom servers
export const DEFAULT_BLOSSOM_SERVERS: BlossomServer[] = [
  {
    url: 'https://blossom.primal.net',
    name: 'Primal',
    description: 'Primal Blossom server',
  },
  {
    url: 'https://blossom.band',
    name: 'Blossom.band',
    description: 'Blossom.band Blossom server',
  },
];

/**
 * Creates a Blossom API instance for the given server
 */
export function createBlossomAPI(server: BlossomServer): BlossomAPI {
  return new BlossomAPI(server);
}
