# TaskFlow Desktop — User Consent & Installer Plan

## Why This Is Needed

The TaskFlow Desktop app monitors keyboard activity, mouse activity, idle time, and active application names while the timer is running. This is activity monitoring software — it **must** have explicit user consent before collecting any data. Currently, monitoring starts silently with no notice or permission request. This document outlines the consent flow and installer setup required before production distribution.

---

## What Data Is Collected

| Data | Method | When | Privacy Level |
|------|--------|------|--------------|
| Keyboard press **count** | Win32 `GetAsyncKeyState` (polls 255 key codes) | Every 1 second | Safe — no key values recorded |
| Mouse event **count** | Win32 `GetCursorPos` + button states | Every 1 second | Safe — no coordinates stored |
| Active/idle seconds | Win32 `GetLastInputInfo` | Every 1 second | Safe — just a duration |
| Active application name | Win32 `GetForegroundWindow` + process name | Every 5 seconds | Moderate — shows "VS Code", "Chrome", etc. |
| App usage breakdown | Aggregated from above | Every 5 minutes | Moderate — time per app |

### What Is NOT Collected
- No keystrokes or typed text
- No screenshots or screen recordings
- No mouse coordinates or click positions
- No window titles, URLs, or file names
- No web browsing history
- No data when the timer is stopped

### When Monitoring Runs
- **Only** when the user has an active timer (signed in to a task)
- Stops immediately when timer stops
- Data sent to backend every 5 minutes as aggregated "heartbeat" buckets
- Zero monitoring when timer is off — no CPU usage, no data collection

---

## Consent Flow

### First-Launch Consent Screen

When the user opens the app for the first time (no consent stored), show a full-screen consent page **before** the login screen:

```
┌─────────────────────────────────────────┐
│                                         │
│           [TaskFlow Logo]               │
│                                         │
│     Activity Monitoring Notice           │
│                                         │
│  TaskFlow Desktop tracks your work      │
│  activity while the timer is running:   │
│                                         │
│  ✓ Keyboard & mouse activity levels     │
│  ✓ Which applications you use           │
│  ✓ Active vs idle time                  │
│                                         │
│  We do NOT track:                       │
│  ✗ What you type (keystrokes)           │
│  ✗ Screenshots or screen content        │
│  ✗ Websites, files, or URLs             │
│  ✗ Any data when timer is stopped       │
│                                         │
│  Your admin can see activity reports    │
│  on the TaskFlow web dashboard.         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │    I Understand & Accept        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  By clicking Accept, you agree to       │
│  activity monitoring during active      │
│  timer sessions.                        │
│                                         │
│          [Decline & Exit]               │
│                                         │
└─────────────────────────────────────────┘
```

### Consent Storage

- Store consent flag in Windows Credential Manager: `keyring.Set("taskflow-desktop", "consent_accepted", "v1_<timestamp>")`
- Include version prefix (`v1_`) so consent can be re-requested if monitoring scope changes
- On app launch: check `keyring.Get("taskflow-desktop", "consent_accepted")` — if missing/invalid, show consent screen
- **Decline** → app closes with a message: "Activity monitoring is required. Contact your admin for details."

### Consent Flow Diagram

```
App Launch
  ↓
Check keyring for "consent_accepted"
  ↓
┌─ Found (v1_*) ──→ Proceed to Login
│
└─ Not found ──→ Show Consent Screen
                    ↓
              ┌── Accept ──→ Store consent → Proceed to Login
              │
              └── Decline ──→ Show message → Exit app
```

### Re-Consent

If the monitoring scope changes in a future update (e.g., adding screenshots):
1. Update the consent version prefix to `v2_`
2. App checks for `v2_` — existing `v1_` consent is insufficient
3. User sees the updated consent screen again

---

## Installer Plan (NSIS)

### Why an Installer

