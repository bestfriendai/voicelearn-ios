# Workstream 3: iOS Client (STT, Testing, UI)

## Context
This is one of several parallel workstreams identified from an incomplete work audit. You are fixing iOS client issues across STT services, testing infrastructure, and UI components.

**Important:** Use MCP tools for building and testing:
```
mcp__XcodeBuildMCP__session-set-defaults({
  projectPath: "/Users/ramerman/dev/unamentis/UnaMentis.xcodeproj",
  scheme: "UnaMentis",
  simulatorName: "iPhone 17 Pro"
})
```

## Tasks

### 3.1 GLM-ASR On-Device STT (BLOCKED - Info Only)
**File:** `UnaMentis/Services/STT/GLMASROnDeviceSTTService.swift`
**Lines:** 22-24

This is BLOCKED pending model downloads. The architecture is complete but disabled:
```swift
// GLM-ASR decoder disabled - use Apple Speech fallback for STT
private let llamaAvailable = false
```

**No action needed** - document that this requires:
- CoreML models from Hugging Face
- GGUF model bundled
- Swift/C++ interop enabled

---

### 3.2 Self-Hosted STT Streaming (P2)
**File:** `UnaMentis/Services/STT/SelfHostedSTTService.swift`
**Lines:** 190-200

Currently throws error for streaming:
```swift
logger.warning("Streaming transcription not implemented for HTTP-based STT service")
throw STTError.connectionFailed("Streaming not supported")
```

**Requirements:**
1. Implement WebSocket connection to self-hosted Whisper server
2. Stream audio chunks via WebSocket
3. Receive partial transcription results
4. Handle connection lifecycle (connect, stream, disconnect)

**Reference:** Look at how `DeepgramSTTService.swift` handles streaming for patterns.

---

### 4.1 Audio File Loading for Latency Tests (P1)
**File:** `UnaMentis/Testing/LatencyHarness/LatencyTestCoordinator.swift`
**Lines:** 303-314

Currently uses text fallback:
```swift
// For now, use text input as fallback (audio file loading not implemented)
logger.warning("Audio input not implemented, using text fallback")
```

**Requirements:**
1. Load audio file from `scenario.userUtteranceAudioPath`
2. Convert to appropriate format for STT service
3. Stream audio through the STT pipeline
4. Capture accurate timing metrics

---

### 5.1 Voice Cloning UI (P2)
**File:** `UnaMentis/Services/TTS/ChatterboxConfig.swift`
**Lines:** 78-84

Config property exists but no UI:
```swift
/// NOTE: Voice cloning UI is deferred for future implementation
public var referenceAudioPath: String?
```

**Requirements:**
1. Add UI in settings to select/record reference audio
2. Store reference audio path in config
3. Pass to Chatterbox TTS service when configured

**Related:** `UnaMentis/UI/Settings/ChatterboxSettingsViewModel.swift` lines 78-79

---

### 5.2 LaTeX Rendering (P3 - Lower Priority)
**File:** `UnaMentis/UI/Components/FormulaRendererView.swift`
**Lines:** 318-324

Currently just text replacement:
```swift
/// Basic LaTeX to display string conversion (placeholder for proper renderer)
private func formatLatexForDisplay(_ latex: String) -> String {
    // This is a simplified version - a real app would use a LaTeX rendering library
```

**Requirements:**
1. Research iOS LaTeX rendering options (iosMath, LaTeX.js via WKWebView, etc.)
2. Implement proper math rendering
3. Handle common LaTeX math commands (fractions, exponents, Greek letters)

---

## Verification

After completing each task:
1. Build with MCP: `mcp__XcodeBuildMCP__build_sim`
2. Run on simulator: `mcp__XcodeBuildMCP__build_run_sim`
3. Test specific functionality:
   - STT streaming: Test with self-hosted server
   - Audio loading: Run latency tests with audio files
   - Voice cloning: Navigate to settings, configure reference audio
   - LaTeX: View content with math formulas
4. Run `/validate` to ensure tests pass
