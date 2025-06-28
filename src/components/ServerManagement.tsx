import { useState, useEffect } from 'react';
import type { UserServerList } from '../types';
import { serverListService } from '../services/serverList';
import { validateServerUrl } from '../utils/serverList';
import { useAuth } from '../hooks/useAuth';
import { POPULAR_SERVERS, getPricingBadge, type PopularServer } from '../constants/servers';

interface ServerManagementProps {
  userServerList: UserServerList | null;
  onServerListUpdate: (serverList: UserServerList) => void;
  onClose: () => void;
}


export function ServerManagement({
  userServerList,
  onServerListUpdate,
  onClose,
}: ServerManagementProps) {
  const { getSigningMethod } = useAuth();
  const [servers, setServers] = useState<string[]>(
    userServerList?.servers || []
  );

  // Debug log when servers change
  useEffect(() => {
    console.log('🔍 ServerManagement: servers state updated:', servers);
    console.log('🔍 ServerManagement: userServerList?.servers:', userServerList?.servers);
  }, [servers, userServerList]);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paidServerConfirm, setPaidServerConfirm] = useState<{ server: PopularServer; show: boolean } | null>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    // Store original body overflow
    const originalOverflow = document.body.style.overflow;
    
    // Disable background scrolling
    document.body.style.overflow = 'hidden';
    
    // Cleanup function to restore scrolling when modal closes
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const addServer = () => {
    if (!newServerUrl.trim()) return;

    if (!validateServerUrl(newServerUrl)) {
      setError('Invalid server URL. Must be a valid HTTP/HTTPS URL.');
      return;
    }

    if (servers.includes(newServerUrl)) {
      setError('Server already in list.');
      return;
    }

    setServers([...servers, newServerUrl]);
    setNewServerUrl('');
    setError(null);
  };

  const addPopularServer = (url: string) => {
    if (servers.includes(url)) {
      setError('Server already in list.');
      return;
    }

    const server = POPULAR_SERVERS.find(s => s.url === url);
    
    // If it's a paid server, show confirmation dialog
    if (server && server.pricing === 'paid') {
      setPaidServerConfirm({ server, show: true });
      return;
    }
    
    // For free and freemium servers, add directly but show info for freemium
    if (server && server.pricing === 'freemium') {
      setError(null);
      setSuccessMessage(`Added ${server.name}. Note: ${server.pricingDetails}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    setServers([...servers, url]);
    setError(null);
  };

  const confirmAddPaidServer = () => {
    if (paidServerConfirm) {
      setServers([...servers, paidServerConfirm.server.url]);
      setError(null);
      setPaidServerConfirm(null);
    }
  };

  const removeServer = (url: string) => {
    setServers(servers.filter(s => s !== url));
  };

  const moveServerUp = (index: number) => {
    if (index === 0) return;
    const newServers = [...servers];
    [newServers[index - 1], newServers[index]] = [newServers[index], newServers[index - 1]];
    setServers(newServers);
  };

  const moveServerDown = (index: number) => {
    if (index === servers.length - 1) return;
    const newServers = [...servers];
    [newServers[index], newServers[index + 1]] = [newServers[index + 1], newServers[index]];
    setServers(newServers);
  };

  const saveServerList = async () => {
    if (!userServerList) return;

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      setError('No signing method available. Please login again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔐 ServerManagement: Updating server list with signing method:', signingMethod);
      const updatedList = await serverListService.updateServerList(
        servers,
        userServerList.pubkey,
        signingMethod
      );
      onServerListUpdate(updatedList);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save server list');
    } finally {
      setLoading(false);
    }
  };

  // Handle modal backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent scroll event bubbling
  const handleModalScroll = (e: React.UIEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Manage Blossom Servers
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Configure your Blossom servers for parallel uploads.
            Your files will be uploaded to ALL servers simultaneously for maximum redundancy.
          </p>
        </div>

        <div 
          className="p-6 overflow-y-auto flex-1 min-h-0"
          onScroll={handleModalScroll}
        >
          {/* Your Servers section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Your Servers
              </label>
              {servers.length > 0 && (
                <span className="text-xs text-gray-500">
                  {servers.length} server{servers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {servers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>No servers configured</p>
                <p className="text-sm">Add servers below to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {servers.map((server, index) => {
                  const isFirst = index === 0;
                  const isLast = index === servers.length - 1;
                  return (
                    <div
                      key={server}
                      className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => moveServerUp(index)}
                          disabled={isFirst}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveServerDown(index)}
                          disabled={isLast}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            isFirst 
                              ? 'bg-pink-100 text-pink-800' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {isFirst ? 'Primary' : `#${index + 1}`}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate" title={server}>
                            {server}
                          </span>
                        </div>
                        {isFirst && (
                          <p className="text-xs text-gray-500 mt-1">
                            Primary server (used for single-server operations)
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => removeServer(server)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove server"
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Popular servers */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Popular Servers
            </label>
            <div className="grid grid-cols-1 gap-3">
              {POPULAR_SERVERS.map((server) => {
                const pricingBadge = getPricingBadge(server.pricing);
                const isAdded = servers.includes(server.url);
                
                return (
                  <div
                    key={server.url}
                    className={`p-3 rounded-lg border transition-colors ${
                      isAdded
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 text-sm">{server.name}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${pricingBadge.className}`}>
                            {pricingBadge.text}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">{server.description}</p>
                        <p className="text-xs text-gray-500 truncate" title={server.url}>
                          {server.url}
                        </p>
                        {server.pricingDetails && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                            <span className="font-medium">Pricing: </span>
                            {server.pricingDetails}
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => addPopularServer(server.url)}
                        disabled={isAdded}
                        className={`ml-3 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          isAdded
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : server.pricing === 'paid'
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'bg-pink-600 text-white hover:bg-pink-700'
                        }`}
                      >
                        {isAdded ? 'Added' : server.pricing === 'paid' ? 'Add Paid' : 'Add'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add custom server */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Custom Server
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
                placeholder="https://blossom.example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                onKeyPress={(e) => e.key === 'Enter' && addServer()}
              />
              <button
                onClick={addServer}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{successMessage}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          {/* Help text */}
          {servers.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Primary Server Upload (BUD-03)</p>
                  <p className="mt-1">
                    When uploading, files will be sent to your primary (first) server for fast, focused uploads. 
                    Downloads will try servers in order until success.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {servers.length > 0 ? (
                `Changes will be published to Nostr relays`
              ) : (
                'At least one server is required'
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveServerList}
                disabled={loading || servers.length === 0}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
                <span>{loading ? 'Publishing...' : 'Save & Publish'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Paid Server Confirmation Modal */}
      {paidServerConfirm?.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Add Paid Server
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-600">
                    You're about to add <strong>{paidServerConfirm.server.name}</strong>, which is a paid service.
                  </p>
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-800">
                      <strong>Pricing:</strong> {paidServerConfirm.server.pricingDetails}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Make sure you understand the costs before uploading files to this server.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPaidServerConfirm(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddPaidServer}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                I Understand, Add Server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
