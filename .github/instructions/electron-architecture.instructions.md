---
description: "Use when writing or modifying Electron main process, preload, IPC, or window management code. Covers architecture rules, security boundaries, and process separation for AniSocialDesktop."
applyTo: "src/**/*.ts"
---
# Electron Architecture

## Process Separation

- Main process code lives in `src/main.ts`, `src/push.ts`, `src/updater.ts`
- Preload script: `src/preload.ts` — the only bridge between main and renderer
- Shared type definitions go in `src/types/`

## Security Boundaries

- Prefer `contextIsolation: true` and `nodeIntegration: false` on BrowserWindow
- Since the renderer loads a remote web page, use the message-passing pattern (not `contextBridge`):
  - Main injects scripts via `executeJavaScript` on `did-start-navigation` and `dom-ready`
  - Injected scripts communicate back via `window.postMessage`
  - Preload listens with `window.addEventListener('message')` and forwards via `ipcRenderer.send()`
- IPC channel names should be defined in `src/types/ipc.ts` as `IPC_CHANNELS`
- Prefer validating navigation targets: allow URLs starting with `APP_CONFIG.TARGET_URL`; open others in the system browser via `shell.openExternal`

## Configuration

- App-wide constants (URLs, window dimensions, intervals, tray icons) should live in `src/types/config.ts` as `APP_CONFIG`
- Avoid hardcoding URLs, sizes, or timer values directly in main process files

## Platform Handling

- Support Linux, Windows, and macOS
- Use `process.platform` checks for platform-specific behavior (tray icons, badge updates, auto-updater)
- Auto-update via `electron-updater` is only supported for AppImage (Linux), Windows, and macOS — show manual update notification for other Linux formats

## UI Language

- All user-facing strings (menus, tray labels, notifications, tooltips) are in German
