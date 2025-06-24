import type { UserServerList } from '../types';

interface SidebarProps {
  currentView: 'grid' | 'upload' | 'profile' | 'settings';
  onViewChange: (view: 'grid' | 'upload' | 'profile' | 'settings') => void;
  isOpen: boolean;
  onToggle: () => void;
  userServerList?: UserServerList | null;
}

export function Sidebar({ currentView, onViewChange, isOpen, onToggle, userServerList }: SidebarProps) {
  const menuItems = [
    {
      id: 'grid' as const,
      label: 'My Media',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      id: 'upload' as const,
      label: 'Upload',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      ),
    },
    {
      id: 'profile' as const,
      label: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const handleItemClick = (id: 'grid' | 'upload' | 'profile' | 'settings') => {
    onViewChange(id);
    onToggle(); // Close sidebar on mobile after selection
  };

  return (
    <aside className={`
      fixed lg:static top-0 lg:top-auto inset-y-0 lg:inset-y-auto left-0 z-30
      w-64 bg-white border-r border-gray-200 h-screen lg:h-full
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      flex flex-col
    `}>
      {/* Mobile close button */}
      <div className="lg:hidden flex justify-end p-4 flex-shrink-0">
        <button
          onClick={onToggle}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <nav className="p-4 flex-shrink-0 overflow-y-auto min-h-0">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
                  currentView === item.id
                    ? 'bg-pink-50 text-pink-700 border border-pink-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Spacer to push bottom content down - but ensure bottom content is always visible */}
      <div className="flex-1 min-h-0"></div>

      {/* Bottom content - Server List (always visible) */}
      <div className="p-4 space-y-3 flex-shrink-0 min-h-0">
        {/* Server List */}
        {userServerList && userServerList.servers.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg max-h-32 overflow-y-auto">
            <h3 className="text-xs font-medium text-blue-900 mb-2 flex items-center flex-shrink-0">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v4a2 2 0 01-2 2H5z" />
              </svg>
              Blossom Servers ({userServerList.servers.length})
            </h3>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {userServerList.servers.slice(0, 3).map((server, index) => (
                <div key={server} className="text-xs text-blue-700 truncate" title={server}>
                  {index === 0 && '★ '}{new URL(server).hostname}
                </div>
              ))}
              {userServerList.servers.length > 3 && (
                <div className="text-xs text-blue-600 font-medium">
                  +{userServerList.servers.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
