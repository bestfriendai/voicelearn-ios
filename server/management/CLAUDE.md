# Management Console

Python/aiohttp web server for content administration and curriculum management.

**URL:** http://localhost:8766

## Purpose

- Curriculum management (import, browse, edit)
- User progress tracking and analytics
- Visual asset management
- Source browser for external curriculum import (MIT OCW, Stanford, etc.)
- AI enrichment pipeline
- User management (future)

## Tech Stack

- **Python 3** with async/await
- **aiohttp** for async HTTP server
- **SQLite** for curriculum database
- **Vanilla JavaScript** for frontend (no framework)

## Key Files

| File | Purpose |
|------|---------|
| `server.py` | Main aiohttp server (3,500+ lines) |
| `import_api.py` | Curriculum import API endpoints |
| `resource_monitor.py` | System resource monitoring |
| `idle_manager.py` | Idle state management |
| `metrics_history.py` | Metrics collection and history |
| `diagnostic_logging.py` | Diagnostic logging system |
| `static/` | HTML/JavaScript frontend |
| `data/` | Runtime data directory |

## API Patterns

- All endpoints are async (`async def`)
- Use aiohttp request/response objects
- JSON responses with `web.json_response()`
- Error handling with appropriate HTTP status codes

## Database

The curriculum database is in `../database/`:
- Schema defined in `schema.sql`
- Python interface in `curriculum_db.py`

## Restart Command

```bash
pkill -f "server/management/server.py"
cd server/management && python server.py &
```

Always restart after code changes and verify via API calls or log inspection.

## Testing Best Practices

### MANDATORY: Clean Up After Testing

When creating test data (curricula, assets, import jobs, etc.), you MUST clean up after yourself:

1. **Test Curricula**: Delete any test curricula created during testing
   ```bash
   curl -X DELETE "http://localhost:8766/api/curricula/{curriculum-id}?confirm=true"
   ```

2. **Test Assets**: Remove any test visual assets uploaded during testing

3. **Before Finishing**: Always verify the curriculum list only contains intended content
   ```bash
   curl -s http://localhost:8766/api/curricula | python3 -c "import sys,json; d=json.load(sys.stdin); [print(c['id'], c['title']) for c in d['curricula']]"
   ```

### Naming Convention for Test Data

When creating test data that should be easily identified:
- Prefix with `test-` or `claude-test-`
- Include "DELETE ME" or "TEST" in titles
- Example: `test-import-validation`, `claude-test-asset-upload`

This makes it easy to identify and clean up orphaned test data.

### Server State Synchronization

The server loads curriculum data at startup. If files change on disk while the server is running (e.g., file renames, manual deletions), the server's in-memory state becomes stale. Fix by:
1. Restart the server, OR
2. Call the reload endpoint: `POST /api/curricula/reload`
