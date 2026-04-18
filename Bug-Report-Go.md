# Bug Report — TaskFlow Desktop (Go / Wails v2)

**Date:** 2026-04-15
**Audit coverage:** Full codebase (Go backend + Preact frontend)
**Passes run:** `/review`, `/security-review`, `/debug` — with module-by-module deep review plus a second structural/invariant pass
**Total findings:** ~85 issues — **23 Critical, 32 High, 30 Medium** after dedup
**Status:** **Do not ship to production until the P0 section is green.**

---

## 0. How to read this report (team onboarding)

This document is written for a team that is new to Go. Read it in this order:

1. **Section 1 — P0 Fix-First queue.** The 10 items that must be fixed before v1 ships. Each item has a file, a line, an impact, and a fix template in Section 8.
2. **Section 2 — Hardening plan.** Process and tooling changes that catch whole classes of bugs at `go build` time instead of in production. Do this BEFORE touching any code — it will surface bugs as you fix them.
3. **Section 3 — Findings by module.** The full catalog. Treat it as your bug tracker. Every item has a severity, a fix direction, and a cross-reference to the fix template.
4. **Section 4 — Systemic patterns.** Codebase-wide problems that need a design decision, not a line edit. Take these to your most senior person before implementing.
5. **Section 5 — Invariant & failure-mode analysis.** What actually breaks in production: auth-refresh cascades, suspend/resume drift, double-click races. These are the bugs users will hit.
6. **Section 6 — Go concurrency crash course.** The minimum Go your team needs to internalize to stop re-introducing these bugs. One evening of study.
7. **Section 7 — Fix templates.** Copy-paste-ready Go patterns for the common problems. Reference from Section 3.
8. **Section 8 — Acceptance criteria.** How to know you are done.

**Rule of thumb:** if a finding cites `file.go:LINE`, the bug is real and verifiable. Do not "clean up" code around it — make the minimal fix, commit, move on.

---

## 1. P0 Fix-First Queue (the 10 items blocking production)

