# Knowledge Bowl Module: On-Device First Architecture

**Version:** 2.0
**Last Updated:** 2026-01-19
**Status:** Active Development

## Architecture Philosophy

The Knowledge Bowl module follows an **on-device first** design philosophy:

- **On-device:** Practice sessions, answer validation, progress tracking, audio playback
- **Server role:** Question delivery, team coordination, statistics aggregation, configuration management

This architecture enables:
- ✅ Full offline practice capability
- ✅ Low latency (<50ms validation)
- ✅ Privacy (no answer data sent to server during practice)
- ✅ Scalability (server not in critical path for individual practice)
- ✅ Team coordination for geographically distributed teams

---

## Component Architecture

### On-Device Components

#### 1. Question Engine (`KBQuestionEngine`)
- **Purpose:** Manage question library, selection algorithms, difficulty progression
- **Storage:** Local SQLite database + bundled JSON
- **Offline:** ✅ Full capability

#### 2. Answer Validation (3-Tier System)
- **Tier 1 (All devices):** Enhanced algorithms (85-90% accuracy, 0 bytes)
  - Levenshtein fuzzy matching
  - Double Metaphone phonetic matching
  - N-gram similarity (character + word)
  - Token-based similarity (Jaccard + Dice)
  - Domain-specific synonyms (~650 entries)
  - Linguistic matching (Apple NL framework)

- **Tier 2 (iPhone XS+):** Semantic embeddings (92-95% accuracy, 80MB optional)
  - all-MiniLM-L6-v2 sentence transformer (FP16 quantized CoreML)
  - 384-dim sentence embeddings
  - Cosine similarity matching

- **Tier 3 (iPhone 12+):** LLM validation (95-98% accuracy, 1.5GB, admin-controlled)
  - Llama 3.2 1B (4-bit quantized GGUF via llama.cpp)
  - Open source, no API costs
  - Server admin controls availability via feature flags

- **Regional Strictness:**
  - `.strict` (Colorado): Tier 1 baseline only (Levenshtein)
  - `.standard` (Minnesota, Washington): Tier 1 enhanced algorithms
  - `.lenient` (Practice mode): All tiers available

- **Offline:** ✅ Full capability (models stored locally)

#### 3. Session Management (`KBSession`, `KBSessionManager`)
- **Purpose:** Track practice sessions, store attempts, calculate statistics
- **Storage:** Local Core Data
- **Offline:** ✅ Full capability, syncs when online

#### 4. Voice Services (Oral Round)

**TTS (Text-to-Speech):**
- **On-device TTS:** AVSpeechSynthesizer for live practice
  - Zero storage, instant playback
  - Adjustable speed, pitch, voice
  - Best for: Quick practice, customizable experience

- **Pre-generated audio:** Opus 32kbps files for competition simulation
  - Consistent moderator voice
  - Matches real competition conditions
  - ~60KB per question (~60MB per 1,000 questions)
  - Best for: Competition prep, offline tournaments

**STT (Speech-to-Text):**
- **Implementation:** SFSpeechRecognizer (iOS), Android Speech Recognition
- **Mode:** On-device recognition (when available)
- **Fallback:** User sees error message requesting physical device
- **Privacy:** Audio never sent to server

- **Offline:** ⚠️ Requires on-device speech model (iOS 13+, Android 8+)

#### 5. Analytics Engine (`KBAnalyticsService`)
- **Purpose:** Calculate mastery scores, identify weak domains, track progress
- **Storage:** Local Core Data
- **Offline:** ✅ Full capability

### Server Components

#### 1. Question Distribution Service
- **Endpoints:**
  - `GET /api/kb/question-packs` - List available question packs
  - `GET /api/kb/question-packs/:id/download` - Download pack (JSON + audio bundle)
  - `GET /api/kb/questions/updates` - Check for new/updated questions

- **Delivery Format:**
  - JSON metadata + Opus 32kbps audio files (zipped)
  - Incremental updates (only changed questions)
  - Versioned bundles with checksum validation

