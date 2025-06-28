import { memo } from 'react';
import type { BlossomServer, UserServerList } from '../types';

interface UploadSettingsProps {
  removeExif: boolean;
  onRemoveExifChange: (enabled: boolean) => void;
  selectedServer: BlossomServer;
  onServerChange: (server: BlossomServer) => void;
  availableServers: BlossomServer[];
  userServerList: UserServerList | null;
  autoMirror: boolean;
  onAutoMirrorChange: (enabled: boolean) => void;
}

export const UploadSettings = memo(function UploadSettings({
  removeExif,
  onRemoveExifChange,
  selectedServer,
  onServerChange,
  availableServers,
  userServerList,
  autoMirror,
  onAutoMirrorChange
}: UploadSettingsProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <h3 className="font-medium text-gray-900">Upload Settings</h3>
      
      {/* EXIF Removal Setting */}
      <div className="flex items-start space-x-3">
        <div className="flex items-center h-5">
          <input
            id="remove-exif"
            type="checkbox"
            checked={removeExif}
            onChange={(e) => onRemoveExifChange(e.target.checked)}
            className="w-4 h-4 text-pink-600 bg-gray-100 border-gray-300 rounded focus:ring-pink-500 focus:ring-2"
          />
        </div>
        <div className="text-sm">
          <label htmlFor="remove-exif" className="font-medium text-gray-900 cursor-pointer">
            Remove EXIF data from images
          </label>
          <p className="text-gray-600 mt-1">
            Recommended for privacy. Strips location data, device info, and other metadata from images before upload.
          </p>
          {!removeExif && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
              ⚠️ Images will be uploaded with metadata intact, which may include location and device information.
            </div>
          )}
        </div>
      </div>

      {/* Auto Mirror Setting */}
      {userServerList && userServerList.servers.length > 1 && (
        <div className="flex items-start space-x-3">
          <div className="flex items-center h-5">
            <input
              id="auto-mirror"
              type="checkbox"
              checked={autoMirror}
              onChange={(e) => onAutoMirrorChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
          </div>
          <div className="text-sm">
            <label htmlFor="auto-mirror" className="font-medium text-gray-900 cursor-pointer">
              Auto-mirror failed uploads (BUD-04)
            </label>
            <p className="text-gray-600 mt-1">
              Automatically mirror blobs to servers that failed during initial upload to ensure complete redundancy.
            </p>
            {autoMirror && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-xs">
                🪞 Failed uploads will be automatically mirrored to ensure all servers have your files.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Server Selection */}
      {!userServerList && availableServers.length > 1 && (
        <div>
          <label htmlFor="server-select" className="block text-sm font-medium text-gray-900 mb-2">
            Upload Server
          </label>
          <select
            id="server-select"
            value={selectedServer.url}
            onChange={(e) => {
              const server = availableServers.find(s => s.url === e.target.value);
              if (server) onServerChange(server);
            }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
          >
            {availableServers.map((server) => (
              <option key={server.url} value={server.url}>
                {server.name} - {server.description}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Note: Configure multiple servers in Settings for redundant uploads
          </p>
        </div>
      )}

      {/* Server List Info */}
      {userServerList && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Configured Servers ({userServerList.servers.length})
          </h4>
          <div className="space-y-1">
            {userServerList.servers.slice(0, 3).map((serverUrl, index) => (
              <div key={serverUrl} className="flex items-center text-xs text-gray-600">
                <div className={`w-2 h-2 rounded-full mr-2 ${index === 0 ? 'bg-pink-500' : 'bg-gray-300'}`} />
                <span className="truncate">
                  {new URL(serverUrl).hostname}
                  {index === 0 && ' (Primary)'}
                </span>
              </div>
            ))}
            {userServerList.servers.length > 3 && (
              <div className="text-xs text-gray-500">
                ...and {userServerList.servers.length - 3} more
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Files will be uploaded to all configured servers for maximum redundancy
          </p>
        </div>
      )}

      {/* Upload Strategy Info */}
      <div className="text-xs text-gray-500 border-t border-gray-200 pt-3">
        <p className="font-medium mb-1">Upload Strategy:</p>
        {userServerList ? (
          <p>📡 Multi-server upload - Files stored on all configured servers simultaneously</p>
        ) : (
          <p>🔄 Single server upload - Files stored on selected server only</p>
        )}
      </div>
    </div>
  );
});