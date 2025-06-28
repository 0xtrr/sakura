import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface VirtualGridProps<T> {
  items: T[];
  itemHeight: number;
  itemWidth: number;
  containerHeight: number;
  containerWidth: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

/**
 * Virtual grid component for efficient rendering of large lists
 * Only renders visible items plus a small buffer to improve performance
 */
export function VirtualGrid<T>({
  items,
  itemHeight,
  itemWidth,
  containerHeight,
  containerWidth,
  gap = 16,
  renderItem,
  className = ''
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate grid layout
  const { columnsPerRow, visibleRange, totalHeight } = useMemo(() => {
    const availableWidth = containerWidth - gap;
    const itemTotalWidth = itemWidth + gap;
    const cols = Math.floor(availableWidth / itemTotalWidth);
    const rows = Math.ceil(items.length / cols);
    
    // Calculate visible items based on scroll position
    const rowHeight = itemHeight + gap;
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.min(
      rows,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + 1 // Buffer row
    );
    
    const startIndex = Math.max(0, startRow * cols - cols); // Buffer items
    const endIndex = Math.min(items.length, endRow * cols + cols); // Buffer items
    
    return {
      columnsPerRow: cols,
      visibleRange: { start: startIndex, end: endIndex },
      totalHeight: rows * rowHeight
    };
  }, [items.length, itemHeight, itemWidth, containerHeight, containerWidth, gap, scrollTop]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      originalIndex: visibleRange.start + index
    }));
  }, [items, visibleRange]);

  // Calculate item positions
  const getItemStyle = useCallback((index: number) => {
    const row = Math.floor(index / columnsPerRow);
    const col = index % columnsPerRow;
    
    return {
      position: 'absolute' as const,
      top: row * (itemHeight + gap),
      left: col * (itemWidth + gap),
      width: itemWidth,
      height: itemHeight,
    };
  }, [columnsPerRow, itemHeight, itemWidth, gap]);

  return (
    <div
      ref={scrollElementRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: containerHeight, width: containerWidth }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, originalIndex }) => (
          <div key={originalIndex} style={getItemStyle(originalIndex)}>
            {renderItem(item, originalIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hook to detect container size for responsive virtual grids
 */
export function useContainerSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateSize = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return { size, ref };
}
