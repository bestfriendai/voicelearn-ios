/**
 * Session State Management Utilities
 *
 * Provides localStorage-based persistence for UI state that doesn't belong in URLs:
 * - Scroll positions per panel
 * - Expanded/collapsed states
 * - UI preferences
 */

const STORAGE_KEY = 'unamentis-session-state';

// Types for session storage
export interface SessionStorage {
  scrollPositions: Record<string, number>;
  uiPreferences: {
    expandedItems: string[];
  };
  version: number;
}

const DEFAULT_SESSION: SessionStorage = {
  scrollPositions: {},
  uiPreferences: {
    expandedItems: [],
  },
  version: 1,
};

/**
 * Get the current session state from localStorage
 */
function getSessionState(): SessionStorage {
  if (typeof window === 'undefined') {
    return DEFAULT_SESSION;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SESSION;
    }
    const parsed = JSON.parse(stored) as SessionStorage;
    // Validate version and structure
    if (typeof parsed.version !== 'number' || parsed.version < 1) {
      return DEFAULT_SESSION;
    }
    return {
      ...DEFAULT_SESSION,
      ...parsed,
    };
  } catch {
    return DEFAULT_SESSION;
  }
}

/**
 * Save session state to localStorage
 */
function saveSessionState(state: SessionStorage): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // localStorage might be full or disabled
    console.warn('Failed to save session state:', error);
  }
}

// ============================================================
// Scroll Position Management
// ============================================================

/**
 * Save scroll position for a specific panel/view
 * @param key - Unique identifier for the scroll container (e.g., "curricula-list", "sources-catalog")
 * @param position - Scroll position in pixels
 */
export function saveScrollPosition(key: string, position: number): void {
  const state = getSessionState();
  state.scrollPositions[key] = position;
  saveSessionState(state);
}

/**
 * Get saved scroll position for a panel/view
 * @param key - Unique identifier for the scroll container
 * @returns Scroll position in pixels, or 0 if not found
 */
export function getScrollPosition(key: string): number {
  const state = getSessionState();
  return state.scrollPositions[key] ?? 0;
}

/**
 * Clear scroll position for a specific panel (e.g., when data changes significantly)
 */
export function clearScrollPosition(key: string): void {
  const state = getSessionState();
  delete state.scrollPositions[key];
  saveSessionState(state);
}

/**
 * Clear all scroll positions (e.g., on logout or major state reset)
 */
export function clearAllScrollPositions(): void {
  const state = getSessionState();
  state.scrollPositions = {};
  saveSessionState(state);
}

// ============================================================
// Expanded/Collapsed State Management
// ============================================================

/**
 * Check if an item is expanded
 */
export function isItemExpanded(itemId: string): boolean {
  const state = getSessionState();
  return state.uiPreferences.expandedItems.includes(itemId);
}

/**
 * Set expanded state for an item
 */
export function setItemExpanded(itemId: string, expanded: boolean): void {
  const state = getSessionState();
  const currentlyExpanded = state.uiPreferences.expandedItems.includes(itemId);

  if (expanded && !currentlyExpanded) {
    state.uiPreferences.expandedItems.push(itemId);
  } else if (!expanded && currentlyExpanded) {
    state.uiPreferences.expandedItems = state.uiPreferences.expandedItems.filter(
      (id) => id !== itemId
    );
  }

  saveSessionState(state);
}

/**
 * Get all expanded item IDs
 */
export function getExpandedItems(): string[] {
  const state = getSessionState();
  return [...state.uiPreferences.expandedItems];
}

/**
 * Clear all expanded states
 */
export function clearExpandedItems(): void {
  const state = getSessionState();
  state.uiPreferences.expandedItems = [];
  saveSessionState(state);
}

// ============================================================
// Session State Reset
// ============================================================

/**
 * Reset all session state to defaults
 */
export function resetSessionState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to reset session state:', error);
  }
}
