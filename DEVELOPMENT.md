# Development

Guide for building Niri-Search locally and contributing to the project.

## Repository layout

```text
.
├── apps/
│   └── linows/                   # Tauri v2 app, Linux (Niri-first)
│       ├── src-tauri/            #   Rust backend (commands, config, platform, etc.)
│       ├── src/                  #   Frontend (vanilla HTML/CSS/JS, ES modules)
│       └── flake.nix             #   NixOS dev shell
├── core/                         # Shared Rust, consumed by the linows shell
│   ├── answers/                  # Platform-agnostic "web answer" features
│   ├── calc/                     # Calculator expression evaluation
│   ├── engine/                   # Query engine, search pipeline, config
│   ├── indexing/                 # Candidate model, source traits
│   ├── matching/                 # Fuzzy matching
│   ├── netspeed/                 # Bandwidth measurement
│   ├── qactions/                 # Quick Actions catalog (declarative half)
│   ├── ranking/                  # Ranking heuristics
│   ├── sources/                  # User-declared source blocks
│   ├── storage/                  # SQLite-backed storage
│   ├── todo/                     # Todo backend
│   └── tools/                    # Preferred tools: catalog + command composition
├── tools/
│   └── perf/                     # Watcher / refresh benchmarks (separate crate, never bundled)
├── docs/                         # User guide, architecture, design decisions
├── scripts/                      # Build, release, install scripts
├── config/                       # Niri integration stanza (config/niri-search.kdl)
└── assets/                       # Icons, screenshots, demo GIF
```

## Prerequisites

- Rust stable toolchain (for the core engine)
- GNU Make (top-level `Makefile`: `test`, `check`, `dev`, `build`)
- For the Tauri app: `cargo-tauri` CLI (`cargo install tauri-cli --version "^2" --locked`) plus the distro WebKitGTK/GTK system libraries (or `nix develop` on NixOS)

The per-distro package lists and all packaging/installer details are canonical in [apps/linows/BUILDING.md](apps/linows/BUILDING.md).

## Building and running

Rust workspace checks:

```bash
cd core
cargo check --workspace
cargo test --workspace
```

Linows (Tauri) dev run: `cd apps/linows && cargo tauri dev` (release: `cargo tauri build`; on NixOS prefix with `nix develop -c`). Per-distro specifics are in [apps/linows/BUILDING.md](apps/linows/BUILDING.md). The dev build reads `~/.look/config.dev`.

`make help` lists every top-level target.

## Benchmarks

All benches live in a separate `tools/perf` crate. Nothing in `apps/` or
`bridge/` depends on it, so they never end up in a shipped binary.

```bash
cd tools/perf
cargo run --release --bin query_engine_bench     # query throughput + fuzzy scoring micro-bench
cargo run --release --bin scoped_refresh_bench   # per-call latency: ALL / APPS_ONLY / FILES_ONLY
cargo run --release --bin watcher_stress         # simulated event streams, BEFORE vs AFTER
cargo run --release --bin real_fs_stress         # real notify watcher + worker doing real disk I/O
```

Watcher / index-refresh methodology, scenarios, and a side-by-side report
live at [tools/perf/WATCHER_PERF.md](tools/perf/WATCHER_PERF.md).

Benchmark snapshots land under [docs/bench-notes/](docs/bench-notes/). Add a new snapshot when scoring, matching, or indexing changes.

## Releasing (maintainers)

Push a `v*` tag (e.g. `v0.2.0`) or dispatch the release workflow with an
explicit version. CI (`.github/workflows/release-linux.yml`) runs the core
test suite, builds the `.deb` on Ubuntu and the `.rpm` in a Fedora
container, and publishes both to GitHub Releases with checksums:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

No staging branch, no freeze: `main` stays releasable at all times.

## Contribution flow

- every PR targets `main`, maintainer and external alike; there is no long-lived staging branch
- external contributions: branch from `main` in your fork and open the PR into `main`
- run local checks before opening a PR:
  ```bash
  cargo test --workspace --manifest-path core/Cargo.toml
  # if touching linows:
  cargo clippy --manifest-path apps/linows/src-tauri/Cargo.toml
  cargo fmt --all --manifest-path apps/linows/src-tauri/Cargo.toml -- --check
  ```
- update docs when user-visible behavior changes
- see [CONTRIBUTING.md](CONTRIBUTING.md)

## Further reading

- [docs/architecture.md](docs/architecture.md) - canonical architecture reference
- [docs/backend-guide.md](docs/backend-guide.md) - backend edit targets and verification
- [docs/user-guide.md](docs/user-guide.md) - user guide
- [docs/features.md](docs/features.md) - feature status
- [apps/linows/BUILDING.md](apps/linows/BUILDING.md) - linows build, packaging, and install methods
