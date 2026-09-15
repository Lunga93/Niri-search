#!/usr/bin/env bash
# Niri-Search installer for Linux.
#
# One-liner:
#   curl -fsSL https://raw.githubusercontent.com/Lunga93/Niri-search/main/scripts/linux/install-niri-search.sh | bash
#
# Installs the .deb (Debian/Ubuntu) or .rpm (Fedora/RHEL/openSUSE) from
# GitHub Releases, fixes dependencies with the system package manager,
# and optionally wires the Niri keybinds (opt-in --configure-niri).
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

usage() {
  cat <<EOF
Usage: install-niri-search.sh [OPTIONS]

Options:
  --version <x.y.z>   Install a specific version (default: latest release)
  --repo <owner/repo> GitHub repository (default: ${REPO})
  --configure-niri    Append spawn-at-startup, Alt+Space bind and window
                      rule to ~/.config/niri/config.kdl (backs it up first)
  --uninstall         Remove Niri-Search
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
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | sed 's/.*"v\?\([^"]*\)".*/\1/'
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
if [[ "$(uname -m)" != "x86_64" ]]; then
  echo "Only x86_64 builds are published (found: $(uname -m))." >&2
  exit 1
fi
need curl

# --- Distro detection ---
# shellcheck disable=SC1091
source /etc/os-release 2>/dev/null || { echo "Cannot detect distro (/etc/os-release missing)." >&2; exit 1; }
DISTRO_ID="${ID:-unknown}"
DISTRO_LIKE="${ID_LIKE:-}"

is_like() { [[ "$DISTRO_ID" == "$1" || "$DISTRO_LIKE" == *"$1"* ]]; }

if is_like debian || is_like ubuntu; then FAMILY=debian;
elif is_like fedora || is_like rhel || is_like centos; then FAMILY=redhat;
elif [[ "$DISTRO_ID" == *"suse"* ]] || is_like suse; then FAMILY=suse;
elif is_like arch; then FAMILY=arch;
elif [[ "$DISTRO_ID" == "nixos" ]]; then FAMILY=nixos;
else FAMILY=unknown; fi

# --- Uninstall ---
do_uninstall() {
  log "Removing Niri-Search..."
  case "$FAMILY" in
    debian)
      if dpkg -s niri-search >/dev/null 2>&1; then dry sudo dpkg -r niri-search;
      elif dpkg -s "$BIN_NAME" >/dev/null 2>&1; then dry sudo dpkg -r "$BIN_NAME";
      else echo "Niri-Search is not installed via dpkg."; fi ;;
    redhat)
      if rpm -q niri-search >/dev/null 2>&1; then dry sudo dnf remove -y niri-search;
      else echo "Niri-Search is not installed via rpm."; fi ;;
    suse)
      if rpm -q niri-search >/dev/null 2>&1; then dry sudo zypper remove -y niri-search;
      else echo "Niri-Search is not installed via rpm."; fi ;;
    *) echo "Uninstall the package with your package manager (package: niri-search)." ;;
  esac
  echo ""
  echo "Local state is kept. To remove it as well (config, index, history):"
  echo "  rm -rf ~/.look"
  echo "To remove the Niri stanza this installer may have added:"
  echo "  delete the block between '# >>> niri-search >>>' markers in ~/.config/niri/config.kdl"
}

if [[ "$UNINSTALL" == true ]]; then do_uninstall; exit 0; fi

# --- NixOS: native packages only ---
if [[ "$FAMILY" == nixos ]]; then
  cat <<EOF
NixOS cannot install .deb/.rpm. Use the flake instead:

  nix run 'github:${REPO}?dir=apps/linows'

or declaratively:

  { inputs, ... }: {
    imports = [ inputs.niri-search-nix.homeModules.default ];
    programs.lookapp.enable = true;
  }

(Flake input: niri-search-nix.url = "github:${REPO}?dir=apps/linows";)
EOF
  exit 0
fi

# --- Arch: no native package published; convert the .deb ---
if [[ "$FAMILY" == arch ]]; then
  if command -v yay >/dev/null 2>&1 || command -v paru >/dev/null 2>&1; then
    echo "Trying the AUR (package: niri-search-bin)..."
    if [[ "$DRY_RUN" == true ]]; then echo "    [dry-run] yay/paru -S niri-search-bin"; exit 0; fi
    (yay -S --needed niri-search-bin || paru -S --needed niri-search-bin) && exit 0
    echo "AUR package not available, falling back to debtap..." >&2
  fi
  if ! command -v debtap >/dev/null 2>&1; then
    cat <<EOF >&2
No native Arch package is published. Options:
  1. yay -S debtap && sudo debtap -u, then re-run this installer
  2. Download the .deb from https://github.com/${REPO}/releases and convert it by hand
EOF
    exit 1
  fi
  log "Converting .deb to Arch package with debtap (debtap path continues as a .deb download below)."
  FAMILY=debian
  DEBTAP=true
fi

if [[ "$FAMILY" == unknown ]]; then
  echo "Unsupported distro '${DISTRO_ID}'. Grab a package by hand:" >&2
  echo "  https://github.com/${REPO}/releases" >&2
  exit 1
