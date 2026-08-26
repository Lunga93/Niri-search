# AGENTS.md

Compact guide for AI agents working in this repo. Every line answers: "Would an agent likely miss this without help?"

## Codebuff Ban (HIGHEST PRIORITY)

**Remove anything and everything written by "Codebuff" in any commit, any comment, or anything referencing it.**

This is the highest priority rule. Whenever you see it, you remove it. No exceptions.

- Search for `codebuff` (case-insensitive) across the entire repo
- Remove from code, comments, commit messages, docs, configs, everywhere
- A pre-commit hook enforces this: commits containing "codebuff" are rejected

## Project overview

**Look** is a keyboard-first, local-first launcher. macOS shell is Swift/AppKit (`apps/macos/`), Linux shell is Tauri v2 with a vanilla HTML/CSS/JS frontend (`apps/linows/`). Both shells share a Rust core (`core/`). The repo root contains both platforms.

## Repo structure (critical paths)

```
core/           Shared Rust workspace (12 crates)
bridge/ffi/     C ABI bridge consumed by macOS/Windows native apps
apps/linows/    Tauri v2 app (Linux) - Rust backend + vanilla JS frontend
apps/macos/     Swift Xcode project (macOS)
tools/perf/     Standalone benchmark crate (NEVER bundled, NOT in core workspace)
docs/           User guide, architecture, design decisions
scripts/        Build, release, install scripts (Makefile.mac at root)
```

## Important structural gotcha

`bridge/ffi/Cargo.toml` depends on `look-ai` (path: `core/ai`) and `look-lunar` (path: `core/lunar`), but **neither directory exists** in this checkout. The FFI bridge will not compile as-is. The core workspace does not list these crates as members either. Before working on `bridge/ffi`, verify whether these crates have been added elsewhere or if the FFI deps are stale.

## Quick commands

**Core workspace (always works):**
```bash
cargo check --workspace --manifest-path core/Cargo.toml
cargo test --workspace --manifest-path core/Cargo.toml
```

**FFI bridge:**
```bash
cargo check --manifest-path bridge/ffi/Cargo.toml
cargo test --manifest-path bridge/ffi/Cargo.toml
```

**Tauri app (Linux):**
```bash
cd apps/linows
cargo tauri dev          # dev with hot reload
cargo tauri build        # release bundle
```

**NixOS:**
```bash
nix develop --accept-flake-config ./apps/linows/
cargo tauri dev
```

## Linting & formatting

Pre-commit hooks (auto-installed via `nix develop`) run:
- `cargo fmt` for core, ffi, and linows
- `cargo clippy` with `-D warnings` for core and linows
- `cargo test` for core and ffi
- `prettier` for linows frontend (JS/HTML/CSS)
- Secrets detection (grep for password/secret/token patterns)

Run manually:
```bash
# Core
cargo fmt --manifest-path core/Cargo.toml --all -- --check
cargo clippy --workspace --manifest-path core/Cargo.toml -- -D warnings

# Linows
cargo fmt --manifest-path apps/linows/src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path apps/linows/src-tauri/Cargo.toml -- -D warnings
```

**linows clippy is conditional:** The pre-commit hook skips it if `pkg-config`/`glib-2.0` aren't available (i.e., outside `nix develop`). It will silently pass even if code is broken.

## Platform-specific gotchas

- **Linux:** Requires WebKitGTK 4.1 (not 4.0), GTK 3, and other system libs. On NixOS: `nix develop --accept-flake-config ./apps/linows/`.
- **Hot reload:** Tauri dev watches only `apps/linows/src-tauri/`. Changes in `core/` need a touch of any `src-tauri/` file to trigger rebuild.
- **Config paths:** Dev config: `~/.look/config.dev`. Dev database: `look.dev.db` vs `look.db` (production).
- **Rust edition:** 2024, minimum rust-version 1.88 (let chains stabilized in 1.88). NixOS flake pins Rust 1.95.0.
- **notify version split:** `bridge/ffi` and `tools/perf` use `notify` v6/v8 respectively; linows uses `notify` v6. These are independent (ffi is a separate workspace).

## Contribution workflow

- All PRs target `main` (no staging branch).
- Branch from `main`, keep branches short-lived.
- Run local checks before opening PR (see above).
- Commit style: `fix:`, `feat:`, `docs:`, `refactor:`, `test:`.
- Update docs when user-visible behavior changes.

## Testing quirks

- Benchmarks live in `tools/perf` crate (separate from core workspace, never bundled).
- `core/todo/examples/seed.rs` seeds demo task history into `look.dev.db`.
- FFI string allocation/free paths must stay balanced (`look_free_cstring`).
- Pre-commit runs `cargo test` for core and ffi on every Rust commit.

## Verify Before Claiming Success

**Before saying anything is "fixed" or "working":**

1. **Run the actual test** — compilation ≠ behavior
2. **Check for side effects** — did your fix break something else?
3. **Verify with evidence** — logs, D-Bus calls, not just "it compiled"

**Verification checklist:**
- [ ] Service actually starts and stays running
- [ ] D-Bus responds to toggle/commands
- [ ] UI renders without visual glitches
- [ ] Colors match expected theme
- [ ] No new errors in logs
- [ ] User can reproduce the fix themselves

## Key references

- `DEVELOPMENT.md` – full build instructions, repo layout.
- `CONTRIBUTING.md` – PR flow, commit style, CLA.
- `apps/linows/BUILDING.md` – per-distro Linux deps, NixOS flake.
- `docs/backend-guide.md` – module map, edit targets, verification checklist.
- `docs/architecture.md` – canonical architecture reference.
- `.pre-commit-config.yaml` – exact lint/test commands.
