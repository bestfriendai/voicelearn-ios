// API Client with mock data fallback for standalone operation
import type {
  LogsResponse,
  MetricsResponse,
  ClientsResponse,
  ServersResponse,
  ModelsResponse,
  DashboardStats,
  LogEntry,
  MetricsSnapshot,
  SystemMetricsSummary,
  IdleStatus,
  PowerModesResponse,
  IdleTransition,
  HourlyMetrics,
  DailyMetrics,
  MetricsHistorySummary,
} from '@/types';
import {
  mockLogs,
  mockMetrics,
  mockClients,
  mockServers,
  mockModels,
  getMockStats,
  generateMockLog,
} from './mock-data';

// Configuration
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || !BACKEND_URL;

// In-memory state for demo mode (simulates backend state)
let demoLogs: LogEntry[] = [...mockLogs];
let demoMetrics: MetricsSnapshot[] = [...mockMetrics];
let lastLogTime = Date.now();

// Add periodic log generation for demo
if (typeof window !== 'undefined' && USE_MOCK) {
  setInterval(() => {
    if (Date.now() - lastLogTime > 5000) {
      demoLogs = [generateMockLog(), ...demoLogs].slice(0, 500);
      lastLogTime = Date.now();
    }
  }, 5000);
}

async function fetchWithFallback<T>(
  endpoint: string,
  mockFn: () => T,
  options?: RequestInit
): Promise<T> {
  // If explicitly using mock or no backend configured
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    return mockFn();
  }

  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`Backend unavailable, using mock data for ${endpoint}:`, error);
    return mockFn();
  }
}

// API Functions
export async function getStats(): Promise<DashboardStats> {
  return fetchWithFallback('/api/stats', getMockStats);
}

export async function getLogs(params?: {
  limit?: number;
  offset?: number;
  level?: string;
  search?: string;
  client_id?: string;
}): Promise<LogsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));
  if (params?.level) queryParams.set('level', params.level);
  if (params?.search) queryParams.set('search', params.search);
  if (params?.client_id) queryParams.set('client_id', params.client_id);

  const query = queryParams.toString();
  const endpoint = `/api/logs${query ? `?${query}` : ''}`;

  return fetchWithFallback(endpoint, () => {
    let filtered = [...demoLogs];

    if (params?.level) {
      const levels = params.level.split(',');
      filtered = filtered.filter(l => levels.includes(l.level));
    }

    if (params?.search) {
      const search = params.search.toLowerCase();
      filtered = filtered.filter(
        l => l.message.toLowerCase().includes(search) || l.label.toLowerCase().includes(search)
      );
    }

    if (params?.client_id) {
      filtered = filtered.filter(l => l.client_id === params.client_id);
    }

    // Sort by received_at descending
    filtered.sort((a, b) => b.received_at - a.received_at);

    const offset = params?.offset || 0;
    const limit = params?.limit || 500;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      logs: paginated,
      total: filtered.length,
      limit,
      offset,
    };
  });
}

export async function getMetrics(params?: {
  limit?: number;
  client_id?: string;
}): Promise<MetricsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.client_id) queryParams.set('client_id', params.client_id);

  const query = queryParams.toString();
  const endpoint = `/api/metrics${query ? `?${query}` : ''}`;

  return fetchWithFallback(endpoint, () => {
    let filtered = [...demoMetrics];

    if (params?.client_id) {
      filtered = filtered.filter(m => m.client_id === params.client_id);
    }

    // Sort by received_at descending
    filtered.sort((a, b) => b.received_at - a.received_at);

    const limit = params?.limit || 100;
    filtered = filtered.slice(0, limit);

    // Calculate aggregates
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    return {
      metrics: filtered,
      aggregates: {
        avg_e2e_latency: Math.round(avg(filtered.map(m => m.e2e_latency_median)) * 100) / 100,
        avg_llm_ttft: Math.round(avg(filtered.map(m => m.llm_ttft_median)) * 100) / 100,
        avg_stt_latency: Math.round(avg(filtered.map(m => m.stt_latency_median)) * 100) / 100,
        avg_tts_ttfb: Math.round(avg(filtered.map(m => m.tts_ttfb_median)) * 100) / 100,
        total_cost: Math.round(filtered.reduce((sum, m) => sum + m.total_cost, 0) * 10000) / 10000,
        total_sessions: filtered.length,
        total_turns: filtered.reduce((sum, m) => sum + m.turns_total, 0),
      },
    };
  });
}

