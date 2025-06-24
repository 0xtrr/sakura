import { useState } from 'react';
import { createRelayListEvent, signEventWithMethod, publishToRelays } from '../utils/nostr';
import { useAuth } from '../hooks/useAuth';
import type { RelayMetadata } from '../types';

interface RelayOnboardingProps {
  onComplete: (relayList: Record<string, RelayMetadata>) => void;
}

interface PopularRelay {
  url: string;
  name: string;
  description: string;
  location: string;
  cost: 'free' | 'freemium' | 'paid';
}

const POPULAR_RELAYS: PopularRelay[] = [
  {
    url: 'wss://relay.damus.io',
    name: 'Damus',
    description: 'Popular public relay by Damus team',
    location: 'Global',
    cost: 'free'
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal',
    description: 'High-performance relay by Primal',
    location: 'Global',
    cost: 'free'
  },
  {
    url: 'wss://nos.lol',
    name: 'nos.lol',
    description: 'Community-driven public relay',
    location: 'Global',
    cost: 'free'
  },
  {
    url: 'wss://relay.nostr.band',
    name: 'Nostr.band',
    description: 'Analytics and search focused relay',
    location: 'Global',
    cost: 'free'
  },
  {
    url: 'wss://relay.snort.social',
    name: 'Snort',
    description: 'Social-focused relay by Snort team',
    location: 'Global',
    cost: 'free'
  },
  {
    url: 'wss://nostr.wine',
    name: 'Nostr Wine',
    description: 'Premium relay with spam filtering',
    location: 'Europe',
    cost: 'paid'
  },
  {
    url: 'wss://relay.nostr.com.au',
    name: 'Nostr Australia',
    description: 'Australian-based relay',
    location: 'Australia',
    cost: 'free'
  },
  {
    url: 'wss://nostr.oxtr.dev',
    name: 'Oxtr',
    description: 'Community relay by Oxtr',
    location: 'Global',
    cost: 'free'
  },
];

export function RelayOnboarding({ onComplete }: RelayOnboardingProps) {
  const { user, getSigningMethod } = useAuth();
  const [step, setStep] = useState<'welcome' | 'select' | 'custom' | 'saving'>('welcome');
  const [selectedRelays, setSelectedRelays] = useState<Record<string, RelayMetadata>>({});
  const [customRelay, setCustomRelay] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRelayToggle = (relayUrl: string) => {
    setSelectedRelays(prev => {
      const newSelected = { ...prev };
      if (newSelected[relayUrl]) {
        delete newSelected[relayUrl];
      } else {
        newSelected[relayUrl] = { read: true, write: true };
      }
      return newSelected;
    });
  };

  const handleAddCustomRelay = () => {
    const url = customRelay.trim();
    
    if (!url) {
      setError('Please enter a relay URL');
      return;
    }

    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith('ws')) {
        setError('Relay URL must use ws:// or wss:// protocol');
        return;
      }
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    if (selectedRelays[url]) {
      setError('Relay already added');
      return;
    }

    setSelectedRelays(prev => ({
      ...prev,
      [url]: { read: true, write: true }
    }));
    setCustomRelay('');
    setError(null);
  };

  const handleSaveRelayList = async () => {
    if (!user) {
      setError('No user available');
      return;
    }

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      setError('No signing method available');
      return;
    }

    if (Object.keys(selectedRelays).length === 0) {
      setError('Please select at least one relay');
      return;
    }

    setStep('saving');
    setError(null);

    try {
      console.log('🔑 RelayOnboarding: Using signing method:', signingMethod, 'for user:', user.pubkey.slice(0, 8));
      
      // Create the relay list event
      const unsignedEvent = await createRelayListEvent(selectedRelays, user.pubkey);
      
      // Sign the event using the correct method for this user
      const signedEvent = await signEventWithMethod(unsignedEvent, signingMethod);
      
      // Publish to the selected relays
      const relayUrls = Object.keys(selectedRelays);
      await publishToRelays(relayUrls, signedEvent);
      
      console.log('✅ RelayOnboarding: Successfully published relay list to', relayUrls.length, 'relays');
      
      // Complete the onboarding
      onComplete(selectedRelays);
    } catch (error) {
      console.error('❌ RelayOnboarding: Failed to save relay list:', error);
      setError(error instanceof Error ? error.message : 'Failed to save relay list');
      setStep('select');
    }
  };

  const getCostBadge = (cost: string) => {
    const colors = {
      free: 'bg-green-100 text-green-800',
      freemium: 'bg-blue-100 text-blue-800',
      paid: 'bg-yellow-100 text-yellow-800'
    };
    return colors[cost as keyof typeof colors] || colors.free;
  };

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Relays</h2>
            <p className="text-gray-600">
              Nostr relays are servers that store and distribute your data. <strong>You must configure at least one relay</strong> to publish and retrieve your Blossom server configuration.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Why relays are required:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Store your server preferences securely on the Nostr network</li>
                <li>• Enable discovery and syncing across devices</li>
                <li>• Provide redundancy and reliability for your data</li>
                <li>• Essential for the decentralized infrastructure to work</li>
              </ul>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-orange-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h3 className="font-medium text-orange-900 mb-1">Required Step</h3>
                  <p className="text-sm text-orange-800">
                    Without relays, you cannot save your server configuration or use this application. This step cannot be skipped.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex mt-6">
            <button
              onClick={() => setStep('select')}
              className="w-full px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
            >
              Configure Relays
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'select') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Choose Your Relays</h2>
                <p className="text-gray-600 mt-1">
                  <span className="text-red-600 font-medium">Required:</span> Select at least one relay to continue
                </p>
              </div>
              <button
                onClick={() => setStep('custom')}
                className="text-pink-600 hover:text-pink-700 text-sm font-medium"
              >
                Add Custom Relay
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="grid gap-3 mb-6">
              {POPULAR_RELAYS.map((relay) => (
                <label
                  key={relay.url}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedRelays[relay.url]
                      ? 'border-pink-300 bg-pink-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedRelays[relay.url]}
                    onChange={() => handleRelayToggle(relay.url)}
                    className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded mr-3"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{relay.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCostBadge(relay.cost)}`}>
                        {relay.cost}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {relay.location}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{relay.description}</p>
                    <p className="text-xs text-gray-500 font-mono">{relay.url}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Show custom relays */}
            {Object.keys(selectedRelays).some(url => !POPULAR_RELAYS.find(r => r.url === url)) && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Custom Relays</h3>
                <div className="space-y-2">
                  {Object.keys(selectedRelays)
                    .filter(url => !POPULAR_RELAYS.find(r => r.url === url))
                    .map((url) => (
                      <div key={url} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-mono text-gray-700">{url}</span>
                        <button
                          onClick={() => handleRelayToggle(url)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-sm text-gray-500 mb-6">
              <span>{Object.keys(selectedRelays).length} relays selected</span>
              <span>All selected relays will be used for both read and write operations</span>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep('welcome')}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSaveRelayList}
                disabled={Object.keys(selectedRelays).length === 0}
                className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save Relay List
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'custom') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Custom Relay</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="custom-relay" className="block text-sm font-medium text-gray-700 mb-2">
              Relay URL
            </label>
            <input
              id="custom-relay"
              type="url"
              value={customRelay}
              onChange={(e) => setCustomRelay(e.target.value)}
              placeholder="wss://relay.example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must start with wss:// or ws://
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setStep('select')}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleAddCustomRelay}
              disabled={!customRelay.trim()}
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Relay
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'saving') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-pink-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Saving Relay List</h2>
          <p className="text-gray-600">
            Publishing your relay preferences to the Nostr network...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
