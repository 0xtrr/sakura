import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { EnhancedBlossomAPI } from '../services/blossom';
import type { UserServerList } from '../types';
import { extractSha256FromUrl } from '../utils/serverList';

interface BlobMirrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  blobUrl: string;
  userServerList: UserServerList | null;
  onMirrorSuccess?: () => void; // Callback to refresh media data
}

interface ServerAvailability {
  available: string[];
  unavailable: string[];
  errors: Array<{ serverUrl: string; error: Error }>;
}

export function BlobMirrorDialog({ isOpen, onClose, blobUrl, userServerList, onMirrorSuccess }: BlobMirrorDialogProps) {
  const { getSigningMethod } = useAuth();
  const [availability, setAvailability] = useState<ServerAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [mirroring, setMirroring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mirrorResults, setMirrorResults] = useState<{
    successful: Array<{ serverUrl: string }>;
    failed: Array<{ serverUrl: string; error: Error }>;
  } | null>(null);

  const blobHash = extractSha256FromUrl(blobUrl);
  const sourceServerUrl = new URL(blobUrl).origin;

  // Check blob availability across servers when dialog opens
  useEffect(() => {
    if (isOpen && userServerList && blobHash) {
      checkBlobAvailability();
    }
  }, [isOpen, userServerList, blobHash]);

  const checkBlobAvailability = async () => {
    if (!userServerList || !blobHash) return;

    setLoading(true);
    setError(null);

    try {
      const api = new EnhancedBlossomAPI(
        { url: userServerList.servers[0], name: 'primary' },
        userServerList
      );
      
      const result = await api.checkBlobAvailability(blobHash);
      setAvailability(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check blob availability');
    } finally {
      setLoading(false);
    }
  };

  const mirrorToAllServers = async () => {
    if (!userServerList || !blobHash) return;

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      setError('No signing method available. Please login again.');
      return;
    }

    setMirroring(true);
    setError(null);
    setMirrorResults(null);

    try {
      const api = new EnhancedBlossomAPI(
        { url: userServerList.servers[0], name: 'primary' },
        userServerList
      );
      
      const result = await api.mirrorBlobToAllServers(blobUrl, signingMethod);
      setMirrorResults(result);
      
      // Refresh availability after mirroring
      await checkBlobAvailability();
      
      // Notify parent component to refresh media data
      if (onMirrorSuccess && result.successful.length > 0) {
        onMirrorSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mirror blob');
    } finally {
      setMirroring(false);
    }
  };

  const mirrorToSpecificServer = async (targetServerUrl: string) => {
    if (!blobHash) return;

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      setError('No signing method available. Please login again.');
      return;
    }

    setMirroring(true);
    setError(null);

    try {
      const api = new EnhancedBlossomAPI(
        { url: targetServerUrl, name: 'target' }
      );
      
      await api.mirrorBlobBetweenServers(blobUrl, targetServerUrl, signingMethod);
      
      // Refresh availability after mirroring
      await checkBlobAvailability();
      
      // Notify parent component to refresh media data
      if (onMirrorSuccess) {
        onMirrorSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mirror blob');
    } finally {
      setMirroring(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Mirror Blob to Servers</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Blob Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Blob Hash:</strong> <code className="text-xs bg-gray-200 px-1 rounded">{blobHash}</code>
            </p>
            <p className="text-sm text-gray-600">
              <strong>Source Server:</strong> {sourceServerUrl}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Mirror Results */}
          {mirrorResults && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">Mirror Results</h3>
              <p className="text-green-700 text-sm">
                Successfully mirrored to {mirrorResults.successful.length} servers
                {mirrorResults.failed.length > 0 && `, ${mirrorResults.failed.length} failed`}
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="mb-4 flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Checking server availability...</span>
            </div>
          )}

          {/* Server Availability */}
          {availability && !loading && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3">Server Availability</h3>
              
              {/* Servers with blob */}
              {availability.available.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-green-700 mb-2">
                    ✅ Has Blob ({availability.available.length})
                  </h4>
                  <div className="space-y-1">
                    {availability.available.map((serverUrl) => (
                      <div key={serverUrl} className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                        {new URL(serverUrl).hostname}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Servers without blob */}
              {availability.unavailable.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-orange-700 mb-2">
                    ❌ Missing Blob ({availability.unavailable.length})
                  </h4>
                  <div className="space-y-2">
                    {availability.unavailable.map((serverUrl) => (
                      <div key={serverUrl} className="flex items-center justify-between text-sm bg-orange-50 px-2 py-1 rounded">
                        <span className="text-orange-600">{new URL(serverUrl).hostname}</span>
                        <button
                          onClick={() => mirrorToSpecificServer(serverUrl)}
                          disabled={mirroring}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                          {mirroring ? 'Mirroring...' : 'Mirror'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Servers with errors */}
              {availability.errors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-red-700 mb-2">
                    ⚠️ Connection Errors ({availability.errors.length})
                  </h4>
                  <div className="space-y-1">
                    {availability.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">
                        {new URL(error.serverUrl).hostname}: {error.error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {availability && availability.unavailable.length > 0 && (
              <button
                onClick={mirrorToAllServers}
                disabled={mirroring || loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {mirroring ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Mirroring...
                  </span>
                ) : (
                  `Mirror to All Missing Servers (${availability.unavailable.length})`
                )}
              </button>
            )}
            
            <button
              onClick={checkBlobAvailability}
              disabled={loading || mirroring}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
            >
              Refresh
            </button>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}