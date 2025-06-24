import type { Event, UserServerList, ServerListEvent } from '../types';
import { createServerListEvent, parseServerListEvent, validateServerUrl } from '../utils/serverList';
import { signEventWithMethod, queryRelays, publishToRelays, getUserRelayList } from '../utils/nostr';

/**
 * Service for managing BUD-03 User Server Lists
 */
export class ServerListService {
  // Default relays for discovery when user has no relay list
  private _defaultRelayUrls: string[] = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://relay.primal.net',
    'wss://relay.snort.social',
    'wss://nos.lol',
    'wss://nostr.oxtr.dev', // Keep current one for backward compatibility
  ];

  // Current relay URLs to use for publishing
  private _publishRelayUrls: string[] = [];

  /**
   * Get current default relay URLs for discovery
   */
  get defaultRelayUrls(): string[] {
    return this._defaultRelayUrls;
  }

  /**
   * Get current publish relay URLs
   */
  get publishRelayUrls(): string[] {
    return this._publishRelayUrls.length > 0 ? this._publishRelayUrls : this._defaultRelayUrls;
  }

  /**
   * Get user's server list from Nostr relays with hybrid approach
   */
  async getUserServerList(pubkey: string): Promise<UserServerList | null> {
    try {
      // First try default discovery relays
      let events = await queryRelays(this._defaultRelayUrls, {
        kinds: [10063],
        authors: [pubkey],
        limit: 1
      });

      // If not found, try to get user's relay list and check those
      if (events.length === 0) {
        console.log(`No server list found in default relays, checking user's relay list...`);
        const userRelayList = await getUserRelayList(pubkey);
        
        if (userRelayList) {
          const userRelayUrls = Object.keys(userRelayList.relays);
          console.log(`Found user relay list with ${userRelayUrls.length} relays, checking for server list...`);
          
          events = await queryRelays(userRelayUrls, {
            kinds: [10063],
            authors: [pubkey],
            limit: 1
          });
        }
      }

      if (events.length === 0) {
        console.log(`No server list found for user ${pubkey}`);
        return null;
      }

      // Get the most recent event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      
      // Parse the server list from the event
      return parseServerListEvent(latestEvent as ServerListEvent);
    } catch (error) {
      console.error('Failed to fetch user server list:', error);
      return null;
    }
  }

  /**
   * Create and publish a new server list for the user
   */
  async createAndPublishServerList(
    servers: string[],
    pubkey: string,
    signingMethod: 'extension' | 'nsec'
  ): Promise<UserServerList> {
    // Validate all server URLs
    const validServers = servers.filter(url => validateServerUrl(url).valid);
    if (validServers.length === 0) {
      throw new Error('No valid server URLs provided');
    }

    try {
      // Create the kind 10063 event
      const unsignedEvent = await createServerListEvent(validServers, pubkey);
      
      console.log('🔐 ServerListService: Creating server list with signing method:', signingMethod, 'for user:', pubkey.slice(0, 8));
      
      // Sign the event using the specified method
      const signedEvent = await signEventWithMethod(unsignedEvent, signingMethod);
      
      // Publish to relays
      await this.publishEvent(signedEvent);
      
      return parseServerListEvent(signedEvent as ServerListEvent);
    } catch (error) {
      console.error('Failed to create and publish server list:', error);
      throw error;
    }
  }

  /**
   * Update user's server list
   */
  async updateServerList(
    servers: string[],
    pubkey: string,
    signingMethod: 'extension' | 'nsec'
  ): Promise<UserServerList> {
    return this.createAndPublishServerList(servers, pubkey, signingMethod);
  }

  /**
   * Add a server to user's list
   */
  async addServer(
    serverUrl: string,
    currentList: UserServerList,
    signingMethod: 'extension' | 'nsec'
  ): Promise<UserServerList> {
    if (!validateServerUrl(serverUrl).valid) {
      throw new Error('Invalid server URL');
    }

    if (currentList.servers.includes(serverUrl)) {
      throw new Error('Server already in list');
    }

    const updatedServers = [...currentList.servers, serverUrl];
    return this.updateServerList(updatedServers, currentList.pubkey, signingMethod);
  }

  /**
   * Remove a server from user's list
   */
  async removeServer(
    serverUrl: string,
    currentList: UserServerList,
    signingMethod: 'extension' | 'nsec'
  ): Promise<UserServerList> {
    const updatedServers = currentList.servers.filter(url => url !== serverUrl);
    return this.updateServerList(updatedServers, currentList.pubkey, signingMethod);
  }

  /**
   * Reorder servers in user's list
   */
  async reorderServers(
    newOrder: string[],
    currentList: UserServerList,
    signingMethod: 'extension' | 'nsec'
  ): Promise<UserServerList> {
    // Validate that all servers in new order exist in current list
    const validServers = newOrder.filter(url => 
      currentList.servers.includes(url) && validateServerUrl(url).valid
    );

    return this.updateServerList(validServers, currentList.pubkey, signingMethod);
  }

  /**
   * Publish an existing server list to relays
   */
  async publishServerList(
    serverList: UserServerList,
    signingMethod: 'extension' | 'nsec'
  ): Promise<void> {
    try {
      // Create the kind 10063 event
      const unsignedEvent = await createServerListEvent(serverList.servers, serverList.pubkey);
      
      console.log('🔐 ServerListService: Publishing server list with signing method:', signingMethod, 'for user:', serverList.pubkey.slice(0, 8));
      
      // Sign the event using the specified method
      const signedEvent = await signEventWithMethod(unsignedEvent, signingMethod);
      
      // Publish to relays
      await this.publishEvent(signedEvent);
    } catch (error) {
      console.error('Failed to publish server list:', error);
      throw error;
    }
  }

  /**
   * Publish event to Nostr relays
   */
  private async publishEvent(event: Event): Promise<void> {
    try {
      await publishToRelays(this.publishRelayUrls, event);
      console.log('Successfully published server list event to relays');
    } catch (error) {
      console.error('Failed to publish server list event:', error);
      throw error;
    }
  }

  /**
   * Set custom relay URLs for publishing
   */
  setPublishRelayUrls(urls: string[]) {
    this._publishRelayUrls = urls;
  }

  /**
   * Set default relay URLs for discovery
   */
  setDefaultRelayUrls(urls: string[]) {
    this._defaultRelayUrls = urls;
  }

  /**
   * Set publish relays based on user's relay list
   */
  async setPublishRelaysFromUserList(pubkey: string): Promise<boolean> {
    try {
      const userRelayList = await getUserRelayList(pubkey);
      
      if (userRelayList) {
        // Get relays that support write operations
        const writeRelays = Object.entries(userRelayList.relays)
          .filter(([, metadata]) => metadata.write !== false)
          .map(([url]) => url);
        
        if (writeRelays.length > 0) {
          this.setPublishRelayUrls(writeRelays);
          console.log(`Set publish relays from user list: ${writeRelays.length} relays`);
          return true;
        }
      }
      
      console.log('No user relay list found, using default relays for publishing');
      return false;
    } catch (error) {
      console.error('Failed to set publish relays from user list:', error);
      return false;
    }
  }
}

// Export singleton instance
export const serverListService = new ServerListService();
