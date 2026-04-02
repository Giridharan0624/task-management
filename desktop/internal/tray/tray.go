package tray

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"runtime"

	"github.com/getlantern/systray"

	"taskflow-desktop/internal/state"
)

// ActionHandler defines callbacks for tray menu actions.
type ActionHandler struct {
	OnShowWindow func()
	OnStopTimer  func()
	OnSignOut    func()
	OnQuit       func()
}

// Manager manages the system tray icon and menu.
type Manager struct {
	appState *state.AppState
	running  bool
	handler  *ActionHandler

	mStatus    *systray.MenuItem
	mShow      *systray.MenuItem
	mStop      *systray.MenuItem
	mDashboard *systray.MenuItem
	mQuit      *systray.MenuItem
}

// NewManager creates a new tray manager.
func NewManager(appState *state.AppState) *Manager {
	return &Manager{
		appState: appState,
	}
}

// SetHandler sets the action callbacks.
func (m *Manager) SetHandler(h *ActionHandler) {
	m.handler = h
}

// Start initializes the system tray. Blocks until stopped.
func (m *Manager) Start(ctx context.Context) {
	m.running = true
	systray.Run(m.onReady, m.onExit)
}

// Stop shuts down the system tray.
func (m *Manager) Stop() {
	if m.running {
		m.running = false
		systray.Quit()
	}
}

// SetTimerActive updates the tray tooltip and menu based on timer state.
func (m *Manager) SetTimerActive(active bool, task *state.CurrentTask) {
	if m.mStatus == nil {
		return
	}

	if active && task != nil {
		title := fmt.Sprintf("Working: %s", task.TaskTitle)
		m.mStatus.SetTitle(title)
		systray.SetTooltip(title)
		m.mStop.Show()
	} else {
		m.mStatus.SetTitle("Timer stopped")
		systray.SetTooltip("TaskFlow Desktop")
		m.mStop.Hide()
	}
}

func (m *Manager) onReady() {
	systray.SetTitle("TF")
	systray.SetTooltip("TaskFlow Desktop")

	m.mStatus = systray.AddMenuItem("Timer stopped", "Current status")
	m.mStatus.Disable()

	systray.AddSeparator()

	m.mShow = systray.AddMenuItem("Show Window", "Open TaskFlow Desktop")
	m.mStop = systray.AddMenuItem("Stop Timer", "Stop the current timer")
	m.mStop.Hide()

	systray.AddSeparator()

	m.mDashboard = systray.AddMenuItem("Open Dashboard", "Open web app in browser")

	systray.AddSeparator()

	m.mQuit = systray.AddMenuItem("Quit", "Exit TaskFlow Desktop")

	go m.handleClicks()
}

func (m *Manager) handleClicks() {
	for {
		select {
		case <-m.mShow.ClickedCh:
			if m.handler != nil && m.handler.OnShowWindow != nil {
				m.handler.OnShowWindow()
			}

		case <-m.mStop.ClickedCh:
			if m.handler != nil && m.handler.OnStopTimer != nil {
				m.handler.OnStopTimer()
			}

		case <-m.mDashboard.ClickedCh:
			openBrowser("https://taskflow-ns.vercel.app")

		case <-m.mQuit.ClickedCh:
			if m.handler != nil && m.handler.OnQuit != nil {
				m.handler.OnQuit()
			}
			systray.Quit()
			return
		}
	}
}

func (m *Manager) onExit() {
	log.Println("System tray exited")
}

// openBrowser opens a URL in the default browser.
func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