fi

# --- Resolve version ---
if [[ -z "$VERSION" ]]; then
  VERSION="$(resolve_latest_version || true)"
  if [[ -z "$VERSION" ]]; then
    echo "Unable to resolve the latest version from GitHub." >&2
    echo "Set NIRI_SEARCH_VERSION or pass --version <x.y.z>." >&2
    exit 1
  fi
fi

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

download() {
  local url="$1" out="$2"
  log "Downloading: ${url}"
  if [[ "$DRY_RUN" == true ]]; then echo "    [dry-run] curl -fL $url -o $out"; return 0; fi
  curl -fL "$url" -o "$out" || {
    echo "Download failed. Check that version '${VERSION}' exists at:" >&2
    echo "  https://github.com/${REPO}/releases" >&2
    exit 1
  }
}

install_deb() {
  need dpkg
  local name="niri-search_${VERSION}_amd64.deb"
  local path="${TMP_DIR}/${name}"
  download "https://github.com/${REPO}/releases/download/v${VERSION}/${name}" "$path"
  # Read the real Package: field instead of assuming it, so a future
  # productName change cannot desync the remove/status checks below.
  local pkg="niri-search"
  if [[ "$DRY_RUN" != true ]]; then pkg="$(dpkg-deb -f "$path" Package 2>/dev/null || echo niri-search)"; fi
  if dpkg -s "$pkg" >/dev/null 2>&1; then log "Removing previous ${pkg}..."; dry sudo dpkg -r "$pkg"; fi
  log "Installing ${name}..."
  if [[ "${DEBTAP:-false}" == true ]]; then
    dry sudo debtap -q "$path"
    log "Install the converted package, then re-run with --configure-niri for the Niri stanza."
    return 0
  fi
  dry sudo dpkg -i "$path"
  if [[ "$DRY_RUN" != true ]] && ! dpkg -s "$pkg" >/dev/null 2>&1; then
    log "Fixing missing dependencies..."
    dry sudo apt-get install -f -y
  fi
}

install_rpm() {
  local name="niri-search-${VERSION}-1.x86_64.rpm"
  local path="${TMP_DIR}/${name}"
  download "https://github.com/${REPO}/releases/download/v${VERSION}/${name}" "$path"
  log "Installing ${name} (the package manager resolves dependencies)..."
  case "$FAMILY" in
    redhat) dry sudo dnf install -y "$path" ;;
    suse)   dry sudo zypper --no-confirm install "$path" ;;
  esac
}

case "$FAMILY" in
  debian) install_deb ;;
  redhat|suse) install_rpm ;;
esac

# --- Optional Niri wiring ---
configure_niri() {
  local cfg="${XDG_CONFIG_HOME:-$HOME/.config}/niri/config.kdl"
  if [[ ! -f "$cfg" ]]; then echo "No Niri config at ${cfg}; skipping Niri setup." >&2; return 0; fi
  if grep -q 'niri-search >>>' "$cfg" 2>/dev/null || grep -q 'spawn-at-startup "lookapp"' "$cfg" 2>/dev/null; then
    log "Niri-Search stanza already present in ${cfg}."
    return 0
  fi
  local stanza
  stanza=$(cat <<EOF
# >>> niri-search >>> (added by install-niri-search.sh; safe to delete)
spawn-at-startup "${BIN_NAME}"

binds {
    Alt+Space allow-inhibiting=false hotkey-overlay-title="Niri-Search" { spawn "gdbus" "call" "--session" "--dest" "${DBUS_DEST}" "--object-path" "${DBUS_PATH}" "--method" "${DBUS_DEST}.Toggle"; }
}

window-rule {
    match app-id="^${BIN_NAME}\$"
    open-floating true
    focus-ring { off; }
    shadow { off; }
}
# <<< niri-search <<<
EOF
)
  if [[ "$DRY_RUN" == true ]]; then echo "    [dry-run] append Niri stanza to ${cfg} (backup ${cfg}.bak)"; return 0; fi
  cp "$cfg" "${cfg}.bak"
  printf '\n%s\n' "$stanza" >> "$cfg"
  if command -v niri >/dev/null 2>&1 && niri validate 2>/dev/null; then
    log "Niri config valid (backup: ${cfg}.bak)."
  else
    log "Stanza appended (backup: ${cfg}.bak). Run 'niri validate' to check it."
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
  echo "  (Niri stanza installed: spawn-at-startup, Alt+Space bind, floating rule)"
else
  cat <<EOF

Niri is not wired yet. Either re-run with --configure-niri, or add to
~/.config/niri/config.kdl by hand:

  spawn-at-startup "${BIN_NAME}"
  binds {
      Alt+Space allow-inhibiting=false { spawn "gdbus" "call" "--session" "--dest" "${DBUS_DEST}" "--object-path" "${DBUS_PATH}" "--method" "${DBUS_DEST}.Toggle"; }
  }
EOF
fi
cat <<EOF

To uninstall:
  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/linux/install-niri-search.sh | bash -s -- --uninstall
EOF
