#!/usr/bin/env python3
"""
Persistent Metrics History for UnaMentis Server

Stores aggregated hourly and daily metrics for long-term analysis:
- Average and max values per hour
- Average and max values per day
- Minimal storage footprint for indefinite retention

Data is persisted to JSON files and loaded on startup.
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict

logger = logging.getLogger(__name__)

# Storage location
DATA_DIR = Path(__file__).parent / "data"
HOURLY_FILE = DATA_DIR / "metrics_hourly.json"
DAILY_FILE = DATA_DIR / "metrics_daily.json"


@dataclass
class HourlyMetrics:
    """Aggregated metrics for one hour"""
    hour: str  # ISO format: "2025-12-22T14:00:00"

    # Power/Battery
    avg_battery_draw_w: float = 0.0
    max_battery_draw_w: float = 0.0
    min_battery_percent: float = 100.0
    max_battery_percent: float = 100.0

    # Thermal
    avg_thermal_level: float = 0.0
    max_thermal_level: int = 0
    avg_cpu_temp_c: float = 0.0
    max_cpu_temp_c: float = 0.0

    # CPU
    avg_cpu_percent: float = 0.0
    max_cpu_percent: float = 0.0

    # Per-service CPU (averages)
    service_cpu_avg: Dict[str, float] = field(default_factory=dict)
    service_cpu_max: Dict[str, float] = field(default_factory=dict)

    # Activity
    total_requests: int = 0
    total_inferences: int = 0

    # Idle state distribution (seconds in each state)
    idle_state_seconds: Dict[str, int] = field(default_factory=dict)

    # Sample count (for calculating aggregates)
    sample_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HourlyMetrics":
        return cls(**data)


@dataclass
class DailyMetrics:
    """Aggregated metrics for one day"""
    date: str  # ISO format: "2025-12-22"

    # Power/Battery
    avg_battery_draw_w: float = 0.0
    max_battery_draw_w: float = 0.0
    min_battery_percent: float = 100.0
    battery_drain_percent: float = 0.0  # How much battery was consumed

    # Thermal
    avg_thermal_level: float = 0.0
    max_thermal_level: int = 0
    thermal_events_count: int = 0  # Times thermal_level > 1
    avg_cpu_temp_c: float = 0.0
    max_cpu_temp_c: float = 0.0

    # CPU
    avg_cpu_percent: float = 0.0
    max_cpu_percent: float = 0.0

    # Per-service CPU
    service_cpu_avg: Dict[str, float] = field(default_factory=dict)

    # Activity
    total_requests: int = 0
    total_inferences: int = 0
    active_hours: int = 0  # Hours with any activity

    # Idle state distribution (hours in each state)
    idle_state_hours: Dict[str, float] = field(default_factory=dict)

    # Derived
    hours_aggregated: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DailyMetrics":
        return cls(**data)


class MetricsHistory:
    """
    Manages persistent historical metrics with hourly and daily aggregation.

    Collection flow:
    1. Raw metrics come from ResourceMonitor (every 5s)
    2. Current hour accumulator collects samples
    3. At hour boundary, accumulator is finalized and stored
    4. Daily metrics are aggregated from hourly data
    """

    def __init__(self):
        # In-memory storage
        self.hourly_metrics: Dict[str, HourlyMetrics] = {}  # key: "2025-12-22T14:00:00"
        self.daily_metrics: Dict[str, DailyMetrics] = {}    # key: "2025-12-22"

        # Current hour accumulator
        self._current_hour: Optional[str] = None
        self._hour_accumulator: Optional[_HourAccumulator] = None

        # Background task
        self._running = False
        self._save_task: Optional[asyncio.Task] = None
        self._dirty = False

        # Load existing data
        self._load_data()

    def _load_data(self):
        """Load historical data from disk"""
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        # Load hourly
        if HOURLY_FILE.exists():
            try:
                with open(HOURLY_FILE) as f:
                    data = json.load(f)
                    for key, metrics in data.items():
                        self.hourly_metrics[key] = HourlyMetrics.from_dict(metrics)
                logger.info(f"[MetricsHistory] Loaded {len(self.hourly_metrics)} hourly records")
            except Exception as e:
                logger.error(f"[MetricsHistory] Error loading hourly data: {e}")

        # Load daily
        if DAILY_FILE.exists():
            try:
                with open(DAILY_FILE) as f:
                    data = json.load(f)
                    for key, metrics in data.items():
                        self.daily_metrics[key] = DailyMetrics.from_dict(metrics)
                logger.info(f"[MetricsHistory] Loaded {len(self.daily_metrics)} daily records")
            except Exception as e:
                logger.error(f"[MetricsHistory] Error loading daily data: {e}")

    def _save_data(self):
        """Save historical data to disk"""
        DATA_DIR.mkdir(parents=True, exist_ok=True)

        try:
            # Save hourly
            hourly_data = {k: v.to_dict() for k, v in self.hourly_metrics.items()}
            with open(HOURLY_FILE, 'w') as f:
                json.dump(hourly_data, f, indent=2)

            # Save daily
            daily_data = {k: v.to_dict() for k, v in self.daily_metrics.items()}
            with open(DAILY_FILE, 'w') as f:
                json.dump(daily_data, f, indent=2)

            self._dirty = False
            logger.debug("[MetricsHistory] Saved metrics to disk")
        except Exception as e:
            logger.error(f"[MetricsHistory] Error saving data: {e}")

    async def start(self):
        """Start background save task"""
        if self._running:
            return
        self._running = True
        self._save_task = asyncio.create_task(self._save_loop())
        logger.info("[MetricsHistory] Started")

    async def stop(self):
        """Stop and save"""
        self._running = False
        if self._save_task:
            self._save_task.cancel()
            try:
                await self._save_task
            except asyncio.CancelledError:
                pass

        # Finalize current hour and save
        self._finalize_current_hour()
        self._save_data()
        logger.info("[MetricsHistory] Stopped and saved")

    async def _save_loop(self):
        """Periodically save data to disk"""
        while self._running:
            try:
                await asyncio.sleep(300)  # Save every 5 minutes

                # Check for hour boundary
                self._check_hour_boundary()

                # Save if dirty
                if self._dirty:
                    self._save_data()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[MetricsHistory] Save loop error: {e}")

    def record_sample(self, metrics_summary: Dict[str, Any], idle_state: str):
        """
        Record a metrics sample (called from ResourceMonitor).

        Args:
            metrics_summary: Output from resource_monitor.get_summary()
            idle_state: Current idle state from idle_manager
        """
        now = datetime.now()
        hour_key = now.replace(minute=0, second=0, microsecond=0).isoformat()

        # Check if we need a new hour accumulator
        if self._current_hour != hour_key:
            self._finalize_current_hour()
            self._current_hour = hour_key
            self._hour_accumulator = _HourAccumulator(hour_key)

        # Add sample to accumulator
        if self._hour_accumulator:
            self._hour_accumulator.add_sample(metrics_summary, idle_state)

        self._dirty = True

    def _check_hour_boundary(self):
        """Check if we've crossed an hour boundary"""
        now = datetime.now()
        hour_key = now.replace(minute=0, second=0, microsecond=0).isoformat()

        if self._current_hour and self._current_hour != hour_key:
            self._finalize_current_hour()
            self._current_hour = hour_key
            self._hour_accumulator = _HourAccumulator(hour_key)

    def _finalize_current_hour(self):
        """Finalize the current hour's metrics"""
        if not self._hour_accumulator or not self._hour_accumulator.sample_count:
            return

        hourly = self._hour_accumulator.finalize()
        self.hourly_metrics[hourly.hour] = hourly

        # Update daily aggregation
        date_key = hourly.hour[:10]  # "2025-12-22"
        self._update_daily_metrics(date_key)

        logger.info(f"[MetricsHistory] Finalized hour {hourly.hour}: {hourly.sample_count} samples")
        self._dirty = True

    def _update_daily_metrics(self, date_key: str):
        """Aggregate daily metrics from hourly data"""
        # Get all hourly metrics for this day
        hourly_for_day = [
            m for k, m in self.hourly_metrics.items()
            if k.startswith(date_key)
        ]

        if not hourly_for_day:
            return

        # Aggregate
        daily = DailyMetrics(date=date_key)
        daily.hours_aggregated = len(hourly_for_day)

        # Averages
        daily.avg_battery_draw_w = sum(h.avg_battery_draw_w for h in hourly_for_day) / len(hourly_for_day)
        daily.max_battery_draw_w = max(h.max_battery_draw_w for h in hourly_for_day)
        daily.min_battery_percent = min(h.min_battery_percent for h in hourly_for_day)

        daily.avg_thermal_level = sum(h.avg_thermal_level for h in hourly_for_day) / len(hourly_for_day)
        daily.max_thermal_level = max(h.max_thermal_level for h in hourly_for_day)
        daily.thermal_events_count = sum(1 for h in hourly_for_day if h.max_thermal_level > 1)

        daily.avg_cpu_temp_c = sum(h.avg_cpu_temp_c for h in hourly_for_day) / len(hourly_for_day)
        daily.max_cpu_temp_c = max(h.max_cpu_temp_c for h in hourly_for_day)

        daily.avg_cpu_percent = sum(h.avg_cpu_percent for h in hourly_for_day) / len(hourly_for_day)
        daily.max_cpu_percent = max(h.max_cpu_percent for h in hourly_for_day)

        # Per-service averages
        service_cpu_sums: Dict[str, List[float]] = defaultdict(list)
        for h in hourly_for_day:
            for svc, cpu in h.service_cpu_avg.items():
                service_cpu_sums[svc].append(cpu)
        daily.service_cpu_avg = {
            svc: sum(values) / len(values)
            for svc, values in service_cpu_sums.items()
        }

        # Activity
        daily.total_requests = sum(h.total_requests for h in hourly_for_day)
        daily.total_inferences = sum(h.total_inferences for h in hourly_for_day)
        daily.active_hours = sum(1 for h in hourly_for_day if h.total_requests > 0)

        # Idle state distribution
        state_seconds: Dict[str, int] = defaultdict(int)
        for h in hourly_for_day:
            for state, secs in h.idle_state_seconds.items():
                state_seconds[state] += secs
        daily.idle_state_hours = {
            state: secs / 3600
            for state, secs in state_seconds.items()
        }

        self.daily_metrics[date_key] = daily

    def get_hourly_history(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get hourly metrics for the last N days"""
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()

        result = [
            m.to_dict() for k, m in sorted(self.hourly_metrics.items())
            if k >= cutoff
        ]
        return result

    def get_daily_history(self, days: int = 30) -> List[Dict[str, Any]]:
        """Get daily metrics for the last N days"""
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        result = [
            m.to_dict() for k, m in sorted(self.daily_metrics.items())
            if k >= cutoff
        ]
        return result

    def get_summary_stats(self) -> Dict[str, Any]:
        """Get high-level summary statistics"""
        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        this_week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")

        # Today's metrics
        today_metrics = self.daily_metrics.get(today)
        yesterday_metrics = self.daily_metrics.get(yesterday)

        # This week averages
        week_daily = [
            m for k, m in self.daily_metrics.items()
            if k >= this_week_start
        ]

        return {
            "today": today_metrics.to_dict() if today_metrics else None,
            "yesterday": yesterday_metrics.to_dict() if yesterday_metrics else None,
            "this_week": {
                "days_recorded": len(week_daily),
                "avg_cpu_percent": sum(d.avg_cpu_percent for d in week_daily) / len(week_daily) if week_daily else 0,
                "total_requests": sum(d.total_requests for d in week_daily),
                "max_thermal_level": max((d.max_thermal_level for d in week_daily), default=0),
            } if week_daily else None,
            "total_days_tracked": len(self.daily_metrics),
            "total_hours_tracked": len(self.hourly_metrics),
            "oldest_record": min(self.daily_metrics.keys()) if self.daily_metrics else None,
        }


class _HourAccumulator:
    """Accumulates samples for a single hour before finalization"""

    def __init__(self, hour: str):
        self.hour = hour
        self.sample_count = 0

        # Accumulators
        self.battery_draw_sum = 0.0
        self.battery_draw_max = 0.0
        self.battery_percent_min = 100.0
        self.battery_percent_max = 0.0

        self.thermal_level_sum = 0.0
        self.thermal_level_max = 0
        self.cpu_temp_sum = 0.0
        self.cpu_temp_max = 0.0

        self.cpu_percent_sum = 0.0
        self.cpu_percent_max = 0.0

        self.service_cpu_sums: Dict[str, float] = defaultdict(float)
        self.service_cpu_maxes: Dict[str, float] = defaultdict(float)
        self.service_cpu_counts: Dict[str, int] = defaultdict(int)

        self.total_requests = 0
        self.total_inferences = 0

        self.idle_state_seconds: Dict[str, int] = defaultdict(int)
        self.last_sample_time: Optional[float] = None

    def add_sample(self, metrics: Dict[str, Any], idle_state: str):
        """Add a sample to the accumulator"""
        self.sample_count += 1
        now = time.time()

        # Power/Battery
        power = metrics.get("power", {})
        battery_draw = power.get("current_battery_draw_w", 0) or power.get("avg_battery_draw_w", 0)
        self.battery_draw_sum += battery_draw
        self.battery_draw_max = max(self.battery_draw_max, battery_draw)

        battery_pct = power.get("battery_percent", 100)
        self.battery_percent_min = min(self.battery_percent_min, battery_pct)
        self.battery_percent_max = max(self.battery_percent_max, battery_pct)

        # Thermal
        thermal = metrics.get("thermal", {})
        thermal_level = thermal.get("pressure_level", 0)
        self.thermal_level_sum += thermal_level
        self.thermal_level_max = max(self.thermal_level_max, thermal_level)

        cpu_temp = thermal.get("cpu_temp_c", 0)
        self.cpu_temp_sum += cpu_temp
        self.cpu_temp_max = max(self.cpu_temp_max, cpu_temp)

        # CPU
        cpu = metrics.get("cpu", {})
        cpu_pct = cpu.get("total_percent", 0)
        self.cpu_percent_sum += cpu_pct
        self.cpu_percent_max = max(self.cpu_percent_max, cpu_pct)

        # Per-service CPU
        for svc, pct in cpu.get("by_service", {}).items():
            self.service_cpu_sums[svc] += pct
            self.service_cpu_maxes[svc] = max(self.service_cpu_maxes[svc], pct)
            self.service_cpu_counts[svc] += 1

        # Idle state tracking
        if self.last_sample_time:
            elapsed = int(now - self.last_sample_time)
            self.idle_state_seconds[idle_state] += elapsed
        self.last_sample_time = now

    def finalize(self) -> HourlyMetrics:
        """Finalize and return hourly metrics"""
        if self.sample_count == 0:
            return HourlyMetrics(hour=self.hour)

        return HourlyMetrics(
            hour=self.hour,
            avg_battery_draw_w=round(self.battery_draw_sum / self.sample_count, 2),
            max_battery_draw_w=round(self.battery_draw_max, 2),
            min_battery_percent=round(self.battery_percent_min, 1),
            max_battery_percent=round(self.battery_percent_max, 1),
            avg_thermal_level=round(self.thermal_level_sum / self.sample_count, 2),
            max_thermal_level=self.thermal_level_max,
            avg_cpu_temp_c=round(self.cpu_temp_sum / self.sample_count, 1),
            max_cpu_temp_c=round(self.cpu_temp_max, 1),
            avg_cpu_percent=round(self.cpu_percent_sum / self.sample_count, 1),
            max_cpu_percent=round(self.cpu_percent_max, 1),
            service_cpu_avg={
                svc: round(self.service_cpu_sums[svc] / self.service_cpu_counts[svc], 1)
                for svc in self.service_cpu_sums
            },
            service_cpu_max={
                svc: round(max_val, 1)
                for svc, max_val in self.service_cpu_maxes.items()
            },
            total_requests=self.total_requests,
            total_inferences=self.total_inferences,
            idle_state_seconds=dict(self.idle_state_seconds),
            sample_count=self.sample_count,
        )


# Singleton instance
metrics_history = MetricsHistory()