#### 2. Team Coordination Service
- **Purpose:** Enable geographically distributed teams to practice together
- **Features:**
  - Team creation and management
  - Scheduled practice sessions
  - Real-time session synchronization
  - Turn-based question distribution

- **Endpoints:**
  - `POST /api/kb/teams` - Create team
  - `POST /api/kb/teams/:id/sessions` - Schedule practice session
  - `GET /api/kb/teams/:id/sessions/:sessionId` - Join session
  - WebSocket: `/ws/kb/sessions/:sessionId` - Real-time coordination

#### 3. Statistics Aggregation Service
- **Purpose:** Aggregate individual progress, team performance, leaderboards
- **Data Flow:** Device → Server (when online, batch upload)
- **Endpoints:**
  - `POST /api/kb/stats/upload` - Upload local session data
  - `GET /api/kb/stats/team/:id` - Team performance summary
  - `GET /api/kb/leaderboards` - Regional leaderboards

#### 4. Configuration Management Service
- **Purpose:** Deliver regional configs, feature flags, model availability
- **Endpoints:**
  - `GET /api/kb/config/regional` - Regional rule sets
  - `GET /api/kb/config/features` - Feature flags (Tier 3 LLM availability, etc.)
  - `GET /api/kb/config/models` - Available model versions

---

## Data Flow Patterns

### Individual Practice Session (Fully Offline)

```
User taps "Start Practice"
    ↓
KBQuestionEngine selects questions (local DB)
    ↓
Session starts (KBSession tracks attempts)
    ↓
For each question:
    - Display question text
    - Play audio (on-device TTS or pre-generated file)
    - Capture user answer (written or voice)
    - Validate answer (on-device, Tier 1-3)
    - Store attempt (local Core Data)
    ↓
Session ends
    ↓
Calculate statistics (local KBAnalyticsService)
    ↓
[When online] Upload session data to server (async)
```

### Team Practice Session (Server Coordination)

```
Team captain creates session on server
    ↓
Server generates session ID, notifies team members
    ↓
Team members join session (WebSocket connection)
    ↓
Server orchestrates question flow:
    - Sends question ID to all team members
    - Team members fetch question locally (or download if missing)
    - Team members practice independently
    - Team members submit answers to server
    - Server validates + aggregates team score
    ↓
Session ends, team statistics calculated
```

### Question Pack Download (Periodic)

```
User requests "Download Colorado Question Pack"
    ↓
Server checks user's current version
    ↓
Server generates download bundle:
    - JSON question metadata
    - Opus 32kbps audio files (if not already downloaded)
    - Checksum manifest
    ↓
Device downloads bundle (background fetch)
    ↓
Device extracts to local storage
    ↓
KBQuestionEngine indexes new questions
```

---

## Storage Architecture

### On-Device Storage

| Component | Storage Type | Size Estimate | Persistence |
|-----------|--------------|---------------|-------------|
| Question metadata | SQLite | ~1 MB per 1,000 questions | Permanent |
| Pre-generated audio | File system (Opus) | ~60 MB per 1,000 questions | Smart unloading |
| Session data | Core Data | ~100 KB per session | Permanent |
| Analytics cache | Core Data | ~5 MB | Permanent |
| Tier 2 embeddings model | CoreML file | 80 MB | Optional download |
| Tier 3 LLM model | GGUF file | 1.5 GB | Optional download |

### Smart Content Unloading

Questions with high mastery can be unloaded to free storage:

| Mastery Level | Unload After | Reload Priority |
|---------------|--------------|-----------------|
| < 70% | Never | N/A |
| 70-85% | 30 days | High |
| 85-95% | 14 days | Medium |
| > 95% | 7 days | Low (spaced review) |

**Unloading order:**
1. Remove audio files first (can re-stream from server)
2. Keep JSON metadata (mastery history preserved)
3. Lazy reload when question resurfaces

---

## Regional Compliance

The system respects regional competition rules:

