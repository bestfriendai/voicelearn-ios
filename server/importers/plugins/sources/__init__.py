"""
Source importer plugins.

Each plugin in this directory provides access to a curriculum source
(MIT OCW, CK-12, MERLOT, Stanford, EngageNY, Core Knowledge, etc.).

Plugins are auto-discovered but must be enabled via the Plugin Manager.

Education Level Categories:
- K-12 (kindergarten through 12th grade): coreknowledge, engageny, ck12_flexbook
- Collegiate (post-secondary): mit_ocw, merlot

Voice-Friendly Classification:
- EXCELLENT (narrative): coreknowledge (History, ELA), engageny (ELA)
- GOOD (conceptual): engageny (Math concepts explained)
- CHALLENGING (visual): engageny (Math with formulas/graphs)
"""

# Import plugins to trigger @SourceRegistry.register decorators
from . import mit_ocw
from . import ck12_flexbook
from . import merlot
from . import engageny
from . import coreknowledge

__all__ = [
    "mit_ocw",
    "ck12_flexbook",
    "merlot",
    "engageny",
    "coreknowledge",
]

# Education level classification for filtering
EDUCATION_LEVELS = {
    "k12": ["coreknowledge", "engageny", "ck12_flexbook"],
    "collegiate": ["mit_ocw", "merlot"],
}

# Voice-friendly classification (for audio-first tutoring)
VOICE_SUITABILITY = {
    "excellent": ["coreknowledge"],  # History, Literature, Geography, Arts
    "good": ["engageny", "mit_ocw", "merlot"],  # Conceptual content
    "challenging": ["ck12_flexbook"],  # Math-heavy, visual content
}

def get_sources_by_education_level(level: str) -> list:
    """Get source IDs for a given education level (k12 or collegiate)."""
    return EDUCATION_LEVELS.get(level, [])

def get_sources_by_voice_suitability(suitability: str) -> list:
    """Get source IDs for a given voice suitability level."""
    return VOICE_SUITABILITY.get(suitability, [])
