#!/usr/bin/env bash
# Niri-Search installer for Arch Linux and CachyOS.
#
# One-liner:
#   curl -fsSL https://raw.githubusercontent.com/Lunga93/Niri-search/main/scripts/linux/install-niri-search.sh | bash
#
# No binary packages are published. The installer clones the release tag,
# builds with `cargo tauri build --no-bundle`, and installs user-locally
# under ~/.local. Only the pacman build dependencies need root.
# Optionally wires the Niri keybinds (opt-in --configure-niri).
set -euo pipefail

REPO="${NIRI_SEARCH_REPO:-Lunga93/Niri-search}"
VERSION="${NIRI_SEARCH_VERSION:-}"
UNINSTALL=false
CONFIGURE_NIRI=false
DRY_RUN=false
# Binary and D-Bus names are code identifiers (unchanged by the rebrand).
BIN_NAME="lookapp"
DBUS_DEST="com.look.Desktop"
DBUS_PATH="/com/look/Desktop"
PREFIX="${HOME}/.local"

usage() {
  cat <<EOF
Usage: install-niri-search.sh [OPTIONS]

Options:
  --version <x.y.z>   Install a specific version (default: latest v* tag)
  --repo <owner/repo> GitHub repository (default: ${REPO})
  --configure-niri    Append spawn-at-startup, Alt+Space bind and window
                      rule to ~/.config/niri/config.kdl (backs it up first)
  --uninstall         Remove Niri-Search (user-local files under ~/.local)
  --dry-run           Show what would happen without doing it
  -h, --help          Show this help

Environment:
  NIRI_SEARCH_REPO     Same as --repo
  NIRI_SEARCH_VERSION  Same as --version
EOF
}

log()  { echo "==> $*"; }
dry()  { if [[ "$DRY_RUN" == true ]]; then echo "    [dry-run] $*"; else "$@"; fi; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required tool: $1" >&2; exit 1; }; }

resolve_latest_version() {
  # Latest v* tag, straight from git. No GitHub Release object needed
  # (and no API rate limits to hit).
  git ls-remote --tags --sort='-v:refname' "https://github.com/${REPO}.git" 2>/dev/null \
    | grep -v '\^{}' \
    | grep -oE 'refs/tags/v[0-9][0-9A-Za-z._-]*$' \
    | head -1 \
    | sed 's#.*/v##'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)           REPO="$2"; shift 2 ;;
    --version)        VERSION="$2"; shift 2 ;;
    --configure-niri) CONFIGURE_NIRI=true; shift ;;
    --uninstall)      UNINSTALL=true; shift ;;
    --dry-run)        DRY_RUN=true; shift ;;
    -h|--help)        usage; exit 0 ;;
    *)                echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer is for Linux only." >&2
  exit 1
fi
# Accept both "0.2.0" and "v0.2.0": tags, clone branch and messages use v${VERSION}.
VERSION="${VERSION#v}"
need git

# --- Distro gate: Arch Linux and CachyOS (both pacman-based) ---
# shellcheck disable=SC1091
source /etc/os-release 2>/dev/null || { echo "Cannot detect distro (/etc/os-release missing)." >&2; exit 1; }
DISTRO_ID="${ID:-unknown}"
DISTRO_LIKE="${ID_LIKE:-}"
if [[ "$DISTRO_ID" != "arch" && "$DISTRO_ID" != "cachyos" && "$DISTRO_LIKE" != *"arch"* ]]; then
  echo "Niri-Search supports Arch Linux and CachyOS only (found '${DISTRO_ID}')." >&2
  echo "Other distros: build from source, see apps/linows/BUILDING.md" >&2
  exit 1
fi

# --- Uninstall (user-local files only) ---
do_uninstall() {
  log "Removing Niri-Search..."
  removed=false
  for f in "${PREFIX}/bin/${BIN_NAME}" \
           "${PREFIX}/share/applications/Niri-Search.desktop" \
           "${PREFIX}/share/icons/hicolor/128x128/apps/${BIN_NAME}.png" \
           "${PREFIX}/share/icons/hicolor/256x256/apps/${BIN_NAME}.png" \
           "${PREFIX}/share/icons/hicolor/512x512/apps/${BIN_NAME}.png"; do
    if [[ -e "$f" ]]; then dry rm -f "$f"; removed=true; fi
  done
  if [[ "$removed" == false ]]; then echo "No user-local Niri-Search files found."; fi
  echo ""
  echo "Local state is kept. To remove it as well (config, index, history):"
  echo "  rm -rf ~/.look"
  echo "To remove the Niri stanza this installer may have added:"
  echo "  delete the block between '# >>> niri-search >>>' markers in ~/.config/niri/config.kdl"
}

if [[ "$UNINSTALL" == true ]]; then do_uninstall; exit 0; fi

# --- Resolve version ---
if [[ -z "$VERSION" ]]; then
  VERSION="$(resolve_latest_version || true)"
  if [[ -z "$VERSION" ]]; then
    echo "Unable to resolve the latest version tag from GitHub." >&2
    echo "Set NIRI_SEARCH_VERSION or pass --version <x.y.z>." >&2
    exit 1
  fi
