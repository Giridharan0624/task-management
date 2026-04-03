# Timer Architecture — How TaskFlow's Timer Works

## Core Principle

> The timer never actually "runs" continuously anywhere.
> It's **recomputed every time using timestamps**.

This is the same approach used by Clockify, Toggl, and other time-tracking apps.

---

## How It Works

### 1. When User Clicks "Start"

**Backend stores in DynamoDB:**
```json
{
  "sign_in_at": "2026-04-03T10:00:00Z",
  "sign_out_at": null,
  "hours": null,
  "task_id": "abc-123",
  "description": "Working on API integration"
}
```

No timer process starts. Just a timestamp is saved.

### 2. Frontend Displays the Timer

Every second, the frontend calculates:
```javascript
elapsed = Date.now() - new Date(sign_in_at).getTime()
```

The `LiveTimer` component runs a `setInterval` that updates the display every 1000ms. No actual "timer" is counting — it's just **math on two timestamps**.

### 3. When User Clicks "Stop"

Backend sets:
```json
{
  "sign_out_at": "2026-04-03T11:30:00Z",
  "hours": 1.5
}
```

The `hours` field is only populated when the session closes.

---

## What Happens In Different Scenarios

### Page Refresh
1. Frontend fetches `/attendance/me` from API
2. Backend returns `currentSignInAt` timestamp (stored in DB)
3. Frontend calculates: `now - currentSignInAt`
4. Timer "resumes" instantly — no data lost

### Browser Close & Reopen
Same as page refresh. The timestamp lives in DynamoDB, not in the browser. When the app loads, it fetches the timestamp and recalculates.

### App Closed for Hours
```
Start timer:   10:00 AM
Close browser: 10:05 AM
Reopen:        2:30 PM

elapsed = 2:30 PM - 10:00 AM = 4 hours 30 minutes
```

Timer shows 4h 30m immediately. No background process needed.

### Network Disconnect
Timer display continues locally (frontend has the `currentSignInAt` cached). When network returns, a refetch confirms the timestamp.

---

## Current Implementation Details

### Backend (Python / DynamoDB)

| File | What It Does |
|------|-------------|
| `domain/attendance/entities.py` | `Session` model with `sign_in_at`, `sign_out_at`, `hours` |
| `application/attendance/use_cases.py` | `SignInUseCase` saves timestamp, `SignOutUseCase` calculates hours |
| `handlers/attendance/sign_in.py` | API endpoint `POST /attendance/sign-in` |
| `handlers/attendance/sign_out.py` | API endpoint `PUT /attendance/sign-out` |

**Sign-in flow:**
```python
now = datetime.now(timezone.utc).isoformat()
session = Session(sign_in_at=now, sign_out_at=None, hours=None, ...)
attendance.sessions.append(session)
attendance.current_sign_in_at = now
attendance.status = "SIGNED_IN"
```

**Sign-out flow:**
```python
now = datetime.now(timezone.utc)
sign_in = datetime.fromisoformat(session.sign_in_at)
session.hours = round((now - sign_in).total_seconds() / 3600, 4)
session.sign_out_at = now.isoformat()
attendance.status = "SIGNED_OUT"
```

### Frontend (Next.js / React)

| File | What It Does |
|------|-------------|
| `components/attendance/LiveTimer.tsx` | Displays `HH:MM:SS`, ticks every 1s via `setInterval` |
| `components/attendance/AttendanceButton.tsx` | Full timer UI with session list |
| `lib/utils/liveSession.ts` | `getSessionHours()` — returns `(now - signInAt) / 3600000` for active sessions |
| `lib/hooks/useAttendance.ts` | Fetches attendance data, optimistic updates on sign-in/out |
| `lib/hooks/useTimerTitle.ts` | Updates browser tab title + favicon via Web Worker |
| `lib/hooks/useLiveHours.ts` | Calculates total hours including running session |
| `lib/utils/timerWorker.ts` | Web Worker for background tab title updates (browsers throttle setInterval) |

**LiveTimer component:**
```typescript
useEffect(() => {
  const start = new Date(startTime).getTime()
  const tick = () => {
    const diff = Math.floor((Date.now() - start) / 1000)
    // Format as HH:MM:SS
  }
  const interval = setInterval(tick, 1000)
  return () => clearInterval(interval)
}, [startTime])
```

