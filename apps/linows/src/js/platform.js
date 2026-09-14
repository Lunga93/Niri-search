import { getPlatform, setWindowEffect, wallpaperSnapshot, onWallpaperChanged, onWindowShown, onOsThemeChanged as onOsThemeChangedEvent } from './ipc.js';

let info = null;

export async function init() {
    try {
        info = await getPlatform();
    } catch {
        info = { os: 'linux', has_compositor: false, compositor: null };
    }
    document.documentElement.setAttribute('data-os', info.os);
    if (info.compositor) {
        document.documentElement.setAttribute('data-compositor', info.compositor);
    }
    // Mirror of apply_transparency (main.rs) with the same has_compositor
    // semantics: the Rust eval runs once at setup, so a page reload (dev hot
    // reload) would otherwise lose the attribute and square the corners.
    document.documentElement.setAttribute('data-transparent', String(hasCompositor()));
    // Virtual GPU (VM): hardware acceleration is already off backend-side, but
    // software compositing still ghost-renders backdrop-filter layers. Force
    // the blur fallback without touching the user's config.
    if (blurForcedOff()) {
        document.documentElement.setAttribute('data-disable-blur', '');
    }
    if (compositorBlur()) {
        document.documentElement.setAttribute('data-blur', 'compositor');
    }
    initWallpaperSnapshot();
}

// True when the compositor grants behind-window blur on request. A capability,
// not a setting: it only says whether Blur Opacity has real frost to act on.
export function compositorBlur() {
    return info?.compositor_blur ?? false;
}

// System dark/light following. WebKitGTK feeds prefers-color-scheme from the
// desktop portal (org.freedesktop.appearance color-scheme), so no backend is
// needed: matchMedia tracks the same toggle the rest of the desktop follows.
// Pure signal — settings.js owns the policy (follow only with no explicit
// ui_theme; any pick or nudge pins the theme and stops following).
const osLightMedia =
    typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: light)')
        : null;

export function osThemeIsLight() {
    return !!osLightMedia?.matches;
}

export function onOsThemeChanged(callback) {
    // Backend portal watcher (primary on Linux): payload { light }.
    // Double-apply is harmless (same value, idempotent preset apply).
    const maybeUnlisten = onOsThemeChangedEvent((event) => {
        const payload = event?.payload;
        const light = typeof payload === 'boolean' ? payload : !!payload?.light;
        callback(light);
    });
    if (maybeUnlisten && typeof maybeUnlisten.then === 'function') {
        maybeUnlisten.catch(() => {});
    }
    // matchMedia backup for environments where WebKit tracks GTK directly.
    osLightMedia?.addEventListener?.('change', (e) => callback(!!e.matches));
}

// True when the blur fallback is forced by the platform (VM GPU) rather than
// the arch_disable_blur config toggle. Settings must not remove the
// attribute in this case.
export function blurForcedOff() {
    return info?.virtual_gpu ?? false;
}

// The floating inner-gap layout depends on see-through gaps and frosted
// tiles, so it needs WebKitGTK to composite translucency faithfully. That
// rules out the same environments applytint() degrades on: no compositor
// (bare X11/i3 - "transparent" pixels come out opaque, gaps read as empty
// boxes), the VM software-rendering fallback, and the ghost-rendering
// stacks where blur is dropped (Hyprland auto, Arch toggle). Those render
// the classic framed panel regardless of the inner_gap setting; the config
// value stays untouched and applies again on a capable setup.
export function floatingSupported() {
    return (
        hasCompositor() &&
        !blurForcedOff() &&
        compositor() !== 'hyprland' &&
        !document.documentElement.hasAttribute('data-disable-blur')
    );
}

export function os() {
    return info?.os || 'linux';
}

export function hasCompositor() {
    return info?.has_compositor ?? false;
}

export function compositor() {
    return info?.compositor || null;
}

export function isWindows() {
    return info?.os === 'windows';
}

export function isLinux() {
    return info?.os === 'linux';
}

// Read live off the query list so an OS toggle mid-session takes effect.
// Windows is excluded to match the CSS: its reduce-motion flag tracks the
// "best performance" visual-effects preset, not motion sensitivity.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function prefersReducedMotion() {
    return reduceMotion.matches && !isWindows();
}

// For surfaces that have to act on the switch rather than read it per frame.
export function onReducedMotionChange(callback) {
    reduceMotion.addEventListener('change', callback);
}

