// UnaMentis Management Console Types

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  label: string;
  message: string;
  file?: string;
  function?: string;
  line?: number;
  metadata?: Record<string, unknown>;
  client_id: string;
  client_name: string;
  received_at: number;
}

export interface MetricsSnapshot {
  id: string;
  client_id: string;
  client_name: string;
  timestamp: string;
  received_at: number;
  session_duration: number;
  turns_total: number;
  interruptions: number;
  // Latencies (in ms)
  stt_latency_median: number;
  stt_latency_p99: number;
  llm_ttft_median: number;
  llm_ttft_p99: number;
  tts_ttfb_median: number;
  tts_ttfb_p99: number;
  e2e_latency_median: number;
  e2e_latency_p99: number;
  // Costs
  stt_cost: number;
  tts_cost: number;
  llm_cost: number;
  total_cost: number;
  // Device stats
  thermal_throttle_events: number;
  network_degradations: number;
}

export interface RemoteClient {
  id: string;
  name: string;
  device_model: string;
  os_version: string;
  app_version: string;
  first_seen: number;
  last_seen: number;
  ip_address: string;
  status: 'online' | 'idle' | 'offline';
  current_session_id?: string;
  total_sessions: number;
  total_logs: number;
  config?: Record<string, unknown>;
}

export interface ServerStatus {
  id: string;
  name: string;
  type: 'ollama' | 'whisper' | 'piper' | 'unamentisGateway' | 'custom';
  url: string;
  port: number;
  status: 'unknown' | 'healthy' | 'degraded' | 'unhealthy';
  last_check: number;
  response_time_ms: number;
  capabilities?: Record<string, unknown>;
  models: string[];
  error_message?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: 'llm' | 'stt' | 'tts';
  server_id: string;
  server_name: string;
  status: 'available' | 'loading' | 'unavailable';
  size_bytes?: number;
  parameters?: string;
  quantization?: string;
}

export interface DashboardStats {
  uptime_seconds: number;
  total_logs: number;
  total_metrics: number;
  errors_count: number;
  warnings_count: number;
  logs_last_hour: number;
  sessions_last_hour: number;
  online_clients: number;
  total_clients: number;
  healthy_servers: number;
  total_servers: number;
  avg_e2e_latency: number;
  avg_llm_ttft: number;
  websocket_connections: number;
}

// API Response types
export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface MetricsResponse {
  metrics: MetricsSnapshot[];
  aggregates: {
    avg_e2e_latency: number;
    avg_llm_ttft: number;
    avg_stt_latency: number;
    avg_tts_ttfb: number;
    total_cost: number;
    total_sessions: number;
    total_turns: number;
  };
}

export interface ClientsResponse {
  clients: RemoteClient[];
  total: number;
  online: number;
  idle: number;
  offline: number;
}

export interface ServersResponse {
  servers: ServerStatus[];
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
}

export interface ModelsResponse {
  models: ModelInfo[];
  total: number;
  by_type: {
    llm: number;
    stt: number;
    tts: number;
  };
}

// System Health & Resource Monitoring Types
export interface PowerMetrics {
  current_battery_draw_w: number;
  avg_battery_draw_w: number;
  battery_percent: number;
  battery_charging: boolean;
  estimated_service_power_w: number;
}

export interface ThermalMetrics {
  pressure: 'nominal' | 'fair' | 'serious' | 'critical';
  pressure_level: number;
  cpu_temp_c: number;
  gpu_temp_c: number;
  fan_speed_rpm: number;
}

export interface CpuMetrics {
  total_percent: number;
  by_service: Record<string, number>;
}

export interface ServiceResourceMetrics {
  service_id: string;
  service_name: string;
  status: string;
  cpu_percent: number;
  memory_mb: number;
  gpu_memory_mb: number;
  last_request_time: number | null;
  request_count_5m: number;
  model_loaded: boolean;
  estimated_power_w: number;
}

export interface SystemMetricsSummary {
  timestamp: number;
  power: PowerMetrics;
  thermal: ThermalMetrics;
  cpu: CpuMetrics;
  services: Record<string, ServiceResourceMetrics>;
  history_minutes: number;
}

export interface IdleStatus {
  enabled: boolean;
  current_state: 'active' | 'warm' | 'cool' | 'cold' | 'dormant';
  current_mode: string;
  seconds_idle: number;
  last_activity_type: string;
  last_activity_time: number;
  thresholds: {
    warm: number;
    cool: number;
    cold: number;
    dormant: number;
  };
  keep_awake_remaining: number;
  next_state_in: {
    state: string;
    seconds_remaining: number;
  } | null;
}

export interface PowerMode {
  name: string;
  description: string;
  thresholds: {
    warm: number;
    cool: number;
    cold: number;
    dormant: number;
  };
  enabled: boolean;
}

export interface PowerModesResponse {
  modes: Record<string, PowerMode>;
  current: string;
}

export interface IdleTransition {
  timestamp: number;
  from_state: string;
  to_state: string;
  idle_seconds: number;
  trigger: string;
}

export interface HourlyMetrics {
  hour: string;
  avg_battery_draw_w: number;
  max_battery_draw_w: number;
  min_battery_percent: number;
  max_battery_percent: number;
  avg_thermal_level: number;
  max_thermal_level: number;
  avg_cpu_temp_c: number;
  max_cpu_temp_c: number;
  avg_cpu_percent: number;
  max_cpu_percent: number;
  service_cpu_avg: Record<string, number>;
  service_cpu_max: Record<string, number>;
  total_requests: number;
  total_inferences: number;
  idle_state_seconds: Record<string, number>;
  sample_count: number;
}

export interface DailyMetrics {
  date: string;
  avg_battery_draw_w: number;
  max_battery_draw_w: number;
  min_battery_percent: number;
  battery_drain_percent: number;
  avg_thermal_level: number;
  max_thermal_level: number;
  thermal_events_count: number;
  avg_cpu_temp_c: number;
  max_cpu_temp_c: number;
  avg_cpu_percent: number;
  max_cpu_percent: number;
  service_cpu_avg: Record<string, number>;
  total_requests: number;
  total_inferences: number;
  active_hours: number;
  idle_state_hours: Record<string, number>;
  hours_aggregated: number;
}

export interface MetricsHistorySummary {
  today: DailyMetrics | null;
  yesterday: DailyMetrics | null;
  this_week: {
    days_recorded: number;
    avg_cpu_percent: number;
    total_requests: number;
    max_thermal_level: number;
  } | null;
  total_days_tracked: number;
  total_hours_tracked: number;
  oldest_record: string | null;
}
