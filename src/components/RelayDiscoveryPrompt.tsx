import { useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface RelayDiscoveryPromptProps {
  onCustomRelay: (relayUrl: string) => Promise<void>;
  onSetupNewRelays: () => void;
  attemptedRelays: string[];
  loading?: boolean;
  error?: string | null;
}

export function RelayDiscoveryPrompt({ 
  onCustomRelay, 
  onSetupNewRelays, 
  attemptedRelays, 
  loading = false,
  error 
}: RelayDiscoveryPromptProps) {
  const [customRelay, setCustomRelay] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateRelayUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      if (!parsed.protocol.startsWith('ws')) {
        setValidationError('Relay URL must use ws:// or wss://');
        return false;
      }
      setValidationError(null);
      return true;
    } catch {
      setValidationError('Please enter a valid WebSocket URL');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customRelay.trim()) {
      setValidationError('Please enter a relay URL');
      return;
    }

    if (!validateRelayUrl(customRelay.trim())) {
      return;
    }

    await onCustomRelay(customRelay.trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Relay Discovery Failed
          </h2>
          <p className="text-gray-600 text-sm">
            We couldn't find your relay list in our discovery relays. This could mean:
          </p>
        </div>

        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• You haven't published a relay list yet</li>
            <li>• Your relay list is on a different relay</li>
            <li>• Our discovery relays are temporarily unavailable</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-2">Attempted Discovery Relays:</h3>
          <div className="max-h-32 overflow-y-auto bg-gray-50 rounded p-3">
            {attemptedRelays.map((relay, index) => (
              <div key={index} className="text-xs text-gray-600 font-mono">
                {relay}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {/* Option 1: Try Custom Relay */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Option 1: Try a Different Relay</h3>
          <p className="text-sm text-gray-600 mb-3">
            If you know of a relay that might have your relay list, enter it below:
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                value={customRelay}
                onChange={(e) => setCustomRelay(e.target.value)}
                placeholder="wss://relay.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                disabled={loading}
              />
              {validationError && (
                <p className="text-xs text-red-600 mt-1">{validationError}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading || !customRelay.trim()}
              className="w-full flex items-center justify-center px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="xs" color="white" className="mr-2" />
                  Checking Relay...
                </>
              ) : (
                'Try This Relay'
              )}
            </button>
          </form>
        </div>

        {/* Option 2: Setup New Relays */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Option 2: Set Up New Relays</h3>
          <p className="text-sm text-gray-600 mb-3">
            Choose from popular relays and create a new relay list:
          </p>
          
          <button
            onClick={onSetupNewRelays}
            disabled={loading}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Choose From Popular Relays
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            For optimal security and decentralization, you should control your own relay infrastructure.
          </p>
        </div>
      </div>
    </div>
  );
}