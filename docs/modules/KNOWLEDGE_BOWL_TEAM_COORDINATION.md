# Knowledge Bowl: Team Coordination for Distributed Practice

**Version:** 1.0
**Last Updated:** 2026-01-19
**Status:** Planned (Phase 2)

## Overview

Enable Knowledge Bowl teams to practice together even when geographically isolated (e.g., all team members at their homes but practicing together on a schedule).

## Problem Statement

Traditional Knowledge Bowl team practice requires physical co-location. Modern teams are often distributed:
- Students practice from home
- Remote learning environments
- Summer break practice sessions
- Weather/illness preventing in-person practice

**Goal:** Enable synchronized team practice sessions where team members can:
- Practice together in real-time
- Hear the same questions simultaneously
- Compete for answers (buzzer simulation)
- See team performance statistics
- Build team chemistry remotely

---

## Architecture: On-Device First with Server Orchestration

### Client Responsibilities (On-Device)

Each team member's device handles:
- ✅ Question audio playback (on-device TTS or pre-generated files)
- ✅ Answer capture (written or voice)
- ✅ Answer validation (on-device, 3-tier system)
- ✅ Individual progress tracking
- ✅ Conference timer countdown
- 📱 Buzzer simulation (tap to buzz in)
- 📱 Team member presence indicators

### Server Responsibilities (Coordination)

Server orchestrates the session but doesn't process answers:
- 🌐 Session creation and team member invitations
- 🌐 Real-time session state synchronization (WebSocket)
- 🌐 Question distribution (sends question IDs, not audio)
- 🌐 Buzzer arbitration (who buzzed first?)
- 🌐 Turn management (who answers next?)
- 🌐 Team score aggregation
- 🌐 Session analytics and replay

---

## User Flows

### Flow 1: Scheduled Team Practice

```
1. Team captain creates practice session:
   - Selects: Date/time, duration (30/60/90 min)
   - Selects: Region (Colorado), Round type (Oral/Written)
   - Sends invitations to team members

2. Server sends push notifications to team members

3. Team members join session:
   - Tap notification → Opens app to session lobby
   - See team members who have joined
   - See session configuration

4. When all members ready, captain starts session

5. Session begins:
   - Server sends NEXT_QUESTION { questionId, conferenceTime }
   - All devices fetch question from local DB
   - All devices start conference timer (synchronized)

6. Conference phase:
   - Team members can discuss (speaker mode on one phone?)
   - Timer counts down visually on all devices
   - When timer ends, buzzer phase begins

7. Buzzer phase:
   - First team member to buzz in gets to answer
   - Server sends BUZZER_WON { userId, userName }
   - All devices show who buzzed in
   - Winner's device enables answer input

8. Answer submission:
   - Winner submits answer (validated on-device)
   - Device sends: SUBMIT_ANSWER { questionId, answer, isCorrect, responseTime }
   - Server broadcasts: ANSWER_RESULT { userId, isCorrect, correctAnswer }

9. Repeat for next question

10. Session ends:
    - Server sends SESSION_ENDED { teamScore, accuracy, report }
    - Each device stores individual session data
    - Team statistics available on server dashboard
```

### Flow 2: Casual Drop-In Practice

```
1. Team member creates open session:
   - Sets to "open" (anyone from team can join)
   - Starts practicing

2. Other team members see "Active Session" notification

3. Team members can join mid-session:
   - Join current question or wait for next
   - See current team score
   - Contribute to team performance

4. Last member leaving ends session
```

---

## WebSocket Protocol

### Message Types

#### Client → Server

```typescript
// Join a session
{
  type: "JOIN_SESSION",
  sessionId: string,
  userId: string
}

// Ready to start (captain only)
{
  type: "START_SESSION",
  sessionId: string
}

// Buzz in to answer
{
  type: "BUZZ_IN",
  sessionId: string,
  userId: string,
  questionId: string,
  timestamp: number  // Client timestamp for latency correction
}

// Submit answer
{
  type: "SUBMIT_ANSWER",
  sessionId: string,
  userId: string,
  questionId: string,
  answer: string,
  isCorrect: boolean,      // Client-validated (on-device)
  responseTime: number,    // Time from question start to answer
  validationTier: number   // 1, 2, or 3
}

// Leave session
{
  type: "LEAVE_SESSION",
  sessionId: string,
  userId: string
}
```

#### Server → Client

```typescript
// Session started
{
  type: "SESSION_STARTED",
  sessionId: string,
  questionCount: number,
  duration: number,
  teamMembers: [
    { userId: string, userName: string, isReady: boolean }
  ]
}

// Next question
{
  type: "NEXT_QUESTION",
  questionIndex: number,
  questionId: string,
  conferenceTime: number,    // Seconds for conference phase
  roundType: "written" | "oral"
}

// Conference countdown sync
{
  type: "CONFERENCE_TICK",
  secondsRemaining: number
}

// Buzzer result
{
  type: "BUZZER_WON",
  userId: string,
  userName: string,
  buzzTime: number           // Server-corrected timestamp
}

// Answer result
{
  type: "ANSWER_RESULT",
  userId: string,
  userName: string,
  questionId: string,
  answer: string,
  isCorrect: boolean,
  correctAnswer: string,     // If incorrect
  teamScore: number,         // Updated team score
  validationTier: number     // Which tier validated
}

// Session ended
{
  type: "SESSION_ENDED",
  sessionId: string,
  teamScore: number,
  accuracy: number,
  questionResults: [
    {
      questionId: string,
      answeredBy: string,
      answer: string,
      isCorrect: boolean,
      responseTime: number
    }
  ]
}

// Member joined/left
{
  type: "MEMBER_UPDATE",
  userId: string,
  userName: string,
  action: "joined" | "left"
}
```

