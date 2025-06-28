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
   * Query individual relays to debug server ordering issues
   */
  private async queryRelaysIndividually(relayUrls: string[], pubkey: string): Promise<UserServerList | null> {
    console.log(`🔍 Querying ${relayUrls.length} relays individually for server list debug...`);
    
    const allEvents: Array<{ relay: string; event: any; servers: string[] }> = [];
    
    for (const relayUrl of relayUrls) {
      try {
        console.log(`🔎 Querying relay: ${relayUrl}`);
        const events = await queryRelays([relayUrl], {
          kinds: [10063],
          authors: [pubkey],
          limit: 1
        }, 3000); // 3 second timeout per relay
        
        if (events.length > 0) {
          const event = events[0];
          const servers = event.tags
            .filter((tag: string[]) => tag[0] === 'server' && tag[1])
            .map((tag: string[]) => tag[1]);
          
          console.log(`📋 ${relayUrl} returned event created at ${new Date(event.created_at * 1000).toISOString()}`);
          console.log(`📋 ${relayUrl} server order:`, servers);
          
          allEvents.push({ relay: relayUrl, event, servers });
        } else {
          console.log(`❌ ${relayUrl} returned no events`);
        }
      } catch (error) {
        console.error(`❌ Failed to query ${relayUrl}:`, error);
      }
    }
    
    if (allEvents.length === 0) {
      console.log('❌ No events found from any relay');
      return null;
    }
    
    // Find the most recent event across all relays
    const latestEventInfo = allEvents.sort((a, b) => b.event.created_at - a.event.created_at)[0];
    
    console.log(`🏆 Using most recent event from ${latestEventInfo.relay} (${new Date(latestEventInfo.event.created_at * 1000).toISOString()})`);
    console.log(`🏆 Final server order:`, latestEventInfo.servers);
    
    // Check for inconsistencies
    const uniqueOrders = new Set(allEvents.map(e => JSON.stringify(e.servers)));
    if (uniqueOrders.size > 1) {
      console.warn(`⚠️ INCONSISTENT SERVER ORDERS DETECTED across ${allEvents.length} relays!`);
      allEvents.forEach(({ relay, servers, event }) => {
        console.warn(`⚠️ ${relay}: [${servers.join(', ')}] (created: ${new Date(event.created_at * 1000).toISOString()})`);
      });
    } else {
      console.log(`✅ All ${allEvents.length} relays have consistent server order`);
    }
    
    return parseServerListEvent(latestEventInfo.event as ServerListEvent);
  }

  /**
   * Get user's server list from Nostr relays with hybrid approach
   */
  async getUserServerList(pubkey: string): Promise<UserServerList | null> {
    try {
      // First try default discovery relays with individual debugging
      console.log('🔍 Checking default discovery relays...');
      let result = await this.queryRelaysIndividually(this._defaultRelayUrls, pubkey);
      
      if (result) {
        return result;
      }

      // If not found, try user's relay list
      console.log(`No server list found in default relays, checking user's relay list...`);
      const userRelayList = await getUserRelayList(pubkey);
      
      if (userRelayList) {
        const userRelayUrls = Object.keys(userRelayList.relays);
        console.log(`Found user relay list with ${userRelayUrls.length} relays, checking for server list...`);
        
        result = await this.queryRelaysIndividually(userRelayUrls, pubkey);
        if (result) {
          return result;
        }
      }

      console.log(`No server list found for user ${pubkey}`);
      return null;
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
      console.log('🔍 ServerListService: Publishing to relays:', this.publishRelayUrls);
      console.log('🔍 ServerListService: _publishRelayUrls:', this._publishRelayUrls);
      console.log('🔍 ServerListService: _defaultRelayUrls:', this._defaultRelayUrls);
      console.log('🔍 ServerListService: Event to publish:', event);
      
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
      console.log('🔍 ServerListService: Getting user relay list for publish relays (cached)...');
      const userRelayList = await getUserRelayList(pubkey); // Will use cache if available
      console.log('🔍 ServerListService: User relay list:', userRelayList);
      
      if (userRelayList) {
        // Use ALL user relays for publishing (like RelayManagement does)
        // NIP-65: If write is not specified, assume both read and write are supported
        const allRelays = Object.keys(userRelayList.relays);
        
        console.log('🔍 ServerListService: ALL user relays for publishing:', allRelays);
        
        if (allRelays.length > 0) {
          this.setPublishRelayUrls(allRelays);
          console.log(`✅ Set publish relays to ALL user relays: ${allRelays.length} relays`);
          console.log('🔍 ServerListService: _publishRelayUrls after setting:', this._publishRelayUrls);
          return true;
        }
      }
      
      console.log('⚠️ No user relay list found, using default relays for publishing');
      return false;
    } catch (error) {
      console.error('❌ Failed to set publish relays from user list:', error);
      return false;
    }
  }
}

// Export singleton instance
export const serverListService = new ServerListService();
