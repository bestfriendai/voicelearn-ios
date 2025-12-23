#!/usr/bin/env python3
"""
Idle State Manager for UnaMentis Server

Implements a tiered idle state system that progressively reduces
resource usage as the server sits idle, while maintaining acceptable
wake-up responsiveness.

States:
- ACTIVE (0-30s): Full operation, all services hot
- WARM (30s-5min): Reduce polling, maintain models
- COOL (5-30min): Unload TTS model, reduce Ollama keep_alive
- COLD (30min-2hr): Unload all models, minimal processes
- DORMANT (2hr+): Only management console running
"""

import asyncio
import json
import time
import logging
from collections import deque
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Callable, Dict, List, Optional, Any
import aiohttp

logger = logging.getLogger(__name__)

# Storage for custom profiles
PROFILES_FILE = Path(__file__).parent / "data" / "power_profiles.json"


class IdleState(Enum):
    """Server idle states from most active to most dormant"""
    ACTIVE = "active"
    WARM = "warm"
    COOL = "cool"
    COLD = "cold"
    DORMANT = "dormant"

    @property
    def level(self) -> int:
        """Numeric level for comparison"""
        return {
            IdleState.ACTIVE: 0,
            IdleState.WARM: 1,
            IdleState.COOL: 2,
            IdleState.COLD: 3,
            IdleState.DORMANT: 4,
        }[self]


@dataclass
class IdleThresholds:
    """Configurable thresholds for idle state transitions (in seconds)"""
    warm: int = 30          # 30 seconds
    cool: int = 300         # 5 minutes
    cold: int = 1800        # 30 minutes
    dormant: int = 7200     # 2 hours

    def to_dict(self) -> Dict[str, int]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, int]) -> "IdleThresholds":
        return cls(**{k: v for k, v in data.items() if k in ["warm", "cool", "cold", "dormant"]})


@dataclass
class PowerMode:
    """Predefined power mode configurations"""
    name: str
    description: str
    thresholds: IdleThresholds
    enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "thresholds": self.thresholds.to_dict(),
            "enabled": self.enabled,
        }


# Predefined power modes (built-in, cannot be deleted)
BUILTIN_POWER_MODES = {
    "performance": PowerMode(
        name="Performance",
        description="Never idle, always ready. Maximum responsiveness, highest power.",
        thresholds=IdleThresholds(warm=9999999, cool=9999999, cold=9999999, dormant=9999999),
        enabled=False,  # Disabled = no idle management
    ),
    "balanced": PowerMode(
        name="Balanced",
        description="Default settings. Good balance of responsiveness and power saving.",
        thresholds=IdleThresholds(warm=30, cool=300, cold=1800, dormant=7200),
    ),
    "power_saver": PowerMode(
        name="Power Saver",
        description="Aggressive power saving. Longer wake times but much lower power.",
        thresholds=IdleThresholds(warm=10, cool=60, cold=300, dormant=1800),
    ),
    "development": PowerMode(
        name="Development",
        description="Optimized for active development. Quick transitions but saves power during breaks.",
        thresholds=IdleThresholds(warm=60, cool=180, cold=600, dormant=3600),
    ),
    "presentation": PowerMode(
        name="Presentation",
        description="For demos and presentations. Stays responsive longer.",
        thresholds=IdleThresholds(warm=300, cool=900, cold=3600, dormant=7200),
    ),
}

# Mutable copy that includes custom profiles
POWER_MODES: Dict[str, PowerMode] = dict(BUILTIN_POWER_MODES)


@dataclass
class StateTransition:
    """Record of a state transition"""
    timestamp: float
    from_state: str
    to_state: str
    idle_seconds: float
    trigger: str  # "timeout" or "activity"


