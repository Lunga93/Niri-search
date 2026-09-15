# Feature Status

This document tracks what `niri-search` supports today and what is planned next.

## Product pillars

- keyboard-first launcher UX
- low-latency local search
- practical ranking and personalization
- focused built-in tools (not plugin-first)
- predictable behavior with clear controls

## Available now

### Core search and launch

- app/file/folder search from one input
- scoped query prefixes: `a"`, `f"`, `d"`, `r"`, and `rc"` (recent files/folders, newest first - blends opened-through-Niri-Search with recently added/changed on disk)
- path-fragment friendly matching (slash-biased queries)
- URL-like queries (no prefix): typing a URL offers an **Open in browser** row (structural URLs rank first, a bare `host.tld` after local results); opened URLs return as frecency-ranked **Recently opened** rows
- arithmetic queries (no prefix): typing an expression (`2+2`, `sqrt(16)`, `200*15%`) pins a **Calculator** row above every other result; shape decides whether something counts as math, not spacing, so a date, a resolution, or a ratio (`20-05-2026`, `1920x1080`, `16:9`) is left alone. `Enter` or a click copies the value and hides the launcher; clipboard history shows the worked expression (`2+2 = 4`) but still pastes just the value. Shared `core/calc` engine
- open with `Enter`, reveal in the file manager with `Ctrl+F`
- copy selected file/folder path/content handle with `Ctrl+C`
- multi-pick files/folders with `Ctrl+P` (toggle); picked set is mirrored to the system clipboard for paste anywhere. `Ctrl+Shift+P` clears the set
- move selected file/folder (or all picked items) to the Trash with `Ctrl+D` - recoverable, no confirmation
- pinned **Trash** quick folder (type `trash`): `Enter` opens it in the file manager and its preview shows the item count
- preview pane: text/image file previews, plus folder previews listing the immediate children (folders first, capped at 30, click to open)
- hide the selected app from Niri-Search with `Ctrl+Shift+H` so it stops appearing in results

### Clipboard and translation

- clipboard history mode with `c"` prefix
- in-memory clipboard history (recent text clips, size set by `clipboard_history_limit`, default 10, range 10 to 100); file/folder copies are excluded
- remove the selected clipboard history item with `Ctrl+D`
- quick translation with `t"...`
- dictionary lookup panel with `tw"...`

### AI answers and web suggestions

- optional, **on by default**; toggle with `ai_enabled` in `~/.look/config` or the Settings panel
- **answer card**: a question, an entity with no local match (e.g. `sir alex ferguson`), or an instant-answer pattern (weather/currency/crypto) shows an answer card. Sources resolve concurrently and render as they arrive - DuckDuckGo, then Wikipedia (arithmetic no longer answers here; it has its own pinned row above the results - see Core search and launch). In the knowledge-lookup view the card sits in a two-column layout with the suggestion list
- **search suggestions**: Google autocomplete rows appear under the results for plain text queries (2+ chars); `Enter` on one runs a web search, as does `Ctrl+Enter` on the query
- network note: while AI is on, the answer card's web sources and the Google suggestions send the typed query to those services. All of it is off when `ai_enabled = false`

### AI actions and chat

- **the `>` session**: type `>` to switch the panel into a conversation - actions, questions, and streamed answers stack together. `Esc` leaves, `Ctrl+Z` undoes, `Ctrl+.` stops a generation without ending the session. Past conversations are listed, searchable, and resumable
- **`@` for exact times**: `>add lunch @ 1pm` skips the model entirely - instant, deterministic, and works with no capable model configured
- **no prefix needed**: typing an instruction in the main bar works too. The plan appears as the first result row and one `Enter` runs it
- **file recall**: "pdfs from last week", "files added to desktop" search your index by type, time, and place
- **text-ops**: "summarize", "translate to german", "make this shorter" transform whatever you copied. Pick a file first (`Ctrl+P`), or `@`-mention one while typing, and they transform that file instead. Text files, source code, and PDFs; an oversized file says how much of it was read rather than quietly summarizing the first part. A PDF that is a scan, is password-protected, or decodes to junk is refused by name - summarizing garbage would read exactly like a real answer
- **remembered facts**: "remember I prefer metric" stores a durable fact the assistant sees on every turn. Only you can write these - the model never can
- **requires a capable provider** for the natural-language paths: Ollama with a pulled model (Settings > AI), local by default but usable against a remote host. The `@` forms keep working regardless
- **privacy**: prompts go to whichever provider you select, so a remote host or cloud-routed model receives them over the network
- Apple-framework features have no Linux counterpart and are unavailable here: Calendar and Reminders actions, meeting join, Contacts/FaceTime calling, Apple Intelligence answers