// Ctrl+Shift+Enter target: exes and look-cmd:// applets. ms-settings: pages
// have no elevated form, so neither gesture nor hint is offered for them.
export function canRunElevated(item) {
    return isWindows() && item?.kind === 'app' && !item.path?.startsWith('ms-settings:');
}

// The name of the platform's own file manager, for a Reveal entry that has no
// declared `file_manager` to name. Null on Linux: the desktop's handler has no
// one name every distro agrees on, so the entry keeps its plain wording.
export function systemFileManager() {
    return isWindows() ? 'Explorer' : null;
}

// Windows calls it the Recycle Bin; Linux/macOS call it the Trash. Used for
// user-facing strings so the banner/confirm copy matches the OS.
export function trashLabel() {
    return isWindows() ? 'Recycle Bin' : 'Trash';
}

// Windows blur styles map to CSS backdrop-filter radii. We deliberately do
// NOT use native Mica/Acrylic via tauri's `set_effects` - that path
// reconfigures DWM and brings back the sharp rectangular outline outside
// the CSS-clipped rounded silhouette (DWM can't round transparent windows).
// CSS backdrop-filter is supported in WebView2 and respects our border-radius.
const WINDOWS_BLUR_RADIUS = {
    high_contrast: 30,
    balanced: 20,
    soft: 12,
};

/**
 * Apply blur effect based on platform.
 * - Windows: CSS backdrop-filter, strength chosen by Blur Style preset
 * - Linux + compositor: CSS backdrop-filter, strength from `radius` arg
 * - Linux bare (i3): no blur, tint-only
 */
export function applyBlur(radius, style) {
    const r = isWindows()
        ? (WINDOWS_BLUR_RADIUS[style] ?? WINDOWS_BLUR_RADIUS.balanced)
        : hasCompositor()
          ? Math.round(radius)
          : 0;
    document.documentElement.style.setProperty('--blur-radius', r + 'px');
}

/**
 * Get available blur style options for the current platform.
 */
export function getBlurStyles() {
    if (isWindows()) {
        return [
            { value: 'high_contrast', label: 'Mica', hint: 'Windows 11 native blur' },
            { value: 'balanced', label: 'Acrylic', hint: 'Translucent with blur' },
            { value: 'soft', label: 'Acrylic (Soft)', hint: 'Lightest acrylic' },
        ];
    }
    return [
        { value: 'high_contrast', label: 'High Contrast', hint: 'Darkest and most readable' },
        { value: 'balanced', label: 'Balanced', hint: 'Default translucency' },
        { value: 'soft', label: 'Soft', hint: 'Lightest, most transparent' },
    ];
}

// Frost branch: dark glass gets heavy grain + strong displacement, light
// glass gets the clear Apple-style bend. Kindle is the only light preset;
// anything else (including custom) reads dark.
export function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') !== 'kindle';
}

// Publish the branch frost.css keys off. Called from settings'
// applyThemePreset on every theme application (switch, reset, restore), so
// the attribute is always in step with data-theme.
export function applyFrostTheme() {
    document.documentElement.setAttribute('data-theme-dark', String(isDarkTheme()));
}

// Screen-behind snapshot for the adaptive frost. The grim capture feeds
// --screen-capture (the displacement's pixels: user --bg-image wins when
// set), the luminance feeds data-wallpaper-lum (the scrim's strength).
// Re-sampled on every summon: apps open and close behind the window, so a
// startup-only snapshot goes stale within a session.
function applyWallpaperSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    const root = document.documentElement;
    if (typeof snapshot.luminance === 'number') {
        root.setAttribute('data-wallpaper-lum', String(snapshot.luminance));
    }
    if (typeof snapshot.image === 'string' && snapshot.image) {
        root.style.setProperty('--screen-capture', `url("${snapshot.image}")`);
    }
}

export async function refreshWallpaperSnapshot() {
    try {
        applyWallpaperSnapshot(await wallpaperSnapshot());
    } catch {
        // grim missing, capture failed: static tint already covers this.
    }
}

function initWallpaperSnapshot() {
    refreshWallpaperSnapshot();
    try {
        const maybeUnlisten = onWallpaperChanged((event) => {
            applyWallpaperSnapshot(event?.payload);
        });
        if (maybeUnlisten && typeof maybeUnlisten.then === 'function') {
            maybeUnlisten.catch(() => {});
        }
        const maybeShow = onWindowShown(() => {
            refreshWallpaperSnapshot();
        });
        if (maybeShow && typeof maybeShow.then === 'function') {
            maybeShow.catch(() => {});
        }
    } catch {
        // Event bridge unavailable (unit tests, static preview).
    }
}
