# Learnings from Look

Patterns and techniques from Look (kunkka19xx/look) worth applying to Manatee Desktop projects.

## Architecture Patterns

### 1. SystemControl Adapter Pattern
**File:** `qactions/controls/bluetooth.rs` (reference adapter)

The qactions system uses a clean adapter pattern:
- Each control implements `SystemControl` trait
- All OS-specific code stays inside the adapter
- Adding a new control = copy file, implement trait, register

**Apply to:** niri-settings sidecar commands, quickshell components

```rust
// Pattern: Each feature is a self-contained adapter
pub trait SystemControl {
    fn state(&self) -> ActionState;
    fn apply(&self, intent: ActionIntent) -> ActionOutcome;
    fn info(&self) -> Vec<ListItem>;
}
```

### 2. Hardware Detection → Graceful Degradation
**File:** `qactions/controls/bluetooth.rs`, `mic.rs`, `screensaver.rs`

Controls detect hardware at runtime and report `Unavailable` with a reason:
- No deletion needed — code stays for other users
- UI renders inert tiles when unavailable
- Same codebase works across different hardware configs

**Apply to:** Any feature that depends on hardware (bluetooth, mic, battery, etc.)

### 3. Layer Shell for Wayland Overlay
**File:** `platform/linux/layer_shell.rs`

Look uses `gtk-layer-shell` for Wayland overlay surfaces:
- Loads library at runtime (`libloading::Library`)
- Falls back gracefully if library not found
- Proper keyboard focus management (exclusive vs none)

**Apply to:** Any overlay/panel that needs to sit above fullscreen windows

### 4. D-Bus Service for IPC
**File:** `platform/linux/wayland_shortcut.rs`

Look registers a D-Bus service (`com.look.Desktop`) for toggle:
- Compositor keybinding calls `gdbus call ... Toggle`
- App registers service at startup
- Single-instance lock prevents duplicates

**Apply to:** Quickshell IPC, niri-settings sidecar

## Frontend Patterns

### 5. CSS Custom Properties for Theming
**File:** `css/theme.css`

Look uses CSS custom properties extensively:
- All colors defined as `--variable-name`
- Theme switching = set `data-theme` attribute
- Custom mode = override individual properties

**Apply to:** Quickshell Theme.qml (already does this), any web UI

### 6. Component-Based JS Architecture
**File:** `js/components/`

Each UI component is a separate JS file:
- `results.js` — search results
- `preview.js` — file preview
- `health.js` — health warnings
- Components communicate via events, not direct references

**Apply to:** Refactor any monolithic JS into components

### 7. Motion System
**File:** `css/motion.css`, `js/motion.js`

All animation constants in one place:
- Duration tiers: fast (140ms), medium (220ms), slow (320ms)
- Easing curves: standard, decelerate, accelerate
- Respects `prefers-reduced-motion`

**Apply to:** Quickshell animation timing, any UI transitions

## Rust Patterns

### 8. Scoped Filesystem Refresh
**File:** `core/engine/index/`

Index only re-walks changed source families:
- File watcher with debounce (2s) + cooldown (10s)
- Scoped refresh: apps-only, files-only, or all
- RAII slot guard for panic safety

**Apply to:** Any file-watching/indexing system

### 9. Bounded DP Fuzzy Scoring
**File:** `core/matching/lib.rs`

1D dynamic programming for fuzzy matching:
- Word-boundary bonuses
- Consecutive-character bonuses
- Gap penalties
- Queries >64 chars fall back to greedy for predictable CPU

**Apply to:** Any search/filter functionality

### 10. Log-Scaled Frecency Ranking
**File:** `core/ranking/lib.rs`

Usage + recency ranking:
- `log2(use_count) * 5.0` keeps frequent items helpful without dominating
- Recency tiers: last hour (+140), today (+90), this week (+40)
- Kind bias: apps > folders > files

**Apply to:** Any "most used" or "recent" sorting

## Configuration Patterns

### 11. TOML-Based User Sources
**File:** `core/sources/`

Users declare custom search sources in `~/.look/sources/`:
- Shell-escaped placeholders (`{id}`, `{title}`, `{query}`)
- Per-block verbs and drill-downs
- Preview commands

**Apply to:** niri-settings custom actions, quickshell custom widgets

### 12. Single-Instance Lock
**File:** `main.rs` (tauri_plugin_single_instance)

Prevents multiple instances:
- Second launch shows existing window
- Clean startup/shutdown lifecycle

**Apply to:** Any desktop app that should only run once

## What We Should Adopt

| Pattern | From | To | Priority |
|---------|------|----|----------|
| SystemControl adapter | Look qactions | niri-settings sidecar | 🔴 High |
| Hardware detection | Look qactions | Any hardware feature | 🔴 High |
| CSS custom properties | Look theme | Quickshell Theme.qml | ✅ Already done |
| Motion system | Look motion | Quickshell animations | 🟡 Medium |
| Scoped refresh | Look engine | File watchers | 🟡 Medium |
| Fuzzy scoring | Look matching | Search functionality | 🟡 Medium |
| TOML sources | Look sources | Custom actions | 🟢 Low |
