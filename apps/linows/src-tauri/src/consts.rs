// Shared constants used across multiple modules.

pub const MAIN_WINDOW: &str = "main";
pub const EVENT_INDEX_READY: &str = "index-ready";
/// Emitted right before the launcher window hides, so the frontend can pin the
/// launchpad to its entrance-start pose while the webview can still paint. Keeps
/// the next summon from flashing the fully-visible strip then rewinding it (see
/// superactions.armEntrance). Paired with the show-side `window-shown`.
pub const EVENT_WINDOW_HIDDEN: &str = "window-hidden";
/// Emitted when the wallpaper state file changes (and after a re-sample):
/// the screen-behind snapshot the frost displacement warps and the
/// luminance the tile scrim adapts to. Payload: { luminance: f32, image:
/// string|null }.
pub const EVENT_WALLPAPER_CHANGED: &str = "wallpaper-changed";
/// Emitted when the xdg-desktop-portal appearance color-scheme changes:
/// the OS dark/light toggle. WebKitGTK does not deliver matchMedia change
/// events for it, so the backend watches the portal directly (see
/// platform::linux::os_theme). Payload: { light: bool }. The frontend
/// applies it only while no explicit ui_theme is stored.
pub const EVENT_OS_THEME_CHANGED: &str = "os-theme-changed";

/// Delay between starting something and trying to focus the window it opened -
/// long enough for the app to have received the input and drawn. Used by the
/// file/URL open path and by the preferred-tools launcher on both platforms.
pub const HANDLER_FOCUS_DELAY_MS: u64 = 150;