A standalone `.exe` works for testing, but production distribution needs:
- **Consent notice during installation** — user sees what the app does before installing
- **Windows Add/Remove Programs** registration — proper uninstall path
- **Desktop/Start Menu shortcuts**
- **Optional auto-start** toggle
- **WebView2 bootstrapper** — ensures WebView2 runtime is present (pre-installed on Win10 1903+ / Win11, but edge cases exist)

### NSIS Installer Structure

```
TaskFlowDesktop-Setup-1.0.0.exe
├── Welcome page
├── License/Privacy page ← Activity monitoring disclosure
├── Install directory selection
├── Options:
│   ├── [✓] Create desktop shortcut
│   ├── [✓] Create Start Menu shortcut
│   └── [ ] Launch on startup
├── Install files
│   ├── taskflow-desktop.exe (13.9 MB)
│   └── WebView2Loader.dll (if needed)
├── Register in Add/Remove Programs
└── Finish page
    └── [✓] Launch TaskFlow Desktop
```

### Privacy Notice in Installer

The "License/Privacy" page should include:

```
ACTIVITY MONITORING DISCLOSURE

TaskFlow Desktop monitors your work activity while the timer
is running. This includes:

• Keyboard and mouse activity levels (not keystrokes)
• Which applications are in the foreground
• Active vs idle time during work sessions

This data is sent to your organization's TaskFlow server
every 5 minutes and is visible to your admin in reports.

No monitoring occurs when the timer is stopped.

By installing this software, you acknowledge that your
organization uses activity monitoring during tracked sessions.

Contact your IT administrator for the full privacy policy.
```

### Build Command

```bash
cd desktop
wails build -nsis
```

This uses Wails' built-in NSIS integration. The NSIS script can be customized at `desktop/build/windows/installer/`.

---

## Implementation Checklist

### Phase 1: Consent Screen (Required before production)

- [ ] Create `ConsentScreen.tsx` component in `desktop/frontend/src/components/`
- [ ] Add consent check in `app.go` — new Go method `HasConsent() bool` and `AcceptConsent() error`
- [ ] Store consent in keyring with version prefix
- [ ] Update `app.tsx` flow: Consent → Login → TimerView
- [ ] Decline exits the app
- [ ] Activity monitor only starts if consent is given

### Phase 2: Settings/Transparency (Recommended)

- [ ] Add a "Privacy" section in the app showing what's monitored
- [ ] Show "Monitoring active" indicator when timer is running
- [ ] Option to revoke consent (clears flag, exits app)

### Phase 3: NSIS Installer (Required for distribution)

- [ ] Create NSIS script at `desktop/build/windows/installer/project.nsi`
- [ ] Add privacy disclosure page to installer
- [ ] Configure shortcuts and registry entries
- [ ] Bundle WebView2 bootstrapper
- [ ] Test install/uninstall cycle
- [ ] Add to GitHub Actions CI/CD

### Phase 4: Admin Controls (Future)

- [ ] Admin can enable/disable monitoring per user from web dashboard
- [ ] If admin disables monitoring, desktop app skips activity tracking
- [ ] Admin can set which data points to collect (keyboard, mouse, window, etc.)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `desktop/frontend/src/components/ConsentScreen.tsx` | Create | Consent UI |
| `desktop/frontend/src/app.tsx` | Modify | Add consent state check before login |
| `desktop/app.go` | Modify | Add `HasConsent()`, `AcceptConsent()`, `DeclineConsent()` methods |
| `desktop/internal/auth/keystore.go` | Modify | Add consent read/write functions |
| `desktop/build/windows/installer/project.nsi` | Create | NSIS installer script |
| `desktop/build/windows/installer/privacy.txt` | Create | Privacy notice for installer |

---

## Key Principles

1. **No silent monitoring** — always tell the user what's happening
2. **Consent before collection** — never start monitoring without explicit acceptance
3. **Easy to understand** — use plain language, not legal jargon
4. **Revocable** — user can withdraw consent (app becomes unusable but that's the trade-off)
5. **Versioned** — consent scope changes require re-consent
6. **Transparent** — show monitoring status in the UI at all times
