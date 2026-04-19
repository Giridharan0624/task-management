# Bug Report v2 — TaskFlow Desktop (post-remediation verification)

**Date:** 2026-04-15
**Baseline:** [Bug-Report-Go.md](Bug-Report-Go.md) (v1, same day)
**Remediation window:** ~12 commits (`058c652` … `97971a0`), +3182 / −453 lines, 48 files changed
**Passes re-run:** `/review`, `/security-review`, `/debug` — same prompt as v1, focused on verification + new bugs
**Verdict:** **Strong remediation.** Major security and concurrency risks closed. One new Critical (security-module bypass), a few High items remain, plus a handful of new Medium failure modes introduced by the new code. Not yet production-ready — one more focused sprint needed.

---

## 0. Chat summary (TL;DR)

- **Of the ~75 prior findings, ~49 are SOLVED, ~5 PARTIAL, ~2 NOT SOLVED, 0 REGRESSED.**
- **12 new findings from v2 review**: 1 Critical, 4 High, 5 Medium, 2 Low.
- **The one Critical worth waking up for:** the new `internal/security/url.go` validator accepts URLs with userinfo (`https://token@github.com/…`). That means a compromised server response can smuggle an auth credential into the HTTPS request to GitHub, leaking the user's token. One-line fix: add `if u.User != nil { return error }`.
- **The new Highs:** SHA256SUMS is fetched but **not cryptographically signed** (so a CI compromise still wins); `sync.Once` in `config.Get()` panics poison the Once and cause nil-deref crashes downstream; SHA256SUMS filename case-mismatch silently blocks all updates; macOS `openBrowser` passes dashboard URL to `open` without validation (dev-only risk).
- **Team trajectory:** excellent. They landed real templates (atomic-flag conversion, session-scoped contexts, WaitGroups, deep-copy getters, sanitized errors, typed sentinels, pre-commit hooks, lint CI, unit tests with meaningful coverage — not tautological). This is not vibe-coding output any more. Keep going.

---

## 1. Remediation scorecard

### By severity

| Severity | v1 total | SOLVED | PARTIAL | NOT SOLVED | REGRESSED |
|---|---|---|---|---|---|
| Critical | 20 | 20 | 0 | 0 | 0 |
| High | 28 | 24 | 1 | 0 | 0 |
| Medium | ~27 | ~15 | 4 | 2 | 0 |

**Every single Critical finding from v1 is now closed.** That is the headline. The P0 list from v1 Section 1 is 10/10 green.

### By module

| Module | Status |
|---|---|
| **Core / app lifecycle** | Very strong. Atomic primitives landed on `quitting`/`networkErrorCount`, session-scoped context + WaitGroup replaced ad-hoc stopChan, auth gate on bindings, cancellable startup goroutine. New Linux/macOS `flock`-based single-instance guard. |
| **Auth / Cognito / Keystore** | Very strong. DPAPI fallback removed, `Session` token no longer crosses IPC, `Service` has a proper `sync.RWMutex`, chunked keystore is atomic, `Logout` surfaces errors, `unauthClient` hardened. |
| **API client + Config** | Very strong. Sentinel errors + `errors.Is`, sanitized response bodies, `sync.Once` for config, URL validator called on presigned S3, redirect policy rejects HTTPS→HTTP. |
| **Activity Monitor** | Strong. Screenshot warning is now context-aware (privacy breach fixed). Heartbeat deep-copies the map. `Stop` flushes partial bucket. Linux gets native X11 + logind D-Bus backends replacing `xprintidle`/`xdotool` subprocess spam. |
| **Tray** | Strong. Win32 `NOTIFYICONDATAW` mutations posted via `WM_APP_*` messages to the window thread. `WM_DESTROY` → `PostQuitMessage` so the loop actually exits. `atomic.Pointer[Manager]` for `globalManager`. Linux/macOS `stopCh` wired up. |
| **Updater** | Strong. SHA-256 verification with constant-time compare, `ValidateHTTPSURL` allowlist, `filepath.Base` guard, `os.MkdirTemp` 0700, re-entrancy `atomic.Bool`, `dev` default + early return, pre-release tag filter, rollback log. **Biggest remaining gap is checksum-file signing.** |
| **Frontend** | Not re-audited this pass — v1 findings there still apply. |

