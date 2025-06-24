import { useState } from 'react';
import { validateServerUrl } from '../utils/serverList';
import { POPULAR_SERVERS, getPricingBadge, normalizeUrl, type PopularServer } from '../constants/servers';

interface ServerOnboardingProps {
  onComplete: (servers: string[]) => void;
  onCancel?: () => void;
}

export function ServerOnboarding({ onComplete, onCancel }: ServerOnboardingProps) {
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [paidServerConfirm, setPaidServerConfirm] = useState<{ server: PopularServer; show: boolean } | null>(null);

  const addPopularServer = (url: string) => {
    // Normalize URLs for comparison to handle trailing slashes
    const normalizedUrl = normalizeUrl(url);
    const normalizedSelected = selectedServers.map(normalizeUrl);
    
    if (normalizedSelected.includes(normalizedUrl)) {
      setError('Server already selected.');
      return;
    }

    const server = POPULAR_SERVERS.find(s => s.url === url);
    
    // If it's a paid server, show confirmation dialog
    if (server && server.pricing === 'paid') {
      setPaidServerConfirm({ server, show: true });
      return;
    }
    
    setSelectedServers([...selectedServers, url]);
    setError(null);
  };

  const confirmAddPaidServer = () => {
    if (paidServerConfirm) {
      setSelectedServers([...selectedServers, paidServerConfirm.server.url]);
      setError(null);
      setPaidServerConfirm(null);
    }
  };

  const addCustomServer = () => {
    if (!customServerUrl.trim()) return;

    if (!validateServerUrl(customServerUrl)) {
      setError('Invalid server URL. Must be a valid HTTP/HTTPS URL.');
      return;
    }

    // Normalize URLs for comparison to handle trailing slashes
    const normalizedUrl = normalizeUrl(customServerUrl);
    const normalizedSelected = selectedServers.map(normalizeUrl);
    
    if (normalizedSelected.includes(normalizedUrl)) {
      setError('Server already selected.');
      return;
    }

    setSelectedServers([...selectedServers, customServerUrl]);
    setCustomServerUrl('');
    setError(null);
  };

  const removeServer = (url: string) => {
    setSelectedServers(selectedServers.filter(s => s !== url));
  };

  const moveServerUp = (index: number) => {
    if (index === 0) return;
    const newServers = [...selectedServers];
    [newServers[index - 1], newServers[index]] = [newServers[index], newServers[index - 1]];
    setSelectedServers(newServers);
  };

  const moveServerDown = (index: number) => {
    if (index === selectedServers.length - 1) return;
    const newServers = [...selectedServers];
    [newServers[index], newServers[index + 1]] = [newServers[index + 1], newServers[index]];
    setSelectedServers(newServers);
  };

  const handleComplete = () => {
    if (selectedServers.length === 0) {
      setError('Please select at least one server to continue.');
      return;
    }
    onComplete(selectedServers);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to Sakura! 🌸
          </h2>
          <p className="text-gray-600">
            To get started, you'll need to configure at least one Blossom server for media storage. 
            Your first server will be your primary server for uploads.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Selected Servers */}
        {selectedServers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Your Selected Servers ({selectedServers.length})
            </h3>
            <div className="space-y-2">
              {selectedServers.map((server, index) => (
                <div
                  key={server}
                  className="flex items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      {index === 0 && (
                        <span className="text-yellow-500 mr-2" title="Primary server">
                          ★
                        </span>
                      )}
                      <span className="font-medium text-gray-900">
                        {new URL(server).hostname}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 truncate" title={server}>
                      {server}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => moveServerUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => moveServerDown(index)}
                      disabled={index === selectedServers.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => removeServer(server)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Remove server"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popular Servers */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Popular Servers
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {POPULAR_SERVERS.map((server) => {
              const pricingBadge = getPricingBadge(server.pricing);
              const normalizedServerUrl = normalizeUrl(server.url);
              const normalizedSelected = selectedServers.map(normalizeUrl);
              const isSelected = normalizedSelected.includes(normalizedServerUrl);
              
              return (
                <div
                  key={server.url}
                  className={`p-3 rounded-lg border transition-all duration-300 ${
                    isSelected
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{server.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${pricingBadge.className}`}>
                          {pricingBadge.text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{server.description}</p>
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
                      disabled={isSelected}
                      className={`ml-3 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                        isSelected
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : server.pricing === 'paid'
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'bg-pink-600 text-white hover:bg-pink-700'
                      }`}
                    >
                      {isSelected ? 'Added' : server.pricing === 'paid' ? 'Add Paid' : 'Add'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Server Input */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Or Add a Custom Server
          </h3>
          <div className="flex gap-2">
            <input
              type="url"
              value={customServerUrl}
              onChange={(e) => setCustomServerUrl(e.target.value)}
              placeholder="https://blossom.example.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
              onKeyPress={(e) => e.key === 'Enter' && addCustomServer()}
            />
            <button
              onClick={addCustomServer}
              className="btn-primary text-sm"
            >
              Add
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Skip for Now
            </button>
          )}
          <button
            onClick={handleComplete}
            disabled={selectedServers.length === 0}
            className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue with {selectedServers.length} Server{selectedServers.length !== 1 ? 's' : ''}
          </button>
        </div>

        {/* Info Note */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Blossom Servers</p>
              <p>
                Blossom servers store your media files. You can change these settings later in the Settings page. 
                Your selection will be saved to the Nostr network so it syncs across devices and apps.
              </p>
            </div>
          </div>
        </div>

        {/* Paid Server Confirmation Modal */}
        {paidServerConfirm?.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
    </div>
  );
}
