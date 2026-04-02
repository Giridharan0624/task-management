package monitor

import (
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32                  = windows.NewLazySystemDLL("user32.dll")
	procGetForegroundWindow = user32.NewProc("GetForegroundWindow")
	procGetWindowTextW      = user32.NewProc("GetWindowTextW")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")

	kernel32             = windows.NewLazySystemDLL("kernel32.dll")
	procOpenProcess      = kernel32.NewProc("OpenProcess")
	procCloseHandle      = kernel32.NewProc("CloseHandle")

	psapi                     = windows.NewLazySystemDLL("psapi.dll")
	procGetModuleFileNameExW  = psapi.NewProc("GetModuleFileNameExW")
)

// WindowTracker tracks the active foreground window application name.
type WindowTracker struct{}

// NewWindowTracker creates a new window tracker.
func NewWindowTracker() *WindowTracker {
	return &WindowTracker{}
}

// GetActiveWindowApp returns the executable name of the foreground window (e.g., "Code.exe" → "VS Code").
func (w *WindowTracker) GetActiveWindowApp() string {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return ""
	}

	// Get the process ID for the foreground window
	var pid uint32
	procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		return ""
	}

	// Open the process to read its module name
	const PROCESS_QUERY_INFORMATION = 0x0400
	const PROCESS_VM_READ = 0x0010
	handle, _, _ := procOpenProcess.Call(
		PROCESS_QUERY_INFORMATION|PROCESS_VM_READ,
		0,
		uintptr(pid),
	)
	if handle == 0 {
		return getWindowTitle(hwnd)
	}
	defer procCloseHandle.Call(handle)

	// Get the executable file path
	var buf [260]uint16
	procGetModuleFileNameExW.Call(
		handle,
		0,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(len(buf)),
	)

	exePath := syscall.UTF16ToString(buf[:])
	if exePath == "" {
		return getWindowTitle(hwnd)
	}

	return friendlyAppName(exePath)
}

// getWindowTitle returns the window title as a fallback.
func getWindowTitle(hwnd uintptr) string {
	var buf [256]uint16
	procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	title := syscall.UTF16ToString(buf[:])

	// Extract just the app name from the title (usually after " - ")
	if idx := strings.LastIndex(title, " - "); idx != -1 {
		return strings.TrimSpace(title[idx+3:])
	}
	if len(title) > 30 {
		return title[:30]
	}
	return title
}

// friendlyAppName converts an exe path to a friendly display name.
func friendlyAppName(exePath string) string {
	// Extract filename from path
	parts := strings.Split(strings.ReplaceAll(exePath, "\\", "/"), "/")
	fileName := parts[len(parts)-1]

	// Remove .exe extension
	name := strings.TrimSuffix(fileName, ".exe")
	name = strings.TrimSuffix(name, ".EXE")

	// Map known executables to friendly names
	knownApps := map[string]string{
		"Code":             "VS Code",
		"code":             "VS Code",
		"chrome":           "Chrome",
		"msedge":           "Edge",
		"firefox":          "Firefox",
		"slack":            "Slack",
		"Discord":          "Discord",
		"Postman":          "Postman",
		"WindowsTerminal":  "Terminal",
		"cmd":              "Command Prompt",
		"powershell":       "PowerShell",
		"pwsh":             "PowerShell",
		"explorer":         "File Explorer",
		"WINWORD":          "Word",
		"EXCEL":            "Excel",
		"POWERPNT":         "PowerPoint",
		"OUTLOOK":          "Outlook",
		"Teams":            "Teams",
		"notepad":          "Notepad",
		"devenv":           "Visual Studio",
		"idea64":           "IntelliJ IDEA",
		"webstorm64":       "WebStorm",
		"goland64":         "GoLand",
		"figma":            "Figma",
		"Notion":           "Notion",
		"Obsidian":         "Obsidian",
	}

	if friendly, ok := knownApps[name]; ok {
		return friendly
	}

	return name
}