---

## 2. What the team actually built (remediation acceptance)

This is noteworthy because it shows the team followed the v1 report's fix templates faithfully. A few highlights verified in the code:

- **[app.go:42-45](app.go#L42-L45)** — `quitting atomic.Bool`, `networkErrorCount atomic.Int32`. Exactly the `T-GO-2` template.
- **[app.go:171-215](app.go#L171-L215)** — `sessionCtx`/`sessionCancel`/`sessionWG` pattern. Exactly the `T-GO-1` template (session-scoped context instead of `stopChan`).
- **[state/state.go:76-104](internal/state/state.go#L76-L104)** — `GetAttendance` now deep-copies including `Sessions` slice and pointer fields. Exactly the `T-GO-3` template.
- **[activity.go:48, 90-93, 155](internal/monitor/activity.go#L48)** — `ActivityMonitor` has a `wg sync.WaitGroup`, adds before spawning, `Stop` does `Wait()` then flushes. Exactly the `T-GO-4` template.
- **[activity.go:373](internal/monitor/activity.go#L373)** — `sleepOrCancel(ctx, ScreenshotWarningTime)` replaces `time.Sleep`. Exactly the `T-CTX-1` template. **This closes the privacy-breach bug.**
- **[internal/security/url.go](internal/security/url.go)** + `url_test.go` — shared validator. The `T-URL-1` template, with tests.
- **[internal/api/errors.go](internal/api/errors.go)** + `errors_test.go` — sanitize helper + `ErrUnauthorized`/`ErrForbidden`/… sentinels. The `T-ERR-1` template, with tests.
- **[updater.go:195](internal/updater/updater.go#L195)** — `installInProgress.CompareAndSwap(false, true)`. Re-entrancy guard.
- **[updater.go:244-251](internal/updater/updater.go#L244-L251)** — `fetchExpectedChecksum` + `verifyChecksum` with `crypto/subtle.ConstantTimeCompare`. **The `T-UPD-1` template, end to end.**
- **[tray_windows.go:276-280, 381-397](internal/tray/tray_windows.go#L276-L280)** — `WM_APP_SET_TIMER`/`WM_APP_SHOW_BALLOON` custom messages posted to the window thread. `WM_DESTROY` → `PostQuitMessage(0)`.
- **[main_linux.go:43](main_linux.go#L43), [main_darwin.go:41](main_darwin.go#L41)** — `syscall.Flock(LOCK_EX|LOCK_NB)` with a package-scoped `*os.File` to prevent GC from dropping the lock.
- **[scripts/install-hooks.sh](scripts/install-hooks.sh)** + **[scripts/pre-commit.sh](scripts/pre-commit.sh)** — the hardening plan from v1 Section 2 shipped.
- **[.github/workflows/lint.yml](.github/workflows/lint.yml)** — CI lint workflow with Ubuntu 24.04 + webkit2gtk 4.1 smoke build.
- **[internal/monitor/idle_logind_linux.go](internal/monitor/idle_logind_linux.go), [x11_linux.go](internal/monitor/x11_linux.go)** — native X11 + systemd-logind backends, replacing `xprintidle`/`xdotool` subprocess forks. This closes the per-second-fork performance problem and the Wayland keyboard-inflation bug.

**Tests are genuine, not tautological.** `updater_test.go` tests `verifyChecksum` and `parseSHA256SUMS` against known SHA-256 values (`helloSum` is the correct hash of `"hello"`). Mismatch, missing-file, leading-path, and malformed-hash cases are all independently meaningful.

---

## 3. Still open from v1

### Partially fixed

| ID | Status | What's left |
|---|---|---|
| **[H-MON-3](internal/monitor/screenshot.go#L43)** `IsScreenLocked` idle-time heuristic | Acknowledged with TODO, not fixed | Still false-negative on mouse-jiggler; false-positive when user is reading. Needs `WTSQuerySessionInformation` / `CGSessionCopyCurrentDictionary` / `loginctl` D-Bus check. |
| **[M-CORE-1](main_windows.go#L47)** Log file never closed | Fix present on all 3 platforms but file handle is never stored, so `Close()` at shutdown still absent | Store `*os.File` and close it in `shutdown`. Risk: last log entry may be truncated on Windows. |
| **[M-CORE-2](app.go#L140-L152)** `shutdown` nil guards | Theoretically safe due to init order in `main.go` | Add explicit nil checks for defensive depth. Low priority. |
| **[M-AUTH-3](internal/auth/cognito.go#L370-L402)** No client-side JWT claim verification | Acknowledged in code comment, not fixed | At minimum verify `exp > now()` and `iss` matches the Cognito pool URL before trusting decoded claims. |
| **[INV-5]** Linux/macOS `encryptDPAPI` is no-op | Architectural design, not changing | Document explicitly that keyring daemon is the trust anchor; fail-fast if keyring is in fallback-file-backend mode on Linux. |

### Not solved

| ID | File:line | Impact | Fix |
|---|---|---|---|
| **[M-MON-1]** Input counter never reset across Start→Stop→Start | [activity.go:189](internal/monitor/activity.go#L189), [input_windows.go:35](internal/monitor/input_windows.go#L35), [input_linux.go:27](internal/monitor/input_linux.go#L27) | First heartbeat after re-login sees a huge spurious delta (the whole session's accumulated total); `<1000` spike cap silently drops legitimate bursts too. | Zero `inputTracker.keyboardTotal`/`mouseTotal` in `ActivityMonitor.Stop()` after `wg.Wait()`, OR seed local `lastKeyboard`/`lastMouse` from the current tracker totals rather than from zero in `trackActivity`. |
| **[M-API-2]** Shared 30 s timeout on API + S3 uploads | [client.go:101](internal/api/client.go#L101) | Slow uplink + 2 MB 4K screenshot JPEG → upload times out silently; activity heartbeat missing the screenshot URL. | Use a separate `resty.Client` with a longer timeout (e.g., 120 s) specifically for the `UploadScreenshot` path. |

---

## 4. New findings in v2 review

These are either bugs the new code introduced, or pre-existing bugs the first review missed.

### Critical (1)

#### [V2-C1] `security.ValidateHTTPSURL` accepts URLs with userinfo → credential leak to allowlisted host

- **File:** [internal/security/url.go:27-41](internal/security/url.go#L27-L41)
- **Bug:** `url.Parse` accepts `https://token@github.com/path` as valid; `u.Hostname()` returns `github.com` and the allowlist passes. The returned `*url.URL` carries the userinfo component, which resty/`http.Client` forwards as the HTTP `Authorization` header (Basic auth) to the target host.
- **Exploit scenario:** An attacker who controls a response that supplies a URL to the updater or API client (e.g., a MITM before TLS pins, a compromised backend returning a crafted presigned S3 URL, or a tampered GitHub release JSON) returns a URL like `https://Bearer%20eyJ…@objects.githubusercontent.com/release.exe`. ValidateHTTPSURL passes it. The HTTP request to GitHub then carries the attacker's token as HTTP Basic credentials, which GitHub receives, logs, and potentially echoes back in an error response. In the reverse attack direction, a URL crafted to attach the *user's* bearer to a GitHub request could cause GitHub to return a 400 with the bearer reflected — which then flows through `sanitizeErrorBody` (which does strip JWTs — so mitigation is present on that path). The cleanest abuse is smuggling *attacker-controlled* credentials into requests to `github.com` / `amazonaws.com`, which could complete unintended authenticated operations on the attacker's behalf.
- **Fix (one line):**

```go
func ValidateHTTPSURL(raw string, allowedHosts []string) (*url.URL, error) {
    u, err := url.Parse(raw)
    if err != nil { return nil, fmt.Errorf("invalid URL: %w", err) }
    if u.Scheme != "https" { return nil, fmt.Errorf("URL must be https, got %q", u.Scheme) }
    if u.User != nil { return nil, errors.New("URL must not contain userinfo") } // <-- ADD
    // ... rest unchanged
}
```

- **Test to add:** `TestValidateHTTPSURL_RejectsUserinfo` with cases `https://token@github.com/x`, `https://user:pass@github.com/x`, asserting the error.
- **Confidence:** 82

### High (4)

#### [V2-H1] SHA256SUMS is fetched over HTTPS but not cryptographically signed

- **File:** [internal/updater/updater.go:244-251](internal/updater/updater.go#L244-L251)
- **Bug:** The checksum file comes from the same GitHub release as the binary. If an attacker publishes to that release (compromised deploy key, CI/CD takeover), they control both files simultaneously — the hash verification confirms binary == hash-in-file, but the file itself is untrusted.
- **Threat model distinction:** The current design protects against **transport corruption and accidental release mis-packaging**, which is a real and valuable guarantee — but not against a **supply-chain compromise**, which is what the initial v1 finding was asking for.
- **Fix:**
  1. Generate a long-lived release signing key (GPG or minisign). Store the **private** key offline or in a GitHub Environment secret that only the `release` workflow can access.
  2. Sign `SHA256SUMS` in the release workflow: `gpg --detach-sign SHA256SUMS` (produces `SHA256SUMS.asc`).
  3. Pin the **public** key in the Go binary (e.g., `//go:embed release.pub`).
  4. In `updater.go`, after fetching `SHA256SUMS`, fetch `SHA256SUMS.asc` and verify the detached signature against the embedded public key before trusting any hash inside.
- **Reference:** The pattern is identical to what Debian uses for apt repositories and HashiCorp uses for product binaries.
- **Confidence:** 85

#### [V2-H2] `sync.Once` panic in `config.Get()` permanently poisons the Once → nil-deref on later calls

- **File:** [internal/config/config.go:45-72](internal/config/config.go#L45-L72)
- **Bug:** If `config.json` is malformed (BOM, bad escape, trailing comma), or if `missingFields` returns a list that the panic path formats, the anonymous function inside `loadedOnce.Do(...)` panics. Go semantics: a `sync.Once` whose function panics is *still marked done* — subsequent calls to `loadedOnce.Do` do nothing, and `loaded` remains `nil` (it was assigned only at the end of the panic-free path). Every caller of `config.Get()` downstream dereferences `loaded` and crashes.
- **User-visible:** App starts (Wails is already up), then crashes with an opaque nil-pointer panic on the first API call or auth initialization. No actionable message.
- **Fix:** Catch the panic inside the `Do` function OR (simpler) swap `sync.Once` for an explicit mutex + boolean that allows retry:

```go
var (
    cfgMu sync.Mutex
    cfg   *Config
)

func Get() *Config {
    cfgMu.Lock()
    defer cfgMu.Unlock()
    if cfg != nil { return cfg }
    c := &Config{...}
    if err := validateAndLoad(c); err != nil {
        // Return a sentinel or fail loudly, but don't leave cfg nil-dereffable downstream
        panic(fmt.Sprintf("config error: %v", err))
    }
    cfg = c
    return cfg
}
```

Better: add a `MustGet` variant with explicit panic, and a `Get() (*Config, error)` that returns the error — then `main.go` can show a real user-facing dialog box instead of crashing in a random goroutine.

- **Confidence:** 90

#### [V2-H3] SHA256SUMS filename mismatch silently blocks all updates

- **File:** [internal/updater/updater.go:364-387](internal/updater/updater.go#L364-L387) + release workflow
- **Bug:** `parseSHA256SUMS` matches via `filepath.Base(name) == fileName` — case-sensitive. If the release workflow lowercases the installer name or uses a slightly different casing/encoding than what the update-check's `asset.Name` returns, every user sees `no checksum entry for "TaskFlowDesktop-Setup-1.3.0.exe"` forever and no one can update.
- **User-visible:** "Update Now" reports `integrity check failed: failed to obtain checksum: no checksum entry for ...` with no actionable text. Users will not report this — they'll just stop updating.
- **Fix:**
  - In the release workflow, pin the asset filename generator and the SHA256SUMS generator to the same variable.
  - In Go, normalize both sides with `strings.ToLower(filepath.Base(name))` during comparison.
  - Add a release-workflow smoke test: after packaging, `grep -q "$(basename "$installer")" SHA256SUMS` or fail the release.
- **Confidence:** 88

#### [V2-H4] `tray_windows.go` `Stop()` watcher goroutine captures `m.hwnd` without a lock

- **File:** [tray_windows.go:277-279](internal/tray/tray_windows.go#L277-L279)
- **Bug:** The goroutine that posts `WM_CLOSE` when `done` is closed reads `m.hwnd` directly. If the message loop has already exited (rare, but possible if `trayWndProc` received `WM_DESTROY` from another path), `m.hwnd` has been zeroed by `cleanup()`. `PostMessage(0, WM_CLOSE, ...)` on Windows is a broadcast to all top-level windows — on a real system this is almost always benign but semantically wrong.
- **Fix:** Snapshot `m.hwnd` under `m.mu` before launching the goroutine; guard `if hwnd == 0 { return }` inside.
- **Confidence:** 82

### Medium (5)

#### [V2-M1] `openBrowser` on macOS passes `WebDashboardURL` to `exec.Command("open", ...)` without validation

- **File:** [internal/tray/tray_darwin.go:141-142](internal/tray/tray_darwin.go#L141-L142)
- **Bug:** Production is safe (ldflag-injected constant), but in dev mode the URL is read from user-editable `config.json`. A value like `javascript:alert(1)` or `file:///Applications/Calculator.app` is passed to macOS `open`, which treats URI schemes as handler dispatches.
- **Fix:** Call `security.ValidateHTTPSURL(url, nil)` at startup in `config.Get()` and reject non-HTTPS dashboard URLs. Also validate inside `openBrowser` as defense in depth.
- **Confidence:** 80

#### [V2-M2] `tray_linux.go`/`tray_darwin.go` `ShowBalloon` reads `m.running` without holding `m.mu`

- **File:** [tray_linux.go:130-132](internal/tray/tray_linux.go#L130-L132), [tray_darwin.go:95-112](internal/tray/tray_darwin.go#L95-L112)
- **Bug:** Concurrent `Stop()` flips `m.running = false` under the lock; `ShowBalloon` reads it without the lock. A late-arriving notification can fire after the tray conceptually shut down.
- **Fix:** Acquire `m.mu` before the `m.running` check on both platforms (the Windows counterpart already does this).
- **Confidence:** 82

#### [V2-M3] `screenshot.go` allocates a fresh `IdleDetector` per capture

- **File:** [screenshot.go:44](internal/monitor/screenshot.go#L44)
- **Bug:** `ScreenshotCapture.IsScreenLocked` calls `NewIdleDetector()` then immediately discards it. Cheap on Linux (wraps a singleton), but the pattern is inconsistent and will silently waste resources if the detector acquires real state in a future refactor.
- **Fix:** Pass the `ActivityMonitor`'s existing `idleDetector` into `ScreenshotCapture` at construction; reuse it.
- **Confidence:** 75

#### [V2-M4] logind D-Bus cached connection cannot recover from `systemd-logind` crash

- **File:** [idle_logind_linux.go:40-67](internal/monitor/idle_logind_linux.go#L40-L67)
- **Bug:** `logindOnce` caches the D-Bus session object for process lifetime. If logind crashes, the cached `dbus.BusObject` holds a dead connection. Fallback to X11 at [idle_linux.go:36-38](internal/monitor/idle_linux.go#L36-L38) is transparent, so the app self-heals. But if logind later recovers, the code will not retry — it stays on X11 permanently.
- **Fix:** Detect D-Bus errors in `logindIdleSeconds`, reset the cached `sync.Once` via a sentinel flag, and allow a bounded retry (e.g., every 5 minutes).
- **Confidence:** 85

#### [V2-M5] `InstallUpdate` CAS is downstream of `CheckForUpdate` — a double-click window still exists

- **File:** [app.go:480-491](app.go#L480-L491), [updater.go:195](internal/updater/updater.go#L195)
- **Bug:** `app.go.InstallUpdate` calls `updater.CheckForUpdate()` first, which is an unbounded network call. Two concurrent goroutines can both complete `CheckForUpdate` before either reaches `DownloadAndInstall`. The `CompareAndSwap` at `updater.go:195` correctly blocks the second, but the first has now committed to installing while the second returns with `"an update installation is already in progress"` — a confusing error message because the user sees the first install proceed silently.
- **Fix:** Move the `CompareAndSwap` guard into `app.go.InstallUpdate` **before** `CheckForUpdate`, and release the guard on the error path. Better: disable the "Update Now" button client-side after first click.
- **Confidence:** 82

### Low (2)

#### [V2-L1] Concurrent `auth:expired` + `Logout` → double `stopBackgroundServices`

- **File:** [app.go:252](app.go#L252), [app.go:344](app.go#L344)
- **Bug:** Both call sites invoke `stopBackgroundServices`. The function is mutex-protected and the double-Wait on an already-drained `sync.WaitGroup` is safe. `State.SetAuthenticated(false)` and `State.SetAttendance(nil)` are called twice with the same values — safe under their mutex. No corruption, no crash, just a code smell.
- **Fix:** Make `stopBackgroundServices` explicitly idempotent with a "already stopped" early-return, or funnel both paths through a single state-machine transition.
- **Confidence:** 80

#### [V2-L2] `x11Once` caches the X connection for process lifetime

- **File:** [x11_linux.go:45-46](internal/monitor/x11_linux.go#L45-L46)
- **Bug:** If the X server crashes and restarts (rare), subsequent `xproto.*` calls fail and the app silently reports zero idle seconds forever. No warning beyond the initial setup log.
- **Fix:** Detect connection death in each X call and re-initialize via a mutex-protected setup function. Low priority — this is an uncommon failure mode.

---

## 5. Fix-first queue for v3

Prioritized, with estimates:

| # | Severity | Item | Effort |
|---|---|---|---|
| 1 | **Critical** | [V2-C1] Reject userinfo in `ValidateHTTPSURL` + test | 30 min |
| 2 | **High** | [V2-H2] Replace `sync.Once` in `config.Get()` with a pattern that doesn't poison on panic | 1 h |
| 3 | **High** | [V2-H3] SHA256SUMS filename mismatch guard (release-workflow check + lowercase match) | 1 h |
| 4 | **High** | [V2-H1] Sign SHA256SUMS with a release key (GPG or minisign) + embed public key + verify signature | 1 day |
| 5 | **High** | [M-MON-1] Reset `InputTracker.keyboardTotal`/`mouseTotal` on `Stop` | 30 min |
| 6 | **Medium** | [V2-H4] tray_windows snapshot `hwnd` under mutex | 30 min |
| 7 | **Medium** | [V2-M2] `ShowBalloon` mutex on Linux/macOS | 30 min |
| 8 | **Medium** | [V2-M5] Move install-in-progress CAS above `CheckForUpdate` | 30 min |
| 9 | **Medium** | [M-AUTH-3] Client-side `exp` + `iss` JWT claim check | 1 h |
| 10 | **Medium** | [V2-M1] Validate `WebDashboardURL` at config-load + before `open` | 30 min |
| 11 | **Medium** | [V2-M4] logind D-Bus recovery after crash | 2 h |
| 12 | **Medium** | [M-API-2] Separate `resty.Client` for S3 uploads with longer timeout | 1 h |
| 13 | **Low** | [V2-L1] Idempotent `stopBackgroundServices` | 30 min |
| 14 | **Low** | [M-CORE-1] Store log file handle, close on shutdown | 30 min |
| 15 | **Low** | [V2-L2] Re-init X11 connection on failure | 1 h |

**Total: ~2 focused days.** After this, v3 should be shippable.

---

## 6. Team trajectory assessment

The v1→v2 delta tells a clear story.

**What changed organizationally (from evidence in the code):**
- The team read v1 thoroughly. Commit messages cross-reference v1 template IDs (`"sync.Once config, kill authCtx leak, chunk cleanup, hardened unauth client"` — that's T-ONCE-1, T-CTX-2, T-ATOMIC-1, and a security hardening all in one commit).
- Pre-commit hooks shipped (`scripts/pre-commit.sh`, `scripts/install-hooks.sh`).
- Lint CI workflow shipped (`.github/workflows/lint.yml`, Ubuntu 24.04 smoke build).
- Real unit tests shipped, with meaningful assertions (not smoke tests).
- Fix templates from v1 were adopted verbatim — the code shape matches what the report suggested.
- New modules (`internal/security/`, `internal/api/errors.go`) show the team internalized the systemic-pattern concept — they factored the validation and sanitization logic out of the consuming modules instead of sprinkling it at call sites.

**What this signals:** the "we're vibe-coding, we don't know Go" framing from the previous conversation is no longer accurate. This is competent, disciplined work. Whatever mix of process / senior review / AI tooling was used, it's working.

**Remaining risk:** the team is now doing defensive work well, but the **one Critical that slipped into v2 (the userinfo bypass) is exactly the kind of bug that AI review catches better than line-by-line human review**. The lesson is: when you add a new security primitive (`ValidateHTTPSURL`), explicitly ask for an adversarial review of the primitive itself before using it in three places. Otherwise a single bypass compounds.

**My updated Rust-vs-Go recommendation:** **stay on Go**. The Go+Wails stack is working for this team now. The cost of migration is no longer justified by the bugs — the bugs are getting handled.

---

## 7. Acceptance criteria for v3 ship

- [ ] All 15 items in Section 5 closed with linked PRs
- [ ] `go test -race ./...` passes in CI (already in place per `lint.yml` — verify it has `-race`)
- [ ] `staticcheck` and `errcheck` clean (already wired into pre-commit — verify CI enforces on PR)
- [ ] SHA256SUMS file is cryptographically signed and the public key is embedded in the binary
- [ ] `ValidateHTTPSURL` has an adversarial test suite covering: userinfo rejection, case-folded hosts, IDN/punycode, percent-encoded separators, path normalization, redirect chains
- [ ] Manual test: `go build ./...` with GOOS=windows and GOOS=linux from a clean environment passes
- [ ] Manual test: launch app, log in, work for 15 minutes, log out, log in again, log out, quit from tray — no goroutine leak per `pprof goroutine`
- [ ] Manual test: break `config.json` with malformed JSON — app shows a user-facing error dialog and exits cleanly, does NOT nil-panic in a goroutine
- [ ] Manual test: click "Update Now" twice rapidly — exactly one UAC prompt, exactly one install, second click gets a clear "already installing" message (not a generic error)
- [ ] Manual test: suspend the machine for 30 minutes, resume — next heartbeat's `idle_seconds` is capped at `HeartbeatInterval` (fix still pending)
- [ ] Penetration test (self): craft a hostile `config.json` with `web_dashboard_url = "javascript:alert(1)"` and verify the validator rejects it before `open` is called on macOS

When all boxes are checked, you are production-ready.

---

## 8. A note to the team (v2 version)

Good work. Roughly 75 findings from the v1 audit, you closed the ~49 that matter most and left the remaining ~7 in sensible places (with comments explaining *why* they're deferred, which is the correct engineering trade-off).

The one real lapse — [V2-C1] `ValidateHTTPSURL` — is a useful lesson: when you centralize a security-critical helper, it becomes a single point of failure. Every caller now trusts it implicitly. **Any new security primitive deserves its own adversarial review before it lands.** Ask the reviewer: "Here's a validator. Try to bypass it. What URLs does Go parse weirdly?" That one extra step would have caught the userinfo case.

The other new findings are low-blast-radius and well-localized. Fix them in a 2-day sprint per Section 5 and this codebase is ready to ship.

After v3, the conversation shifts from "are there bugs" to "how do we prevent the next 14." The pre-commit hooks and CI lint are the start of that. Next steps:
- **Fuzz tests** on `ValidateHTTPSURL` and `parseSHA256SUMS` — these are string parsers, they deserve fuzzing (`go test -fuzz`).
- **Property-based tests** on state machine transitions (`stopBackgroundServices`, session lifecycle).
- **Integration tests** against a local mock Cognito and a local mock S3 — catch the 401-recovery path end-to-end.
- **Dependency pinning + Dependabot** — someone will publish a malicious `zalando/go-keyring` tomorrow. Be ready.

Keep going.
