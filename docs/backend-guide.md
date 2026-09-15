# Backend Guide

This is a contributor-focused guide for the Rust backend.

Architecture shape and diagrams live in `docs/architecture.md`. This file is intentionally narrower: what to edit, where to edit it, and how to verify changes safely.

## What this guide is for

Use this guide when you are changing:

- indexing scope and discovery behavior,
- matching/ranking quality,
- SQLite persistence semantics,
- web answers / translation lookups (`core/answers`).

## Module map (edit targets)

### `core/engine`

- `core/engine/src/config.rs`: tunables, weights, hints, limits.
- `core/engine/src/query.rs`: query parsing and prefixes (`a"`, `f"`, `d"`, `r"`).
- `core/engine/src/search.rs`: search orchestration and result flow.
- `core/engine/src/scoring.rs`: score composition, biases, top-k helpers.
- `core/engine/src/index/mod.rs`: index orchestration.
- `core/engine/src/index/apps.rs`: app discovery and app excludes.
- `core/engine/src/index/files.rs`: file/folder discovery and excludes.
- `core/engine/src/index/settings.rs`: curated System Settings catalog.
- `core/engine/src/lib.rs`: bootstrap, cache refresh, integration surface.

### `core/answers`

- `core/answers/src/lib.rs`: public entry points (`instant_answer`, `has_match`, suggestions, `translate`).
- `core/answers/src/sources/`: per-provider lookups (`currency.rs`, `weather.rs`, `crypto.rs`, `knowledge.rs`, `suggest.rs`).
- `core/answers/src/http.rs`: blocking `curl` subprocess transport (no async runtime).
- `core/answers/src/translate.rs`: translation logic behind the Tauri translate endpoints.
- Keep entry points best-effort and panic-free: return "no answer" on any failure.

### `core/storage`

- `core/storage/src/lib.rs`:
  - schema/migrations,
  - candidate upsert/load APIs,
  - usage event persistence,
  - index state persistence.

### `core/todo`

- `core/todo/src/lib.rs`: `TodoStore` (open/list/save/prune) over the `todo_tasks` table in the app's `look.db`; the JSON task shape is pinned by tests since both app shells decode it.
- `core/todo/examples/seed.rs`: seeds demo task history into a database (`dev` target by default: the `look.dev.db` file that dev builds read automatically).

### `apps/linows/src-tauri/src` (shell backend)

- `main.rs`: entry point, plugin registration, D-Bus toggle service.
- `commands.rs`: Tauri commands (search, open, reveal, window, quit) calling the core engine directly - no FFI layer.
- `state.rs`: engine cache and the scoped-refresh file watcher.
- `config.rs`: `~/.look/config` persistence.
- `platform/linux/`: icons, WM detection, Wayland shortcuts, compositor blur, autostart.

## Common change recipes

### Tune ranking quality

1. Start in `core/engine/src/config.rs` for weights/hints.
2. Adjust scoring in `core/engine/src/scoring.rs` only if config knobs are insufficient.
3. Keep heuristics centralized; avoid ad-hoc constants in unrelated files.

### Change indexing scope

1. Update defaults and limits in `core/engine/src/config.rs`.
2. Update source-specific logic in `core/engine/src/index/apps.rs`, `core/engine/src/index/files.rs`, or `core/engine/src/index/settings.rs`.
3. Verify behavior with a realistic local config.

### Change persistence behavior

1. Update schema/API behavior in `core/storage/src/lib.rs`.
2. Keep migration compatibility explicit.
3. Re-check bootstrap and cache refresh flow in `core/engine/src/lib.rs`.

### Change the shell command surface

1. Add/update the command in `apps/linows/src-tauri/src/commands.rs`.
2. Keep error payloads structured and stable.
3. Add the matching wrapper in `apps/linows/src/js/ipc.js`.

## Runtime config keys (backend-relevant)

Runtime file: `~/.look/config` (or `LOOK_CONFIG_PATH`).

- `app_scan_roots`, `app_scan_depth`, `app_exclude_paths`, `app_exclude_names`
- `file_scan_roots`, `file_scan_extra_roots`, `file_scan_depth` (default: 4, range: 1-12), `file_scan_limit` (default: 4000, range: 500-50000), `file_exclude_paths`
- `skip_dir_names`
- `lazy_indexing_enabled` (default: true) - when true, launcher-open refresh runs only when the index is dirty
- `backend_log_level`
- `launch_at_login`

Behavior:

- one `key=value` per line,
- `#` comments supported,
- unknown keys ignored,
- invalid values fall back to defaults.

## Verification checklist

### Build checks

```bash
cd core && cargo check --workspace
```

### Test checks

```bash
cargo test --workspace --manifest-path core/Cargo.toml
```

### App-level smoke check

Run the app with `cd apps/linows && cargo tauri dev` (see [DEVELOPMENT.md](../DEVELOPMENT.md#building-and-running)), then validate:

- search returns expected results,
- usage events update ranking after opening items,
- config reload (`Ctrl+Shift+;`) applies expected runtime changes,
- lazy indexing mode behavior:
  - `lazy_indexing_enabled=true`: `Alt+Space` refreshes only when dirty,
  - `lazy_indexing_enabled=false`: `Alt+Space` always requests background refresh.

## Reliability rules

- keep tunables in config, not scattered literals,
- keep indexing logic inside `index/*`,
- propagate actionable errors across boundaries,
- prefer predictable bounded work in query-time paths.
