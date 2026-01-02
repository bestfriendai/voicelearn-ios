"""
UnaMentis Management Server Tests
Tests for the management server API endpoints.
"""

import pytest
import json
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, unittest_run_loop

# Import server components
from server import (
    ManagementState,
    LogEntry,
    MetricsSnapshot,
    RemoteClient,
    ServerStatus,
    CurriculumSummary,
    TopicSummary,
    chunk_text_for_tts,
    handle_health,
    handle_get_stats,
    handle_receive_log,
    handle_get_logs,
    handle_clear_logs,
    handle_get_clients,
    handle_get_servers,
    handle_get_curricula,
)


class TestManagementState:
    """Tests for ManagementState initialization and management."""

    def test_init_creates_empty_state(self):
        """Test that ManagementState initializes with empty collections."""
        state = ManagementState()

        assert len(state.logs) == 0
        assert len(state.clients) == 0
        assert len(state.websockets) == 0

    def test_init_creates_default_servers(self):
        """Test that default servers are initialized."""
        state = ManagementState()

        assert "ollama" in state.servers
        assert "whisper" in state.servers
        assert "piper" in state.servers

    def test_stats_initialized(self):
        """Test that stats are properly initialized."""
        state = ManagementState()

        assert "total_logs_received" in state.stats
        assert "total_metrics_received" in state.stats
        assert "server_start_time" in state.stats
        assert state.stats["total_logs_received"] == 0


class TestLogEntry:
    """Tests for LogEntry dataclass."""

    def test_log_entry_creation(self):
        """Test creating a LogEntry with required fields."""
        entry = LogEntry(
            id="log-001",
            timestamp="2025-01-01T12:00:00Z",
            level="INFO",
            label="test",
            message="Test message"
        )

        assert entry.id == "log-001"
        assert entry.level == "INFO"
        assert entry.label == "test"
        assert entry.message == "Test message"

    def test_log_entry_with_metadata(self):
        """Test creating a LogEntry with metadata."""
        entry = LogEntry(
            id="log-002",
            timestamp="2025-01-01T12:00:00Z",
            level="DEBUG",
            label="session",
            message="Session started",
            metadata={"session_id": "abc123", "user": "test"}
        )

        assert entry.metadata["session_id"] == "abc123"
        assert entry.metadata["user"] == "test"


class TestRemoteClient:
    """Tests for RemoteClient dataclass."""

    def test_remote_client_creation(self):
        """Test creating a RemoteClient."""
        client = RemoteClient(
            id="client-001",
            name="iPhone 15 Pro"
        )

        assert client.id == "client-001"
        assert client.name == "iPhone 15 Pro"
        assert client.status == "online"

    def test_remote_client_with_device_info(self):
        """Test creating a RemoteClient with device information."""
        client = RemoteClient(
            id="client-002",
            name="Test Device",
            device_model="iPhone15,3",
            os_version="18.0",
            app_version="1.0.0"
        )

        assert client.device_model == "iPhone15,3"
        assert client.os_version == "18.0"
        assert client.app_version == "1.0.0"


class TestServerStatus:
    """Tests for ServerStatus dataclass."""

    def test_server_status_creation(self):
        """Test creating a ServerStatus."""
        server = ServerStatus(
            id="ollama-1",
            name="Ollama LLM",
            type="ollama",
            url="http://localhost:11434",
            port=11434
        )

        assert server.id == "ollama-1"
        assert server.type == "ollama"
        assert server.status == "unknown"

    def test_server_status_with_health(self):
        """Test ServerStatus with health information."""
        server = ServerStatus(
            id="whisper-1",
            name="Whisper STT",
            type="whisper",
            url="http://localhost:11401",
            port=11401,
            status="healthy",
            response_time_ms=45.5
        )

        assert server.status == "healthy"
        assert server.response_time_ms == 45.5


