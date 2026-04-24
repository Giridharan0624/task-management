# CI Pipeline: Auto-Build Installers for All Platforms

## Overview

GitHub Actions CI pipeline that automatically builds **ready-to-distribute installers** for Windows, Linux, and macOS on every push.

```
git push
    │
    ├── Windows VM (windows-latest)
    │   ├── Install Go + Node + Wails
    │   ├── wails build -platform windows/amd64
    │   ├── makensis → TaskFlowDesktop-Setup-1.0.0.exe
    │   └── Upload artifact ✓
    │
    ├── Linux VM (ubuntu-latest)
    │   ├── Install Go + Node + Wails + GTK/WebKit deps
    │   ├── wails build -platform linux/amd64
    │   ├── appimagetool → TaskFlow-Desktop.AppImage
    │   └── Upload artifact ✓
    │
    └── macOS VM (macos-latest)
        ├── Install Go + Node + Wails
        ├── wails build -platform darwin/universal
        ├── create-dmg → TaskFlow-Desktop.dmg
        └── Upload artifact ✓
```

---

## Triggers

| Trigger | Environment | When |
|---------|-------------|------|
| Push to `main` | Production | Every merge to main |
| Push to `feature/*` | Staging | During development |
| Manual (`workflow_dispatch`) | Choose: staging / production / company | On-demand from GitHub UI |
| Tag push (`v*`) | Production + GitHub Release | Version releases |

---

## What Each Platform Builds

### Windows (`windows-latest`)

| Step | Tool | Output |
|------|------|--------|
| Compile Go + frontend | `wails build` | `build/bin/taskflow-desktop.exe` (15 MB) |
| Package installer | `makensis` (NSIS) | `TaskFlowDesktop-Setup-1.0.0.exe` (5 MB) |

NSIS script: `desktop/build/windows/installer/project.nsi`

**User experience:** Download → double-click → install wizard → app in Start Menu + system tray.

### Linux (`ubuntu-latest`)

| Step | Tool | Output |
|------|------|--------|
| Install deps | `apt-get` | `gcc libgtk-3-dev libwebkit2gtk-4.0-dev` |
| Compile Go + frontend | `wails build` | `build/bin/taskflow-desktop` (15 MB) |
| Package AppImage | `appimagetool` | `TaskFlow-Desktop.AppImage` (15 MB) |

AppImage structure:
```
TaskFlow-Desktop.AppDir/
├── AppRun                         → symlink to usr/bin/taskflow-desktop
├── taskflow-desktop.desktop       → desktop entry
├── taskflow-desktop.png           → app icon
└── usr/bin/taskflow-desktop       → the binary
```

**User experience:** Download → `chmod +x` → double-click. No installation, no root, runs on any Linux distro.

### macOS (`macos-latest`)

| Step | Tool | Output |
|------|------|--------|
| Compile Go + frontend | `wails build` | `build/bin/TaskFlow Desktop.app` (app bundle) |
| Package DMG | `create-dmg` | `TaskFlow-Desktop.dmg` (10 MB) |

**User experience:** Download → open DMG → drag to Applications → launch from Launchpad.

**Note:** Without Apple code signing ($99/yr), macOS will show "unidentified developer" warning. Users bypass with right-click → Open.

---

## Config Injection

Each build injects environment-specific config via Go `-ldflags`:

```
-X 'taskflow-desktop/internal/config.apiURL=<API_URL>'
-X 'taskflow-desktop/internal/config.cognitoRegion=ap-south-1'
-X 'taskflow-desktop/internal/config.cognitoPoolID=<POOL_ID>'
-X 'taskflow-desktop/internal/config.cognitoClientID=<CLIENT_ID>'
-X 'taskflow-desktop/internal/config.webDashboardURL=<DASHBOARD_URL>'
```

### Environment Values

| Environment | API URL | Pool ID | Dashboard |
|-------------|---------|---------|-----------|
| **Staging** | `https://4saz9agwdi.execute-api.ap-south-1.amazonaws.com/staging` | `ap-south-1_NedaPlHsx` | `http://localhost:3000` |
| **Production** | `https://3syc4x99a7.execute-api.ap-south-1.amazonaws.com/prod` | `ap-south-1_72qWKeSH5` | `https://taskflow-ns.vercel.app` |
| **Company** | `https://qhh92ze0rc.execute-api.ap-south-1.amazonaws.com/prod` | `ap-south-1_KvHp1RVEE` | `https://taskflow.neurostack.in` |

Store these as GitHub Secrets (`STAGING_API_URL`, `PROD_API_URL`, etc.) for the CI pipeline.

---

## Auto-Release on Version Tag

When you push a version tag, CI builds all 3 platforms and creates a GitHub Release:

```bash
git tag v1.1.0
git push --tags
```

This triggers:
1. Build all 3 installers in parallel
2. Create GitHub Release `v1.1.0`
3. Attach all 3 installers as release assets
4. Desktop app's built-in auto-updater detects the new release → prompts user to update

### Auto-Update Flow (already implemented)

```
Desktop app starts
    ↓
Check GitHub API: /repos/Giridharan0624/taskflow-desktop/releases/latest
    ↓
Compare CurrentVersion vs release tag
    ↓
If newer: prompt user → download platform-specific asset → install
    Windows: downloads .exe → launches installer
    Linux: downloads .AppImage → chmod +x → replaces binary
    macOS: downloads .dmg → opens for user to drag-install
```

---

## Local Build Scripts (for manual builds)

| Script | Environment | Command |
|--------|-------------|---------|
| `build-installer.ps1` | Production | `powershell -File build-installer.ps1` |
| `build-installer-staging.ps1` | Staging | `powershell -File build-installer-staging.ps1` |
| `build-installer-company.ps1` | Company | `powershell -File build-installer-company.ps1` |

These only build **Windows installers** (since you're on Windows). Linux and macOS installers can only be built on their respective platforms or via CI.

---

## Cost

| Runner | Build time | Free tier multiplier | Effective minutes |
|--------|-----------|----------------------|-------------------|
| Windows | ~2 min | 1x | 2 min |
| Linux | ~2 min | 1x | 2 min |
| macOS | ~3 min | **10x** | 30 min |
| **Total per push** | | | **~34 min** |

GitHub Free: 2,000 min/month → **~57 builds/month**
GitHub Pro: 3,000 min/month → **~88 builds/month**

---

## Files

| File | Purpose |
|------|---------|
| `desktop/.github/workflows/build.yml` | CI pipeline definition |
| `desktop/build/windows/installer/project.nsi` | Windows NSIS installer script |
| `desktop/build/linux/TaskFlow-Desktop.desktop` | Linux AppImage desktop entry |
| `desktop/Makefile` | Local build targets for all platforms |
| `desktop/build-installer.ps1` | Local Windows production build |
| `desktop/build-installer-staging.ps1` | Local Windows staging build |
| `desktop/build-installer-company.ps1` | Local Windows company build |

---

## Prerequisites for CI

1. Push code to GitHub repository
2. Add GitHub Secrets for each environment's config values
3. Ensure the `desktop/build/windows/installer/project.nsi` is committed
4. Create `desktop/build/linux/TaskFlow-Desktop.desktop` for AppImage packaging
5. For macOS code signing (optional): add Apple Developer certificates as GitHub Secrets
