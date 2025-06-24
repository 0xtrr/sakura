import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ServerManagement } from './ServerManagement';
import { ServerHealthIndicator } from './ServerHealthIndicator';
import { RelayManagement } from './RelayManagement';
import { getUserRelayList } from '../utils/nostr';
import type { UserServerList, RelayMetadata } from '../types';

interface SettingsProps {
  userServerList?: UserServerList | null;
  onUserServerListChange?: (serverList: UserServerList | null) => void;
}

export function Settings({ userServerList, onUserServerListChange }: SettingsProps) {
  const { user, logout } = useAuth();
  const [showServerManagement, setShowServerManagement] = useState(false);
  const [showRelayManagement, setShowRelayManagement] = useState(false);
  const [relayList, setRelayList] = useState<Record<string, RelayMetadata>>({});
  const [relayListLoading, setRelayListLoading] = useState(true);

  // Load user's relay list
  const loadRelayList = useCallback(async () => {
    if (!user) return;

    setRelayListLoading(true);
    try {
      const currentRelayList = await getUserRelayList(user.pubkey);
      if (currentRelayList) {
        setRelayList(currentRelayList.relays);
      }
    } catch (err) {
      console.error('Failed to load relay list:', err);
    } finally {
      setRelayListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRelayList();
  }, [loadRelayList]);

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Settings</h2>
        <p className="text-gray-600">Please log in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Profile Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Public Key</label>
            <input
              type="text"
              value={user.pubkey}
              readOnly
              className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-500"
            />
          </div>
          {user.displayName && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Display Name</label>
              <input
                type="text"
                value={user.displayName}
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Relay Management Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Nostr Relays</h2>
          <button
            onClick={() => setShowRelayManagement(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Manage Relays
          </button>
        </div>
        
        {relayListLoading ? (
          <div className="flex items-center text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading relay configuration...
          </div>
        ) : Object.keys(relayList).length > 0 ? (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              You have {Object.keys(relayList).length} relay{Object.keys(relayList).length !== 1 ? 's' : ''} configured for Nostr data storage.
            </p>
            <div className="space-y-2">
              {Object.entries(relayList).map(([url, metadata]) => (
                <div key={url} className="flex items-center text-sm">
                  <div className="flex items-center space-x-2 mr-3">
                    {metadata.read && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        R
                      </span>
                    )}
                    {metadata.write && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        W
                      </span>
                    )}
                  </div>
                  <span className="text-gray-600 truncate">{url}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              No relays configured. Relays are required to store your server configuration and sync data across devices.
            </p>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Without relays, your server configuration won't sync across devices and apps.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Server Management Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Blossom Servers</h2>
          <button
            onClick={() => setShowServerManagement(true)}
            className="px-4 py-2 bg-pink-600 text-white text-sm rounded-lg hover:bg-pink-700 transition-colors"
          >
            Manage Servers
          </button>
        </div>
        
        {userServerList && userServerList.servers.length > 0 ? (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              You have {userServerList.servers.length} server{userServerList.servers.length !== 1 ? 's' : ''} configured for media uploads.
            </p>
            <div className="space-y-2">
              {userServerList.servers.slice(0, 3).map((server, index) => (
                <div key={server} className="flex items-center text-sm">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mr-3 ${
                    index === 0 ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {index === 0 ? 'Primary' : `#${index + 1}`}
                  </span>
                  <span className="text-gray-600 truncate">{server}</span>
                </div>
              ))}
              {userServerList.servers.length > 3 && (
                <p className="text-xs text-gray-500">
                  And {userServerList.servers.length - 3} more server{userServerList.servers.length - 3 !== 1 ? 's' : ''}...
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              No servers configured. You'll need at least one Blossom server to upload media files.
            </p>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Without configured servers, you won't be able to upload new media files.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Server Health Section */}
      {userServerList && userServerList.servers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <ServerHealthIndicator userServerList={userServerList} />
        </div>
      )}

      {/* Account Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account</h2>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Relay Management Modal */}
      {showRelayManagement && (
        <RelayManagement
          onRelayListUpdate={(updatedRelayList) => {
            setRelayList(updatedRelayList);
            setShowRelayManagement(false);
          }}
          onClose={() => setShowRelayManagement(false)}
        />
      )}

      {/* Server Management Modal */}
      {showServerManagement && userServerList && onUserServerListChange && (
        <ServerManagement
          userServerList={userServerList}
          onServerListUpdate={(updatedList) => {
            onUserServerListChange(updatedList);
            setShowServerManagement(false);
          }}
          onClose={() => setShowServerManagement(false)}
        />
      )}
    </div>
  );
}