fi

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# --- Build from source ---
# Deps mirror apps/linows/BUILDING.md ("Arch Linux"). The build itself is a
# plain `cargo tauri build --no-bundle`; install is user-local (~/.local).
ARCH_DEPS=(base-devel rustup webkit2gtk-4.1 gtk3 libsoup3 glib2 cairo pango
  gdk-pixbuf2 harfbuzz dbus alsa-lib librsvg openssl pkg-config)

install_from_source() {
  need pacman
  log "Installing build dependencies (pacman, needs root)..."
  dry sudo pacman -S --needed --noconfirm "${ARCH_DEPS[@]}"
  export PATH="$HOME/.cargo/bin:$PATH"
  if ! command -v cargo >/dev/null 2>&1; then
    log "Activating the stable Rust toolchain..."
    dry rustup default stable
    need cargo
  fi
  if ! cargo tauri --version >/dev/null 2>&1; then
    log "Installing tauri-cli v2..."
    dry cargo install tauri-cli --version '^2' --locked
  fi
  local src="${TMP_DIR}/niri-search"
  log "Cloning tag v${VERSION}..."
  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] git clone --depth 1 --branch v${VERSION} https://github.com/${REPO}.git"
  else
    git clone --depth 1 --branch "v${VERSION}" "https://github.com/${REPO}.git" "$src" || {
      echo "No tag 'v${VERSION}' in ${REPO}. Pass --version <x.y.z> with an existing tag." >&2
      exit 1
    }
  fi
  log "Building release binary (no bundle; takes a few minutes)..."
  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] (cd <clone>/apps/linows && cargo tauri build --no-bundle)"
  else
    (cd "${src}/apps/linows" && cargo tauri build --no-bundle)
  fi
  log "Installing user-locally under ${PREFIX} (no root needed)..."
  dry mkdir -p "${PREFIX}/bin" "${PREFIX}/share/applications" \
    "${PREFIX}/share/icons/hicolor/128x128/apps" \
    "${PREFIX}/share/icons/hicolor/256x256/apps" \
    "${PREFIX}/share/icons/hicolor/512x512/apps"
  # cp straight onto the target fails with "Text file busy" while an old
  # instance of the launcher is still running (its binary IS that file).
  # Copy to a sibling temp path, then rename: rename() is atomic and
  # replaces the running executable without error; the live process keeps
  # the old inode and the next launch picks up the new binary.
  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] install ${BIN_NAME} via temp file + rename (atomic over a running instance)"
  else
    cp "${src}/apps/linows/src-tauri/target/release/${BIN_NAME}" "${PREFIX}/bin/${BIN_NAME}.new"
    mv -f "${PREFIX}/bin/${BIN_NAME}.new" "${PREFIX}/bin/${BIN_NAME}"
  fi
  dry cp "${src}/apps/linows/src-tauri/icons/128x128.png" \
    "${PREFIX}/share/icons/hicolor/128x128/apps/${BIN_NAME}.png"
  dry cp "${src}/apps/linows/src-tauri/icons/128x128@2x.png" \
    "${PREFIX}/share/icons/hicolor/256x256/apps/${BIN_NAME}.png"
  dry cp "${src}/apps/linows/src-tauri/icons/icon.png" \
    "${PREFIX}/share/icons/hicolor/512x512/apps/${BIN_NAME}.png"
  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] write ${PREFIX}/share/applications/Niri-Search.desktop"
  else
    cat > "${PREFIX}/share/applications/Niri-Search.desktop" <<EOF
[Desktop Entry]
Categories=Utility;
Comment=Keyboard-first launcher for the Niri compositor
Exec=${BIN_NAME}
StartupWMClass=${BIN_NAME}
Icon=${BIN_NAME}
Name=Niri-Search
Terminal=false
Type=Application
EOF
  fi
  if [[ "$DRY_RUN" != true ]] && pgrep -x "${BIN_NAME}" >/dev/null 2>&1; then
    echo "Note: an older Niri-Search instance is still running. Its binary"
    echo "      just changed, so quit it before launching again:"
    echo "        pkill -x ${BIN_NAME}"
    echo "      The new build adds a global Alt+Shift+Q quit bind (niri)."
  fi
  log "Make sure ${PREFIX}/bin is on your PATH."
}

install_from_source

# --- Optional Niri wiring ---
# All niri integration lives in $NIRI_DIR/niri-search.kdl. niri merges
# binds/ spawn-at-startup/ window-rule from included files, so config.kdl
# only needs a single `include` line. This is robust against rewrites of
# config.kdl (e.g. niri-settings) and avoids the invalid duplicate
# top-level `binds` an older installer appended as an inline stanza.
NIRI_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/niri"
NIRI_INCLUDE_FILE="$NIRI_DIR/niri-search.kdl"