**Session hours calculation:**
```typescript
export function getSessionHours(session: AttendanceSession): number {
  if (session.hours !== null && session.hours !== undefined) return session.hours
  if (!session.signOutAt && session.signInAt) {
    return Math.max(0, (Date.now() - new Date(session.signInAt).getTime()) / 3600000)
  }
  return 0
}
```

### Optimistic Updates (No Timer Jump)

When the user clicks "Start":
1. Frontend records `_optimisticSignInAt = new Date().toISOString()` (client time)
2. UI updates instantly — timer starts ticking from client time
3. Backend processes the request, saves its own `now.isoformat()` (server time)
4. When backend response arrives, frontend **keeps the client timestamp** to prevent the timer from jumping backward

This ensures the timer feels instant (no waiting for API round-trip).

---

## Data Flow Diagram

```
┌─────────────┐     POST /sign-in      ┌─────────────┐
│   Frontend   │ ──────────────────────▶ │   Backend   │
│              │                         │             │
│ Click Start  │     { timestamp }       │ Save to DB  │
│              │ ◀────────────────────── │             │
│ Start local  │                         └─────────────┘
│ setInterval  │                               │
│              │                               ▼
│ Every 1s:    │                         ┌─────────────┐
│ now - start  │                         │  DynamoDB   │
│              │                         │             │
└─────────────┘                         │ sign_in_at  │
      │                                  │ sign_out_at │
      │  Page refresh / reopen           │ hours       │
      │                                  └─────────────┘
      ▼                                        │
┌─────────────┐     GET /attendance/me   ┌─────┘
│   Frontend   │ ──────────────────────▶ │
│              │                         │
│ Fetch start  │     { timestamp }       │
│ time from DB │ ◀────────────────────── │
│              │
│ Recalculate: │
│ now - start  │
│              │
│ Timer resumes│
└─────────────┘
```

---

## Edge Cases Handled

| Scenario | How It's Handled |
|----------|-----------------|
| Page refresh | Fetches `currentSignInAt` from API, recalculates |
| Browser close/reopen | Same as refresh — DB has the timestamp |
| App closed for hours | `now - start_time` = accurate elapsed time |
| Network disconnect | Cached timestamp continues, refetch on reconnect |
| Multiple tabs | Each tab calculates independently from same timestamp |
| Client clock skew | Optimistic update uses client time; server time used for final calculation |
| Midnight crossover | ISO 8601 timestamps handle date boundaries correctly |
| Task switching | Previous session gets `sign_out_at`, new session starts with fresh `sign_in_at` |
| Force kill app | Data already in DynamoDB — timer resumes on next load |

---

## Why This Works (Key Insight)

> **Timer = (current time - stored time)**
> NOT a running process

Benefits:
- Zero backend load (no timer threads/processes)
- Works offline (once start time is cached)
- Works after restart/crash
- Scales to millions of users
- No WebSocket needed
- No background service needed
- Accurate to the second

---

## Tab Title + Favicon (Background Tab Support)

When the timer is running, the browser tab shows: `00:08:11 · Task Name — TaskFlow`

**Challenge:** Browsers throttle `setInterval` in background tabs (1 call/minute in Chrome after 5 min).

**Solution:** A Web Worker (`timerWorker.ts`) runs the tick — Web Workers are NOT throttled in background tabs.

```typescript
// Web Worker (inline blob)
self.onmessage = function(e) {
  if (e.data === 'start') {
    interval = setInterval(() => self.postMessage('tick'), 1000)
  }
}
```

The favicon also swaps to show a red recording dot (canvas-drawn) when the timer is active.

---

## Comparison to Clockify

| Feature | TaskFlow | Clockify |
|---------|----------|----------|
| Timestamp-based | Yes | Yes |
| No background process | Yes | Yes |
| Survives page refresh | Yes | Yes |
| Survives browser close | Yes | Yes |
| Optimistic UI | Yes | Yes |
| Background tab title | Yes (Web Worker) | Yes |
| Recording indicator | Red dot favicon | Green dot favicon |
| Task switching | Auto-close + new session | Same |
| Mandatory description | Yes | Optional |

TaskFlow's timer is architecturally identical to Clockify's approach.
