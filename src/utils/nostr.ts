import type { Event, UnsignedEvent, BlossomAuthEvent, UserRelayList, RelayListEvent, RelayMetadata } from '../types';
import { SimplePool, nip19, finalizeEvent, getPublicKey as derivePublicKey } from 'nostr-tools';
import type { Filter } from 'nostr-tools';
import CryptoJS from 'crypto-js';

// Private key storage interface for fallback authentication
interface PrivateKeyStorage {
  privateKey: string; // AES encrypted private key
  publicKey: string;  // Plain public key for UI display
  salt: string;       // Random salt for key derivation
  iv: string;         // Initialization vector for AES
}

// Storage key for encrypted private key
const PRIVATE_KEY_STORAGE_KEY = 'sakura_encrypted_nsec';

// Session storage for decrypted private key (memory only)
let sessionPrivateKey: string | null = null;

/**
 * NIP-19 Helper Functions
 */

/**
 * Validates if a string is a valid nsec (NIP-19 private key)
 */
export function isValidNsec(nsec: string): boolean {
  try {
    const decoded = nip19.decode(nsec);
    return decoded.type === 'nsec' && decoded.data instanceof Uint8Array && decoded.data.length === 32;
  } catch {
    return false;
  }
}

/**
 * Converts nsec to hex private key
 */
