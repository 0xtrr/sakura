import { useState, useEffect, useCallback } from 'react';
import { MediaGrid } from './MediaGrid.tsx';
import { UploadZone } from './UploadZone.tsx';
import { Profile } from './Profile.tsx';
import { Settings } from './Settings.tsx';
import { Header } from './Header.tsx';
import { Sidebar } from './Sidebar.tsx';
import { RelayOnboarding } from './RelayOnboarding.tsx';
import { ServerOnboarding } from './ServerOnboarding.tsx';
import { useAuth } from '../hooks/useAuth';
import { getUserRelayList } from '../utils/nostr';
import { serverListService } from '../services/serverList';
import type { UserServerList, RelayMetadata } from '../types';

export function MainLayout() {
  const { user, getSigningMethod } = useAuth();
  const [view, setView] = useState<'grid' | 'upload' | 'profile' | 'settings'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userServerList, setUserServerList] = useState<UserServerList | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRelayOnboarding, setShowRelayOnboarding] = useState(false);
  const [showServerOnboarding, setShowServerOnboarding] = useState(false);

  const checkUserOnboardingStatus = useCallback(async () => {
    if (!user) return;
    
    console.log('🚀 MAINLAYOUT: Starting onboarding check for user:', user.pubkey.slice(0, 8));
    setLoading(true);
    
    try {
      // First check if user has a relay list (NIP-65)
      console.log('📡 MAINLAYOUT: Checking for user relay list...');
      const userRelayList = await getUserRelayList(user.pubkey);
      console.log('📡 MAINLAYOUT: User relay list result:', userRelayList);
      
      if (!userRelayList || Object.keys(userRelayList.relays).length === 0) {
        // No relay list found - show relay onboarding first
        console.log('🔴 MAINLAYOUT: No user relay list found, showing relay onboarding');
        setShowRelayOnboarding(true);
        setLoading(false);
        return;
      }

      console.log('✅ MAINLAYOUT: User has relay list, checking for server list...');
      // User has relays, now check for server list
      // Set the publish relays based on user's relay list
      await serverListService.setPublishRelaysFromUserList(user.pubkey);
      
      // Fetch user server list directly from relays (no default servers needed)
      const serverList = await serverListService.getUserServerList(user.pubkey);
      console.log('🗂️ MAINLAYOUT: User server list result:', serverList);
      
      if (serverList && serverList.servers.length > 0) {
        console.log('🔍 MAINLAYOUT: Server list order before setting state:', serverList.servers);
        setUserServerList(serverList);
        console.log(`✅ MAINLAYOUT: Loaded user server list with ${serverList.servers.length} servers`);
      } else {
        // User has relays but no server list - show server onboarding
        console.log('🔴 MAINLAYOUT: User has relays but no server list found, showing server onboarding');
        setShowServerOnboarding(true);
      }
    } catch (error) {
      console.error('❌ MAINLAYOUT: Failed to check onboarding status:', error);
      // On error, show server onboarding as fallback
      setShowServerOnboarding(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Effect to check user onboarding status
  useEffect(() => {
    if (user) {
      checkUserOnboardingStatus();
    }
  }, [user, checkUserOnboardingStatus]);

  const handleRelayOnboardingComplete = async (relayList: Record<string, RelayMetadata>) => {
    console.log('✅ MAINLAYOUT: Relay onboarding completed with relays:', Object.keys(relayList));
    setShowRelayOnboarding(false);
    
    // After relay setup, check for server list
    setTimeout(() => {
      checkUserOnboardingStatus();
    }, 1000); // Small delay to allow relay events to propagate
  };

  const handleServerOnboardingComplete = async (selectedServers: string[]) => {
    console.log('✅ MAINLAYOUT: Server onboarding completed with servers:', selectedServers);
    
    if (!user) {
      console.error('❌ MAINLAYOUT: No user found for server list creation');
      setShowServerOnboarding(false);
      return;
    }

    try {
      // Get the signing method to ensure we use the correct signing approach
      const signingMethod = getSigningMethod();
      if (!signingMethod) {
        console.error('❌ MAINLAYOUT: No signing method available');
        setShowServerOnboarding(false);
        return;
      }

      console.log('🔐 MAINLAYOUT: Creating server list with signing method:', signingMethod);
      console.log('📝 MAINLAYOUT: Selected servers:', selectedServers);

      // Create and publish the server list
      await serverListService.createAndPublishServerList(
        selectedServers,
        user.pubkey,
        signingMethod
      );

      console.log('✅ MAINLAYOUT: Server list created and published successfully');
      setShowServerOnboarding(false);
      
      // Reload the user server list after creation
      setTimeout(() => {
        checkUserOnboardingStatus();
      }, 1000); // Small delay to allow events to propagate
    } catch (error) {
      console.error('❌ MAINLAYOUT: Failed to create server list:', error);
      // Still close the onboarding on error to prevent getting stuck
      setShowServerOnboarding(false);
    }
  };

  const handleServerOnboardingSkip = () => {
    console.log('⏭️ MAINLAYOUT: User skipped server onboarding');
    setShowServerOnboarding(false);
  };

  // Show relay onboarding modal if needed
  if (showRelayOnboarding) {
    return (
      <RelayOnboarding
        onComplete={handleRelayOnboardingComplete}
      />
    );
  }

  // Show server onboarding modal if needed
  if (showServerOnboarding) {
    return (
      <ServerOnboarding
        onComplete={handleServerOnboardingComplete}
        onCancel={handleServerOnboardingSkip}
      />
    );
  }

  // Show loading overlay if checking onboarding status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          currentView={view} 
          onViewChange={setView} 
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          userServerList={userServerList}
        />
        
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6">
            {/* Mobile menu button */}
            <div className="lg:hidden mb-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Menu
              </button>
            </div>
            
            <div className="max-w-7xl mx-auto">
              {view === 'grid' && <MediaGrid userServerList={userServerList} />}
              {view === 'upload' && <UploadZone userServerList={userServerList} />}
              {view === 'profile' && <Profile userServerList={userServerList} />}
              {view === 'settings' && <Settings userServerList={userServerList} onUserServerListChange={setUserServerList} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
