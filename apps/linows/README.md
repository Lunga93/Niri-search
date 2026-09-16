# linows

Tauri v2 desktop app for **Linux**, Niri-first. Vanilla HTML/CSS/JS frontend.

Dark, blurred, rounded, minimal: a single design language implemented once
in web technologies across the whole app.

## Architecture

```
apps/linows/
  src-tauri/             Rust backend (Tauri commands, state, platform logic)
    src/
      main.rs            Entry point, plugin registration, global hotkey
      commands.rs        Search, open, reveal, window, quit
      state.rs           AppState: engine cache, scoped-refresh watcher (non-recursive
                         file roots, noise filter, debounce + cooldown, off-thread reindex,
                         RAII slot guard). See tools/perf/WATCHER_PERF.md for benchmarks.
      config.rs          Config get/set (.look/config persistence)
      files.rs           File meta, version, clipboard copy, music scan, folder pick
      clipboard.rs       Clipboard history monitor
      shell.rs           Shell command execution
      calc.rs            Calculator (functions, constants, !, %, commas)
      music.rs           Background music player (rodio, ALSA)
      process.rs         Running apps list + kill
      sysinfo.rs         System info (OS, memory, CPU, battery, uptime, disk)
      todo.rs            Daily tasks (shared look-todo store in look.db)
      netspeed.rs        Speed test (shared look-netspeed crate) + local IPv4 lookup
      translate.rs       Translation
      weburl.rs          URL-like query detection + opened-URL history (shared core)
      autostart.rs       Autostart management
      platform/          Platform-specific code
        linux/           Icons, WM detection, Wayland shortcuts, GNOME ext, compositor blur, …
        shared.rs        Shared platform helpers
    capabilities/
      default.json       Tauri v2 permissions (events, dialog)
  src/                   Vanilla frontend (served by Tauri webview)
    index.html
    css/                 reset.css, layout.css, theme.css, motion.css, liquid.css
    js/
      app.js             Main controller, mode switching
      keyboard.js        Keyboard handling
      search.js          Query input, search modes (clipboard, translate)
      ipc.js             All Tauri invoke wrappers
      platform.js        Platform detection
      blur.js            Compositor blur region (painted surfaces)
      icons.js           Icon resolution
      html-loader.js     Dynamic HTML template loader
      components/        results, preview, picked, banner, translate, ai-answer (web answer card)
      screens/           settings, commands (calc, kill, pomo, shell, speed, sys, todo)
    html/screens/        HTML templates (search, settings, help, commands)
    assets/              Icons
```

## Why This Exists

A launcher has to feel native to the compositor it lives on. linows is
built Niri-first: layer-shell floating tiles, D-Bus toggle, niri IPC
focus — with GNOME, KDE, Sway, Hyprland, and i3 carried along through
shared Wayland/X11 paths. One Rust backend, one web frontend, no
per-desktop rewrites.

## Key Decisions

- Direct Rust crate deps (no FFI/cdylib); Tauri commands call core engine directly
- Own Cargo workspace (not part of core/ workspace)
- ES modules (`<script type="module">`), no bundler
- CSS custom properties for theming
- Design language: dark, blurred, rounded, minimal
- Audio playback via `rodio` (Rust); WebKitGTK's HTML5 Audio has issues on Linux
- Folder picker via `tauri-plugin-dialog`, cross-platform native dialogs
- Tauri v2 capabilities in `capabilities/default.json` for event/dialog permissions

## Linux Desktop Environments

| Environment   | Distro | Status   | Notes                                                   |
| ------------- | ------ | -------- | ------------------------------------------------------- |
| GNOME Xorg    | NixOS  | Tested   | Full support                                            |
| GNOME Wayland | Ubuntu | Tested   | Dock icon visible while Niri-Search is open (see Known Issues) |
| GNOME Wayland | NixOS  | Tested   | Full support                                            |
| GNOME Wayland | Arch   | Tested   | Full support                                            |
| i3 X11        | NixOS  | Tested   | No system settings entries                              |
| Sway          | NixOS  | Tested   | No system settings entries                              |
| Hyprland      | Arch   | Tested   | No system settings entries                              |
| KDE Plasma    |        | Untested |                                                         |

