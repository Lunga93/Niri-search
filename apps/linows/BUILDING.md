# Building & Packaging: linows

Build instructions for the Niri-Search desktop app (Linux via Tauri v2).

## Architecture support

**Released builds target x86_64 (x64) only** on Linux.

- ARM64 builds aren't shipped. Linux on ARM is rarely a desktop target.
- If you have a real ARM machine and want native builds, please open an issue; the project will add an ARM track when there's demand.

---

## Prerequisites

- **Rust** stable toolchain (`rustup`)
- **cargo-tauri** CLI (`cargo install tauri-cli --version "^2" --locked`)
- System libraries (see per-distro sections below)

---

## Build from Source (Development)

### Ubuntu / Debian

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev \
  libglib2.0-dev libcairo2-dev libpango1.0-dev \
  libgdk-pixbuf-2.0-dev libharfbuzz-dev libdbus-1-dev \
  libasound2-dev librsvg2-dev libssl-dev \
  libappindicator3-dev pkg-config

cd apps/linows
cargo tauri dev
```

### Arch Linux

```bash
sudo pacman -S --needed \
  base-devel rustup \
  webkit2gtk-4.1 gtk3 libsoup3 glib2 cairo pango \
  gdk-pixbuf2 harfbuzz dbus alsa-lib librsvg openssl pkg-config

rustup default stable
cargo install tauri-cli --version "^2" --locked

cd apps/linows
cargo tauri dev
```

> `base-devel` provides `gcc` / `cc`, without it the Rust build fails with `error: linker 'cc' not found` on a fresh Arch install.

### NixOS

```bash
nix develop --accept-flake-config ./apps/linows/
cargo tauri dev
```

The `flake.nix` provides all dependencies automatically. Pass `--accept-flake-config` to trust the Cachix substituter, or add `trusted-substituters = https://look.cachix.org` to your `~/.config/nix/nix.conf` to avoid the prompt.