export async function getClients(): Promise<ClientsResponse> {
  return fetchWithFallback('/api/clients', () => {
    const clients = [...mockClients];

    return {
      clients,
      total: clients.length,
      online: clients.filter(c => c.status === 'online').length,
      idle: clients.filter(c => c.status === 'idle').length,
      offline: clients.filter(c => c.status === 'offline').length,
    };
  });
}

export async function getServers(): Promise<ServersResponse> {
  return fetchWithFallback('/api/servers', () => {
    const servers = [...mockServers];

    return {
      servers,
      total: servers.length,
      healthy: servers.filter(s => s.status === 'healthy').length,
      degraded: servers.filter(s => s.status === 'degraded').length,
      unhealthy: servers.filter(s => s.status === 'unhealthy').length,
    };
  });
}

export async function getModels(): Promise<ModelsResponse> {
  return fetchWithFallback('/api/models', () => {
    const models = [...mockModels];

    return {
      models,
      total: models.length,
      by_type: {
        llm: models.filter(m => m.type === 'llm').length,
        stt: models.filter(m => m.type === 'stt').length,
        tts: models.filter(m => m.type === 'tts').length,
      },
    };
  });
}

// Clear logs (demo mode only affects in-memory state)
export async function clearLogs(): Promise<void> {
  if (USE_MOCK) {
    demoLogs = [];
    return;
  }

  await fetch(`${BACKEND_URL}/api/logs`, { method: 'DELETE' });
}