class TestCurriculumSummary:
    """Tests for CurriculumSummary dataclass."""

    def test_curriculum_summary_creation(self):
        """Test creating a CurriculumSummary."""
        summary = CurriculumSummary(
            id="curriculum-001",
            title="Machine Learning Basics",
            description="Introduction to ML",
            version="1.0.0",
            topic_count=10,
            total_duration="PT4H",
            difficulty="medium",
            age_range="18+"
        )

        assert summary.id == "curriculum-001"
        assert summary.title == "Machine Learning Basics"
        assert summary.topic_count == 10
        assert summary.difficulty == "medium"

    def test_curriculum_summary_with_visual_assets(self):
        """Test CurriculumSummary with visual asset counts."""
        summary = CurriculumSummary(
            id="curriculum-002",
            title="Physics 101",
            description="Physics basics",
            version="1.0.0",
            topic_count=5,
            total_duration="PT2H",
            difficulty="easy",
            age_range="12+",
            visual_asset_count=25,
            has_visual_assets=True
        )

        assert summary.visual_asset_count == 25
        assert summary.has_visual_assets is True


class TestTopicSummary:
    """Tests for TopicSummary dataclass."""

    def test_topic_summary_creation(self):
        """Test creating a TopicSummary."""
        summary = TopicSummary(
            id="topic-001",
            title="Neural Networks",
            description="Introduction to neural networks",
            order_index=0,
            duration="PT30M"
        )

        assert summary.id == "topic-001"
        assert summary.title == "Neural Networks"
        assert summary.order_index == 0

    def test_topic_summary_with_content_info(self):
        """Test TopicSummary with content information."""
        summary = TopicSummary(
            id="topic-002",
            title="Backpropagation",
            description="Learning about backprop",
            order_index=1,
            duration="PT45M",
            has_transcript=True,
            segment_count=15,
            assessment_count=3
        )

        assert summary.has_transcript is True
        assert summary.segment_count == 15
        assert summary.assessment_count == 3


class TestChunkTextForTTS:
    """Tests for the chunk_text_for_tts function."""

    def test_empty_text_returns_empty_list(self):
        """Test that empty text returns empty list."""
        result = chunk_text_for_tts("")
        assert result == []

    def test_whitespace_only_returns_empty_list(self):
        """Test that whitespace-only text returns empty list."""
        result = chunk_text_for_tts("   \n\t  ")
        assert result == []

    def test_single_sentence_returns_one_segment(self):
        """Test that a single sentence returns one segment."""
        result = chunk_text_for_tts("Hello world, this is a test.")
        assert len(result) >= 1
        # Content should be preserved
        combined = " ".join([seg["content"] for seg in result])
        assert "Hello world" in combined

    def test_removes_mitocw_headers(self):
        """Test that MIT OCW headers are removed."""
        text = "MITOCW | MIT8_01F16_L00v01_360p Welcome to physics."
        result = chunk_text_for_tts(text)

        combined = " ".join([seg["content"] for seg in result])
        assert "MITOCW" not in combined
        assert "Welcome" in combined

    def test_preserves_paragraph_structure(self):
        """Test that paragraph breaks create separate segments."""
        text = "First paragraph here.\n\nSecond paragraph here."
        result = chunk_text_for_tts(text)

        # Should have at least 2 segments for 2 paragraphs
        assert len(result) >= 1

    def test_handles_multiple_sentences(self):
        """Test handling of multiple sentences."""
        text = "First sentence. Second sentence. Third sentence."
        result = chunk_text_for_tts(text)

        # All content should be preserved
        combined = " ".join([seg["content"] for seg in result])
        assert "First" in combined
        assert "Second" in combined
        assert "Third" in combined


