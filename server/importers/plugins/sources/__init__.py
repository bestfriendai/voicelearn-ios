"""
Source importer plugins.

Each plugin in this directory provides access to a curriculum source
(MIT OCW, CK-12, MERLOT, Stanford, EngageNY, etc.).

Plugins are auto-discovered but must be enabled via the Plugin Manager.

Education Level Categories:
- K-12 (kindergarten through 12th grade): engageny, ck12_flexbook
- Collegiate (post-secondary): mit_ocw, merlot
"""

# Import plugins to trigger @SourceRegistry.register decorators
from . import mit_ocw
from . import ck12_flexbook
from . import merlot
from . import engageny

__all__ = [
    "mit_ocw",
    "ck12_flexbook",
    "merlot",
    "engageny",
]

# Education level classification for filtering
EDUCATION_LEVELS = {
    "k12": ["engageny", "ck12_flexbook"],
    "collegiate": ["mit_ocw", "merlot"],
}

def get_sources_by_education_level(level: str) -> list:
    """Get source IDs for a given education level (k12 or collegiate)."""
    return EDUCATION_LEVELS.get(level, [])