| Region | Strictness | Allowed Validation |
|--------|------------|-------------------|
| Colorado | `.strict` | Exact + Levenshtein only |
| Minnesota | `.standard` | + Phonetic + N-gram + Token + Linguistic |
| Washington | `.standard` | + Phonetic + N-gram + Token + Linguistic |
| Practice Mode | `.lenient` | All tiers (including embeddings, LLM) |

**Server role:** Delivers regional configs, enforces team session rules

---

## Team Coordination (Isolated Geographic Training)

### Use Case: Team Practice Session

**Scenario:** 5 team members at different homes want to practice together for 60 minutes.

**Flow:**
1. **Team Captain** creates session via app
   - Selects: Region (Colorado), Round type (Oral), Duration (60 min)
   - Server assigns session ID

2. **Server** sends invitations to team members (push notification)

3. **Team Members** join session (WebSocket connection)
   - Server confirms all members joined
   - Server starts countdown timer

4. **Question Flow:**
   - Server sends question ID to all members
   - Each member's device:
     - Fetches question from local DB (or downloads if missing)
     - Plays audio (on-device TTS or pre-generated file)
     - Shows conference timer (synchronized via WebSocket)
     - Captures answer (written or voice)
     - Validates answer locally (on-device)
     - Submits answer + validation result to server

5. **Server Aggregation:**
   - Collects all answers
   - Calculates team score
   - Sends results to all members
   - Advances to next question

6. **Session End:**
   - Server generates team performance report
   - Each member's device stores individual session data
   - Team statistics available on server dashboard

### WebSocket Protocol

```
Client → Server: JOIN_SESSION { sessionId, userId }
Server → Client: SESSION_STARTED { questionCount, duration }

Server → Client: NEXT_QUESTION { questionId, conferenceTime }
Client → Server: SUBMIT_ANSWER { questionId, answer, isCorrect, responseTime }
Server → Client: QUESTION_RESULTS { teamScore, answers[] }

Server → Client: SESSION_ENDED { teamScore, accuracy, report }
```

---

## Next Development Phases

### Phase 1: Core Functionality (Completed)
- ✅ Question engine with regional configs
- ✅ Written round practice
- ✅ Oral round practice with TTS/STT
- ✅ Enhanced 3-tier answer validation
- ✅ Session management

### Phase 2: Team Coordination (In Progress)
- 🚧 Team management API endpoints
- 🚧 WebSocket session orchestration
- 🚧 Real-time team session UI
- ⬜ Team statistics dashboard
- ⬜ Practice session scheduling

### Phase 3: Advanced Features
- ⬜ Conference mode (team discussion simulation)
- ⬜ Rebound mode (second-chance questions)
- ⬜ Full match simulation (timed competition)
- ⬜ Question pack marketplace
- ⬜ Custom question authoring

### Phase 4: Polish
- ⬜ Advanced analytics (weak domain identification, spaced repetition)
- ⬜ watchOS companion app
- ⬜ iPad split-screen mode (question + notes)
- ⬜ Accessibility improvements (VoiceOver, Dynamic Type)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Offline capability** | 100% practice sessions | Can complete session without internet |
| **Answer validation accuracy** | 85-90% (Tier 1), 92-95% (Tier 2), 95-98% (Tier 3) | Validated against test vectors |
| **Validation latency** | <50ms (Tier 1), <80ms (Tier 2), <250ms (Tier 3) | P95 latency |
| **Team session latency** | <200ms question distribution | WebSocket round-trip |
| **Storage efficiency** | <250MB for 1,000 questions | With smart unloading |
| **Voice recognition accuracy** | >90% transcript correctness | Manual validation |

---

## See Also

- [Answer Validation API](KNOWLEDGE_BOWL_ANSWER_VALIDATION.md)
- [Module Specification](KNOWLEDGE_BOWL_MODULE_SPEC.md)
- [Enhanced Validation User Guide](../user-guides/KNOWLEDGE_BOWL_ENHANCED_VALIDATION.md)
- [Team Coordination API](../../server/docs/api/KB_TEAM_COORDINATION.md) (TBD)
