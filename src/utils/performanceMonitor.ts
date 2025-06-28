/**
 * Performance monitoring utility for tracking and optimizing app performance
 */
import React from 'react';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private timers = new Map<string, number>();
  private readonly MAX_METRICS = 1000; // Prevent memory bloat

  /**
   * Start timing an operation
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing and record the metric
   */
  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`No timer started for: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);
    
    this.recordMetric(name, duration, metadata);
    return duration;
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      metadata
    });

    // Prevent memory bloat by keeping only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS * 0.8); // Keep 80% of max
    }

    // Log significant performance issues
    if (name.includes('api') && value > 5000) {
      console.warn(`Slow API call detected: ${name} took ${value.toFixed(0)}ms`, metadata);
    }
  }

  /**
   * Get performance statistics for a metric
   */
  getStats(metricName: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    recent: number[];
  } | null {
    const filtered = this.metrics.filter(m => m.name === metricName);
    if (filtered.length === 0) return null;

    const values = filtered.map(m => m.value);
    const recent = filtered.slice(-10).map(m => m.value); // Last 10 measurements

    return {
      count: filtered.length,
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      recent
    };
  }

  /**
   * Get all available metrics
   */
  getAllMetrics(): string[] {
    return [...new Set(this.metrics.map(m => m.name))];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get a performance report
   */
  getReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    this.getAllMetrics().forEach(name => {
      const stats = this.getStats(name);
      if (stats) {
        report[name] = stats;
      }
    });

    return report;
  }

  /**
   * Monitor React component render performance
   */
  measureRender<T extends any[]>(
    componentName: string,
    renderFn: (...args: T) => React.ReactElement
  ) {
    return (...args: T): React.ReactElement => {
      const startTime = performance.now();
      const result = renderFn(...args);
      const endTime = performance.now();
      
      this.recordMetric(`render_${componentName}`, endTime - startTime);
      return result;
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitoring() {
  return {
    startTimer: performanceMonitor.startTimer.bind(performanceMonitor),
    endTimer: performanceMonitor.endTimer.bind(performanceMonitor),
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    getStats: performanceMonitor.getStats.bind(performanceMonitor),
    getReport: performanceMonitor.getReport.bind(performanceMonitor),
    clear: performanceMonitor.clear.bind(performanceMonitor)
  };
}

/**
 * Higher-order component for automatic render performance monitoring
 */
export function withPerformanceMonitoring<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const name = componentName || Component.displayName || Component.name || 'UnknownComponent';
  
  return function PerformanceMonitoredComponent(props: P) {
    performanceMonitor.startTimer(`render_${name}`);
    const result = React.createElement(Component, props);
    performanceMonitor.endTimer(`render_${name}`);
    return result;
  };
}