For i3/X11 without compositor:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 cargo tauri dev
```

### Home Manager

The flake exports a Home Manager module for declarative user configuration. Add
the input and make sure `inputs` reaches your modules, since Home Manager does
not pass it by default:

```nix
# flake.nix
{
  inputs.look.url = "github:Lunga93/Niri-search?dir=apps/linows";

  outputs = { nixpkgs, home-manager, ... }@inputs: {
    homeConfigurations."me" = home-manager.lib.homeManagerConfiguration {
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      extraSpecialArgs = { inherit inputs; };   # required for the import below
      modules = [ ./home.nix ];
    };
  };
}
```

Home Manager as a NixOS module wants `home-manager.extraSpecialArgs = { inherit
inputs; };` instead. Then:

```nix
# home.nix
{ inputs, ... }: {
  imports = [ inputs.look.homeModules.default ];

  programs.lookapp = {
    enable = true;
    theme = "kindle";
    settings = {
      running_apps_placement = "right";
      file_scan_extra_roots = [ "~/Projects" "/mnt/data" ];
      ai_enabled = false;
    };
    aliases = {
      note = [ "Obsidian" "Logseq" ];
      term = [ "Alacritty" "Kitty" ];
    };
  };
}
```

`package` defaults to the flake's own build, so nothing else needs wiring. Set
it to `null` to manage only the config file, for example when the package is
already installed system-wide through `environment.systemPackages` or
`nixosModules.default`.

**Binary cache.** The module deliberately does not touch substituters. Those are
read by the nix daemon, and Home Manager's `nix.settings` only writes
`~/.config/nix/nix.conf`, which the daemon ignores unless you are listed in
`trusted-users`. A flake's own `nixConfig` also applies only when that flake is
the one being built, never when it is an input, so this repo's `nixConfig` does
nothing for you. Put the cache in the flake you actually build:

```nix
# your own flake.nix, top level
nixConfig = {
  extra-substituters = [ "https://look.cachix.org" ];
  extra-trusted-public-keys = [ "look.cachix.org-1:8elPCeSVBzlDZXqIRKBK9GyLIK/Hoe1xiWZF0ir7uX4=" ];
};
```

Nix asks once whether to trust those settings, or pass `--accept-flake-config`.
On NixOS the system-wide equivalent is `programs.lookapp.cachix = true` from
`nixosModules.default`. Elsewhere, `cachix use look` or `/etc/nix/nix.conf`.
Without one of these, Home Manager will build Niri-Search from source.

`theme` accepts `catppuccin` (the default), `tokyo-night`, `rose-pine`,
`gruvbox`, `dracula`, `kanagawa`, `kindle`, `liquid` and `custom`. Colours are
derived from the preset at startup, so the module only writes `ui_theme`, plus
the opacity values for `kindle` and `liquid` because those two own them. Use
`custom` to drive every `ui_*` value from `settings` instead.

`settings` keys map directly to `~/.look/config` keys and override values
derived from `theme`. Lists are written as comma-separated values, except
`ignored_patterns_*` and `alias_*`, which Niri-Search parses as pipe-separated.
`aliases` is the same thing with the prefix filled in, so declaring
`aliases.note` and `settings.alias_note` together is an error.

Activation merges the managed keys into `~/.look/config` rather than replacing
it: keys you set in Nix win, anything you changed in-app is kept, and keys you
remove from the Nix config are cleaned up on the next rebuild. The file stays
writable so the app can keep saving to it, but Nix wins again on every
activation, so treat Nix as the source of truth for the keys it manages. The
first activation copies the pre-Nix file to `<config>.hm-backup`.

Upgrading from a Niri-Search that kept its config at `~/.look.config`: activation
merges into whichever file Niri-Search reads, the old one until Niri-Search copies it into
`~/.look/` on its next launch, which carries the managed keys across. Nothing
needs doing by hand, and the old file is left where it is.

---

## Building a Release Binary Locally

No prebuilt packages are published; release builds are made from a
source checkout. Build the optimized binary with:

```bash
cd apps/linows
cargo tauri build --no-bundle
# Output: src-tauri/target/release/lookapp
```

`cargo tauri build` (without `--no-bundle`) additionally runs the Tauri
bundler, which can produce `.deb`/`.rpm` when the host satisfies the
corresponding tooling — useful for local testing on those systems, but
not shipped anywhere.

---

## Runtime Dependencies

| Dependency         | Purpose                         |
| ------------------ | ------------------------------- |
| WebKitGTK 4.1      | WebView rendering               |
| GTK 3              | UI toolkit                      |
| libsoup 3          | HTTP (WebKitGTK dep)            |
| dbus               | System bus                      |
| ALSA (libasound)   | Audio playback (Pomodoro music) |
| xdg-desktop-portal | File picker dialogs             |

---

## Notes

- **Monorepo**: The linows app depends on `core/` crates via path. The full repo checkout is needed to build.
- **WebKitGTK version**: Tauri v2 requires the Soup3 variant (`webkitgtk-4.1`), not the older `webkitgtk-4.0`.
- **NixOS specifics**: Binary wrapping, icon paths in `XDG_DATA_DIRS`, and `wrapGAppsHook` for GTK runtime are handled by the flake.

---

## Package Manager Installation

### Arch Linux / CachyOS

**Status:** Supported, from source.

The one-liner installer clones the latest release tag, installs the
pacman build dependencies, builds with `cargo tauri build --no-bundle`,
and installs user-locally under `~/.local`:

```bash
curl -fsSL https://raw.githubusercontent.com/Lunga93/Niri-search/main/scripts/linux/install-niri-search.sh | bash
```

Add `--configure-niri` to append the Niri keybind stanza. See
`scripts/linux/install-niri-search.sh --help`.

Other distros currently have no installer path; build from source with
the instructions above.

### NixOS (flake)

**Status:** Available now.

```bash
# Run directly
nix run 'github:Lunga93/Niri-search?dir=apps/linows'

# Install to profile
nix profile install 'github:Lunga93/Niri-search?dir=apps/linows'

# Build locally
cd apps/linows
nix build .#default
./result/bin/lookapp
```

**Declarative install** (recommended):

```nix
# flake.nix
{
  inputs.look.url = "github:Lunga93/Niri-search?dir=apps/linows";

  outputs = { nixpkgs, look, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      modules = [
        look.nixosModules.default
        {
          programs.lookapp.enable = true;
          # Binary cache is enabled by default.
          # To disable: programs.lookapp.cachix = false;
        }
      ];
    };
  };
}
```

That's it: the module installs the package and configures the binary cache automatically.

**Other install methods:**

```nix
# Use the package directly
environment.systemPackages = [ inputs.look.packages.${system}.default ];

# Or use the overlay
nixpkgs.overlays = [ inputs.look.overlays.default ];
environment.systemPackages = [ pkgs.lookapp ];
```

For non-NixOS Nix users: `cachix use look` then `nix profile install`.

> **Note:** For user-level declarative installation and configuration, use the Home Manager module described above. The NixOS module is intended for system-level configuration. Contributions to add Niri-Search to [nixpkgs](https://github.com/NixOS/nixpkgs) are welcome.