### Command mode

- `Ctrl+/` command mode entry, or inline `:cmdid` shortcut from the home screen (e.g. `:calc 2+2`, `:kill chrome`, `:pomo`); space after a known command id triggers a live switch with args pre-filled
- built-in commands: `calc`, `pomo`, `todo`, `speed`, `kill`, `shell`, `sys`
- `pomo`: pomodoro focus timer with editable session list, three timer styles (Modern Ring / Vintage Dial / Minimal Text), shuffled background-music folder, "ending soon" alert at 10s remaining
- `todo`: daily tasks grouped by date (3 unfinished per day, 3 upcoming groups, past days stay non-editable, unfinished tasks 1-3 days late show an `EXTENDED` badge and can still be completed, tasks more than 3 days late show `OVERDUE`, fuzzy search over tasks and dates, manual save) plus a Stats page: weekly/monthly completion donuts, streak, 30-day trend, GitHub-style year heatmap. Today's done/total shows as a clickable stat in the home hint bar. Stored in the shared `look.db` (`core/todo`), one-year retention
- `speed`: internet speed test on a live dial - download and upload as counter-rotating comets on a log scale (1 Mbps to 1 Gbps), latency at the centre pulsing once per round trip, plus LAN/public addresses (public masked by default, both click-to-copy), ISP, location, and a plain-language read of the result. Measurement is shared (`core/netspeed`): a latency probe plus four parallel curl streams per direction against Cloudflare's keyless endpoints, falling back to the nearest of several public test mirrors when Cloudflare rate-limits the connection. Runs on open (reusing a reading under a minute old) and on `R`, never on a timer
- calc parser (`core/calc`, shared by every shell) supports exponent (`^`), factorial (`!`), constants (`pi`, `e`), math functions (`sqrt`, `abs`, `round`, `floor`, `ceil`), `%` shorthand while keeping modulo, implicit multiplication (`2pi`, `3sqrt(9)`), comma-grouped and scientific-notation input (`1,500`, `1e6`), and aliases `x`/`:`/leading `v` (multiply, divide, `sqrt`) honored wherever they land inside `/calc` (`1920x1080`, `16:9`) - results are limited only by what an `f64` can represent, not an artificial ceiling
- kill flow with explicit confirmation and process-by-port lookup (`:3000` / `port 3000`)
- warning cue when shell input contains `sudo`

### Running apps switcher

- an icon row rendered on the right half of the search bar: when enabled, the search field takes the left half and the running-app icons occupy the right (right-aligned, growing leftward as more apps open). Apps are capped at 9, sorted alphabetically and **stable** - positions don't shuffle when you switch apps
  - **Linux**: from `/proc` scan, filtered by what GNOME Shell's `Shell.AppSystem.get_running()` considers a windowed app (via Niri-Search's GNOME extension on Wayland) or by `wlr-foreign-toplevel` / X11 client-list / desktop-hints on other compositors
