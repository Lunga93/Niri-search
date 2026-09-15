#!/usr/bin/env python3
"""Sync the release version into the Tauri build inputs.

The release tag is the single source of truth. This rewrites the
version in apps/linows/src-tauri/tauri.conf.json and
apps/linows/src-tauri/Cargo.toml in the CI workspace only (nothing is
committed back), so build.rs stamps APP_VERSION and the bundle
filenames match the tag.

Usage: sync-version.py <version>   # e.g. sync-version.py 0.2.0
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TAURI_CONF = ROOT / "apps/linows/src-tauri/tauri.conf.json"
CARGO_TOML = ROOT / "apps/linows/src-tauri/Cargo.toml"


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"\d+\.\d+\.\d+", sys.argv[1]):
        print("Usage: sync-version.py <x.y.z>", file=sys.stderr)
        sys.exit(1)
    version = sys.argv[1]

    conf = json.loads(TAURI_CONF.read_text())
    conf["version"] = version
    TAURI_CONF.write_text(json.dumps(conf, indent=2) + "\n")

    text = CARGO_TOML.read_text()
    text, n = re.subn(
        r'^version\s*=\s*"\d+\.\d+\.\d+"', f'version = "{version}"', text, count=1, flags=re.MULTILINE
    )
    if n != 1:
        print(f"Could not find version line in {CARGO_TOML}", file=sys.stderr)
        sys.exit(1)
    CARGO_TOML.write_text(text)

    print(f"Synced version to {version}")


if __name__ == "__main__":
    main()