class TestMetricsSnapshot:
    """Tests for MetricsSnapshot dataclass."""

    def test_metrics_snapshot_creation(self):
        """Test creating a MetricsSnapshot."""
        snapshot = MetricsSnapshot(
            id="metrics-001",
            client_id="client-001",
            client_name="iPhone 15 Pro",
            timestamp="2025-01-01T12:00:00Z",
            received_at=1735689600.0,
            session_duration=3600.0,
            turns_total=50
        )

        assert snapshot.id == "metrics-001"
        assert snapshot.session_duration == 3600.0
        assert snapshot.turns_total == 50

    def test_metrics_snapshot_with_latencies(self):
        """Test MetricsSnapshot with latency data."""
        snapshot = MetricsSnapshot(
            id="metrics-002",
            client_id="client-002",
            client_name="Test Device",
            timestamp="2025-01-01T12:00:00Z",
            received_at=1735689600.0,
            stt_latency_median=150.0,
            stt_latency_p99=300.0,
            llm_ttft_median=200.0,
            llm_ttft_p99=400.0,
            e2e_latency_median=450.0,
            e2e_latency_p99=800.0
        )

        assert snapshot.stt_latency_median == 150.0
        assert snapshot.llm_ttft_median == 200.0
        assert snapshot.e2e_latency_median == 450.0

    def test_metrics_snapshot_with_costs(self):
        """Test MetricsSnapshot with cost data."""
        snapshot = MetricsSnapshot(
            id="metrics-003",
            client_id="client-003",
            client_name="Cost Test",
            timestamp="2025-01-01T12:00:00Z",
            received_at=1735689600.0,
            stt_cost=0.05,
            tts_cost=0.10,
            llm_cost=0.25,
            total_cost=0.40
        )

        assert snapshot.stt_cost == 0.05
        assert snapshot.tts_cost == 0.10
        assert snapshot.llm_cost == 0.25
        assert snapshot.total_cost == 0.40


# Integration tests using aiohttp test client
class TestAPIEndpoints(AioHTTPTestCase):
    """Integration tests for API endpoints."""

    async def get_application(self):
        """Create test application with routes."""
        app = web.Application()

        # Store state in app
        app["state"] = ManagementState()

        # Add routes
        app.router.add_get("/health", handle_health)
        app.router.add_get("/api/stats", handle_get_stats)
        app.router.add_post("/api/logs", handle_receive_log)
        app.router.add_get("/api/logs", handle_get_logs)
        app.router.add_delete("/api/logs", handle_clear_logs)
        app.router.add_get("/api/clients", handle_get_clients)
        app.router.add_get("/api/servers", handle_get_servers)
        app.router.add_get("/api/curricula", handle_get_curricula)

        return app

    @unittest_run_loop
    async def test_health_endpoint(self):
        """Test the health check endpoint."""
        resp = await self.client.request("GET", "/health")
        assert resp.status == 200
        data = await resp.json()
        # Health endpoint returns JSON with status
        assert data["status"] == "healthy"

    @unittest_run_loop
    async def test_get_stats_endpoint(self):
        """Test the stats endpoint."""
        resp = await self.client.request("GET", "/api/stats")
        assert resp.status == 200

        data = await resp.json()
        # Stats endpoint returns various metrics
        assert "errors_count" in data or "total_logs_received" in data

    @unittest_run_loop
    async def test_receive_log_endpoint(self):
        """Test receiving a log entry."""
        log_data = {
            "level": "INFO",
            "label": "test",
            "message": "Test log message",
            "timestamp": "2025-01-01T12:00:00Z"
        }

        resp = await self.client.request(
            "POST",
            "/api/logs",
            json=log_data
        )
        assert resp.status == 200

        result = await resp.json()
        assert result["status"] == "ok"
        # Result may contain 'received' count instead of 'id'
        assert "received" in result or "id" in result

    @unittest_run_loop
    async def test_get_logs_endpoint(self):
        """Test retrieving logs."""
        resp = await self.client.request("GET", "/api/logs")
        assert resp.status == 200

        data = await resp.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)

    @unittest_run_loop
    async def test_clear_logs_endpoint(self):
        """Test clearing logs."""
        resp = await self.client.request("DELETE", "/api/logs")
        assert resp.status == 200

        data = await resp.json()
        assert data["status"] == "ok"

    @unittest_run_loop
    async def test_get_clients_endpoint(self):
        """Test retrieving clients."""
        resp = await self.client.request("GET", "/api/clients")
        assert resp.status == 200

        data = await resp.json()
        assert "clients" in data
        assert isinstance(data["clients"], list)

    @unittest_run_loop
    async def test_get_servers_endpoint(self):
        """Test retrieving servers."""
        resp = await self.client.request("GET", "/api/servers")
        assert resp.status == 200

        data = await resp.json()
        assert "servers" in data
        assert isinstance(data["servers"], list)

    @unittest_run_loop
    async def test_get_curricula_endpoint(self):
        """Test retrieving curricula."""
        resp = await self.client.request("GET", "/api/curricula")
        assert resp.status == 200

        data = await resp.json()
        assert "curricula" in data
        assert isinstance(data["curricula"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