export function nsecToPrivateKey(nsec: string): string {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    // Convert Uint8Array to hex string
    const privateKeyBytes = decoded.data as Uint8Array;
    return Array.from(privateKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    throw new Error('Failed to decode nsec: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Converts hex private key to public key
 */
export function privateKeyToPublicKey(privateKeyHex: string): string {
  try {
    // Convert hex string to Uint8Array
    const privateKeyBytes = new Uint8Array(privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return derivePublicKey(privateKeyBytes);
  } catch (error) {
    throw new Error('Failed to derive public key: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * AES encryption for securely storing private keys
 * Uses PBKDF2 for key derivation and AES-256-CBC for encryption
 */
function encryptPrivateKey(privateKeyHex: string, password: string): {
  encrypted: string;
  salt: string;
  iv: string;
} {
  try {
    // Generate random salt (16 bytes)
    const salt = CryptoJS.lib.WordArray.random(128/8);
    
    // Generate random IV (16 bytes)
    const iv = CryptoJS.lib.WordArray.random(128/8);
    
    // Derive key from password + salt using PBKDF2
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,        // 256-bit key
      iterations: 10000       // 10,000 iterations for security
    });
    
    // Encrypt with AES-256-CBC
    const encrypted = CryptoJS.AES.encrypt(privateKeyHex, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    return {
      encrypted: encrypted.toString(),
      salt: salt.toString(),
      iv: iv.toString()
    };
  } catch (error) {
    throw new Error('Failed to encrypt private key: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

function decryptPrivateKey(encrypted: string, password: string, salt: string, iv: string): string {
  try {
    // Convert salt and IV back to WordArray
    const saltWordArray = CryptoJS.enc.Hex.parse(salt);
    const ivWordArray = CryptoJS.enc.Hex.parse(iv);
    
    // Derive the same key using PBKDF2
    const key = CryptoJS.PBKDF2(password, saltWordArray, {
      keySize: 256/32,        // 256-bit key
      iterations: 10000       // Same iterations as encryption
    });
    
    // Decrypt with AES-256-CBC
    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
    
    return decryptedText;
  } catch (error) {
    throw new Error('Failed to decrypt private key: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}


/**
 * Stores nsec private key securely in localStorage using AES encryption with user password
 */
export function storePrivateKey(nsec: string, password: string): void {
  try {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    const privateKeyHex = nsecToPrivateKey(nsec);
    const publicKey = privateKeyToPublicKey(privateKeyHex);
    
    const { encrypted, salt, iv } = encryptPrivateKey(privateKeyHex, password);
    
    const storage: PrivateKeyStorage = {
      privateKey: encrypted,
      publicKey,
      salt,
      iv
    };
    
    localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, JSON.stringify(storage));
    console.log('🔐 Private key stored securely with AES-256 encryption and user password');
  } catch (error) {
    throw new Error('Failed to store private key: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Retrieves stored private key and decrypts it using AES with user password
 */
export function getStoredPrivateKey(password: string): { privateKey: string; publicKey: string } | null {
  try {
    const stored = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
    if (!stored) return null;
    
    const storage: PrivateKeyStorage = JSON.parse(stored);
    
    // Handle legacy XOR encrypted keys (migration) - these need to be re-encrypted with user password
    if (!storage.salt || !storage.iv) {
      throw new Error('Legacy key found - please re-login with your nsec to upgrade security');
    }
    
    // Decrypt with AES using user password
    const privateKeyHex = decryptPrivateKey(
      storage.privateKey, 
      password, 
      storage.salt, 
      storage.iv
    );
    
    // Store in session memory for signing operations
    sessionPrivateKey = privateKeyHex;
    console.log('🔑 Session private key set successfully');
    
    return {
      privateKey: privateKeyHex,
      publicKey: storage.publicKey
    };
  } catch (error) {
    console.error('❌ Failed to retrieve stored private key:', error);
    if (error instanceof Error && error.message.includes('Legacy key')) {
      throw error; // Re-throw legacy key errors for user notification
    }
    throw new Error('Invalid password or corrupted key data');
  }
}

/**
 * Gets the session private key (decrypted and stored in memory)
 * Used for signing operations during an active session
 */
export function getSessionPrivateKey(): string | null {
  console.log('🔑 getSessionPrivateKey called, sessionPrivateKey is:', sessionPrivateKey ? 'SET' : 'NULL');
  return sessionPrivateKey;
}

/**
 * Clears the session private key from memory
 */
export function clearSessionPrivateKey(): void {
  sessionPrivateKey = null;
}

/**
 * Checks if a stored private key exists (without decrypting)
 */
export function hasStoredPrivateKey(): boolean {
  const stored = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
  if (!stored) return false;
  
  try {
    const storage: PrivateKeyStorage = JSON.parse(stored);
    return !!(storage.privateKey && storage.publicKey && storage.salt && storage.iv);
  } catch {
    return false;
  }
}

/**
 * Removes stored private key
 */
export function clearStoredPrivateKey(): void {
  localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
  clearSessionPrivateKey();
}

/**
 * Signs an event using stored private key
 */
export async function signEventWithPrivateKey(event: UnsignedEvent, privateKeyHex: string): Promise<Event> {
  try {
    const pubkey = privateKeyToPublicKey(privateKeyHex);
    const eventToSign: UnsignedEvent = {
      ...event,
      pubkey,
    };

    // Convert hex string to Uint8Array for finalizeEvent
    const privateKeyBytes = new Uint8Array(privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return finalizeEvent(eventToSign, privateKeyBytes);
  } catch (error) {
    throw new Error('Failed to sign event with private key: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Checks if Nostr extension is available
 */
export function isNostrAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

/**
 * Gets the user's public key from Nostr extension
 */
export async function getPublicKey(): Promise<string> {
  if (!isNostrAvailable()) {
    throw new Error('Nostr extension not found. Please install Alby, nos2x, or another Nostr extension.');
  }

  try {
    return await window.nostr!.getPublicKey();
  } catch {
    throw new Error('Failed to get public key. Please check your Nostr extension.');
  }
}

/**
 * Signs a Nostr event using the specified signing method
 * This ensures we don't mix up extension and nsec users
 */
export async function signEventWithMethod(event: UnsignedEvent, method: 'extension' | 'nsec'): Promise<Event> {
  if (method === 'extension') {
    // Use extension signing
    if (!isNostrAvailable()) {
      throw new Error('Nostr extension not available but extension method requested');
    }
    
    try {
      const pubkey = await getPublicKey();
      const eventToSign: UnsignedEvent = {
        ...event,
        pubkey,
      };

      return await window.nostr!.signEvent(eventToSign);
    } catch (error) {
      throw new Error('Extension signing failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  } else if (method === 'nsec') {
    // Use private key signing
    const sessionKey = getSessionPrivateKey();
    if (!sessionKey) {
      throw new Error('No private key available in session - please unlock first');
    }
    
    return await signEventWithPrivateKey(event, sessionKey);
  } else {
    throw new Error('Invalid signing method specified');
  }
}

/**
 * Signs a Nostr event - supports both extension and private key signing
 * @deprecated Use signEventWithMethod instead to avoid mixing up users
 */
export async function signEvent(event: UnsignedEvent): Promise<Event> {
  // Try to use Nostr extension first
  if (isNostrAvailable()) {
    try {
      const pubkey = await getPublicKey();
      const eventToSign: UnsignedEvent = {
        ...event,
        pubkey,
      };

      return await window.nostr!.signEvent(eventToSign);
    } catch (error) {
      console.warn('Extension signing failed, falling back to private key:', error);
    }
  }

  // Fall back to private key signing
  const sessionKey = getSessionPrivateKey();
  if (sessionKey) {
    return await signEventWithPrivateKey(event, sessionKey);
  }

  throw new Error('No signing method available. Please connect with Nostr extension or enter your private key.');
}

// Cache for Blossom auth events to avoid creating duplicate events for the same operation
interface CachedAuthEvent {
  event: BlossomAuthEvent;
  expires: number; // Unix timestamp
}

const authEventCache = new Map<string, CachedAuthEvent>();

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of authEventCache.entries()) {
    if (now >= cached.expires) {
      authEventCache.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Gets a cached auth event if available and not expired
 */
function getCachedAuthEvent(action: string, method: string, sha256?: string): BlossomAuthEvent | null {
  const cacheKey = `${action}:${method}:${sha256 || 'none'}`;
  const cached = authEventCache.get(cacheKey);
  
  if (cached && Date.now() < cached.expires) {
    return cached.event;
  }
  
  // Remove expired entry
  if (cached) {
    authEventCache.delete(cacheKey);
  }
  
  return null;
}

/**
 * Caches an auth event with expiration
 */
function cacheAuthEvent(action: string, method: string, event: BlossomAuthEvent, sha256?: string): void {
  const cacheKey = `${action}:${method}:${sha256 || 'none'}`;
  // Cache until 30 seconds before the event's actual expiration to ensure validity
  const expirationTag = event.tags.find(tag => tag[0] === 'expiration');
  const eventExpires = expirationTag ? parseInt(expirationTag[1]) * 1000 : Date.now() + 270000; // 4.5 minutes default
  const cacheExpires = eventExpires - 30000; // 30 seconds buffer
  
  authEventCache.set(cacheKey, {
    event,
    expires: cacheExpires
  });
}

/**
 * Creates a Blossom authentication event following BUD-02 specification
 * Implements caching to avoid creating duplicate events for the same operation
 */
export async function createBlossomAuthEvent(
  action: 'upload' | 'list' | 'delete',
  method: 'extension' | 'nsec',
  sha256?: string,
  content?: string
): Promise<BlossomAuthEvent> {
  // Check cache first
  const cachedEvent = getCachedAuthEvent(action, method, sha256);
  if (cachedEvent) {
    return cachedEvent;
  }

  const now = Math.floor(Date.now() / 1000);
  const expirationTime = now + 300; // 5 minutes

  const tags: string[][] = [
    ['t', action],
    ['expiration', expirationTime.toString()],
  ];

  // Add sha256 hash for upload and delete operations
  if (sha256 && (action === 'upload' || action === 'delete')) {
    tags.push(['x', sha256]);
  }

  const unsignedEvent: UnsignedEvent = {
    kind: 24242,
    content: content || `${action.charAt(0).toUpperCase() + action.slice(1)} request`,
    tags,
    created_at: now,
  };

  const signedEvent = await signEventWithMethod(unsignedEvent, method);
  const authEvent = signedEvent as BlossomAuthEvent;
  
  // Cache the event for reuse
  cacheAuthEvent(action, method, authEvent, sha256);
  
  return authEvent;
}

/**
 * Encodes event as base64 for Blossom authorization header
 */
export function encodeAuthEvent(event: BlossomAuthEvent): string {
  return btoa(JSON.stringify(event));
}

/**
 * Default relays for fetching user profiles
 */
const DEFAULT_PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nos.lol',
  'wss://nostr.oxtr.dev',
];

/**
 * Gets user profile information from Nostr relays (NIP-01 kind 0 events)
 */
export async function getUserProfile(pubkey: string): Promise<{
  displayName?: string;
  about?: string;
  picture?: string;
  nip05?: string;
}> {
  try {
    // Query for kind 0 (user metadata) events for this pubkey
    const filter: Filter = {
      kinds: [0],
      authors: [pubkey],
      limit: 1, // We only need the latest profile event
    };

    const events = await queryRelays(DEFAULT_PROFILE_RELAYS, filter, 5000);
    
    if (events.length === 0) {
      // No profile found, return basic info
      return {
        displayName: `User ${pubkey.slice(0, 8)}...`,
      };
    }

    // Get the most recent event (events are returned sorted by created_at)
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    
    try {
      // Parse the JSON content
      const profileData = JSON.parse(latestEvent.content);
      
      return {
        displayName: profileData.name || profileData.display_name,
        about: profileData.about,
        picture: profileData.picture,
        nip05: profileData.nip05,
      };
    } catch (parseError) {
      console.warn('Failed to parse profile JSON:', parseError);
      return {
        displayName: `User ${pubkey.slice(0, 8)}...`,
      };
    }
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    // Fallback to basic display name
    return {
      displayName: `User ${pubkey.slice(0, 8)}...`,
    };
  }
}

/**
 * Validates a public key format
 */
export function isValidPubkey(pubkey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Shortens a public key for display
 */
export function shortenPubkey(pubkey: string): string {
  if (!isValidPubkey(pubkey)) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}

/**
 * Query events from multiple Nostr relays
 */
export async function queryRelays(
  relayUrls: string[],
  filter: Filter,
  timeout = 10000
): Promise<Event[]> {
  const pool = new SimplePool();
  
  try {
    const events = await pool.querySync(relayUrls, filter, { maxWait: timeout });
    return events;
  } catch (error) {
    console.error('Failed to query relays:', error);
    throw error;
  } finally {
    pool.close(relayUrls);
  }
}

/**
 * Publish an event to multiple Nostr relays
 */
export async function publishToRelays(
  relayUrls: string[],
  event: Event,
  _timeout = 10000
): Promise<void> {
  console.log(`📡 publishToRelays: Publishing event kind ${event.kind} to ${relayUrls.length} relays:`, relayUrls);
  
  const pool = new SimplePool();
  
  try {
    const promises = pool.publish(relayUrls, event);
    
    // Wait for all promises to settle so we can see individual results
    const results = await Promise.allSettled(promises);
    
    let successCount = 0;
    let failureCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        console.log(`✅ Published to ${relayUrls[index]}: Success`);
      } else {
        failureCount++;
        console.error(`❌ Failed to publish to ${relayUrls[index]}:`, result.reason);
      }
    });
    
    console.log(`📊 Publish results: ${successCount} success, ${failureCount} failed out of ${relayUrls.length} relays`);
    
    if (successCount === 0) {
      throw new Error('Failed to publish to any relays');
    }
  } catch (error) {
    console.error('Failed to publish to relays:', error);
    throw error;
  } finally {
    pool.close(relayUrls);
  }
}

/**
 * Default relays for fetching relay lists and server lists
 */
const DEFAULT_DISCOVERY_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nos.lol',
  'wss://nostr.oxtr.dev',
];

// Cache for user relay lists - expires after 5 minutes
const relayListCache = new Map<string, { data: UserRelayList | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the relay list cache for a specific user or all users
 */
export function clearRelayListCache(pubkey?: string): void {
  if (pubkey) {
    relayListCache.delete(pubkey);
    console.log(`🗑️ Cleared relay list cache for ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
  } else {
    relayListCache.clear();
    console.log('🗑️ Cleared all relay list cache');
  }
}

/**
 * Gets user's relay list from Nostr relays (NIP-65 kind 10002 events)
 * Cached for 5 minutes to avoid excessive relay queries
 */
export async function getUserRelayList(pubkey: string, forceRefresh = false): Promise<UserRelayList | null> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = relayListCache.get(pubkey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`💾 getUserRelayList: Using cached relay list for ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
      return cached.data;
    }
  }

  console.log(`🔍 getUserRelayList: ${forceRefresh ? 'Force refreshing' : 'Fetching'} relay list for pubkey ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
  console.log(`📡 Using discovery relays:`, DEFAULT_DISCOVERY_RELAYS);
  
  try {
    // Query for kind 10002 events (NIP-65 relay lists)
    const filter: Filter = {
      kinds: [10002],
      authors: [pubkey],
      limit: 1,
    };

    console.log(`🔎 Querying with filter:`, filter);
    const events = await queryRelays(DEFAULT_DISCOVERY_RELAYS, filter, 5000);
    console.log(`📦 Query returned ${events.length} events for relay list`);
    
    if (events.length === 0) {
      console.log(`❌ No relay list found for user ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
      return null;
    }

    // Get the most recent event
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    console.log(`✅ Found relay list event created at:`, new Date(latestEvent.created_at * 1000));
    
    const relayList = parseRelayListEvent(latestEvent as RelayListEvent);
    console.log(`📊 Parsed relay list with ${Object.keys(relayList.relays).length} relays:`, Object.keys(relayList.relays));
    
    // Cache the result
    relayListCache.set(pubkey, { data: relayList, timestamp: Date.now() });
    
    return relayList;
  } catch (error) {
    console.error('❌ Failed to fetch user relay list:', error);
    
    // Cache null result to avoid repeated failures
    relayListCache.set(pubkey, { data: null, timestamp: Date.now() });
    
    return null;
  }
}

/**
 * Parse a kind 10002 event into a UserRelayList
 */
export function parseRelayListEvent(event: RelayListEvent): UserRelayList {
  const relays: Record<string, RelayMetadata> = {};
  
  event.tags.forEach((tag: string[]) => {
    if (tag[0] === 'r' && tag[1]) {
      const relayUrl = tag[1];
      const metadata: RelayMetadata = {};
      
      // Check for read/write markers (tag[2])
      if (tag[2]) {
        if (tag[2] === 'read') {
          metadata.read = true;
        } else if (tag[2] === 'write') {
          metadata.write = true;
        }
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
    event,
  };
}

/**
 * Create a kind 10002 event for user's relay list
 */
export async function createRelayListEvent(
  relays: Record<string, RelayMetadata>,
  pubkey: string
): Promise<UnsignedEvent> {
  const tags: string[][] = [];
  
  Object.entries(relays).forEach(([relayUrl, metadata]) => {
    if (metadata.read && metadata.write) {
      // Both read and write, no marker needed
      tags.push(['r', relayUrl]);
    } else if (metadata.read) {
      tags.push(['r', relayUrl, 'read']);
    } else if (metadata.write) {
      tags.push(['r', relayUrl, 'write']);
    }
  });

  return {
    kind: 10002,
    content: '',
    tags,
    created_at: Math.floor(Date.now() / 1000),
    pubkey,
  };
}
