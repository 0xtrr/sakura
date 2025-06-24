import { useState, useCallback } from 'react';
import { queryRelays, publishToRelays, signEventWithMethod } from '../utils/nostr';
import type { UnsignedEvent, UserProfile } from '../types';
import type { Filter } from 'nostr-tools';

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
        
        // NIP-01 fields (these get their own UI sections)
        const nip01Fields = new Set(['name', 'about', 'picture']);
        
        // Extract additional fields (everything else, including NIP-24 and custom fields)
        const additionalFields: Record<string, any> = {};
        Object.entries(profileData).forEach(([key, value]) => {
          if (!nip01Fields.has(key)) {
            additionalFields[key] = value;
          }
        });
        
        // Clean profile with only NIP-01 fields + additional fields
        const cleanedProfile: UserProfile = {
          // NIP-01 basic fields (only these get dedicated UI)
          name: profileData.name,
          about: profileData.about,
          picture: profileData.picture,
          
          // Everything else goes into additional fields
          arbitraryFields: Object.keys(additionalFields).length > 0 ? additionalFields : undefined,
          
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
      // Create profile content - NIP-01 fields + arbitrary fields
      const profileContent = {
        // NIP-01 basic fields
        ...(profileData.name && { name: profileData.name }),
        ...(profileData.about && { about: profileData.about }),
        ...(profileData.picture && { picture: profileData.picture }),
        
        // Include arbitrary fields (only non-empty values)
        ...(profileData.arbitraryFields && Object.fromEntries(
          Object.entries(profileData.arbitraryFields).filter(([, value]) => 
            value !== null && value !== undefined && value !== ''
          )
        )),
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