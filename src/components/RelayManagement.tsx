import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserRelayList, createRelayListEvent, signEventWithMethod, publishToRelays, clearRelayListCache } from '../utils/nostr';
import type { RelayMetadata } from '../types';

interface RelayManagementProps {
  onClose: () => void;
  onRelayListUpdate: (relayList: Record<string, RelayMetadata>) => void;
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
];

export function RelayManagement({ onClose, onRelayListUpdate }: RelayManagementProps) {
  const { user, getSigningMethod } = useAuth();
  const [relayList, setRelayList] = useState<Record<string, RelayMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customRelay, setCustomRelay] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Load current relay list
  const loadRelayList = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const currentRelayList = await getUserRelayList(user.pubkey);
      if (currentRelayList) {
        setRelayList(currentRelayList.relays);
      }
    } catch (err) {
      console.error('Failed to load relay list:', err);
      setError('Failed to load current relay list');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRelayList();
  }, [loadRelayList]);

  const handleRelayToggle = (relayUrl: string, metadata?: Partial<RelayMetadata>) => {
    setRelayList(prev => {
      const newRelayList = { ...prev };
      if (newRelayList[relayUrl]) {
        delete newRelayList[relayUrl];
      } else {
        newRelayList[relayUrl] = { read: true, write: true, ...metadata };
      }
      return newRelayList;
    });
  };

  const handleRelaySettingsChange = (relayUrl: string, field: 'read' | 'write', value: boolean) => {
    setRelayList(prev => ({
      ...prev,
      [relayUrl]: {
        ...prev[relayUrl],
        [field]: value
      }
    }));
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

    if (relayList[url]) {
      setError('Relay already added');
      return;
    }

    setRelayList(prev => ({
      ...prev,
      [url]: { read: true, write: true }
    }));
    setCustomRelay('');
    setShowAddCustom(false);
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

    if (Object.keys(relayList).length === 0) {
      setError('Please select at least one relay');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create the relay list event
      const unsignedEvent = await createRelayListEvent(relayList, user.pubkey);
      
      // Sign the event using the correct method for this user
      const signedEvent = await signEventWithMethod(unsignedEvent, signingMethod);
      
      // Publish to the relays (use all relays in the list)
      const relayUrls = Object.keys(relayList);
      await publishToRelays(relayUrls, signedEvent);
      
      console.log('✅ RelayManagement: Successfully updated relay list to', relayUrls.length, 'relays');
      
      // Clear cache so next fetch gets the updated relay list
      clearRelayListCache(user.pubkey);
      
      // Update parent component
      onRelayListUpdate(relayList);
      onClose();
    } catch (error) {
      console.error('❌ RelayManagement: Failed to save relay list:', error);
      setError(error instanceof Error ? error.message : 'Failed to save relay list');
    } finally {
      setSaving(false);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Nostr Relays</h2>
              <p className="text-gray-600 mt-1">Configure the relays for storing and retrieving your data</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
              <span className="ml-3 text-gray-600">Loading relay list...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Relays */}
              {Object.keys(relayList).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    Your Relays ({Object.keys(relayList).length})
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(relayList).map(([url, metadata]) => (
                      <div key={url} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{url}</div>
                          <div className="flex items-center mt-2 space-x-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={metadata.read}
                                onChange={(e) => handleRelaySettingsChange(url, 'read', e.target.checked)}
                                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded mr-2"
                              />
                              <span className="text-sm text-gray-600">Read</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={metadata.write}
                                onChange={(e) => handleRelaySettingsChange(url, 'write', e.target.checked)}
                                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded mr-2"
                              />
                              <span className="text-sm text-gray-600">Write</span>
                            </label>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRelayToggle(url)}
                          className="ml-4 text-red-600 hover:text-red-700 p-2"
                          title="Remove relay"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Relays */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Popular Relays</h3>
                <div className="grid gap-3">
                  {POPULAR_RELAYS.map((relay) => {
                    const isSelected = relayList[relay.url];
                    return (
                      <div
                        key={relay.url}
                        className={`p-4 border rounded-lg transition-colors ${
                          isSelected
                            ? 'border-pink-300 bg-pink-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
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
                          <button
                            onClick={() => handleRelayToggle(relay.url)}
                            className={`ml-4 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                              isSelected
                                ? 'bg-pink-600 text-white hover:bg-pink-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {isSelected ? 'Remove' : 'Add'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Relay */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Custom Relay</h3>
                  <button
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="text-pink-600 hover:text-pink-700 text-sm font-medium"
                  >
                    {showAddCustom ? 'Cancel' : 'Add Custom Relay'}
                  </button>
                </div>

                {showAddCustom && (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={customRelay}
                        onChange={(e) => setCustomRelay(e.target.value)}
                        placeholder="wss://relay.example.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCustomRelay()}
                      />
                      <button
                        onClick={handleAddCustomRelay}
                        disabled={!customRelay.trim()}
                        className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Must start with wss:// or ws://
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              {Object.keys(relayList).length} relay{Object.keys(relayList).length !== 1 ? 's' : ''} configured
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRelayList}
                disabled={saving || Object.keys(relayList).length === 0}
                className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}