---

## API Endpoints

### Team Management

```
POST /api/kb/teams
GET /api/kb/teams/:teamId
PUT /api/kb/teams/:teamId
DELETE /api/kb/teams/:teamId
POST /api/kb/teams/:teamId/members
DELETE /api/kb/teams/:teamId/members/:userId
```

### Session Management

```
POST /api/kb/teams/:teamId/sessions          # Create session
GET /api/kb/teams/:teamId/sessions            # List sessions
GET /api/kb/sessions/:sessionId               # Session details
DELETE /api/kb/sessions/:sessionId            # Cancel session
```

### Statistics

```
GET /api/kb/teams/:teamId/stats               # Team performance
GET /api/kb/teams/:teamId/sessions/:sessionId/replay  # Session replay
GET /api/kb/leaderboards                      # Regional leaderboards
```

### WebSocket

```
WS /ws/kb/sessions/:sessionId                 # Real-time session connection
```

---

## Data Models

### Team

```typescript
{
  id: string,
  name: string,
  region: "colorado" | "minnesota" | "washington",
  createdAt: Date,
  members: [
    {
      userId: string,
      role: "captain" | "member",
      joinedAt: Date
    }
  ]
}
```

### Session

```typescript
{
  id: string,
  teamId: string,
  status: "scheduled" | "active" | "completed" | "cancelled",
  scheduledAt: Date | null,     // null for instant sessions
  startedAt: Date | null,
  endedAt: Date | null,
  config: {
    region: "colorado" | "minnesota" | "washington",
    roundType: "written" | "oral",
    questionCount: number,
    duration: number              // Minutes
  },
  results: {
    teamScore: number,
    accuracy: number,
    questionResults: [...]
  }
}
```

### SessionState (Real-time)

```typescript
{
  sessionId: string,
  currentQuestionIndex: number,
  currentPhase: "conference" | "buzzer" | "answering" | "feedback",
  conferenceTimeRemaining: number,
  buzzerId: string | null,        // Who buzzed in
  teamMembers: [
    {
      userId: string,
      userName: string,
      isConnected: boolean,
      lastHeartbeat: Date
    }
  ]
}
```

---

## Buzzer Mechanics

### Latency Compensation

Network latency varies between team members. Fair buzzer arbitration requires server-side timestamp correction:

```
1. Client sends BUZZ_IN with clientTimestamp

2. Server receives at serverTimestamp

3. Estimated client-to-server latency:
   latency = (roundTripTime / 2)

4. Corrected buzz time:
   correctedTime = serverTimestamp - latency

5. Server determines winner:
   winner = argmin(correctedTime)
```

### Heartbeat Protocol

To calculate round-trip time (RTT) for each client:

```
Every 5 seconds:
  Client → Server: HEARTBEAT { clientTimestamp }
  Server → Client: HEARTBEAT_ACK { clientTimestamp, serverTimestamp }
  Client calculates: RTT = now() - clientTimestamp
```

Server maintains moving average of last 10 RTT samples per client.

---

## Speaker Mode (Temporary Solution)

**Problem:** How do geographically isolated team members "confer" during conference time?

**Temporary Solution:** One team member puts their phone on speaker mode, others call in via regular phone call.

**Pros:**
- Simple, uses existing infrastructure
- No additional development required
- Works on all devices

**Cons:**
- Requires phone call (not integrated in app)
- Additional step for users
- Not ideal UX

**Future Enhancement:** In-app voice chat using WebRTC:
- Integrated voice channel during conference time
- Lower latency than phone calls
- Better privacy (encrypted)

---

## Storage & Caching

### Question Download Strategy

When a team session starts:
1. Server sends list of question IDs for the session
2. Each client checks local DB for missing questions
3. Client requests missing questions from server
4. Questions download in background before session starts

**Optimization:** Pre-download questions when session is scheduled (background fetch).

### Offline Tolerance

If a team member loses connection mid-session:
- Continue with remaining members
- Member can rejoin when connection restored
- Missed questions marked as "did not answer"

---

## Next Steps (Implementation Plan)

### Phase 2A: Team Management
- [ ] Team CRUD API endpoints
- [ ] Team invitation system
- [ ] Team member management UI
- [ ] Push notification setup

### Phase 2B: Session Orchestration
- [ ] WebSocket server implementation
- [ ] Session state management
- [ ] Buzzer arbitration logic
- [ ] Latency compensation algorithm

### Phase 2C: iOS Client Integration
- [ ] Team creation/management views
- [ ] Session lobby view
- [ ] Real-time session view with WebSocket
- [ ] Buzzer button UI
- [ ] Team member presence indicators

### Phase 2D: Statistics & Analytics
- [ ] Team performance dashboard
- [ ] Session replay functionality
- [ ] Individual progress within team context
- [ ] Regional leaderboards

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session join latency | <2 seconds | Time from notification to session ready |
| Question distribution latency | <200ms | Server sends → All clients have question |
| Buzzer fairness | <50ms variance | Corrected buzz time variance between members |
| Connection stability | >95% | Successful session completion rate |
| User satisfaction | >4.0/5 | Post-session rating |

---

## See Also

- [Knowledge Bowl Architecture](KNOWLEDGE_BOWL_ARCHITECTURE.md)
- [Knowledge Bowl Module Specification](KNOWLEDGE_BOWL_MODULE_SPEC.md)
- [Management API Documentation](../../server/docs/api/MANAGEMENT_API.md)