**System settings** (Appearance, Wi-Fi, Sound, etc.) are only shown when `gnome-control-center`
is detected. On i3, sway, or minimal distros without GNOME, these entries are skipped.

## Optional Dependencies

| Package        | Used for                          | Fallback                   |
| -------------- | --------------------------------- | -------------------------- |
| `curl`         | Web answers, translation, `/speed` | Answers stay empty; speed test reports "curl is not available on this system" |
| `xclip`        | Copy files to clipboard (X11)     | Shows "Copy failed" banner |
| `wl-clipboard` | Copy files to clipboard (Wayland) | Shows "Copy failed" banner |

Text clipboard (copy path, clipboard history) works without any external tools.
File clipboard (copy a file to paste into a file manager) needs one of the above.

```bash
# Debian/Ubuntu
sudo apt install xclip              # X11
sudo apt install wl-clipboard       # Wayland

# Fedora
sudo dnf install xclip              # X11
sudo dnf install wl-clipboard       # Wayland

# Arch
sudo pacman -S xclip                # X11
sudo pacman -S wl-clipboard         # Wayland
```

## Build

```bash
cd apps/linows
cargo tauri dev       # development
cargo tauri build     # production
```

**NixOS dev shell** (uses flake.nix):

```bash
nix develop
cargo tauri dev
```

## Keyboard shortcuts

| Shortcut      | Action                  |
| ------------- | ----------------------- |
| Alt+Space     | Toggle Niri-Search window      |
| Esc           | Hide Niri-Search               |
| Alt+Shift+Q   | Quit Niri-Search               |
| Tab/Shift+Tab | Navigate results        |
| Enter         | Open selected           |
| Ctrl+Enter    | Search web              |
| Ctrl+C        | Copy path to clipboard  |
| Ctrl+F        | Reveal in file manager  |
| Ctrl+P        | Pick (multi-select)     |
| Ctrl+Shift+P  | Clear all picks         |
| Ctrl+/        | Toggle command mode     |
| Ctrl+Shift+,  | Open settings           |
| Ctrl+Shift+;  | Reload config from file |
| Ctrl+H        | Help screen             |
| Ctrl+Shift+H  | Hide selected app from Niri-Search |
| Ctrl+D        | Remove selected clipboard entry (in `c"` mode) |

**Known issues on Ubuntu:**

- GNOME's default Alt+Space (window menu) is auto-disabled by Niri-Search on Wayland; restored when Niri-Search exits
- **GNOME Wayland: dock icon visible while Niri-Search is open.** Tauri sets `skip_taskbar_hint`
  asynchronously after the GTK window is mapped, so GNOME's dock ignores it. Native GTK apps
  like Ulauncher set this hint in the constructor (before mapping), which works. On X11, the
  hint works correctly. The icon disappears when Niri-Search is hidden (Esc / Alt+Space).
  **Contributions welcome**: if you know a way to set GTK hints before Tauri maps the window,
  please open a PR!

  **Workaround: hide running app indicators from the dock:**

  ```bash
  # Ubuntu Dock
  gsettings set org.gnome.shell.extensions.ubuntu-dock show-running false

  # Dash to Dock
  gsettings set org.gnome.shell.extensions.dash-to-dock show-running false

  # Undo: replace 'false' with 'true'
  ```

**For dev in VM (nixos)**

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 cargo tauri dev
```

**Known issue on Arch: ghost slider trails / overlapping popovers:**

On some Arch installs (observed on GNOME 50 + webkit2gtk 2.52.3 + GTK 3.24.49), dragging a
slider in Settings leaves a trail of past thumb positions, and the theme dropdown shows old
text under the new label. Same webkit version on Ubuntu 26.04 / NixOS 2.50.6 doesn't show
this, so it's some webkit × GTK/mutter/mesa interaction we can't auto-detect yet.

If you hit it, open **Settings > Advanced > Arch** and flip one of:

- **Disable GPU compositing**: keeps blur, fixes the ghost via the same API path VMs already
  use. Requires restart.
- **Disable blur effect**: drops `backdrop-filter`, keeps tint. Live; no restart.

If neither helps, please open an issue with: `pacman -Q webkit2gtk-4.1 gtk3 mutter mesa`,
`lspci -nn | grep VGA`, and `echo $XDG_SESSION_TYPE`.
