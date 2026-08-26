# AGENTS.md

Compact guide for AI agents working in this repo. Every line answers: "Would an agent likely miss this without help?"

## Project overview

Look is a keyboard-first launcher for macOS, Windows, and Linux. Rust core (`core/`), FFI bridge (`bridge/ffi/`), Tauri v2 app for Linux/Windows (`apps/linows/`), Swift macOS app (not in this repo clone).

## Quick commands

**Build & check (cross-platform):**
```bash
# Core workspace
cargo check --workspace --manifest-path core/Cargo.toml
cargo test --workspace --manifest-path core/Cargo.toml

# FFI bridge
cargo check --manifest-path bridge/ffi/Cargo.toml
cargo test --manifest-path bridge/ffi/Cargo.toml
```

**Tauri app (Linux/Windows):**
```bash
cd apps/linows
cargo tauri dev          # dev with hot reload
cargo tauri build        # release bundle
```

**macOS (requires Xcode):**
```bash
make app-run             # builds, stops running Look, launches with dev config
make app-run-dev         # installs side-by-side "Look Dev.app" (bundle id noah-code.Look.Dev)
```

**Windows (requires VS 2022 Build Tools):**
```bash
make app-run             # cargo tauri dev under vcvars
make app-run-release     # cargo tauri build
```

## Platform-specific gotchas

- **Windows:** Every cargo invocation must run inside `vcvarsall.bat x64`. The repo provides `scripts/windows/with-vcvars.bat` wrapper. VS 2026 Community won't work (missing Windows SDK). See `apps/linows/BUILDING.md`.
- **Linux:** Requires WebKitGTK 4.1 (not 4.0), GTK 3, and other system libs. On NixOS: `nix develop --accept-flake-config ./apps/linows/`.
- **macOS:** FFI static lib staleness detection (`make ffi-unstale`) deletes `apps/macos/LauncherApp/RustBuild/liblook_ffi.a` when Rust source changes. Xcode skips the FFI build phase if the file exists.
- **Hot reload:** Tauri dev watches only `apps/linows/src-tauri/`. Changes in `core/` need a touch of any `src-tauri/` file to trigger rebuild.
- **Config paths:** Dev config: `~/.look/config.dev` (macOS) or `%USERPROFILE%\.look\config.dev` (Windows). Dev database: `look.dev.db` (Windows) vs `look.db` (production).

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

# FFI
cargo fmt --manifest-path bridge/ffi/Cargo.toml --all -- --check

# Linows (under vcvars on Windows)
cargo fmt --manifest-path apps/linows/src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path apps/linows/src-tauri/Cargo.toml -- -D warnings
```

## Contribution workflow

- All PRs target `main` (no staging branch).
- Branch from `main`, keep branches short-lived.
- Run local checks before opening PR (see above).
- Commit style: `fix:`, `feat:`, `docs:`, `refactor:`, `test:`.
- Update docs when user-visible behavior changes.

## Testing quirks

- Benchmarks live in `tools/perf` crate (never bundled).
- `core/todo/examples/seed.rs` seeds demo task history into `look.dev.db`.
- FFI string allocation/free paths must stay balanced (`look_free_cstring`).

## Second-Guess Yourself (MANDATORY)

**Before claiming anything is "fixed" or "working":**

1. **Run the actual test** — don't assume compilation = working
2. **Check for side effects** — did your fix break something else?
3. **Consider alternatives** — what else could explain the symptom?
4. **Verify with evidence** — logs, screenshots, D-Bus calls, not just "it compiled"
5. **Ask yourself:** "Would I bet 🍫 on this actually working?"

**Red flags that mean you haven't verified:**
- "It compiles clean" (compilation ≠ behavior)
- "No errors in the log" (you checked the wrong log)
- "It should work" (assumption, not verification)
- "I fixed it" (without testing the actual user flow)

**Verification checklist before claiming success:**
- [ ] Service actually starts and stays running
- [ ] D-Bus responds to toggle/commands
- [ ] UI renders without visual glitches
- [ ] Colors match expected theme
- [ ] No new errors in logs
- [ ] User can reproduce the fix themselves

## Architecture notes (non-obvious)

- Rust edition 2024, rust-version 1.88 (let chains stabilized in 1.88).
- Windows binaries static-link MSVC C runtime via `.cargo/config.toml` (`+crt-static`).
- Tauri app depends on `core/` crates via path; full repo checkout required.
- macOS app not in this repo; see `apps/macos/` in upstream.
- `bridge/ffi` exports C ABI consumed by macOS/Windows native apps.

## Key references

- `DEVELOPMENT.md` – full build instructions, repo layout.
- `CONTRIBUTING.md` – PR flow, commit style, CLA.
- `apps/linows/BUILDING.md` – per-distro Linux deps, Windows vcvars, NixOS flake.
- `docs/backend-guide.md` – module map, edit targets, verification checklist.
- `docs/architecture.md` – canonical architecture reference.
- `.pre-commit-config.yaml` – exact lint/test commands.
