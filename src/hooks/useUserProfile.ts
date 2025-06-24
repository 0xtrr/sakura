import { useState, useCallback } from 'react';
import { queryRelays, publishToRelays, signEventWithMethod } from '../utils/nostr';
import type { Event, Filter, UnsignedEvent } from 'nostr-tools';

// NIP-01 + NIP-24 profile interface
export interface UserProfile {
  // NIP-01 basic fields
  name?: string;
  about?: string;
  picture?: string;
  
  // NIP-24 extra fields
  display_name?: string;
  website?: string;
  banner?: string;
  bot?: boolean;
  birthday?: {
    year?: number;
    month?: number;
    day?: number;
  };
  
  // Metadata
  pubkey: string;
  created_at: number;
  event?: Event;
}

// Default relays for fetching user profiles
const DEFAULT_PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nos.lol',
];

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (pubkey: string): Promise<UserProfile | null> => {
    setLoading(true);
    setError(null);

    try {
      // Query for kind 0 (user metadata) events for this pubkey
      const filter: Filter = {
        kinds: [0],
        authors: [pubkey],
        limit: 1, // We only need the latest profile event (replaceable)
      };

      console.log(`🔍 Fetching profile for pubkey: ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
      const events = await queryRelays(DEFAULT_PROFILE_RELAYS, filter, 5000);
      
      if (events.length === 0) {
        console.log(`❌ No profile found for user ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
        setProfile(null);
        return null;
      }

      // Get the most recent event (events are already sorted by created_at)
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      console.log(`✅ Found profile event created at:`, new Date(latestEvent.created_at * 1000));
      
      try {
        // Parse the JSON content according to NIP-01 and NIP-24
        const profileData = JSON.parse(latestEvent.content);
        
        // Clean up deprecated fields per NIP-24
        const cleanedProfile: UserProfile = {
          // NIP-01 basic fields
          name: profileData.name,
          about: profileData.about,
          picture: profileData.picture,
          
          // NIP-24 extra fields
          display_name: profileData.display_name || profileData.displayName, // Handle deprecated displayName
          website: profileData.website,
          banner: profileData.banner,
          bot: profileData.bot,
          birthday: profileData.birthday,
          
          // Metadata
          pubkey: latestEvent.pubkey,
          created_at: latestEvent.created_at,
          event: latestEvent,
        };

        // Filter out undefined values
        const filteredProfile = Object.fromEntries(
          Object.entries(cleanedProfile).filter(([, value]) => value !== undefined)
        ) as UserProfile;

        console.log(`📊 Parsed profile with fields:`, Object.keys(filteredProfile));
        setProfile(filteredProfile);
        return filteredProfile;
      } catch (parseError) {
        console.warn('Failed to parse profile JSON:', parseError);
        setError('Failed to parse profile data');
        
        // Return basic profile with just pubkey
        const basicProfile: UserProfile = {
          pubkey: latestEvent.pubkey,
          created_at: latestEvent.created_at,
          event: latestEvent,
        };
        
        setProfile(basicProfile);
        return basicProfile;
      }
    } catch (fetchError) {
      console.error('Failed to fetch user profile:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Failed to fetch profile';
      setError(errorMessage);
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveUserProfile = useCallback(async (
    profileData: Omit<UserProfile, 'pubkey' | 'created_at' | 'event'>,
    pubkey: string,
    signingMethod: 'extension' | 'nsec'
  ): Promise<UserProfile | null> => {
    setSaving(true);
    setError(null);

    try {
      // Create profile content according to NIP-01 and NIP-24
      const profileContent = {
        // NIP-01 basic fields
        ...(profileData.name && { name: profileData.name }),
        ...(profileData.about && { about: profileData.about }),
        ...(profileData.picture && { picture: profileData.picture }),
        
        // NIP-24 extra fields
        ...(profileData.display_name && { display_name: profileData.display_name }),
        ...(profileData.website && { website: profileData.website }),
        ...(profileData.banner && { banner: profileData.banner }),
        ...(profileData.bot !== undefined && { bot: profileData.bot }),
        ...(profileData.birthday && { birthday: profileData.birthday }),
      };

      // Create kind 0 event (user metadata)
      const unsignedEvent: UnsignedEvent = {
        kind: 0,
        content: JSON.stringify(profileContent),
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
        pubkey,
      };

      console.log(`📝 Creating profile event for pubkey: ${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
      console.log(`📄 Profile content:`, profileContent);

      // Sign the event
      const signedEvent = await signEventWithMethod(unsignedEvent, signingMethod);

      // Publish to relays
      await publishToRelays(DEFAULT_PROFILE_RELAYS, signedEvent, 10000);

      console.log(`✅ Profile published successfully`);

      // Update local state with new profile
      const newProfile: UserProfile = {
        ...profileData,
        pubkey,
        created_at: signedEvent.created_at,
        event: signedEvent,
      };

      setProfile(newProfile);
      return newProfile;
    } catch (saveError) {
      console.error('Failed to save user profile:', saveError);
      const errorMessage = saveError instanceof Error ? saveError.message : 'Failed to save profile';
      setError(errorMessage);
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const clearProfile = useCallback(() => {
    setProfile(null);
    setError(null);
  }, []);

  return {
    profile,
    loading,
    saving,
    error,
    fetchUserProfile,
    saveUserProfile,
    clearProfile,
  };
}