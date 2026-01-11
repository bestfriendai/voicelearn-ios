# Workstream 2: Operations Console (Next.js)

## Status: COMPLETE (January 2026)

All tasks in this workstream have been implemented and validated.

## Context
This is one of several parallel workstreams identified from an incomplete work audit. You are fixing the Next.js Operations Console UI issues.

**Note:** Task 2.1 (Curriculum Save) depends on the Management API having a save endpoint. Check if `/api/curricula/{id}` PUT/POST exists first.

## Tasks

### 2.1 Curriculum Studio Save Not Implemented (P0 - Critical) ✅ COMPLETE
**File:** `server/web/src/components/dashboard/curriculum-detail-panel.tsx`

**Implementation:**
- Added `saveCurriculumUMCF()` function to call PUT `/api/curricula/{id}`
- Updated `CurriculumStudio` component with save button, status indicators
- Save button shows: orange (unsaved), spinning (saving), green (saved), red (error)
- Footer shows save status text
- Refreshes curriculum data after successful save

**Files Modified:**
- `server/web/src/components/curriculum/CurriculumEditor.tsx` - Save button, handleSave, status state
- `server/web/src/components/dashboard/curriculum-detail-panel.tsx` - saveCurriculumUMCF, onSave wiring

---

### 2.2 Transcript Segments Not Mapped (P1) ✅ COMPLETE
**File:** `server/web/src/components/dashboard/curriculum-detail-panel.tsx`

**Implementation:**
- Added `mapSegmentType()` function to convert API segment types to editor types
- Added `mapTranscript()` function to map full transcript with segments
- Maps: id, type, content, speakingNotes (pace, emotionalTone, emphasis)

**Files Modified:**
- `server/web/src/components/dashboard/curriculum-detail-panel.tsx` - mapSegmentType, mapTranscript, updated adaptToUMCF

---

### 2.3 Multi-Target Concurrent Runs (P3 - Lower Priority) ✅ COMPLETE
**File:** `server/web/src/components/dashboard/latency-harness-panel.tsx`

**Implementation:**
- Updated `handleStartRun` to use `Promise.allSettled()` for all selected targets
- Starts runs concurrently for all selected targets
- Handles partial failures gracefully, reporting count of failures
- Continues with successful runs even if some fail

**Files Modified:**
- `server/web/src/components/dashboard/latency-harness-panel.tsx` - handleStartRun concurrent logic

---

## Verification

Completed verification:
1. Web project builds successfully (`npm run build`)
2. Web lint passes with 0 errors (33 pre-existing warnings)
3. TypeScript compiles without errors

Note: iOS build has pre-existing issues unrelated to this workstream (missing AudioFilePickerView, AudioRecorderView references in ChatterboxSettingsView.swift).
