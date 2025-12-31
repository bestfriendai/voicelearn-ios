'use client';

import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { saveScrollPosition, getScrollPosition, clearScrollPosition } from '@/lib/session-state';

/**
 * Hook for persisting and restoring scroll position across navigation and refreshes.
 *
 * @param key - Unique identifier for the scroll container (e.g., "curricula-list")
 * @param options - Configuration options
 * @returns Object with scrollRef to attach to the scrollable container
 *
 * @example
 * ```tsx
 * function MyList() {
 *   const { scrollRef } = useScrollRestoration('my-list');
 *   return (
 *     <div ref={scrollRef} className="overflow-y-auto">
 *       {items.map(...)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollRestoration<T extends HTMLElement = HTMLDivElement>(
  key: string,
  options: {
    /** Delay in ms before restoring scroll (useful for async content) */
    restoreDelay?: number;
    /** Whether to clear saved position when deps change */
    clearOnChange?: boolean;
    /** Dependencies that when changed should clear the saved scroll position */
    deps?: unknown[];
    /** Whether restoration is enabled */
    enabled?: boolean;
  } = {}
): {
  scrollRef: RefObject<T | null>;
  savePosition: () => void;
  restorePosition: () => void;
  clearPosition: () => void;
} {
  const { restoreDelay = 0, clearOnChange = false, deps = [], enabled = true } = options;
  const scrollRef = useRef<T | null>(null);
  const hasRestored = useRef(false);
  const previousDeps = useRef<unknown[]>(deps);

  // Save current scroll position
  const savePosition = useCallback(() => {
    if (!enabled || !scrollRef.current) return;
    const position = scrollRef.current.scrollTop;
    if (position > 0) {
      saveScrollPosition(key, position);
    }
  }, [key, enabled]);

  // Restore saved scroll position
  const restorePosition = useCallback(() => {
    if (!enabled || !scrollRef.current || hasRestored.current) return;
    const savedPosition = getScrollPosition(key);
    if (savedPosition > 0) {
      scrollRef.current.scrollTop = savedPosition;
    }
    hasRestored.current = true;
  }, [key, enabled]);

  // Clear saved position
  const clearPosition = useCallback(() => {
    clearScrollPosition(key);
    hasRestored.current = false;
  }, [key]);

  // Clear position when deps change (if enabled)
  useEffect(() => {
    if (!clearOnChange || !enabled) return;

    const depsChanged = deps.some((dep, i) => dep !== previousDeps.current[i]);
    if (depsChanged) {
      clearPosition();
    }
    previousDeps.current = deps;
  }, [deps, clearOnChange, clearPosition, enabled]);

  // Restore scroll position on mount
  useEffect(() => {
    if (!enabled) return;

    const restore = () => {
      restorePosition();
    };

    if (restoreDelay > 0) {
      const timer = setTimeout(restore, restoreDelay);
      return () => clearTimeout(timer);
    } else {
      // Use requestAnimationFrame to ensure DOM is ready
      const frameId = requestAnimationFrame(restore);
      return () => cancelAnimationFrame(frameId);
    }
  }, [restorePosition, restoreDelay, enabled]);

  // Save scroll position before unmount
  useEffect(() => {
    if (!enabled) return;

    return () => {
      savePosition();
    };
  }, [savePosition, enabled]);

  // Save position on page visibility change (handles tab switches, minimize, etc.)
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        savePosition();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [savePosition, enabled]);

  // Save position before page unload
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      savePosition();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [savePosition, enabled]);

  return {
    scrollRef,
    savePosition,
    restorePosition,
    clearPosition,
  };
}

/**
 * Hook for managing scroll restoration on the main content area.
 * This is useful when you want to track scroll on the parent container
 * and pass it down to children.
 */
export function useMainScrollRestoration(key: string) {
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Find the main scrollable element
    const main = document.querySelector('main.overflow-y-auto') as HTMLElement | null;
    if (main) {
      scrollRef.current = main;

      // Restore position
      const savedPosition = getScrollPosition(key);
      if (savedPosition > 0) {
        requestAnimationFrame(() => {
          main.scrollTop = savedPosition;
        });
      }

      // Save position before unmount
      return () => {
        if (main.scrollTop > 0) {
          saveScrollPosition(key, main.scrollTop);
        }
      };
    }
  }, [key]);

  return scrollRef;
}
