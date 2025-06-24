import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { EnhancedBlossomAPI } from '../services/blossom';
import type { UserServerList } from '../types';

export interface ServerStatus {
  url: string;
  name: string;
  isHealthy: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

interface UseServerHealthOptions {
  userServerList: UserServerList | null;
  autoCheck?: boolean;
  checkInterval?: number; // in milliseconds
}

export function useServerHealth({ 
  userServerList, 
  autoCheck = true,
  checkInterval = 30000 // 30 seconds
}: UseServerHealthOptions) {
  const { user, getSigningMethod } = useAuth();
  const [serverStatuses, setServerStatuses] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  const checkServerHealth = useCallback(async () => {
    if (!user || !userServerList || userServerList.servers.length === 0) {
      setServerStatuses([]);
      return;
    }

    const signingMethod = getSigningMethod();
    if (!signingMethod) return;

    setLoading(true);
    const statuses: ServerStatus[] = [];

    for (const serverUrl of userServerList.servers) {
      const startTime = Date.now();
      const status: ServerStatus = {
        url: serverUrl,
        name: new URL(serverUrl).hostname,
        isHealthy: false,
        lastChecked: new Date()
      };

      try {
        // Try to list blobs as a health check
        const api = new EnhancedBlossomAPI({ url: serverUrl, name: 'temp' });
        await api.listBlobs(user.pubkey, signingMethod);
        
        status.isHealthy = true;
        status.responseTime = Date.now() - startTime;
      } catch (error) {
        status.isHealthy = false;
        status.error = error instanceof Error ? error.message : 'Health check failed';
        status.responseTime = Date.now() - startTime;
      }

      statuses.push(status);
    }

    setServerStatuses(statuses);
    setLastCheckTime(new Date());
    setLoading(false);
  }, [user, userServerList, getSigningMethod]);

  const getHealthySummary = useCallback(() => {
    const healthy = serverStatuses.filter(s => s.isHealthy).length;
    const total = serverStatuses.length;
    return { healthy, total, percentage: total > 0 ? (healthy / total) * 100 : 0 };
  }, [serverStatuses]);

  const getAverageResponseTime = useCallback(() => {
    const healthyServers = serverStatuses.filter(s => s.isHealthy && s.responseTime);
    if (healthyServers.length === 0) return null;
    
    const totalTime = healthyServers.reduce((sum, s) => sum + (s.responseTime || 0), 0);
    return Math.round(totalTime / healthyServers.length);
  }, [serverStatuses]);

  const getFastestServer = useCallback(() => {
    const healthyServers = serverStatuses.filter(s => s.isHealthy && s.responseTime);
    if (healthyServers.length === 0) return null;
    
    return healthyServers.reduce((fastest, current) => 
      (current.responseTime || Infinity) < (fastest.responseTime || Infinity) ? current : fastest
    );
  }, [serverStatuses]);

  const refreshHealth = useCallback(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  // Auto-check server health on mount and when dependencies change
  useEffect(() => {
    if (autoCheck) {
      checkServerHealth();
    }
  }, [user, userServerList, autoCheck, checkServerHealth]);

  // Set up periodic health checks if autoCheck is enabled
  useEffect(() => {
    if (!autoCheck || checkInterval <= 0) return;

    const interval = setInterval(() => {
      checkServerHealth();
    }, checkInterval);

    return () => clearInterval(interval);
  }, [autoCheck, checkInterval, checkServerHealth]);

  return {
    serverStatuses,
    loading,
    lastCheckTime,
    checkServerHealth: refreshHealth,
    getHealthySummary,
    getAverageResponseTime,
    getFastestServer,
    isAllHealthy: serverStatuses.length > 0 && serverStatuses.every(s => s.isHealthy),
    hasUnhealthyServers: serverStatuses.some(s => !s.isHealthy)
  };
}