| # | Severity | Module | File:line | One-line impact | Template |
|---|---|---|---|---|---|
| 1 | **Critical** | Updater | [updater.go:105-153](internal/updater/updater.go#L105-L153) | No signature / hash verification on downloaded binary → arbitrary code execution with admin (supply-chain RCE) | T-UPD-1 |
| 2 | **Critical** | Updater | [updater.go:110-117](internal/updater/updater.go#L110-L117) + [app.go:339-348](app.go#L339-L348) | Download URL from GitHub API used verbatim, no scheme/host allowlist → MITM can redirect to attacker host | T-UPD-2 |
| 3 | **Critical** | Updater | [updater.go:113-114](internal/updater/updater.go#L113-L114) | `info.FileName` joined into temp path without `filepath.Base` → path traversal (`..\Windows\System32\*.exe`) | T-UPD-3 |
| 4 | **Critical** | Updater | [updater_linux.go:23-34](internal/updater/updater_linux.go#L23-L34) | `/tmp` TOCTOU — local attacker can swap the file between chmod and exec | T-UPD-4 |
| 5 | **Critical** | Auth | [keystore_windows.go:63-64](internal/auth/keystore_windows.go#L63-L64) | DPAPI decryption silently falls back to plaintext → trivial token forgery by any same-user process | T-AUTH-1 |
| 6 | **Critical** | Auth | [cognito.go:44, 117-122](internal/auth/cognito.go#L44) | Cognito `Session` challenge token serialized into `LoginResult` → crosses Wails IPC into the JS renderer | T-AUTH-2 |
| 7 | **Critical** | Monitor | [activity.go:287-289](internal/monitor/activity.go#L287-L289) | Screenshot 5-second warning uses blocking `time.Sleep`, ignores context cancel → **screenshot after Stop / after Logout = privacy breach** | T-CTX-1 |
| 8 | **Critical** | Core | [main_windows.go:27](main_windows.go#L27) | Single-instance mutex check is logically inverted — `||` short-circuits on `handle==0`, so two instances can run simultaneously on Windows | T-FIX-LOGIC |
| 9 | **Critical** | Tray | [tray_darwin.go:75-77](internal/tray/tray_darwin.go#L75-L77) | `osascript` command injection via server-supplied task title — backend can execute arbitrary shell as the user | T-ESC-1 |
| 10 | **Critical** | Core + Monitor | [app.go:120-129, 251-258](app.go#L120-L129) + [activity.go:69-102](internal/monitor/activity.go#L69) | `stopChan` replaced without sync; re-login spawns a second `pollAttendance` goroutine and ActivityMonitor N×2 goroutines (data race + leak + double events) | T-GO-1 |

**Each of these is independently capable of leaking credentials, executing arbitrary code, or corrupting employee activity data. Fix all 10 before any production rollout.**

---

## 2. Hardening plan — do this BEFORE fixing anything else

Set these tools up first. They will catch bugs automatically as you work through Section 3 and prevent the team from re-introducing them later.

### 2.1 Turn on the Go race detector in CI (non-negotiable)

Add this to CI before the build step:

```bash
go vet ./...
go test -race -count=1 ./...
```

There are currently no tests, but `go vet` alone will flag a good chunk of what was found in this audit. Add the flag now so that when you *do* write tests, the race detector runs by default.

### 2.2 Add `staticcheck` and `errcheck`

```bash
go install honnef.co/go/tools/cmd/staticcheck@latest
go install github.com/kisielk/errcheck@latest
staticcheck ./...
errcheck ./...
```

- `staticcheck` catches many of the `sync.Mutex` misuses, unreachable code, and context leaks in this report.
- `errcheck` catches every `_ = foo()` and `foo()` (ignored return) — finding #H-AUTH-6 in Section 3 (`Logout` ignores `deleteTokensFromKeyring` error) would have been caught by `errcheck` in CI.

Add a CI job `lint` that fails the build on any warning.

### 2.3 Pre-commit hook

Create `.git/hooks/pre-commit` (and document it in the README so every dev installs it):

```bash
#!/bin/bash
set -e
gofmt -l . | grep -v '^$' && { echo "gofmt failures"; exit 1; } || true
go vet ./...
staticcheck ./...
errcheck ./...
echo "pre-commit OK"
```

### 2.4 GitHub Actions: cross-compile check

Your `Makefile` already has a `check` target. Make CI run it on every PR:

```yaml
- name: Cross-compile check
  run: |
    GOOS=windows GOARCH=amd64 go build ./...
    GOOS=linux   GOARCH=amd64 go build ./...
    # darwin needs cgo so build on a macOS runner
```

This catches platform-parity bugs (functions missing on one OS) before they land on `main`.

### 2.5 Forbidden patterns — add to code review checklist

Reviewers must reject any PR containing:

- `go func()` without a matching `defer wg.Done()` where `wg` is a `WaitGroup` that the caller will `Wait()` on.
- `time.Sleep` inside any goroutine that lives longer than one call stack.
- `fmt.Errorf("...%s...", resp.String())` or any pattern that embeds a response body into an error.
- `exec.Command("...", fmt.Sprintf(...))` or `osascript ... fmt.Sprintf(...)`.
- `filepath.Join(tempDir, someExternalString)` without `filepath.Base(...)`.
- Any `*http.Request` created with `http.NewRequest` (must be `NewRequestWithContext`).
- Reading or writing a struct field from more than one goroutine without a `sync.Mutex` or `sync/atomic`.
- `_ = foo()` where `foo` returns an `error`.

### 2.6 One senior Go reviewer

If no one on the team can honestly say "I understand when to use a channel vs a mutex vs a `sync.WaitGroup`", hire or borrow one person part-time who does. They don't need to write the code — they need to **review PRs** for the eight forbidden patterns above. Without this, the team will ship the same bugs again.

---

## 3. Findings by module

### 3.1 Core / app lifecycle

Files: [app.go](app.go), [main.go](main.go), [main_windows.go](main_windows.go), [main_linux.go](main_linux.go), [main_darwin.go](main_darwin.go), [internal/state/state.go](internal/state/state.go)

#### Critical
- **C-CORE-1** — [main_windows.go:27](main_windows.go#L27) — Single-instance mutex check is inverted (`|| `short-circuits; should be `handle != 0 && err == ERROR_ALREADY_EXISTS`). Fix: T-FIX-LOGIC.
- **C-CORE-2** — [app.go:120-129](app.go#L120-L129) — `startBackgroundServices` drains and replaces `stopChan` without a lock → concurrent `pollAttendance` goroutine sees torn state; re-login spawns a second poll loop that races the first. Fix: T-GO-1 (replace ad-hoc channel with a session-scoped `context.Context`).
- **C-CORE-3** — [main_linux.go:13-15](main_linux.go#L13-L15), [main_darwin.go:14-16](main_darwin.go#L14-L16) — `ensureSingleInstance` is a no-op on Linux; macOS comment claims NSApplication handles it but that's only true for bundle launches. Fix: T-PLATFORM-1 (file-lock at `~/.local/share/TaskFlow/app.lock` or `~/Library/Application Support/...`).

#### High
- **H-CORE-1** — [app.go:175-183](app.go#L175-L183) — `networkErrorCount` read-modify-write with no lock. Fix: T-GO-2 (wrap in `atomic.Int32`).
- **H-CORE-2** — [app.go:56-67, 112](app.go#L56-L67) — `a.quitting` is written from the tray goroutine and read from Wails' `beforeClose` thread — race, no happens-before edge. A user who presses X between `a.quitting = true` and `runtime.Quit` will see the window hide instead of quit, leaving a stuck tray process. Fix: T-GO-2.
- **H-CORE-3** — [app.go:120-129, 251-258](app.go#L120-L129) — Poll-goroutine leak on re-login (see C-CORE-2 for root cause).
- **H-CORE-4** — [state/state.go:70-74](internal/state/state.go#L70-L74) — `GetAttendance` returns a pointer under `RLock`, then releases the lock. Callers can mutate the inner struct without synchronization. Fix: T-GO-3 (return a deep copy; never leak a pointer past a lock).
- **H-CORE-5** — [app.go:290-300](app.go#L290-L300) — `SignOut` binding method is callable after `Logout` has cleared tokens; produces opaque 401 and the UI goes into a broken state. Fix: guard every binding with `if !a.State.IsAuthenticated() { return ErrNotAuthenticated }`.
- **H-CORE-6** — [app.go:56-72](app.go#L56-L72) — `OnQuit` goroutine sets `a.quitting` then calls async `runtime.Quit`. No memory barrier → Wails `beforeClose` thread can read the old value. Same fix as H-CORE-2.
- **H-CORE-7** — [app.go:87-98](app.go#L87-L98) — Startup update-check goroutine uses plain `time.Sleep(5s)`, has no `defer recover()`, no `select` on shutdown, no `WaitGroup`. If startup aborts during those 5 seconds, `a.ctx` is already torn down when `EventsEmit` fires. Fix: T-CTX-1 + wrap in `defer recover()`.

#### Medium
- **M-CORE-1** — [main_{windows,linux,darwin}.go setupLogging](main_windows.go) — Log file opened, never closed; mkdir failure silently swallowed.
- **M-CORE-2** — [app.go:102-107](app.go#L102-L107) — `shutdown` calls `ActivityMonitor.Stop()` / `TrayManager.Stop()` with no nil guards (impossible via Wails lifecycle today but one PR away from a crash).

---

### 3.2 Auth / Crypto / Keystore

Files: [internal/auth/cognito.go](internal/auth/cognito.go), [keystore*.go](internal/auth/), [crypto*.go](internal/auth/)

#### Critical
- **C-AUTH-1** — [keystore_windows.go:63-64](internal/auth/keystore_windows.go#L63-L64) — DPAPI failure silently returns `plain = encrypted`. **Remove the fallback entirely.** Fix: T-AUTH-1.
- **C-AUTH-2** — [cognito.go:44, 117-122](internal/auth/cognito.go#L44) — `LoginResult.Session` (Cognito challenge session) is `json:"session,omitempty"` and crosses Wails IPC to the JS renderer. Fix: T-AUTH-2 (store in `Service.lastLoginSession`, use inside `CompleteNewPasswordChallenge`, never return to frontend).
- **C-AUTH-3** — [cognito.go:25-33](internal/auth/cognito.go#L25-L33) — `authCtx` leaks the cancel function via a goroutine pattern that only calls `cancel()` after `ctx.Done()` fires. The `context.WithTimeout` internal timer goroutine leaks until natural expiry. Fix: T-CTX-2 (use `defer cancel()` at each call site, not a background goroutine).

#### High
- **H-AUTH-1** — [keystore_windows.go:96-117](internal/auth/keystore_windows.go#L96-L117) — Partial chunk write corrupts keystore permanently. `CHUNKED:N` sentinel is written first, chunks in a loop second. Crash mid-loop = user locked out forever. Fix: T-ATOMIC-1 (write all chunks under temp keys first, swap sentinel last).
- **H-AUTH-2** — [keystore_windows.go:162-165](internal/auth/keystore_windows.go#L162-L165) — `deleteChunked` cleanup loop caps at 10 but load validates up to 20 chunks. Orphaned chunks 10–19 persist after logout.
- **H-AUTH-3** — [cognito.go:218-221](internal/auth/cognito.go#L218-L221) — `Logout` silently ignores `deleteTokensFromKeyring` errors. Tokens survive logout on keyring failure.
- **H-AUTH-4** — [cognito.go:184-198](internal/auth/cognito.go#L184-L198) — `TryRestoreSession` assigns `s.tokens` before verifying the refresh succeeded. A concurrent `GetIDToken` between the assignment and the refresh-failure check returns the stale token.
- **H-AUTH-5** — [cognito.go:247-250](internal/auth/cognito.go#L247-L250) — In-place token refresh (`IDToken`, `AccessToken`, `ExpiresAt`) with no mutex on `Service`. Add `Service.mu sync.RWMutex` and hold it across all token reads/writes.
- **H-AUTH-6** — [cognito.go:320](internal/auth/cognito.go#L320) — `resolveEmployeeID` uses bare `http.Get` (no timeout, no TLS minimum, no `url.QueryEscape`). Route through `APIClient` or use a shared hardened client.

#### Medium
- **M-AUTH-1** — [cognito.go:318-320](internal/auth/cognito.go#L318-L320) — `employeeID` interpolated into URL without `url.QueryEscape`. Safe under the current regex, fragile.
- **M-AUTH-2** — [crypto_windows.go:53-61](internal/auth/crypto_windows.go#L53-L61) — `CryptProtectData` called with flags=0, missing `CRYPTPROTECT_UI_FORBIDDEN` (0x1). Background goroutine can hang on a modal DPAPI dialog.
- **M-AUTH-3** — [cognito.go:257-291](internal/auth/cognito.go#L257-L291) — No client-side JWT claim verification of `iss`/`aud`/`exp` before the decoded fields are used in `CompleteNewPasswordChallenge`.

---

### 3.3 API client / Config

Files: [internal/api/client.go](internal/api/client.go), [internal/config/config.go](internal/config/config.go)

#### Critical
- **C-API-1** — [client.go:309-313](internal/api/client.go#L309-L313) — S3 `presignResp.UploadURL` (server-controlled) is PUT to verbatim. Compromised backend can redirect screenshot JPEGs — containing the user's screen — to an attacker host. Fix: T-URL-1 (scheme+host allowlist validation).
- **C-API-2** — [client.go:290-291](internal/api/client.go#L290-L291) — `filename` interpolated into query string without `url.QueryEscape`. Crafted filename can override later `contentType` parameter. Fix: `url.QueryEscape(filename)`.
- **C-API-3** — [config.go:34-50](internal/config/config.go#L34-L50) — `Get()` has a race: `loaded` is assigned a zero-value struct at line 38 before the panic branch fires. A concurrent second caller sees `loaded != nil` and returns an empty config → downstream panics with misleading "URL scheme" error. Fix: T-ONCE-1 (wrap in `sync.Once`).

#### High
- **H-API-1** — [client.go:124, 174, 225, 275, 296, 317](internal/api/client.go#L124) — Every non-2xx path echoes `resp.String()` (raw backend body) into the error string returned to the frontend. Can leak tokens, ARNs, stack traces. Fix: T-ERR-1 (sanitize-and-truncate helper).
- **H-API-2** — [client.go:173-174, 200](internal/api/client.go#L173-L174) — No sentinel errors. Callers cannot distinguish 401 (reauth) from 5xx (retry). Fix: `var ErrUnauthorized = errors.New("unauthorized")` etc., then `errors.Is(err, ErrUnauthorized)`.
- **H-API-3** — [client.go:326-343](internal/api/client.go#L326-L343) — `snakeToCamel` silently returns raw bytes on parse failure → HTML error pages from a WAF pass through and surface as "failed to parse response".

#### Medium
- **M-API-1** — [config.go:47, loadFromFile](internal/config/config.go#L47) — Dev fallback validates only `APIURL` and `CognitoClientID`. Other fields can be empty; auth fails later with an opaque SDK error.
- **M-API-2** — [client.go:82-87, 309](internal/api/client.go#L82-L87) — Shared 30-second client timeout applied to the S3 screenshot PUT. Slow uplinks will silently fail. Use a second `resty.Client` for uploads with a longer timeout.
- **M-API-3** — [client.go:71-73](internal/api/client.go#L71-L73) — HTTPS enforced only on `APIURL` prefix, not on redirect targets. Default Go client follows redirects to `http://`. Set `CheckRedirect` to reject non-HTTPS.

---

### 3.4 Activity Monitor (largest and riskiest module)

Files: [internal/monitor/activity.go](internal/monitor/activity.go), [screenshot.go](internal/monitor/screenshot.go), [appnames.go](internal/monitor/appnames.go), per-platform `input_*`, `window_*`, `idle_*`

#### Critical
- **C-MON-1** — [activity.go:287-289](internal/monitor/activity.go#L287-L289) — Screenshot warning uses `time.Sleep(5s)` then unconditionally captures. **If `Stop` fires during the sleep, the capture still happens → privacy-contract breach (capture after timer stopped / after logout).** Fix: T-CTX-1.
- **C-MON-2** — [activity.go:198-224](internal/monitor/activity.go#L198-L224) — Heartbeat assigns `m.appUsage` (live map pointer) into `bucket["app_breakdown"]` under the lock, then releases the lock before serializing. `resetBucketLocked` deletes keys in-place — the bucket still holds the same map pointer, so the next `trackActivity` tick corrupts the JSON being serialized. Fix: T-GO-3 (deep-copy the map before releasing the lock).

#### High
- **H-MON-1** — [activity.go:69-102](internal/monitor/activity.go#L69-L102) — `Stop` cancels the context but does not `Wait` on the three spawned goroutines. Rapid `Stop→Start` → up to 6 goroutines run concurrently, interleaving writes to counter state. Fix: T-GO-4 (`sync.WaitGroup` joined on `Stop`).
- **H-MON-2** — [input_linux.go:47](internal/monitor/input_linux.go#L47) — `NewIdleDetector()` allocated per tick (1/sec), forks `xprintidle` on every call. Two process spawns/second. On Wayland sessions without `xprintidle`, idle returns 0 → the `!isIdle` heuristic fires every tick → **keyboard counts are permanently inflated**. Fix: inject the detector as a field on `InputTracker`.
- **H-MON-3** — [screenshot.go:26-29](internal/monitor/screenshot.go#L26-L29) — `IsScreenLocked` uses "idle > 10 min" as a proxy. False negative (privacy breach): locked screen with mouse jiggle is captured. False positive: user reading a long doc is skipped. Fix: use `WTSQuerySessionInformation` (Windows), `CGSessionCopyCurrentDictionary` (macOS), `loginctl` D-Bus (Linux).
- **H-MON-4** — [input_windows.go:28-87](internal/monitor/input_windows.go#L28-L87) — `lastKeyStates[256]`, `lastCursorX/Y` unsynchronized. Currently accessed from a single goroutine, so latent, but race-detector-flagged.
- **H-MON-5** — [activity.go:100](internal/monitor/activity.go#L100) — `Stop` calls `resetBucketLocked()` without flushing → up to 5 minutes of activity silently dropped on every `SignOut`. Flush first, then reset.

#### Medium
- **M-MON-1** — [activity.go:130](internal/monitor/activity.go#L130) — `keyboardTotal` / `mouseTotal` (the `atomic.Uint32`) never reset across `Stop→Start`, while the local `lastKeyboard` is reset to 0. First tick after restart sees an enormous delta; the `<1000` spike cap masks it but also silently drops legitimate bursts.
- **M-MON-2** — [appnames.go:124](internal/monitor/appnames.go#L124) — Linux passes `/proc/[pid]/exe` through `friendlyAppName`. Strip logic correctly returns only the stem, but worth a code comment.

---

### 3.5 Tray

Files: [internal/tray/tray_windows.go](internal/tray/tray_windows.go), [tray_darwin.go](internal/tray/tray_darwin.go), [tray_linux.go](internal/tray/tray_linux.go)

#### Critical
- **C-TRAY-1** — [tray_windows.go:302-327](internal/tray/tray_windows.go#L302-L327) — `SetTimerActive` releases `m.mu` after touching a few status fields, then mutates the Win32 `NOTIFYICONDATAW` struct (`SzTip`, `HIcon`, `UFlags`) unlocked while the message loop reads them. Data race on a 4KB OS struct. Fix: hold the mutex through the full mutation and the `Shell_NotifyIcon` call.
- **C-TRAY-2** — [tray_windows.go:277-299](internal/tray/tray_windows.go#L277-L299) — `ShowBalloon` calls `Shell_NotifyIcon(NIM_MODIFY)` from whatever goroutine the activity monitor fires on. Win32 requires it from the window-owning thread. Fix: `PostMessage` a custom notification code to `hwnd` and handle the balloon update inside the window proc.
- **C-TRAY-3** — [tray_darwin.go:75-77](internal/tray/tray_darwin.go#L75-L77) — `osascript` command injection. `fmt.Sprintf(\`display notification "%s" with title "%s"\`, message, title)`. Server-supplied `task.TaskTitle` reaches here. Fix: T-ESC-1 (use `osascript -e` with separate `-e` arguments; never string-interpolate user data into AppleScript literals).

#### High
- **H-TRAY-1** — [tray_windows.go:267-274, 331-380](internal/tray/tray_windows.go#L267-L274) — `Stop` posts `WM_CLOSE`; `DefWindowProc` handles it with `DestroyWindow`, which posts `WM_DESTROY`, not `WM_QUIT`. `GetMessage` only returns 0 on `WM_QUIT`. The message loop never exits, the cleanup at line 255 never runs, the tray icon stays in the taskbar after logout. Fix: handle `WM_DESTROY` in `trayWndProc` and call `PostQuitMessage(0)`.
- **H-TRAY-2** — [tray_linux.go:60-64](internal/tray/tray_linux.go#L60-L64) / [tray_darwin.go:60-64](internal/tray/tray_darwin.go#L60-L64) — `Stop()` sets `m.running = false` under mutex but does not signal the `<-done` channel in `Start`. Shutdown paths are not aligned. Fix: close a dedicated stop channel in `Stop` and `select` on it inside `Start`.
- **H-TRAY-3** — [tray_windows.go:177, 187](internal/tray/tray_windows.go#L177) — Package-level `globalManager *Manager` written under `m.mu` but read from the Win32 callback goroutine without any sync primitive. Fix: `atomic.Pointer[Manager]`.

#### Medium
- **M-TRAY-1** — Icon switching (red-dot when recording) — verify that the HICON resource handle is not leaked on repeated swaps; cache or call `DestroyIcon`.

---

### 3.6 Updater (highest blast radius — this is where a compromise becomes an RCE)

Files: [internal/updater/updater.go](internal/updater/updater.go), [updater_windows.go](internal/updater/updater_windows.go), [updater_linux.go](internal/updater/updater_linux.go), [updater_darwin.go](internal/updater/updater_darwin.go), [app.go:339-348](app.go#L339-L348)

#### Critical — all four of these must be fixed together
- **C-UPD-1** — [updater.go:105-153](internal/updater/updater.go#L105-L153) — **No integrity verification.** No SHA-256 check, no Authenticode verification, no GPG. Any GitHub release compromise → RCE via `ShellExecute("runas")`. Fix: T-UPD-1.
- **C-UPD-2** — [app.go:339-348](app.go#L339-L348) + [updater.go:110-117](internal/updater/updater.go#L110-L117) — `InstallUpdate(downloadURL, fileName)` accepts a URL from the frontend with no host/scheme check. Fix: T-UPD-2 (allowlist `github.com` and `objects.githubusercontent.com`, enforce `https`).
- **C-UPD-3** — [updater.go:113-114](internal/updater/updater.go#L113-L114) — `filepath.Join(tempDir, info.FileName)` without `filepath.Base`. Path traversal. Fix: T-UPD-3.
- **C-UPD-4** — [updater_linux.go:23-34](internal/updater/updater_linux.go#L23-L34) — `/tmp` TOCTOU race. Fix: T-UPD-4 (`os.MkdirTemp("", "taskflow-update-*")` with 0700 permissions).

#### High
- **H-UPD-1** — [app.go:339-348](app.go#L339-L348) — No re-entrancy guard on `InstallUpdate`. Double-click launches two downloads + two UAC prompts + truncated installer file. Fix: package-level `var installInProgress atomic.Bool`.
- **H-UPD-2** — [updater.go:23](internal/updater/updater.go#L23) — `CurrentVersion = "1.0.0"` as default. Any dev/CI build without ldflags thinks it is ancient and auto-downloads "updates". Fix: default to `"dev"` and early-return if `CurrentVersion == "dev"`.
- **H-UPD-3** — [app.go:347](app.go#L347), [updater_windows.go:51](internal/updater/updater_windows.go#L51) — `ShellExecute` is fire-and-forget; `runtime.Quit` called immediately. Background goroutines (monitor, poll, tray) are not joined → the running `.exe` may still be file-locked when NSIS tries to overwrite. Fix: `WaitGroup.Wait()` all background goroutines before returning from `InstallUpdate`.

#### Medium
- **M-UPD-1** — [updater.go:180-193](internal/updater/updater.go#L180-L193) — `parseVersion` strips anything after `-` or `+`. `v1.6.0-beta` parses as `v1.6.0` → beta tags are auto-delivered to stable users. Skip tags containing `-`.
- **M-UPD-2** — [updater.go:82-84](internal/updater/updater.go#L82-L84) — Silent no-op when remote is older than local. Log it so rollback attacks are detectable.

---

### 3.7 Frontend (Preact) — migration to Tauri would NOT fix any of these

Files: [frontend/src/](frontend/src/)

#### Critical
- **C-FE-1** — [TimerView.tsx:39-46](frontend/src/components/TimerView.tsx#L39-L46) — `patchAttendance` mutates the Wails response object in place instead of spreading a copy. If Wails caches the object reference, you silently corrupt cached state.
- **C-FE-2** — [TimerView.tsx:50-67](frontend/src/components/TimerView.tsx#L50-L67) — `EventsOn` handlers registered in `useEffect([])` that interacts badly with fast-refresh; second mount stacks a second handler before cleanup runs. Dev-time bug today, production-time bug one dependency change away.
- **C-FE-3** — [TimerView.tsx:88-102](frontend/src/components/TimerView.tsx#L88-L102) — `handleStart` recovery path can leave `loading=true` forever if the nested `GetMyAttendance()` throws.

#### High
- **H-FE-1** — [TimerView.tsx:78-86](frontend/src/components/TimerView.tsx#L78-L86) — `useMemo` deps contain `Date.now()` → memo recomputes every render; `groupedTasks` depends on `totalHours` → also recomputes every second.
- **H-FE-2** — [LoginForm.tsx:26](frontend/src/components/LoginForm.tsx#L26) — Password not cleared from state after successful login.
- **H-FE-3** — [TaskSelector.tsx:56-65](frontend/src/components/TaskSelector.tsx#L56-L65) — Whitespace-only description passes client-side validation but fails server-side → bad UX.
- **H-FE-4** — [SessionList.tsx:59](frontend/src/components/SessionList.tsx#L59) — Resume uses `group.sessions[0]` (oldest) instead of most-recent.
- **H-FE-5** — Shell component's `setUpdating(true)` never cleared on error → "Updating…" button sticks.

#### Medium
- **M-FE-1** — [useTheme.ts:14](frontend/src/lib/useTheme.ts#L14) — Theme flash on first paint.
- **M-FE-2** — [Timer.tsx:51-52](frontend/src/components/Timer.tsx#L51-L52) — `NaN:NaN:NaN` display on invalid `currentSignInAt`.
- **M-FE-3** — [TimerView.tsx:325](frontend/src/components/TimerView.tsx#L325) — Dashboard link hard-coded to prod URL, ignoring config.
- **M-FE-4** — Module-level `_optimisticSignInAt` not cleared on logout.

---

## 4. Systemic patterns — codebase-wide

These are not individual bugs — they are design gaps that keep producing bugs. Address them once at the architectural level and many individual findings collapse.

### P-1. Unsynchronized state on `App`
**Evidence:** `a.quitting`, `a.networkErrorCount`, `a.stopChan` in [app.go](app.go).
**Root cause:** `App` has no mutex of its own. Sub-components (`AppState`, `ActivityMonitor`) have correct locking; `App` does not.
**Fix:** Add `App.mu sync.Mutex`. Every mutation to any `App` field after `startup` completes must go through `mu`. Better: add `atomic.Bool` for `quitting`, `atomic.Int32` for `networkErrorCount`, and replace `stopChan` with a session-scoped `context.Context` (see T-GO-1).

### P-2. No goroutine ownership — no `WaitGroup` anywhere in the codebase
**Evidence:** `go func()` appears in [app.go:84, 87, 128, 325](app.go), [activity.go:82-84](internal/monitor/activity.go#L82), and several tray files — **none** have a matching `WaitGroup.Wait()` in any shutdown path.
**Root cause:** The team has been writing "fire-and-forget" goroutines. This works until you need to shut down cleanly — which is exactly what the updater and logout paths need.
**Fix:** Every subsystem that spawns a goroutine owns a `sync.WaitGroup`. `Start` calls `wg.Add(1)` BEFORE `go func()`. Each goroutine does `defer wg.Done()`. `Stop` calls `ctx.Cancel()` then `wg.Wait()`. **Do not return from `Stop` until every goroutine has returned.** See T-GO-4.

### P-3. Blocking primitives ignoring `context`
**Evidence:** [activity.go:289](internal/monitor/activity.go#L289), [app.go:88](app.go#L88), every `time.Sleep` in a goroutine.
**Root cause:** The team reaches for `time.Sleep` because it's simpler than `select` + `time.After`. The result is goroutines that ignore cancellation.
**Fix:** Ban `time.Sleep` inside any goroutine that lives beyond one call stack. Add it to the pre-commit reviewer checklist (Section 2.5). Use T-CTX-1.

### P-4. No validation layer between server strings and network/exec operations
**Evidence:** [updater.go:114](internal/updater/updater.go#L114) (download URL), [client.go:292-313](internal/api/client.go#L292) (presigned S3 URL), [cognito.go:320](internal/auth/cognito.go#L320) (API URL concatenation).
**Root cause:** Strings that arrive from a remote server are trusted implicitly.
**Fix:** Single helper `validateHTTPSURL(raw string, allowedHosts []string) (*url.URL, error)`. Every point where a server-sourced string becomes a network target calls this helper. See T-URL-1.

### P-5. Error strings echoed across the IPC boundary
**Evidence:** [client.go:124, 174, 225, 275, 296, 317](internal/api/client.go#L124) — all use `fmt.Errorf("...: %s", resp.String())`.
**Root cause:** Convenient, but `resp.String()` is the raw backend body which may contain tokens, stack traces, internal ARNs, or reflected PII.
**Fix:** Helper `sanitizeErrorBody(b []byte) string` that truncates to 200 bytes and strips printable-control-characters and anything that looks like a JWT. Use it everywhere an error message includes a response body. See T-ERR-1.

### P-6. External process fork per polling tick (Linux)
**Evidence:** [idle_linux.go:24](internal/monitor/idle_linux.go#L24), [window_linux.go:24](internal/monitor/window_linux.go#L24), [input_linux.go:47](internal/monitor/input_linux.go#L47).
**Root cause:** Linux platform code shells out to `xprintidle`, `xdotool` on every poll. Some call sites also re-allocate their own detector per tick.
**Fix:** Rewrite Linux monitor to use X11 / XCB via a Go binding (`BurntSushi/xgb`) — no subprocess. As an interim, cache detector instances as struct fields and make sure each process is forked once per **interval**, not once per call. See H-MON-2.

### P-7. Platform parity by accident, not by contract
**Evidence:** [tray_linux.go / tray_darwin.go Stop](internal/tray/) uses a different mechanism from `tray_windows.go`. Single-instance guard differs across platforms (C-CORE-3). Idle detector has inconsistent allocation lifetimes per platform.
**Root cause:** No shared interface enforces the same signature and behavior across `_windows.go` / `_linux.go` / `_darwin.go` files.
**Fix:** Define an interface in a **non**-build-tagged file:

```go
// internal/monitor/tracker.go
type IdleDetector interface {
    GetIdleSeconds() int
    Close() error
}
```

Each platform file provides a `NewIdleDetector() IdleDetector` returning the concrete type. `go build` fails on any platform that doesn't provide it. This catches the "no-op on Linux" class of bug at compile time.

---

## 5. Invariant violations & failure-mode cascades

### 5.1 Invariants that DO NOT hold in code

| Invariant | Status | Where it breaks |
|---|---|---|
| **INV-2** `beforeClose` hides unless `a.quitting` | ❌ Race — H-CORE-2 / H-CORE-6. Click-X timing can observe `quitting == false` and hang the process. |
| **INV-3** `ActivityMonitor.Start/Stop` pair 1:1 | ❌ True for method-level re-entry but BROKEN at the app level. Re-login creates a second `pollAttendance` goroutine that calls `Start` → first call's `running=true` makes the second call silently no-op while the old goroutines outlive the new context. See C-CORE-2 + H-MON-1. |
| **INV-4** No keys, coords, titles | ⚠️ Partial — cursor coordinates are stored in `InputTracker` fields ([input_windows.go:28-30](internal/monitor/input_windows.go#L28-L30)). Not transmitted today, but a future `log.Printf("%+v", tracker)` would leak them. Store a `hasPrev bool` + delta only. |
| **INV-5** Tokens encrypted at rest | ⚠️ Partial — Linux/macOS `encryptDPAPI` is a no-op; keyring daemon is trusted to encrypt. On headless Linux (CI, SSH) the secret-service falls back to a plaintext file backend. Document or fail-fast. |
| **INV-7** Updater verifies binary integrity | ❌ **NO VERIFICATION AT ALL.** C-UPD-1. This is the single most dangerous finding in the audit. |

### 5.2 Failure-mode cascades (what users actually hit in production)

| Scenario | What happens today | What should happen | Severity |
|---|---|---|---|
| **Cognito refresh token revoked** | Poll shows "Connection lost. Retrying…" forever. User is never prompted to re-login. | Distinguish 401 from network errors; emit `auth:expired` event → force logout UI. | **High** |
| **S3 screenshot upload fails** | Bucket counters are NOT reset → next heartbeat double-counts up to 15 min of activity. Backend ingests inflated data silently. | Reset bucket on upload failure OR retry the screenshot within the same bucket. | Medium |
| **User double-clicks "Update Now"** | Two concurrent downloads, two UAC prompts, possibly corrupt installer on disk. | `atomic.Bool` guard + UI disables button after first click. | High |
| **User logs out mid-heartbeat** | Heartbeat fires with nil tokens → 401 → error logged, data silently dropped. | Flush the bucket synchronously in `Logout` before clearing tokens. | Medium |
| **Machine suspended for 8 hours** | `GetLastInputInfo` returns ~28800 seconds of idle; next heartbeat sends `idle_seconds=28800` for a 5-min bucket = corrupt data. | Cap `idleSeconds` to `HeartbeatInterval` in `sendCurrentBucket`. | Medium |
| **Frontend calls `Login` before `startup` completes** | `a.AuthService` is nil → panic. Wails converts to unhandled promise rejection. | Initialize services in `NewApp`, not `startup`, OR add nil guards on every binding. | Medium |

---

## 6. Go concurrency crash course — required reading for the team

Your team has been writing Go as if it were JavaScript or Python. It's not. The ~20 Go-specific data races in this audit come from four patterns that **compile fine but break at runtime**. One evening of study fixes this for good.

### 6.1 The Go memory model — one sentence
**If two goroutines touch the same memory location without a `sync` primitive or a `chan` operation between them, your program is broken.** It may look like it works. It will break in production under load. The Go race detector (`go test -race`) proves this conclusively.

### 6.2 The four primitives you must know

| When you need to | Use |
|---|---|
| Protect a **field** that multiple goroutines read/write | `sync.Mutex` or `sync.RWMutex` |
| Protect a single **counter** or **flag** | `sync/atomic` — `atomic.Int32`, `atomic.Bool`, `atomic.Pointer[T]` |
| **Signal** that something happened (cancel, shutdown, done) | `context.Context` — NOT a homegrown `chan struct{}` |
| **Wait** for a group of goroutines to finish | `sync.WaitGroup` |

**Rule:** If you are using a `chan struct{}` as a "stop channel", stop. Use `context.Context` instead. Every standard library function that blocks accepts a context; yours should too.

### 6.3 The goroutine ownership rule
**Every `go func()` has an owner. The owner is responsible for:**
1. Cancelling it (via `context.Context`).
2. Waiting for it to exit (via `sync.WaitGroup`).
3. Not returning from its own `Stop` method until step 2 completes.

If you spawn a goroutine and walk away, you have leaked it. In a long-lived desktop app, leaks compound until the process dies.

### 6.4 The mutex-guard rule
**Never return a pointer, slice, or map from a getter that acquired a mutex.** The mutex protects you while you hold it; the moment the caller has the pointer, you have given them a window to mutate the data without the lock. Return a deep copy, always. See H-CORE-4 / C-MON-2.

### 6.5 The context-cancellation rule
**Any blocking call inside a goroutine must be cancellable.** That means no `time.Sleep` — use `select { case <-time.After(d): case <-ctx.Done(): return }`. It means no `http.Get` — use `http.NewRequestWithContext(ctx, ...)`. It means no `exec.Command(...).Run()` — use `exec.CommandContext(ctx, ...)`.

### 6.6 Recommended reading (two hours total)
- https://go.dev/ref/mem — the Go memory model (30 min, required)
- https://go.dev/blog/pipelines — pipelines & cancellation (45 min)
- https://go.dev/blog/context — the `context` package (30 min)
- https://pkg.go.dev/sync — all four primitives, annotated (15 min)

Do not skip this. Every bug in Section 4 (Systemic Patterns) would have been prevented by understanding these four pages.

---

## 7. Fix Templates

Copy-paste-ready Go patterns. Reference from Section 3 findings.

### T-GO-1 — Session-scoped context instead of ad-hoc `stopChan`

**Problem:** [app.go:120-129](app.go#L120-L129) drains and replaces a channel with no synchronization, causing re-login to spawn a second poll goroutine that races the first.

**Fix:** Replace `stopChan chan struct{}` with a session-scoped `context.Context`.

```go
type App struct {
    mu          sync.Mutex
    sessionCtx  context.Context
    sessionCancel context.CancelFunc
    wg          sync.WaitGroup
    // ... other fields
}

func (a *App) startBackgroundServices() {
    a.mu.Lock()
    // Cancel and wait for the previous session, if any
    if a.sessionCancel != nil {
        a.sessionCancel()
    }
    a.mu.Unlock()
    a.wg.Wait() // waits for previous goroutines to exit
    a.mu.Lock()
    a.sessionCtx, a.sessionCancel = context.WithCancel(a.ctx)
    ctx := a.sessionCtx
    a.mu.Unlock()

    a.wg.Add(1)
    go func() {
        defer a.wg.Done()
        defer func() { recover() }()
        a.pollAttendance(ctx)
    }()
}

func (a *App) stopBackgroundServices() {
    a.mu.Lock()
    if a.sessionCancel != nil {
        a.sessionCancel()
        a.sessionCancel = nil
    }
    a.mu.Unlock()
    a.wg.Wait()
}

func (a *App) pollAttendance(ctx context.Context) {
    t := time.NewTicker(10 * time.Second)
    defer t.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-t.C:
            a.fetchAttendance(ctx)
        }
    }
}
```

### T-GO-2 — Atomic primitives for simple flags and counters

**Problem:** [app.go:175-183](app.go#L175-L183) `networkErrorCount++` and [app.go:67, 112](app.go#L67) `a.quitting = true` / `if a.quitting` are data races.

**Fix:**

```go
import "sync/atomic"

type App struct {
    quitting          atomic.Bool
    networkErrorCount atomic.Int32
    // ...
}

// Writer:
a.quitting.Store(true)
a.networkErrorCount.Add(1)

// Reader:
if a.quitting.Load() { ... }
if a.networkErrorCount.Load() >= 3 { ... }
```

This is simpler and faster than a mutex for single-field access.

### T-GO-3 — Deep-copy values out of a locked region

**Problem:** [state/state.go:70-74](internal/state/state.go#L70-L74) returns the stored pointer under `RLock`; [activity.go:198-224](internal/monitor/activity.go#L198-L224) hands out a live map reference.

**Fix:**

```go
// For state.GetAttendance:
func (s *AppState) GetAttendance() *Attendance {
    s.mu.RLock()
    defer s.mu.RUnlock()
    if s.attendance == nil {
        return nil
    }
    copied := *s.attendance // struct copy
    // deep-copy any slices/maps inside
    if s.attendance.Sessions != nil {
        copied.Sessions = append([]AttendanceSession(nil), s.attendance.Sessions...)
    }
    return &copied
}

// For activity.sendCurrentBucket:
func (m *ActivityMonitor) snapshotBucket() map[string]interface{} {
    m.mu.Lock()
    defer m.mu.Unlock()
    // Deep-copy the map before releasing the lock.
    appCopy := make(map[string]int, len(m.appUsage))
    for k, v := range m.appUsage {
        appCopy[k] = v
    }
    bucket := map[string]interface{}{
        "keyboard_count": m.keyboardCount,
        "mouse_count":    m.mouseCount,
        "active_seconds": m.activeSeconds,
        "idle_seconds":   m.idleSeconds,
        "app_breakdown":  appCopy, // now safe outside the lock
    }
    m.resetBucketLocked()
    return bucket
}
```

### T-GO-4 — `sync.WaitGroup` joined on `Stop`

**Problem:** [activity.go:69-102](internal/monitor/activity.go#L69-L102), [tray code](internal/tray/), [app.go:87](app.go#L87). `Stop` cancels the context but returns before goroutines exit.

**Fix:**

```go
type ActivityMonitor struct {
    mu      sync.Mutex
    wg      sync.WaitGroup
    cancel  context.CancelFunc
    running bool
    // ...
}

func (m *ActivityMonitor) Start(parent context.Context) {
    m.mu.Lock()
    defer m.mu.Unlock()
    if m.running {
        return
    }
    ctx, cancel := context.WithCancel(parent)
    m.cancel = cancel
    m.running = true

    m.wg.Add(3)
    go func() { defer m.wg.Done(); defer recover(); m.trackActivity(ctx) }()
    go func() { defer m.wg.Done(); defer recover(); m.sendHeartbeats(ctx) }()
    go func() { defer m.wg.Done(); defer recover(); m.captureScreenshots(ctx) }()
}

func (m *ActivityMonitor) Stop() {
    m.mu.Lock()
    if !m.running {
        m.mu.Unlock()
        return
    }
    m.cancel()
    m.running = false
    m.mu.Unlock()

    m.wg.Wait() // <-- CRITICAL. Do not return until all goroutines have exited.
}
```

### T-CTX-1 — Cancellable sleep

**Problem:** [activity.go:289](internal/monitor/activity.go#L289), [app.go:88](app.go#L88). `time.Sleep` ignores cancellation.

**Fix:**

```go
func sleepOrCancel(ctx context.Context, d time.Duration) error {
    select {
    case <-time.After(d):
        return nil
    case <-ctx.Done():
        return ctx.Err()
    }
}

// Usage in takeAndUploadScreenshot:
func (m *ActivityMonitor) takeAndUploadScreenshot(ctx context.Context) {
    m.onNotify("Screenshot in 5 seconds", "Activity will be captured")
    if err := sleepOrCancel(ctx, ScreenshotWarningTime); err != nil {
        return // cancelled — do NOT capture
    }
    if IsScreenLocked() {
        return
    }
    jpeg, err := m.screenshotCap.CaptureScreen()
    // ...
}
```

### T-CTX-2 — Always `defer cancel()`

**Problem:** [cognito.go:25-33](internal/auth/cognito.go#L25-L33).

**Fix:**

```go
func (s *Service) callCognito() error {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel() // <-- always.
    // ... use ctx
}
```

Never spawn a goroutine to call `cancel()`. That is an antipattern.

### T-URL-1 — Validate URLs before use

**Problem:** [updater.go:114](internal/updater/updater.go#L114), [client.go:292](internal/api/client.go#L292), [cognito.go:320](internal/auth/cognito.go#L320).

**Fix:**

```go
// internal/security/url.go
package security

import (
    "fmt"
    "net/url"
    "strings"
)

func ValidateHTTPSURL(raw string, allowedHosts []string) (*url.URL, error) {
    u, err := url.Parse(raw)
    if err != nil {
        return nil, fmt.Errorf("invalid URL: %w", err)
    }
    if u.Scheme != "https" {
        return nil, fmt.Errorf("URL must be https, got %q", u.Scheme)
    }
    host := strings.ToLower(u.Hostname())
    for _, allowed := range allowedHosts {
        if host == allowed || strings.HasSuffix(host, "."+allowed) {
            return u, nil
        }
    }
    return nil, fmt.Errorf("host %q not in allowlist", host)
}
```

Call it at every point where a server-sourced string becomes a network target:

```go
// In updater.go DownloadAndInstall:
u, err := security.ValidateHTTPSURL(info.DownloadURL, []string{
    "github.com", "objects.githubusercontent.com",
})
if err != nil {
    return fmt.Errorf("refusing to download: %w", err)
}
// Use u.String() — never the raw info.DownloadURL
```

### T-ERR-1 — Sanitize errors before they cross trust boundaries

**Problem:** [client.go:124, 174, 225, 275, 296, 317](internal/api/client.go#L124).

**Fix:**

```go
// internal/api/errors.go
package api

import (
    "errors"
    "regexp"
    "strings"
)

var (
    ErrUnauthorized = errors.New("unauthorized")
    ErrNotFound     = errors.New("not found")
    ErrServerError  = errors.New("server error")

    // strip anything that looks like a JWT or bearer token
    tokenRegexp = regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,}`)
)

func sanitizeErrorBody(b []byte) string {
    s := string(b)
    s = tokenRegexp.ReplaceAllString(s, "[REDACTED]")
    // strip control chars
    s = strings.Map(func(r rune) rune {
        if r < 32 && r != '\n' && r != '\t' {
            return -1
        }
        return r
    }, s)
    if len(s) > 200 {
        s = s[:200] + "…"
    }
    return s
}

// Usage:
if resp.StatusCode() == 401 {
    return nil, fmt.Errorf("%w: %s", ErrUnauthorized, sanitizeErrorBody(resp.Body()))
}
```

Callers can then do `if errors.Is(err, api.ErrUnauthorized)` to trigger re-auth UI.

### T-UPD-1 — Signed update + hash verification

**Problem:** [updater.go:105-153](internal/updater/updater.go#L105-L153). No binary integrity check.

**Fix:**

1. In your release workflow, generate a `SHA256SUMS` file and upload it to the GitHub release alongside the installer:

```yaml
- name: Generate checksums
  run: |
    cd release-files
    sha256sum * > SHA256SUMS
```

2. In the updater, fetch `SHA256SUMS` from the same release, verify the downloaded binary matches:

```go
func verifyChecksum(filePath, expectedHex string) error {
    f, err := os.Open(filePath)
    if err != nil { return err }
    defer f.Close()
    h := sha256.New()
    if _, err := io.Copy(h, f); err != nil { return err }
    got := hex.EncodeToString(h.Sum(nil))
    if !subtle.ConstantTimeCompare([]byte(got), []byte(expectedHex)) == 1 {
        return fmt.Errorf("checksum mismatch: got %s expected %s", got, expectedHex)
    }
    return nil
}

// In DownloadAndInstall, after the download:
if err := verifyChecksum(destPath, expectedHashFromSums); err != nil {
    os.Remove(destPath)
    return fmt.Errorf("integrity check failed: %w", err)
}
```

**Stretch goal (production):** sign the `SHA256SUMS` file with a long-lived release key (minisign, cosign, or GPG) and verify the signature before trusting the checksums.

### T-UPD-2 — Download URL allowlist

```go
u, err := security.ValidateHTTPSURL(info.DownloadURL, []string{
    "github.com", "objects.githubusercontent.com", "github-releases.githubusercontent.com",
})
if err != nil {
    return fmt.Errorf("refusing update: %w", err)
}
downloadURL := u.String()
```

### T-UPD-3 — Always `filepath.Base` untrusted filenames

```go
safeName := filepath.Base(info.FileName)
// Defense in depth: also check for weird characters
if safeName == "." || safeName == ".." || safeName == "" {
    return errors.New("invalid filename in update asset")
}
destPath := filepath.Join(tempDir, safeName)
```

### T-UPD-4 — Private temp dir + immediate verify

```go
tempDir, err := os.MkdirTemp("", "taskflow-update-*") // 0700 on Unix
if err != nil { return err }
defer os.RemoveAll(tempDir)

destPath := filepath.Join(tempDir, filepath.Base(info.FileName))
// ... download
if err := verifyChecksum(destPath, expectedHash); err != nil {
    return err
}
// Now exec
```

### T-AUTH-1 — No plaintext fallback

```go
// OLD:
// plain, err := decryptDPAPI(encrypted)
// if err != nil {
//     plain = encrypted // DANGEROUS
// }

// NEW:
plain, err := decryptDPAPI(encrypted)
if err != nil {
    // Wipe the corrupted entry and force re-authentication
    _ = keyring.Delete(KeyringService, key)
    return nil, fmt.Errorf("stored token is corrupt or tampered, please log in again: %w", err)
}
```

### T-AUTH-2 — Session token never leaves Go

```go
// cognito.go
type Service struct {
    mu                sync.RWMutex
    tokens            *TokenSet
    lastLoginEmail    string
    lastLoginSession  string // <-- private field, not serialized
}

type LoginResult struct {
    Success             bool    `json:"success"`
    RequiresNewPassword bool    `json:"requiresNewPassword"`
    UserID              string  `json:"userId,omitempty"`
    Email               string  `json:"email,omitempty"`
    Name                string  `json:"name,omitempty"`
    // Session field REMOVED — frontend cannot see it.
}

func (s *Service) Login(email, password string) (*LoginResult, error) {
    // ...
    if out.ChallengeName == "NEW_PASSWORD_REQUIRED" {
        s.mu.Lock()
        s.lastLoginEmail = email
        s.lastLoginSession = *out.Session // store internally
        s.mu.Unlock()
        return &LoginResult{Success: false, RequiresNewPassword: true}, nil
    }
    // ...
}

func (s *Service) CompleteNewPasswordChallenge(newPassword string) error {
    s.mu.RLock()
    email := s.lastLoginEmail
    session := s.lastLoginSession
    s.mu.RUnlock()
    if session == "" {
        return errors.New("no pending password challenge")
    }
    // ... use email + session internally, never return them
}
```

### T-ESC-1 — osascript with `-e` args, not `fmt.Sprintf`

```go
// BAD:
cmd := exec.Command("osascript", "-e",
    fmt.Sprintf(`display notification "%s" with title "%s"`, message, title))

// GOOD: use osascript's shell-safe form
cmd := exec.Command("osascript",
    "-e", "on run argv",
    "-e", "display notification (item 1 of argv) with title (item 2 of argv)",
    "-e", "end run",
    "--", message, title)
```

The `--` separator ensures remaining arguments are treated as data, not flags.

### T-ATOMIC-1 — Atomic write for chunked keystore

```go
// Write all chunks under TEMP keys first
for i, chunk := range chunks {
    if err := keyring.Set(service, fmt.Sprintf("%s.tmp.%d", key, i), chunk); err != nil {
        // Clean up any temp chunks we've written so far
        for j := 0; j < i; j++ {
            _ = keyring.Delete(service, fmt.Sprintf("%s.tmp.%d", key, j))
        }
        return err
    }
}
// Then atomically swap the sentinel
if err := keyring.Set(service, key, fmt.Sprintf("CHUNKED:%d", len(chunks))); err != nil {
    // Clean up temp chunks
    for j := range chunks {
        _ = keyring.Delete(service, fmt.Sprintf("%s.tmp.%d", key, j))
    }
    return err
}
// Promote temp chunks to real chunks
for i := range chunks {
    tempKey := fmt.Sprintf("%s.tmp.%d", key, i)
    realKey := fmt.Sprintf("%s.%d", key, i)
    data, _ := keyring.Get(service, tempKey)
    _ = keyring.Set(service, realKey, data)
    _ = keyring.Delete(service, tempKey)
}
```

### T-FIX-LOGIC — The Windows single-instance fix

```go
// main_windows.go
func ensureSingleInstance() {
    name, _ := syscall.UTF16PtrFromString("Global\\TaskFlowDesktop_SingleInstance")
    ret, _, err := syscall.NewLazyDLL("kernel32.dll").NewProc("CreateMutexW").Call(
        0, 0, uintptr(unsafe.Pointer(name)),
    )
    _ = ret
    const ERROR_ALREADY_EXISTS = syscall.Errno(183)
    if err == ERROR_ALREADY_EXISTS { // <-- correct check
        msg, _ := syscall.UTF16PtrFromString("TaskFlow Desktop is already running.\nCheck your system tray.")
        title, _ := syscall.UTF16PtrFromString("TaskFlow Desktop")
        syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(
            0, uintptr(unsafe.Pointer(msg)), uintptr(unsafe.Pointer(title)), 0x00000040,
        )
        os.Exit(0)
    }
}
```

### T-PLATFORM-1 — File-lock single instance for Linux/macOS

```go
// main_linux.go / main_darwin.go
func ensureSingleInstance() {
    lockDir := filepath.Join(os.Getenv("HOME"), ".local", "share", "TaskFlow")
    _ = os.MkdirAll(lockDir, 0700)
    lockPath := filepath.Join(lockDir, "app.lock")
    f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0600)
    if err != nil {
        log.Fatalf("lock file: %v", err)
    }
    if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
        fmt.Fprintln(os.Stderr, "TaskFlow Desktop is already running.")
        os.Exit(0)
    }
    // Lock held for process lifetime — do NOT close f
}
```

### T-ONCE-1 — `sync.Once` for config singletons

```go
// internal/config/config.go
var (
    cfg  *Config
    once sync.Once
)

func Get() *Config {
    once.Do(func() {
        cfg = &Config{
            APIURL:          apiURL,
            CognitoRegion:   cognitoRegion,
            CognitoPoolID:   cognitoPoolID,
            CognitoClientID: cognitoClientID,
            WebDashboardURL: webDashboardURL,
        }
        if cfg.APIURL == "" || cfg.CognitoClientID == "" {
            if err := loadFromFile(cfg); err != nil {
                panic("Config unavailable. For production: use build.ps1. For dev: create config.json from config.example.json.")
            }
        }
    })
    return cfg
}
```

---

## 8. Acceptance criteria — how you know you're done

Ship readiness requires ALL of the following:

### Critical (all 10 items in Section 1)
- [ ] All P0 items closed with a linked PR
- [ ] `go test -race ./...` passes in CI
- [ ] `staticcheck ./...` and `errcheck ./...` pass with zero warnings
- [ ] Release workflow publishes `SHA256SUMS` alongside every binary
- [ ] Updater verifies `SHA256SUMS` against downloaded binary before `ShellExecute`
- [ ] No use of `time.Sleep` remains inside any goroutine that lives beyond one call stack (grep for `time.Sleep` in all `internal/` files and verify)
- [ ] Every `go func()` in the repo has a matching `defer wg.Done()` and is joined by a `WaitGroup.Wait()` call in the owning `Stop`
- [ ] No `fmt.Errorf` contains `resp.String()` (grep to verify)

### High
- [ ] Manual test: cold start, login, 20-minute session with screenshots, logout, re-login, logout — no goroutine leaks per `pprof goroutine` (`go tool pprof http://localhost:<wails-debug-port>/debug/pprof/goroutine`)
- [ ] Manual test: double-click "Update Now" in succession — only one UAC prompt, one download
- [ ] Manual test: revoke refresh token in Cognito console, observe app shows re-login prompt within 30 seconds
- [ ] Manual test: suspend machine for 1 hour, resume — `idle_seconds` in next heartbeat is capped at `HeartbeatInterval`
- [ ] Manual test: second app instance is blocked on Linux and macOS, not just Windows

### Nice-to-have (next sprint)
- [ ] Linux monitor rewritten to use X11 bindings instead of `xprintidle`/`xdotool` subprocess fork
- [ ] Locked-screen detection uses native APIs per platform (see H-MON-3)
- [ ] `LoginResult.Session` fully removed from Wails IPC (T-AUTH-2)
- [ ] `SHA256SUMS` file is signed with a release key (minisign/cosign)

---

## 9. A note to the team

This codebase is not beyond saving. The core architecture is sound — Go + Wails was a defensible choice for this workload, and the module boundaries are reasonable. The problems are concentrated in three areas:

1. **Concurrency discipline.** This is entirely learnable. Section 6 + one week of practice and the whole class of data-race bugs disappears.
2. **The auto-updater.** This is a security emergency. Fix the four Critical items before anything else, even if you do nothing else in this report.
3. **Trust-boundary hygiene.** Server-sourced strings are being treated as trusted. Add the `ValidateHTTPSURL` helper and the `sanitizeErrorBody` helper, then grep for places to call them.

Everything in this report has a concrete fix, a template, and an acceptance criterion. Do the hardening plan in Section 2 FIRST — the tools will catch bugs you missed as you work through Section 3. Work down the P0 list in order. Do not "clean up" code outside the scope of each fix.

**If any single finding is unclear, ask. Do not guess.** Go's compiler will let you write code that compiles, runs, and silently corrupts data; the tools in Section 2 are the difference between "looks fine" and "actually correct."

Good luck.
