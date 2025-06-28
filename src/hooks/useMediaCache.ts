import { useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './useAuth';
import { EnhancedBlossomAPI } from '../services/blossom';
import type { BlossomBlob, UserServerList } from '../types';

interface MediaCacheState {
  media: BlossomBlob[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  isStale: boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useMediaCache() {
  const { user, getSigningMethod } = useAuth();
  const [state, setState] = useState<MediaCacheState>({
    media: [],
    loading: false,
    error: null,
    lastFetched: null,
    isStale: false
  });
  
  // Keep track of current server list to detect changes
  const lastServerListRef = useRef<string | null>(null);
  const lastFetchedRef = useRef<number | null>(null);

  // Update ref when state changes
  lastFetchedRef.current = state.lastFetched;

  const isDataStale = useCallback((userServerList: UserServerList | null): boolean => {
    if (!lastFetchedRef.current) return true;
    
    // Check if cache has expired
    if (Date.now() - lastFetchedRef.current > CACHE_DURATION) return true;
    
    // Check if server list has changed (create copy to avoid mutating original order)
    const currentServerListKey = userServerList ? JSON.stringify([...userServerList.servers].sort()) : null;
    if (lastServerListRef.current !== currentServerListKey) {
      lastServerListRef.current = currentServerListKey;
      return true;
    }
    
    return false;
  }, []); // No dependencies to prevent recreation

  const fetchMedia = useCallback(async (userServerList: UserServerList | null, force = false) => {
    if (!user) return;

    console.log('🔍 fetchMedia called - force:', force, 'isStale:', isDataStale(userServerList), 'userServerList servers:', userServerList?.servers.length);

    // Don't fetch if data is fresh and not forced
    if (!force && !isDataStale(userServerList)) {
      console.log('⏭️ fetchMedia: Data is fresh, returning cached media');
      return state.media;
    }

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      setState(prev => ({ 
        ...prev, 
        error: 'No signing method available. Please login again.',
        loading: false 
      }));
      return [];
    }

    console.log('🚀 fetchMedia: Starting blob fetch from servers');
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let blobs: BlossomBlob[];
      
      if (userServerList && userServerList.servers.length > 0) {
        // Use enhanced API to fetch from ALL user servers
        const primaryServer = {
          url: userServerList.servers[0],
          name: new URL(userServerList.servers[0]).hostname,
          description: 'User server'
        };
        const enhancedAPI = new EnhancedBlossomAPI(primaryServer, userServerList);
        blobs = await enhancedAPI.listBlobsFromAllServers(user.pubkey, signingMethod);
      } else {
        // No user servers configured
        throw new Error('No Blossom servers configured. Please configure your servers in Settings first.');
      }
      
      console.log('✅ fetchMedia: Successfully fetched', blobs.length, 'blobs');
      
      // Debug: Check for invalid blobs
      const invalidBlobs = blobs.filter(blob => !blob || !blob.type || !blob.sha256);
      if (invalidBlobs.length > 0) {
        console.warn('⚠️ Found', invalidBlobs.length, 'invalid blobs:', invalidBlobs);
      }
      
      setState({
        media: blobs,
        loading: false,
        error: null,
        lastFetched: Date.now(),
        isStale: false
      });
      
      return blobs;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load media';
      console.error('❌ fetchMedia: Error:', errorMessage);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      return [];
    }
  }, [user, getSigningMethod, isDataStale]);

  const addMedia = useCallback((newBlob: BlossomBlob) => {
    setState(prev => ({
      ...prev,
      media: [newBlob, ...prev.media], // Add to beginning (newest first)
      lastFetched: Date.now() // Update cache timestamp
    }));
  }, []);

  const removeMedia = useCallback((sha256: string) => {
    setState(prev => ({
      ...prev,
      media: prev.media.filter(item => item.sha256 !== sha256),
      lastFetched: Date.now() // Update cache timestamp
    }));
  }, []);

  const markStale = useCallback(() => {
    setState(prev => ({ ...prev, isStale: true }));
  }, []);

  const clearCache = useCallback(() => {
    setState({
      media: [],
      loading: false,
      error: null,
      lastFetched: null,
      isStale: false
    });
    lastServerListRef.current = null;
  }, []);

  return useMemo(() => ({
    media: state.media,
    loading: state.loading,
    error: state.error,
    lastFetched: state.lastFetched,
    isStale: state.isStale,
    isDataStale,
    fetchMedia,
    addMedia,
    removeMedia,
    markStale,
    clearCache
  }), [
    state.media,
    state.loading,
    state.error,
    state.lastFetched,
    state.isStale,
    isDataStale,
    fetchMedia,
    addMedia,
    removeMedia,
    markStale,
    clearCache
  ]);
}