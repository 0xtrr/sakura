import { useServerHealth } from '../hooks/useServerHealth';
import { LoadingSpinnerSVG } from './LoadingSpinner';
import type { UserServerList } from '../types';

interface ServerHealthIndicatorProps {
  userServerList: UserServerList | null;
}

export function ServerHealthIndicator({ userServerList }: ServerHealthIndicatorProps) {
  const { 
    serverStatuses, 
    loading, 
    lastCheckTime, 
    checkServerHealth, 
    getHealthySummary,
    getAverageResponseTime 
  } = useServerHealth({ userServerList, autoCheck: true, checkInterval: 30000 });

  const healthSummary = getHealthySummary();
  const avgResponseTime = getAverageResponseTime();

  if (!userServerList || userServerList.servers.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No servers configured to monitor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Server Health</h3>
        <button
          onClick={checkServerHealth}
          disabled={loading}
          className="flex items-center px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <LoadingSpinnerSVG size="sm" className="mr-2 text-gray-500" />
              Checking...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {lastCheckTime && (
        <div className="text-xs text-gray-500">
          Last checked: {lastCheckTime.toLocaleString()}
        </div>
      )}

      <div className="space-y-3">
        {serverStatuses.map((status, index) => (
          <div key={status.url} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${status.isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{status.name}</span>
                  {index === 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-pink-100 text-pink-800">
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 truncate">{status.url}</div>
              </div>
            </div>
            
            <div className="text-right">
              {status.isHealthy ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-green-600">Healthy</div>
                  {status.responseTime && (
                    <div className="text-xs text-gray-500">{status.responseTime}ms</div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-red-600">Error</div>
                  {status.error && (
                    <div className="text-xs text-gray-500 max-w-48 truncate" title={status.error}>
                      {status.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Health Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Health:</span>
            <span className={`font-medium ${
              healthSummary.percentage === 100 
                ? 'text-green-600' 
                : healthSummary.percentage > 0
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}>
              {healthSummary.healthy}/{healthSummary.total} servers ({Math.round(healthSummary.percentage)}%)
            </span>
          </div>
          {avgResponseTime && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Avg Response Time:</span>
              <span className="font-medium text-gray-900">{avgResponseTime}ms</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}