# Strip any lookapp wiring an older installer left inline in config.kdl.
# niri-search.kdl now provides spawn-at-startup + binds + window-rule, so
# leftovers in config.kdl would duplicate them. Safe for unrelated
# window-rule blocks (they are kept unless they match lookapp).
strip_legacy_inline() {
  awk '
    /spawn-at-startup "lookapp"/ { next }
    # pre-existing manual Alt+Space toggle for the launcher: niri-search.kdl
    # now provides it via include; keeping both would double-toggle.
    /Alt\+Space/ && /com\.look\.Desktop\.Toggle/ { next }
    /Look launcher autostart is owned by install-niri-search.sh/ { next }
    /niri-search >>>/ { in_marker=1; next }
    in_marker {
      if ($0 ~ /niri-search <<</) in_marker=0
      next
    }
    /^window-rule[[:space:]]*\{/ {
      wbuf = $0 "\n"
      wopen = 1
      next
    }
    wopen {
      wbuf = wbuf $0 "\n"
      if ($0 ~ /^[[:space:]]*\}/) {
        if (wbuf !~ /app-id="\^lookapp\$"/) printf "%s", wbuf
        wopen = 0; wbuf = ""
      }
      next
    }
    { print }
  ' "$1"
}

configure_niri() {
  local cfg="${NIRI_DIR}/config.kdl"
  if [[ ! -f "$cfg" ]]; then echo "No Niri config at ${cfg}; skipping Niri setup." >&2; return 0; fi

  # 1. Write the standalone integration file (niri merges its binds).
  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] write ${NIRI_INCLUDE_FILE}"
  else
    cat <<KDL > "${NIRI_INCLUDE_FILE}"
// Niri-Search integration (managed by install-niri-search.sh; safe to delete)
// Regenerate with: install-niri-search.sh --configure-niri
// The binary is ${BIN_NAME} and the D-Bus interface is ${DBUS_DEST}

spawn-at-startup "${BIN_NAME}"

binds {
    Alt+Space allow-inhibiting=false hotkey-overlay-title="Niri-Search" { spawn "gdbus" "call" "--session" "--dest" "${DBUS_DEST}" "--object-path" "${DBUS_PATH}" "--method" "${DBUS_DEST}.Toggle"; }
    Alt+Shift+Q allow-inhibiting=false { spawn "gdbus" "call" "--session" "--dest" "${DBUS_DEST}" "--object-path" "${DBUS_PATH}" "--method" "${DBUS_DEST}.Quit"; }
}

window-rule {
    match app-id="^${BIN_NAME}\$"
    open-floating true
    focus-ring { off; }
    shadow { off; }
}
KDL
    log "Wrote ${NIRI_INCLUDE_FILE}"
  fi

  # 2. Remove legacy inline lookapp wiring from config.kdl.
  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] strip legacy inline lookapp stanza from ${cfg}"
  else
    strip_legacy_inline "$cfg" > "${cfg}.tmp" && mv -f "${cfg}.tmp" "$cfg"
  fi

  # 3. Add the include line if absent. Absolute path: niri does not expand '~'.
  if [[ "$DRY_RUN" == true ]]; then
    echo "    [dry-run] add include of ${NIRI_INCLUDE_FILE} to ${cfg}"
  elif ! grep -q 'include .*niri-search.kdl' "$cfg" 2>/dev/null; then
    cp "$cfg" "${cfg}.bak"
    printf '\n// >>> niri-search: managed by install-niri-search.sh (safe to delete)\ninclude "%s";\n// <<< niri-search\n' "${NIRI_INCLUDE_FILE}" >> "$cfg"
    log "Added include of ${NIRI_INCLUDE_FILE} to ${cfg} (backup: ${cfg}.bak)"
  else
    log "Niri include already present in ${cfg}."
  fi

  if command -v niri >/dev/null 2>&1 && niri validate -c "$cfg" >/dev/null 2>&1; then
    log "Niri config valid."
  else
    log "Run 'niri validate' to check your Niri config."
  fi
}

if [[ "$CONFIGURE_NIRI" == true ]]; then configure_niri; fi

# --- Done ---
cat <<EOF

Niri-Search v${VERSION} installed!

Launch:
  ${BIN_NAME}            # from a terminal (starts the background service)
  Alt+Space              # global toggle (after first launch)
EOF
if [[ "$CONFIGURE_NIRI" == true ]]; then
  echo "  (Niri wired: niri-search.kdl include'd from ${NIRI_DIR}/config.kdl)"
else
  cat <<EOF

Niri is not wired yet. Either re-run with --configure-niri, or do it by
hand: save niri-search.kdl to ~/.config/niri/ and add this line to
~/.config/niri/config.kdl:

  include "$(printf '%s' "${NIRI_INCLUDE_FILE}")";

The file manages: spawn-at-startup, Alt+Space toggle (D-Bus), Alt+Shift+Q
quit (D-Bus), and floating window rule.
EOF
fi
cat <<EOF

To uninstall:
  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/linux/install-niri-search.sh | bash -s -- --uninstall
EOF
