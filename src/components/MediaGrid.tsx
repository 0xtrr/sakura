import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMediaCache } from '../hooks/useMediaCache';
import { EnhancedBlossomAPI } from '../services/blossom';
import type { UserServerList } from '../types';
import { formatFileSize, isImage, isVideo } from '../utils/fileUtils';
import { copyToClipboard } from '../utils/clipboard';
import { ServerAvailabilityIndicator } from './ServerAvailabilityIndicator';
import { BlobMirrorDialog } from './BlobMirrorDialog';

type SortOption = 'newest' | 'oldest' | 'largest' | 'smallest' | 'name';
type FilterOption = 'all' | 'images' | 'videos' | 'other';

interface MediaGridProps {
  userServerList: UserServerList | null;
}

export function MediaGrid({ userServerList }: MediaGridProps) {
  const { getSigningMethod } = useAuth();
  const { media, loading, error, isStale, isDataStale, fetchMedia, removeMedia } = useMediaCache();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [mirrorDialogOpen, setMirrorDialogOpen] = useState(false);
  const [selectedBlobUrl, setSelectedBlobUrl] = useState<string | null>(null);
  const [refreshingAfterMirror, setRefreshingAfterMirror] = useState(false);

  // Check if current data is stale for this server list
  const dataIsStale = isStale || isDataStale(userServerList);

  // Memoized sorted and filtered media
  const filteredAndSortedMedia = useMemo(() => {
    // First filter out any null/invalid items
    let filtered = media.filter(item => item && item.type && item.sha256);

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.metadata?.filename || item.sha256).toLowerCase().includes(search) ||
        item.type.toLowerCase().includes(search)
      );
    }

    // Apply file type filter
    switch (filterBy) {
      case 'images':
        filtered = filtered.filter(item => isImage(item.type));
        break;
      case 'videos':
        filtered = filtered.filter(item => isVideo(item.type));
        break;
      case 'other':
        filtered = filtered.filter(item => !isImage(item.type) && !isVideo(item.type));
        break;
      // 'all' - no additional filtering
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.uploaded - a.uploaded;
        case 'oldest':
          return a.uploaded - b.uploaded;
        case 'largest':
          return b.size - a.size;
        case 'smallest':
          return a.size - b.size;
        case 'name': {
          const nameA = (a.metadata?.filename || a.sha256.slice(0, 8)).toLowerCase();
          const nameB = (b.metadata?.filename || b.sha256.slice(0, 8)).toLowerCase();
          return nameA.localeCompare(nameB);
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [media, sortBy, filterBy, searchTerm]);

  // Load media on mount and when server list changes
  useEffect(() => {
    console.log('📡 MediaGrid useEffect triggered - userServerList servers:', userServerList?.servers.length, 'fetchMedia ref changed');
    fetchMedia(userServerList);
  }, [userServerList, fetchMedia]);

  const loadMedia = useCallback(async () => {
    await fetchMedia(userServerList, true); // Force refresh
  }, [userServerList, fetchMedia]);

  const deleteMedia = useCallback(async (sha256: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      alert('No signing method available. Please login again.');
      return;
    }

    // Find the item before removing it (for potential rollback)
    const itemToDelete = media.find(item => item.sha256 === sha256);
    if (!itemToDelete) return;

    try {
      // Optimistically remove from cache first for immediate feedback
      removeMedia(sha256);
      
      // Use enhanced API with fallback if user has server list
      if (userServerList && userServerList.servers.length > 0) {
        const primaryServer = {
          url: userServerList.servers[0],
          name: new URL(userServerList.servers[0]).hostname,
          description: 'User server'
        };
        const enhancedAPI = new EnhancedBlossomAPI(primaryServer, userServerList);
        await enhancedAPI.deleteBlobWithFallback(sha256, signingMethod);
      } else {
        // No user servers configured - this should not happen due to onboarding
        throw new Error('No Blossom servers configured. Cannot delete file.');
      }
      
      console.log(`Successfully deleted file with SHA256: ${sha256}`);
    } catch (err) {
      console.error('Delete failed:', err);
      // Refresh cache to restore correct state
      await loadMedia();
      alert('Failed to delete file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [userServerList, getSigningMethod, media, removeMedia, loadMedia]);

  const copyUrl = useCallback(async (url: string) => {
    try {
      const success = await copyToClipboard(url);
      
      if (success) {
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000); // Clear feedback after 2 seconds
      } else {
        console.error('Failed to copy URL to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  }, []);

  const openMirrorDialog = useCallback((blobUrl: string) => {
    setSelectedBlobUrl(blobUrl);
    setMirrorDialogOpen(true);
  }, []);

  const closeMirrorDialog = useCallback(() => {
    setMirrorDialogOpen(false);
    setSelectedBlobUrl(null);
  }, []);

  const handleMirrorSuccess = useCallback(async () => {
    // Refresh media data to show updated server availability
    setRefreshingAfterMirror(true);
    try {
      await fetchMedia(userServerList);
    } finally {
      setRefreshingAfterMirror(false);
    }
  }, [fetchMedia, userServerList]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your media...</p>
          {userServerList && userServerList.servers.length > 1 && (
            <p className="text-sm text-gray-500 mt-2">
              Fetching from {userServerList.servers.length} servers
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button onClick={loadMedia} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">My Media</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              {/* Show which servers are being used */}
              {userServerList && userServerList.servers.length > 0 && (
                <div className="text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-lg">
                  <div className="font-medium">Fetching from</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(() => {
                      const firstThree = userServerList.servers.slice(0, 3);
                      const remaining = userServerList.servers.length - 3;
                      const serverNames = firstThree.map(url => new URL(url).hostname);
                      
                      if (remaining > 0) {
                        return `${serverNames.join(', ')} and ${remaining} more server${remaining === 1 ? '' : 's'}`;
                      } else {
                        return serverNames.join(', ');
                      }
                    })()}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button 
                  onClick={loadMedia} 
                  className={`flex-1 sm:flex-none text-xs sm:text-sm transition-colors ${
                    dataIsStale 
                      ? 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 px-3 py-2 rounded-lg'
                      : 'btn-secondary'
                  }`}
                  title={dataIsStale ? 'Data may be outdated - click to refresh' : 'Refresh media list'}
                >
                  {dataIsStale ? (
                    <>
                      <svg className="w-3 h-3 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Update Available
                    </>
                  ) : (
                    'Refresh'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Search, Sort, and Filter Controls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  id="search"
                  type="text"
                  placeholder="Search by filename or file type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                />
              </div>
              
              {/* Sort */}
              <div>
                <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort by
                </label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="largest">Largest files</option>
                  <option value="smallest">Smallest files</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
              
              {/* Filter */}
              <div>
                <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter
                </label>
                <select
                  id="filter"
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                >
                  <option value="all">All files</option>
                  <option value="images">Images only</option>
                  <option value="videos">Videos only</option>
                  <option value="other">Other files</option>
                </select>
              </div>
            </div>
            
            {/* Results count and server summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-sm text-gray-600">
                Showing {filteredAndSortedMedia.length} of {media.length} files
              </div>
              {userServerList && userServerList.servers.length > 1 && media.length > 0 && (
                <div className="text-sm text-gray-500">
                  {(() => {
                    const totalFiles = media.length;
                    const filesWithMultipleServers = media.filter(item => 
                      item.availableServers && item.availableServers.filter(s => s.success).length > 1
                    ).length;
                    const redundancyPercentage = totalFiles > 0 ? Math.round((filesWithMultipleServers / totalFiles) * 100) : 0;
                    
                    return `${redundancyPercentage}% of files have multi-server redundancy`;
                  })()}
                </div>
              )}
            </div>
          </div>

      {media.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No media files</h3>
          <p className="mt-2 text-gray-500">
            Upload your first file to get started with decentralized media storage.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredAndSortedMedia.map((item) => (
            <div key={item.sha256} className="card group">
              <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden relative">
                {isImage(item.type) ? (
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : isVideo(item.type) ? (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                )}
                
                {/* Desktop hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 items-center justify-center opacity-0 group-hover:opacity-100 hidden sm:flex">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyUrl(item.url)}
                      className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Copy URL"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Open in new tab"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                    {userServerList && userServerList.servers.length > 1 && (
                      <button
                        onClick={() => openMirrorDialog(item.url)}
                        className="p-2 bg-blue-500 rounded-lg text-white hover:bg-blue-600 transition-colors"
                        title="Mirror to other servers"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => deleteMedia(item.sha256)}
                      className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {item.metadata?.filename || item.sha256.slice(0, 8)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(item.size)} • {item.type}
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  {new Date(item.uploaded * 1000).toLocaleDateString()}
                </div>
                
                {/* Server availability indicators */}
                {item.availableServers && item.availableServers.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Available on:</div>
                    <ServerAvailabilityIndicator availableServers={item.availableServers} />
                  </div>
                )}
                
                {/* Mobile-friendly action buttons */}
                <div className="flex flex-wrap gap-2 sm:hidden">
                  <button
                    onClick={() => copyUrl(item.url)}
                    className={`flex-1 flex items-center justify-center px-3 py-2 text-xs rounded-lg transition-colors border ${
                      copiedUrl === item.url
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100'
                    }`}
                  >
                    {copiedUrl === item.url ? (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy URL
                      </>
                    )}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center px-3 py-2 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Open
                  </a>
                  {userServerList && userServerList.servers.length > 1 && (
                    <button
                      onClick={() => openMirrorDialog(item.url)}
                      className="flex items-center justify-center px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                        />
                      </svg>
                      Mirror
                    </button>
                  )}
                  <button
                    onClick={() => deleteMedia(item.sha256)}
                    className="flex items-center justify-center px-3 py-2 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refreshing After Mirror Indicator */}
      {refreshingAfterMirror && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-40">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Updating server availability...
        </div>
      )}

      {/* Mirror Dialog */}
      {selectedBlobUrl && (
        <BlobMirrorDialog
          isOpen={mirrorDialogOpen}
          onClose={closeMirrorDialog}
          blobUrl={selectedBlobUrl}
          userServerList={userServerList}
          onMirrorSuccess={handleMirrorSuccess}
        />
      )}
    </div>
  );
}