// Add log (for testing)
export async function addLog(log: Omit<LogEntry, 'id' | 'received_at'>): Promise<void> {
  if (USE_MOCK) {
    const newLog: LogEntry = {
      ...log,
      id: Math.random().toString(36).substring(2, 15),
      received_at: Date.now(),
    };
    demoLogs = [newLog, ...demoLogs].slice(0, 500);
    return;
  }

  await fetch(`${BACKEND_URL}/api/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log),
  });
}

// Check if using mock mode
export function isUsingMockData(): boolean {
  return USE_MOCK;
}

// Get backend URL
export function getBackendUrl(): string {
  return BACKEND_URL || '(not configured)';
}

// =============================================================================
// System Health & Resource Monitoring APIs
// =============================================================================

const mockSystemMetrics: SystemMetricsSummary = {
  timestamp: Date.now() / 1000,
  power: {
    current_battery_draw_w: 8.5,
    avg_battery_draw_w: 7.2,
    battery_percent: 78,
    battery_charging: false,
    estimated_service_power_w: 5.3,
  },
  thermal: {
    pressure: 'nominal',
    pressure_level: 0,
    cpu_temp_c: 45.2,
    gpu_temp_c: 42.1,
    fan_speed_rpm: 0,
  },
  cpu: {
    total_percent: 12.5,
    by_service: {
      ollama: 2.1,
      vibevoice: 5.3,
      management: 1.2,
      nextjs: 3.9,
    },
  },
  services: {
    ollama: {
      service_id: 'ollama',
      service_name: 'Ollama',
      status: 'running',
      cpu_percent: 2.1,
      memory_mb: 245,
      gpu_memory_mb: 0,
      last_request_time: Date.now() / 1000 - 300,
      request_count_5m: 0,
      model_loaded: false,
      estimated_power_w: 0.5,
    },
    vibevoice: {
      service_id: 'vibevoice',
      service_name: 'VibeVoice',
      status: 'running',
      cpu_percent: 5.3,
      memory_mb: 2100,
      gpu_memory_mb: 1800,
      last_request_time: Date.now() / 1000 - 120,
      request_count_5m: 3,
      model_loaded: true,
      estimated_power_w: 2.5,
    },
  },
  history_minutes: 60,
};

const mockIdleStatus: IdleStatus = {
  enabled: true,
  current_state: 'warm',
  current_mode: 'balanced',
  seconds_idle: 45,
  last_activity_type: 'request',
  last_activity_time: Date.now() / 1000 - 45,
  thresholds: {
    warm: 30,
    cool: 300,
    cold: 1800,
    dormant: 7200,
  },
  keep_awake_remaining: 0,
  next_state_in: {
    state: 'cool',
    seconds_remaining: 255,
  },
};

const mockPowerModes: PowerModesResponse = {
  modes: {
    performance: {
      name: 'Performance',
      description: 'Never idle, always ready. Maximum responsiveness, highest power.',
      thresholds: { warm: 9999999, cool: 9999999, cold: 9999999, dormant: 9999999 },
      enabled: false,
    },
    balanced: {
      name: 'Balanced',
      description: 'Default settings. Good balance of responsiveness and power saving.',
      thresholds: { warm: 30, cool: 300, cold: 1800, dormant: 7200 },
      enabled: true,
    },
    power_saver: {
      name: 'Power Saver',
      description: 'Aggressive power saving. Longer wake times but much lower power.',
      thresholds: { warm: 10, cool: 60, cold: 300, dormant: 1800 },
      enabled: true,
    },
  },
  current: 'balanced',
};

export async function getSystemMetrics(): Promise<SystemMetricsSummary> {
  return fetchWithFallback('/api/system/metrics', () => mockSystemMetrics);
}

export async function getIdleStatus(): Promise<IdleStatus> {
  return fetchWithFallback('/api/system/idle/status', () => mockIdleStatus);
}

export async function getPowerModes(): Promise<PowerModesResponse> {
  return fetchWithFallback('/api/system/idle/modes', () => mockPowerModes);
}

export async function setIdleConfig(config: {
  mode?: string;
  thresholds?: { warm?: number; cool?: number; cold?: number; dormant?: number };
  enabled?: boolean;
}): Promise<{ status: string; config: IdleStatus }> {
  if (USE_MOCK) {
    return { status: 'ok', config: mockIdleStatus };
  }

  const response = await fetch(`${BACKEND_URL}/api/system/idle/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function keepAwake(durationSeconds: number): Promise<{ status: string }> {
  if (USE_MOCK) {
    return { status: 'ok' };
  }

  const response = await fetch(`${BACKEND_URL}/api/system/idle/keep-awake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_seconds: durationSeconds }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function cancelKeepAwake(): Promise<{ status: string }> {
  if (USE_MOCK) {
    return { status: 'ok' };
  }

  const response = await fetch(`${BACKEND_URL}/api/system/idle/cancel-keep-awake`, {
    method: 'POST',
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function forceIdleState(state: string): Promise<{ status: string }> {
  if (USE_MOCK) {
    return { status: 'ok' };
  }

  const response = await fetch(`${BACKEND_URL}/api/system/idle/force-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function unloadAllModels(): Promise<{ status: string; results: Record<string, boolean> }> {
  if (USE_MOCK) {
    return { status: 'ok', results: { ollama: true, vibevoice: true } };
  }

  const response = await fetch(`${BACKEND_URL}/api/system/unload-models`, {
    method: 'POST',
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function getIdleHistory(limit: number = 50): Promise<{ history: IdleTransition[]; count: number }> {
  return fetchWithFallback(`/api/system/idle/history?limit=${limit}`, () => ({
    history: [],
    count: 0,
  }));
}

export async function getHourlyHistory(days: number = 7): Promise<{ history: HourlyMetrics[]; count: number }> {
  return fetchWithFallback(`/api/system/history/hourly?days=${days}`, () => ({
    history: [],
    count: 0,
  }));
}

export async function getDailyHistory(days: number = 30): Promise<{ history: DailyMetrics[]; count: number }> {
  return fetchWithFallback(`/api/system/history/daily?days=${days}`, () => ({
    history: [],
    count: 0,
  }));
}

export async function getMetricsHistorySummary(): Promise<MetricsHistorySummary> {
  return fetchWithFallback('/api/system/history/summary', () => ({
    today: null,
    yesterday: null,
    this_week: null,
    total_days_tracked: 0,
    total_hours_tracked: 0,
    oldest_record: null,
  }));
}
