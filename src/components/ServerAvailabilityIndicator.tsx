import { memo } from 'react';
import type { BlossomBlob } from '../types';

interface ServerAvailabilityIndicatorProps {
  availableServers: BlossomBlob['availableServers'];
  className?: string;
}

export const ServerAvailabilityIndicator = memo(function ServerAvailabilityIndicator({ 
  availableServers, 
  className = '' 
}: ServerAvailabilityIndicatorProps) {
  if (!availableServers || availableServers.length === 0) {
    return null;
  }

  const successfulServers = availableServers.filter(s => s.success);
  const failedServers = availableServers.filter(s => !s.success);

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-wrap gap-1">
        {availableServers.map((server, index) => (
          <span
            key={`${server.serverUrl}-${index}`}
            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium cursor-pointer ${
              server.success
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            } transition-colors`}
            title={server.success ? `Available on ${server.serverName}` : `Error on ${server.serverName}: ${server.error}`}
          >
            {server.success ? (
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
            {server.serverName}
          </span>
        ))}
      </div>
      
      {availableServers.length > 1 && (
        <div className="text-xs text-gray-400 mt-1">
          <span className="inline-flex items-center">
            <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successfulServers.length} of {availableServers.length} servers
          </span>
          {failedServers.length > 0 && (
            <span className="ml-2 text-red-500">
              ({failedServers.length} failed)
            </span>
          )}
        </div>
      )}
    </div>
  );
});