- on the home screen, activation: `Alt`+badge digit. In command mode, `Ctrl+1`..`Ctrl+7` keep their existing command-catalog semantics
- badge labels follow an ergonomic outer-first layout: with N running apps we consume the easiest-to-reach keys first (`1, 2, 3, 9, 8` before `4`, then `7`, then `6`, then `5`). 5 running apps → badges `1, 2, 3, 8, 9`; 9 running apps → all of `1`..`9`
- focus paths: GNOME Shell extension D-Bus on GNOME Wayland, `wlr-foreign-toplevel-management` on sway/Hyprland, niri IPC on niri (focuses and scrolls to the window's workspace), `i3-msg` on i3, `_NET_ACTIVE_WINDOW` (x11rb) on other X11 WMs
- click on an icon also switches; hover shows app name + shortcut tooltip; active app has an accent ring
- toggled on/off via `Settings > Appearance > Running Apps`. Persisted as `running_apps_placement` in `~/.look/config` (`none` = off, any other value = on; legacy `top`/`right`/`bottom` still load as "on"). The window is a single fixed size and never resizes for the row
- off hides the row and disables the activation shortcut
- AI mode (`>`) hides the row too, and hands `Ctrl+1`..`Ctrl+9` plus `Ctrl+0` to the conversation list: the digit opens the session carrying that chip. Ten chips is the ceiling (a `Ctrl` chord is one keypress), so the list shows ten and older sessions are found by typing

### Super actions

- a control strip on the empty home screen (no query typed) with system toggles, one-shot actions and read-only info tiles
- the tile set, order, sizes and mnemonics come from the shared `core/qactions` catalog; only the native state reads and control paths differ per compositor
- tiles: L slot (Pomodoro session > remaining todos > clock), Bluetooth, Wi-Fi, Battery, Theme, Keep Awake, Screensaver, Weather, Mic, Restart, Shut Down, Now Playing
- activation: click a tile, or press `Alt` + its highlighted letter: `B` Bluetooth, `W` Wi-Fi, `T` Theme, `K` Keep Awake, `S` Screensaver, `M` Mic, `R` Restart, `D` Shut Down, `P` Now Playing play/pause
- Restart and Shut Down arm on the first press and fire on the second; `Esc` or the auto-disarm timeout cancels
- Battery, Weather and the L slot are read-only
- toggled on/off via `Settings > Appearance > Super Actions`. Persisted as `super_actions_enabled` in `~/.look/config`
- off hides the strip and disables its mnemonics

### User-declared sources (v0.6.12)

- your own rows from TOML files in `~/.look/sources/`, indexed and ranked alongside apps and files, with their own usage history
- as many `.toml` files as you like in that directory, merged into one set of blocks (ids unique across all of them, `then` resolves across files); `LOOK_SOURCES_DIR` repoints the directory for dotfiles kept elsewhere
- commands are shell text run by the user's login shell (`$SHELL -lc` on Unix), so a block can call the user's own script in any language; non-POSIX shells (fish, nu) fall back to `/bin/sh` rather than failing per-command
- four block kinds, one producer key each: `do` (one row that performs steps), `dir` (children of one or more directories), `file` (lines of a text file), `run` (lines a command prints)
- `dir` rows stay real files and folders, so preview, reveal, copy, and the file verbs keep working on them
- per-block verbs (`open`, `edit`, `terminal`, `reveal`) overriding the global preferred tools for that block's rows only
- `then` targets reached with `Ctrl+K`: a target that performs steps is an action, a target that produces rows is a drill-down (levels stack 5 deep, `Esc` walks back)
- placeholders in every declared command (`{id}`, `{title}`, `{path}`, `{dir}`, `{query}`, `{parent.*}`), shell-escaped on substitution, plus `LOOK_ID` / `LOOK_TITLE` / `LOOK_PATH` in the environment
- `confirm` question before a destructive block acts; `preview` command whose output fills the right panel for the selected row
- row wire formats: tab-separated lines (`id<TAB>title<TAB>subtitle`) or `format = "json"` for per-row `path` and `icon`
- an executable dropped in the sources directory is a `run` block with everything inferred, no declaration needed
- `aliases`, `bias`, `icon`, and `enabled` per block; unknown keys reported, never fatal
- `run` rows are refreshed on reload (`Ctrl+Shift+;`) and cached in `~/.look/cache/rows/`, so a failed command keeps the last good rows and their ranking
- shared `core/sources` engine. See [`docs/user-sources.md`](user-sources.md), and [lookbook](https://github.com/kunkka19xx/lookbook) for ready-made sources to copy

### Settings and runtime config

- in-app settings panel (`Ctrl+Shift+,`)
- local config file `~/.look/config`
- runtime reload (`Ctrl+Shift+;`)
- 9 built-in theme presets (Catppuccin, Tokyo Night, Rose Pine, Gruvbox, Dracula, Kanagawa, Kindle, Liquid, Custom)
- Behind-window blur requested from the compositor where it exists (KDE / Hyprland / Niri on Linux), clear glass everywhere else
- query alias presets in `~/.look/config` for app + System Settings intent expansion (`alias_note`, `alias_code`, `alias_term`, `alias_chat`, `alias_music`, `alias_brow`)
- in-app config reset (`Settings > Advanced > Create Fresh Config`) with confirmation popup
- semantic color system with auto-derived text colors in Custom mode
- indexing, UI, privacy/logging, launch-at-login controls
- immediate validation feedback for invalid settings input
- advanced extra scan directory controls (`file_scan_extra_roots`) with overlap/risky-root validation

### Backend and persistence

- SQLite-backed candidate + usage storage
- startup/index refresh pipeline for apps/files/settings
- dirty-aware incremental indexing via file-system events (`Alt+Space` refresh-on-dirty)
- usage-event feedback loop for ranking updates
- Rust core called directly from the Tauri shell (no FFI layer)

## In progress / near-term

- better coverage for deeper System Settings pages
- safer shell policy controls (more explicit execution guardrails)
- richer benchmark reporting (p50/p95/p99) for query/index paths
- tighter ranking calibration across title/subtitle/path signals

## Planned direction

- optional extension/plugin injection model (without bloating base UX)
- deeper per-desktop-environment polish across Linux compositors

## Out of scope for v1

- cloud-first workflows
- semantic/vector retrieval
- full content indexing of file bodies
- mandatory plugin ecosystem for core workflow
