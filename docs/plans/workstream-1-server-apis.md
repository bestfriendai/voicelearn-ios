# Workstream 1: Server API Fixes

## Context
This is one of several parallel workstreams identified from an incomplete work audit. You are fixing server-side API and management console issues.

## Tasks

### 1.1 Latency Harness Suite Deletion (P0)
**File:** `server/management/latency_harness_api.py`
**Line:** 263

The endpoint returns success without actually deleting:
```python
# TODO: Implement suite deletion
return web.json_response({"message": f"Suite {suite_id} deleted"})
```

**Requirements:**
1. Call `storage.delete_suite(suite_id)`
2. Handle case where suite doesn't exist (return 404)
3. Return appropriate success/error response

**Reference:** The storage layer is fully implemented in `server/latency_harness/storage.py` - see `FileBasedLatencyStorage.delete_suite()` at line 326.

---

### 1.2 CK-12 Course Detail View
**File:** `server/management/static/app.js`
**Line:** 3839

Currently shows placeholder:
```javascript
async function viewCK12CourseDetail(courseId) {
    showToast('CK-12 course details coming soon', 'info');
    // TODO: Implement detailed view similar to MIT OCW
}
```

**Requirements:**
1. Look at MIT OCW detail view implementation as reference (search for `viewMITOCWCourseDetail` in same file)
2. Implement similar detail fetching and display for CK-12 FlexBooks
3. Show course title, description, units/chapters, and any available metadata

---

### 1.3 Plugin Discovery Metadata Extraction (P3 - Lower Priority)
**File:** `server/importers/core/discovery.py`
**Lines:** 209, 216

Currently hardcoded:
```python
version="1.0.0",  # TODO: Extract from module if available
author=None,  # TODO: Extract from module docstring
```

**Requirements:**
1. Try to extract `__version__` from plugin module if available
2. Try to extract `__author__` from plugin module if available
3. Fall back to current defaults if not found

---

## Verification

After completing each task:
1. Run the management API: `cd server && python -m management.main`
2. Test via curl:
   - Suite deletion: `curl -X DELETE http://localhost:8766/api/latency-tests/suites/{suite_id}`
   - CK-12 detail: Test via web UI at http://localhost:8766
3. Run `/validate` to ensure no regressions
