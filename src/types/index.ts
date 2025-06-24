// Global window extensions for Nostr
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: UnsignedEvent): Promise<Event>;
      getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}

// Nostr Event types
export interface UnsignedEvent {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  pubkey?: string;
}

export interface Event extends UnsignedEvent {
  id: string;
  pubkey: string;
  sig: string;
}

// Blossom types
export interface BlossomServer {
  url: string;
  name: string;
  description?: string;
  pubkey?: string;
}

export interface BlossomBlob {
  sha256: string;
  size: number;
  type: string;
  url: string;
  uploaded: number; // Unix timestamp in seconds (as per BUD-02 specification)
  metadata?: {
    filename?: string;
    alt?: string;
    description?: string;
  };
  // Server availability information
  availableServers?: Array<{
    serverUrl: string;
    serverName: string;
    success: boolean;
    error?: string;
  }>;
}

export interface BlossomUploadResponse {
  sha256: string;
  size: number;
  type: string;
  url: string;
  message?: string;
}

export interface BlossomAuthEvent extends Event {
  kind: 24242;
  content: string;
  tags: [string, string][];
}

// User types
export interface User {
  pubkey: string;
  displayName?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  loginMethod: 'extension' | 'nsec'; // Track how user logged in
}

// Profile interface - only NIP-01 fields get dedicated UI
export interface UserProfile {
  // NIP-01 basic fields (dedicated UI sections)
  name?: string;
  about?: string;
  picture?: string;
  
  // All other fields (NIP-24, custom, etc.) go here
  arbitraryFields?: Record<string, any>;
  
  // Metadata (not editable)
  pubkey: string;
  created_at: number;
  event?: Event;
}

// Media types
export interface MediaFile extends BlossomBlob {
  id: string;
  filename: string;
  originalName: string;
  isImage: boolean;
  isVideo: boolean;
  thumbnail?: string;
  exifRemoved: boolean;
  uploadedAt: Date;
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  loginWithPrivateKey: (nsec: string, password: string) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  needsPassword: boolean; // True when user needs to enter password to unlock stored key
  getSigningMethod: () => 'extension' | 'nsec' | null; // Method to get current signing method
  refreshUserProfile: () => Promise<void>; // Method to refresh user profile data
}

// BUD-03 User Server List types
export interface UserServerList {
  servers: string[]; // Array of server URLs in order of preference
  pubkey: string;
  created_at: number;
  updated_at?: number; // Optional field for local tracking
  event?: Event; // The original kind 10063 event
}

export interface ServerListEvent extends Event {
  kind: 10063;
  content: '';
  tags: [string, string][]; // [["server", "https://..."], ...]
}

// NIP-65 Relay List types
export interface RelayMetadata {
  read?: boolean;
  write?: boolean;
}

export interface UserRelayList {
  relays: Record<string, RelayMetadata>; // relay URL -> metadata
  pubkey: string;
  created_at: number;
  event: RelayListEvent;
}

export interface RelayListEvent extends Event {
  kind: 10002; // NIP-65 relay list
}

export {};
