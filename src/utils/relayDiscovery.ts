import { queryRelays } from './nostr';
import type { UserRelayList, RelayListEvent, RelayMetadata } from '../types';
import type { Filter } from 'nostr-tools';

/**
 * Primary discovery relays - well-established, reliable relays
 * These should be updated periodically based on network health
 */
const PRIMARY_DISCOVERY_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net', 
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr.oxtr.dev',
];

/**
 * Secondary discovery relays - additional fallback options
 */
const SECONDARY_DISCOVERY_RELAYS = [
  'wss://relay.nostr.bg',
  'wss://nostr.wine',
  'wss://offchain.pub',
  'wss://relay.current.fyi',
  'wss://nostr.mom',
];

/**
 * Enhanced relay discovery with multiple fallback strategies
 */
export async function discoverUserRelays(pubkey: string, customDiscoveryRelay?: string): Promise<{
  relayList: UserRelayList | null;
  discoveryMethod: 'primary' | 'secondary' | 'custom' | 'failed';
  attemptedRelays: string[];
}> {
  const attemptedRelays: string[] = [];
  
  // Strategy 1: Try custom discovery relay if provided
  if (customDiscoveryRelay) {
    console.log(`🔍 Trying custom discovery relay: ${customDiscoveryRelay}`);
    try {
      const relayList = await fetchRelayListFromRelays([customDiscoveryRelay], pubkey);
      attemptedRelays.push(customDiscoveryRelay);
      if (relayList) {
        return { relayList, discoveryMethod: 'custom', attemptedRelays };
      }
    } catch (error) {
      console.warn(`Failed to discover from custom relay ${customDiscoveryRelay}:`, error);
      attemptedRelays.push(customDiscoveryRelay);
    }
  }

  // Strategy 2: Try primary discovery relays
  console.log(`🔍 Trying primary discovery relays`);
  try {
    const relayList = await fetchRelayListFromRelays(PRIMARY_DISCOVERY_RELAYS, pubkey);
    attemptedRelays.push(...PRIMARY_DISCOVERY_RELAYS);
    if (relayList) {
      return { relayList, discoveryMethod: 'primary', attemptedRelays };
    }
  } catch (error) {
    console.warn(`Failed to discover from primary relays:`, error);
  }

  // Strategy 3: Try secondary discovery relays
  console.log(`🔍 Trying secondary discovery relays`);
  try {
    const relayList = await fetchRelayListFromRelays(SECONDARY_DISCOVERY_RELAYS, pubkey);
    attemptedRelays.push(...SECONDARY_DISCOVERY_RELAYS);
    if (relayList) {
      return { relayList, discoveryMethod: 'secondary', attemptedRelays };
    }
  } catch (error) {
    console.warn(`Failed to discover from secondary relays:`, error);
  }

  return { relayList: null, discoveryMethod: 'failed', attemptedRelays };
}

/**
 * Fetch relay list from a specific set of discovery relays
 */
async function fetchRelayListFromRelays(discoveryRelays: string[], pubkey: string): Promise<UserRelayList | null> {
  const filter: Filter = {
    kinds: [10002],
    authors: [pubkey],
    limit: 1,
  };

  const events = await queryRelays(discoveryRelays, filter, 5000);
  
  if (events.length === 0) {
    return null;
  }

  // Get the most recent event
  const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
  
  return parseRelayListEvent(latestEvent as RelayListEvent);
}

/**
 * Parse a kind 10002 event into a UserRelayList
 * (Extracted from nostr.ts for reuse)
 */
function parseRelayListEvent(event: RelayListEvent): UserRelayList {
  const relays: Record<string, RelayMetadata> = {};
  
  event.tags.forEach((tag: string[]) => {
    if (tag[0] === 'r' && tag[1]) {
      const relayUrl = tag[1];
      const metadata: RelayMetadata = {};
      
      // Parse read/write markers
      if (tag[2]) {
        if (tag[2] === 'read') metadata.read = true;
        if (tag[2] === 'write') metadata.write = true;
      } else {
        // If no marker specified, assume both read and write
        metadata.read = true;
        metadata.write = true;
      }
      
      relays[relayUrl] = metadata;
    }
  });

  return {
    relays,
    pubkey: event.pubkey,
    created_at: event.created_at,
    event
  };
}

/**
 * Get health status of discovery relays
 */
export async function checkDiscoveryRelayHealth(): Promise<{
  healthy: string[];
  unhealthy: string[];
}> {
  const allRelays = [...PRIMARY_DISCOVERY_RELAYS, ...SECONDARY_DISCOVERY_RELAYS];
  const healthy: string[] = [];
  const unhealthy: string[] = [];

  await Promise.allSettled(
    allRelays.map(async (relay) => {
      try {
        // Simple connection test
        const ws = new WebSocket(relay);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout'));
          }, 3000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(void 0);
          };
          
          ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Connection failed'));
          };
        });
        
        healthy.push(relay);
      } catch {
        unhealthy.push(relay);
      }
    })
  );

  return { healthy, unhealthy };
}