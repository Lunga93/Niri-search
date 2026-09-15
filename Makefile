# Niri-Search top-level shortcuts (Linux only).
#
#   make help     list targets
#   make test     core workspace tests
#   make check    core workspace check + clippy
#   make dev      run the Tauri app in dev mode (needs system deps, see apps/linows/BUILDING.md)
#   make build    release bundles as configured in tauri.conf.json (deb + rpm)

.PHONY: help test check dev build

help:
	@echo "test    cargo test --workspace --manifest-path core/Cargo.toml"
	@echo "check   cargo check + clippy on the core workspace"
	@echo "dev     cd apps/linows && cargo tauri dev"
	@echo "build   cd apps/linows && cargo tauri build"

test:
	cargo test --workspace --manifest-path core/Cargo.toml

check:
	cargo check --workspace --manifest-path core/Cargo.toml
	cargo clippy --workspace --manifest-path core/Cargo.toml -- -D warnings

dev:
	cd apps/linows && cargo tauri dev

build:
	cd apps/linows && cargo tauri build