class IdleManager:
    """
    Manages server idle state and coordinates service resource usage.

    Tracks activity across all services and transitions between idle states
    based on configurable thresholds. Notifies registered handlers when
    states change so they can adjust resource usage accordingly.
    """

    def __init__(self):
        self.last_activity = time.time()
        self.last_activity_type = "startup"
        self.current_state = IdleState.ACTIVE
        self.thresholds = IdleThresholds()

        # Power mode
        self.current_mode = "balanced"
        self.enabled = True

        # State transition handlers
        self._handlers: Dict[IdleState, List[Callable]] = {state: [] for state in IdleState}
        self._global_handlers: List[Callable] = []

        # Transition history
        self.transition_history: deque = deque(maxlen=100)

        # Keep-awake override
        self._keep_awake_until: Optional[float] = None

        # Background monitoring
        self._running = False
        self._monitor_task: Optional[asyncio.Task] = None

        # Service references (set by server.py)
        self._ollama_unload_callback: Optional[Callable] = None
        self._vibevoice_unload_callback: Optional[Callable] = None
        self._vibevoice_load_callback: Optional[Callable] = None

    async def start(self):
        """Start idle monitoring"""
        if self._running:
            return
        self._running = True
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        logger.info("[IdleManager] Started idle monitoring")

    async def stop(self):
        """Stop idle monitoring"""
        self._running = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        logger.info("[IdleManager] Stopped")

    def record_activity(self, activity_type: str = "request", service: str = ""):
        """
        Record user activity - resets idle timer and transitions to ACTIVE.

        Args:
            activity_type: Type of activity (request, inference, websocket, etc.)
            service: Service that received the activity
        """
        now = time.time()
        was_idle = self.current_state != IdleState.ACTIVE

        self.last_activity = now
        self.last_activity_type = activity_type

        if was_idle and self.enabled:
            # Schedule async transition
            asyncio.create_task(self._transition_to(IdleState.ACTIVE, "activity"))

            logger.info(f"[IdleManager] Activity detected ({activity_type}), waking from {self.current_state.value}")

    def register_handler(self, state: IdleState, handler: Callable):
        """
        Register a callback for when entering a specific state.

        Handler signature: async def handler(from_state: IdleState, to_state: IdleState)
        """
        self._handlers[state].append(handler)

    def register_global_handler(self, handler: Callable):
        """
        Register a callback for any state transition.

        Handler signature: async def handler(from_state: IdleState, to_state: IdleState)
        """
        self._global_handlers.append(handler)

    def set_mode(self, mode_name: str) -> bool:
        """Set power mode by name"""
        if mode_name not in POWER_MODES:
            return False

        mode = POWER_MODES[mode_name]
        self.current_mode = mode_name
        self.enabled = mode.enabled
        self.thresholds = mode.thresholds

        logger.info(f"[IdleManager] Set power mode: {mode_name}")
        return True

    def set_thresholds(self, thresholds: Dict[str, int]):
        """Set custom thresholds"""
        self.thresholds = IdleThresholds.from_dict(thresholds)
        self.current_mode = "custom"
        logger.info(f"[IdleManager] Set custom thresholds: {thresholds}")

    def keep_awake(self, duration_seconds: int):
        """Keep system awake for specified duration"""
        self._keep_awake_until = time.time() + duration_seconds
        logger.info(f"[IdleManager] Keeping awake for {duration_seconds}s")

        # Force transition to ACTIVE
        if self.current_state != IdleState.ACTIVE:
            asyncio.create_task(self._transition_to(IdleState.ACTIVE, "keep_awake"))

    def cancel_keep_awake(self):
        """Cancel keep-awake override"""
        self._keep_awake_until = None
        logger.info("[IdleManager] Keep-awake cancelled")

    async def force_state(self, state: IdleState):
        """Force transition to a specific state (manual override)"""
        if state != self.current_state:
            await self._transition_to(state, "manual")

    async def _monitor_loop(self):
        """Background loop to check idle state"""
        while self._running:
            try:
                await asyncio.sleep(10)  # Check every 10 seconds

                if not self.enabled:
                    continue

                # Check keep-awake override
                if self._keep_awake_until and time.time() < self._keep_awake_until:
                    continue

                if self._keep_awake_until and time.time() >= self._keep_awake_until:
                    self._keep_awake_until = None
                    logger.info("[IdleManager] Keep-awake expired")

                idle_seconds = time.time() - self.last_activity
                target_state = self._calculate_state(idle_seconds)

                if target_state != self.current_state:
                    await self._transition_to(target_state, "timeout")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[IdleManager] Monitor error: {e}")

    def _calculate_state(self, idle_seconds: float) -> IdleState:
        """Calculate target state based on idle duration"""
        if idle_seconds >= self.thresholds.dormant:
            return IdleState.DORMANT
        elif idle_seconds >= self.thresholds.cold:
            return IdleState.COLD
        elif idle_seconds >= self.thresholds.cool:
            return IdleState.COOL
        elif idle_seconds >= self.thresholds.warm:
            return IdleState.WARM
        else:
            return IdleState.ACTIVE

    async def _transition_to(self, new_state: IdleState, trigger: str):
        """Handle state transition"""
        if new_state == self.current_state:
            return

        old_state = self.current_state
        idle_seconds = time.time() - self.last_activity

        # Record transition
        transition = StateTransition(
            timestamp=time.time(),
            from_state=old_state.value,
            to_state=new_state.value,
            idle_seconds=idle_seconds,
            trigger=trigger,
        )
        self.transition_history.append(asdict(transition))

        self.current_state = new_state
        logger.info(f"[IdleManager] State: {old_state.value} -> {new_state.value} ({trigger})")

        # Execute state-specific actions
        await self._execute_state_actions(old_state, new_state)

        # Call registered handlers
        for handler in self._handlers.get(new_state, []):
            try:
                await handler(old_state, new_state)
            except Exception as e:
                logger.error(f"[IdleManager] Handler error: {e}")

        for handler in self._global_handlers:
            try:
                await handler(old_state, new_state)
            except Exception as e:
                logger.error(f"[IdleManager] Global handler error: {e}")

    async def _execute_state_actions(self, from_state: IdleState, to_state: IdleState):
        """Execute built-in actions for state transitions"""
        # Waking up from idle
        if from_state.level > to_state.level:
            if from_state in (IdleState.COLD, IdleState.DORMANT):
                logger.info("[IdleManager] Waking services from deep idle")
                # Pre-warm services in background
                asyncio.create_task(self._pre_warm_services())

        # Going into deeper idle
        elif to_state.level > from_state.level:
            if to_state == IdleState.COOL:
                logger.info("[IdleManager] Entering COOL state - unloading TTS model")
                await self._unload_vibevoice()

            elif to_state == IdleState.COLD:
                logger.info("[IdleManager] Entering COLD state - unloading all models")
                await self._unload_vibevoice()
                await self._unload_ollama_models()

            elif to_state == IdleState.DORMANT:
                logger.info("[IdleManager] Entering DORMANT state - minimal operation")
                await self._unload_vibevoice()
                await self._unload_ollama_models()

    async def _unload_ollama_models(self):
        """Unload all Ollama models from memory"""
        if self._ollama_unload_callback:
            try:
                await self._ollama_unload_callback()
            except Exception as e:
                logger.error(f"[IdleManager] Ollama unload error: {e}")
        else:
            # Direct unload via API
            try:
                async with aiohttp.ClientSession() as session:
                    # Get loaded models
                    async with session.get("http://localhost:11434/api/ps", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            for model in data.get("models", []):
                                model_name = model.get("name")
                                if model_name:
                                    # Unload with keep_alive: 0
                                    await session.post(
                                        "http://localhost:11434/api/generate",
                                        json={"model": model_name, "keep_alive": 0},
                                        timeout=aiohttp.ClientTimeout(total=10)
                                    )
                                    logger.info(f"[IdleManager] Unloaded Ollama model: {model_name}")
            except Exception as e:
                logger.debug(f"[IdleManager] Ollama unload failed (may not be running): {e}")

    async def _unload_vibevoice(self):
        """Signal VibeVoice to unload its model"""
        if self._vibevoice_unload_callback:
            try:
                await self._vibevoice_unload_callback()
            except Exception as e:
                logger.error(f"[IdleManager] VibeVoice unload error: {e}")
        else:
            # Try via API if available
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        "http://localhost:8880/admin/unload",
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as resp:
                        if resp.status == 200:
                            logger.info("[IdleManager] VibeVoice model unloaded via API")
            except Exception as e:
                logger.debug(f"[IdleManager] VibeVoice unload API not available: {e}")

    async def _pre_warm_services(self):
        """Pre-warm services when waking from idle"""
        logger.info("[IdleManager] Pre-warming services...")

        # Signal VibeVoice to pre-load model
        if self._vibevoice_load_callback:
            try:
                asyncio.create_task(self._vibevoice_load_callback())
            except Exception as e:
                logger.debug(f"[IdleManager] VibeVoice pre-warm failed: {e}")

        # Don't pre-warm Ollama - let it load on first request
        # This avoids loading a model that might not be needed

    def get_status(self) -> Dict[str, Any]:
        """Get current idle manager status"""
        now = time.time()
        idle_seconds = now - self.last_activity

        keep_awake_remaining = 0
        if self._keep_awake_until:
            keep_awake_remaining = max(0, self._keep_awake_until - now)

        return {
            "enabled": self.enabled,
            "current_state": self.current_state.value,
            "current_mode": self.current_mode,
            "seconds_idle": round(idle_seconds, 1),
            "last_activity_type": self.last_activity_type,
            "last_activity_time": self.last_activity,
            "thresholds": self.thresholds.to_dict(),
            "keep_awake_remaining": round(keep_awake_remaining, 1),
            "next_state_in": self._get_next_transition_time(idle_seconds),
        }

    def _get_next_transition_time(self, idle_seconds: float) -> Optional[Dict[str, Any]]:
        """Calculate time until next state transition"""
        if not self.enabled:
            return None

        thresholds_list = [
            (self.thresholds.warm, IdleState.WARM),
            (self.thresholds.cool, IdleState.COOL),
            (self.thresholds.cold, IdleState.COLD),
            (self.thresholds.dormant, IdleState.DORMANT),
        ]

        for threshold, state in thresholds_list:
            if idle_seconds < threshold:
                return {
                    "state": state.value,
                    "seconds_remaining": round(threshold - idle_seconds, 1),
                }

        return None

    def get_transition_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent state transitions"""
        return list(self.transition_history)[-limit:]

    def get_available_modes(self) -> Dict[str, Dict[str, Any]]:
        """Get all available power modes"""
        result = {}
        for name, mode in POWER_MODES.items():
            mode_dict = mode.to_dict()
            mode_dict["is_builtin"] = name in BUILTIN_POWER_MODES
            mode_dict["is_custom"] = name not in BUILTIN_POWER_MODES
            result[name] = mode_dict
        return result

    def create_profile(self, profile_id: str, name: str, description: str,
                       thresholds: Dict[str, int], enabled: bool = True) -> bool:
        """
        Create a new custom power profile.

        Args:
            profile_id: Unique identifier (lowercase, no spaces)
            name: Display name
            description: Description of the profile
            thresholds: Dict with warm, cool, cold, dormant values in seconds
            enabled: Whether idle management is enabled for this profile

        Returns:
            True if created successfully, False if profile_id already exists
        """
        # Sanitize profile_id
        profile_id = profile_id.lower().replace(" ", "_")

        if profile_id in BUILTIN_POWER_MODES:
            logger.warning(f"[IdleManager] Cannot overwrite built-in profile: {profile_id}")
            return False

        # Create the profile
        profile = PowerMode(
            name=name,
            description=description,
            thresholds=IdleThresholds.from_dict(thresholds),
            enabled=enabled,
        )

        POWER_MODES[profile_id] = profile
        self._save_custom_profiles()

        logger.info(f"[IdleManager] Created custom profile: {profile_id}")
        return True

    def update_profile(self, profile_id: str, name: Optional[str] = None,
                       description: Optional[str] = None,
                       thresholds: Optional[Dict[str, int]] = None,
                       enabled: Optional[bool] = None) -> bool:
        """
        Update an existing custom profile.

        Returns:
            True if updated, False if profile doesn't exist or is built-in
        """
        if profile_id in BUILTIN_POWER_MODES:
            logger.warning(f"[IdleManager] Cannot modify built-in profile: {profile_id}")
            return False

        if profile_id not in POWER_MODES:
            return False

        existing = POWER_MODES[profile_id]

        # Update fields
        updated_name = name if name is not None else existing.name
        updated_desc = description if description is not None else existing.description
        updated_enabled = enabled if enabled is not None else existing.enabled

        if thresholds is not None:
            # Merge with existing thresholds
            current_thresholds = existing.thresholds.to_dict()
            current_thresholds.update(thresholds)
            updated_thresholds = IdleThresholds.from_dict(current_thresholds)
        else:
            updated_thresholds = existing.thresholds

        POWER_MODES[profile_id] = PowerMode(
            name=updated_name,
            description=updated_desc,
            thresholds=updated_thresholds,
            enabled=updated_enabled,
        )

        self._save_custom_profiles()
        logger.info(f"[IdleManager] Updated profile: {profile_id}")
        return True

    def delete_profile(self, profile_id: str) -> bool:
        """
        Delete a custom profile.

        Returns:
            True if deleted, False if profile doesn't exist or is built-in
        """
        if profile_id in BUILTIN_POWER_MODES:
            logger.warning(f"[IdleManager] Cannot delete built-in profile: {profile_id}")
            return False

        if profile_id not in POWER_MODES:
            return False

        # If this is the current mode, switch to balanced
        if self.current_mode == profile_id:
            self.set_mode("balanced")

        del POWER_MODES[profile_id]
        self._save_custom_profiles()

        logger.info(f"[IdleManager] Deleted profile: {profile_id}")
        return True

    def duplicate_profile(self, source_id: str, new_id: str, new_name: str) -> bool:
        """
        Duplicate an existing profile (built-in or custom) as a new custom profile.

        Args:
            source_id: ID of the profile to duplicate
            new_id: ID for the new profile
            new_name: Name for the new profile

        Returns:
            True if duplicated successfully
        """
        if source_id not in POWER_MODES:
            return False

        source = POWER_MODES[source_id]
        return self.create_profile(
            profile_id=new_id,
            name=new_name,
            description=f"Based on {source.name}",
            thresholds=source.thresholds.to_dict(),
            enabled=source.enabled,
        )

    def _save_custom_profiles(self):
        """Save custom profiles to disk"""
        custom_profiles = {
            pid: profile.to_dict()
            for pid, profile in POWER_MODES.items()
            if pid not in BUILTIN_POWER_MODES
        }

        try:
            PROFILES_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(PROFILES_FILE, 'w') as f:
                json.dump(custom_profiles, f, indent=2)
            logger.debug(f"[IdleManager] Saved {len(custom_profiles)} custom profiles")
        except Exception as e:
            logger.error(f"[IdleManager] Failed to save profiles: {e}")

    def _load_custom_profiles(self):
        """Load custom profiles from disk"""
        if not PROFILES_FILE.exists():
            return

        try:
            with open(PROFILES_FILE) as f:
                data = json.load(f)

            for pid, profile_data in data.items():
                if pid not in BUILTIN_POWER_MODES:
                    POWER_MODES[pid] = PowerMode(
                        name=profile_data.get("name", pid),
                        description=profile_data.get("description", ""),
                        thresholds=IdleThresholds.from_dict(profile_data.get("thresholds", {})),
                        enabled=profile_data.get("enabled", True),
                    )

            logger.info(f"[IdleManager] Loaded {len(data)} custom profiles")
        except Exception as e:
            logger.error(f"[IdleManager] Failed to load profiles: {e}")

    def get_profile(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific profile by ID"""
        if profile_id not in POWER_MODES:
            return None

        mode = POWER_MODES[profile_id]
        result = mode.to_dict()
        result["id"] = profile_id
        result["is_builtin"] = profile_id in BUILTIN_POWER_MODES
        result["is_custom"] = profile_id not in BUILTIN_POWER_MODES
        return result


def _init_idle_manager() -> IdleManager:
    """Initialize the idle manager and load custom profiles"""
    manager = IdleManager()
    manager._load_custom_profiles()
    return manager


# Singleton instance
idle_manager = _init_idle_manager()
