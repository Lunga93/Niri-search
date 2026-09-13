//! Screen-behind sampling for the adaptive frost.
//!
//! CSS cannot see through the webview, so the frost displacement would have
//! nothing to warp and the tile opacity nothing to adapt to. This module
//! closes that gap with grim: a region capture of the screen behind the
//! launcher, decoded to sample brightness and handed to the frontend as a
//! data URL the existing SVG displacement filters warp.
//!
//! grim excludes layer-shell surfaces from captures, so the launcher never
//! photographs itself: no hide/show dance, no feedback loop, capture any
//! time (verified: identical bytes with the launcher shown or hidden).
//!
//! Two sources, one contract:
//!   - grim capture of the window region: the live truth (apps included),
//!     refreshed on summon and when the wallpaper state file changes.
//!   - `~/.config/current_wallpaper` decode: fallback luminance when grim is
//!     missing or the capture fails.
//!
//! Absent both: neutral 0.5 and no image. The frost degrades to static tint.

use std::sync::RwLock;
use std::sync::atomic::{AtomicU32, Ordering};

use base64::Engine;

/// Neutral luminance when nothing could be sampled.
pub(crate) const FALLBACK_LUMINANCE: f32 = 0.5;
/// grim output: small enough to base64 cheaply (~25KB), big enough for the
/// displacement filter to warp.
const CAPTURE_JPEG_QUALITY: &str = "60";
/// Pixels sampled for the average (grid step derived from image size).
const LUMINANCE_SAMPLES: u64 = 4096;
/// Watcher debounce: wallpaper tools write the state file, then the image.
const WATCH_DEBOUNCE_MS: u64 = 1000;

/// Cached snapshot shared with the frontend command.
pub struct WallpaperState {
    luminance_milli: AtomicU32,
    image: RwLock<Option<String>>,
}

impl WallpaperState {
    pub fn new() -> Self {
        Self {
            luminance_milli: AtomicU32::new((FALLBACK_LUMINANCE * 1000.0) as u32),
            image: RwLock::new(None),
        }
    }

    pub fn luminance(&self) -> f32 {
        self.luminance_milli.load(Ordering::Relaxed) as f32 / 1000.0
    }

    pub fn image(&self) -> Option<String> {
        self.image.read().ok().and_then(|guard| guard.clone())
    }

    pub fn store(&self, luminance: f32, image: Option<String>) {
        self.luminance_milli.store(
            (luminance.clamp(0.0, 1.0) * 1000.0) as u32,
            Ordering::Relaxed,
        );
        if let Ok(mut guard) = self.image.write() {
            *guard = image;
        }
    }
}

fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME").map(std::path::PathBuf::from)
}

fn wallpaper_state_path() -> Option<std::path::PathBuf> {
    home_dir().map(|home| home.join(".config").join("current_wallpaper"))
}

/// Average perceived brightness of decoded pixels, 0.0 (black) to 1.0
/// (white), sampled on a grid so a full-screen capture costs microseconds.
fn luminance_of_rgb(rgb: &image::RgbImage) -> Option<f32> {
    let total = u64::from(rgb.width()).saturating_mul(u64::from(rgb.height()));
    if total == 0 {
        return None;
    }
    let step = (total / LUMINANCE_SAMPLES).max(1);
    let mut sum = 0f64;
    let mut n = 0u64;
    for (i, px) in rgb.pixels().enumerate() {
        if i as u64 % step == 0 {
            let [r, g, b] = px.0;
            sum += 0.299 * f64::from(r) + 0.587 * f64::from(g) + 0.114 * f64::from(b);
            n += 1;
        }
    }
    if n == 0 {
        return None;
    }
    Some((sum / n as f64 / 255.0) as f32)
}

/// Luminance of encoded image bytes (whatever the image crate was compiled
/// with decoders for: JPEG from grim, JPEG/PNG wallpaper files).
fn luminance_of_bytes(bytes: &[u8]) -> Option<f32> {
    image::load_from_memory(bytes)
        .ok()
        .map(|decoded| decoded.to_rgb8())
        .as_ref()
        .and_then(luminance_of_rgb)
}

/// Luminance of the wallpaper file named by the state file, if readable.
pub fn wallpaper_file_luminance() -> Option<f32> {
    let state_path = wallpaper_state_path()?;
    let named = std::fs::read_to_string(&state_path).ok()?;
    let bytes = std::fs::read(named.trim()).ok()?;
    luminance_of_bytes(&bytes)
}

/// grim capture of a global-compositor rectangle as JPEG bytes.
fn grim_capture(x: i32, y: i32, w: u32, h: u32) -> Option<Vec<u8>> {
    if w == 0 || h == 0 {
        return None;
    }
    let geom = format!("{x},{y} {w}x{h}");
    let out = super::host_command("grim")
        .args(["-t", "jpeg", "-q", CAPTURE_JPEG_QUALITY, "-g", &geom, "-"])
        .output()
        .ok()?;
    if !out.status.success() || out.stdout.is_empty() {
        return None;
    }
    Some(out.stdout)
}

fn data_url_jpeg(bytes: &[u8]) -> String {
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:image/jpeg;base64,{b64}")
}

/// Fresh snapshot of what is behind `window`: capture, sample, encode.
/// Falls back to the wallpaper file luminance (keeping any cached image)
/// when grim is unavailable, so the scrim still adapts.
pub fn capture_behind(window: &tauri::WebviewWindow) -> (f32, Option<String>) {
    let geometry = window
        .outer_position()
        .and_then(|pos| window.outer_size().map(|size| (pos, size)));
    if let Ok((pos, size)) = geometry {
        if let Some(bytes) = grim_capture(pos.x, pos.y, size.width, size.height) {
            let luminance = luminance_of_bytes(&bytes).unwrap_or(FALLBACK_LUMINANCE);
            return (luminance, Some(data_url_jpeg(&bytes)));
        }
    }
    let luminance = wallpaper_file_luminance().unwrap_or(FALLBACK_LUMINANCE);
    (luminance, None)
}

fn refresh_and_emit(app: &tauri::AppHandle) {
    use tauri::{Emitter, Manager};
    let Some(window) = app.get_webview_window(crate::consts::MAIN_WINDOW) else {
        return;
    };
    let (luminance, image) = capture_behind(&window);
    if let Some(state) = app.try_state::<WallpaperState>() {
        state.store(luminance, image.clone());
    }
    let _ = app.emit(
        crate::consts::EVENT_WALLPAPER_CHANGED,
        serde_json::json!({ "luminance": luminance, "image": image }),
    );
}

/// Watch the wallpaper state file; on change, re-sample and tell the
/// frontend. Watches the parent dir (wallpaper tools rewrite the file rather
/// than modifying it) and filters by filename.
pub fn start_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        use notify::{RecursiveMode, Watcher};
        let Some(state_path) = wallpaper_state_path() else {
            return;
        };
        let Some(parent) = state_path.parent().map(|path| path.to_path_buf()) else {
            return;
        };
        let file_name = state_path.file_name().map(|name| name.to_owned());

        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::RecommendedWatcher::new(tx, notify::Config::default()) {
            Ok(watcher) => watcher,
            Err(_) => return,
        };
        if watcher.watch(&parent, RecursiveMode::NonRecursive).is_err() {
            return;
        }

        loop {
            // Wait until our file changes (anything else is ignored).
            let mut seen = false;
            for event in rx.iter() {
                match event {
                    Ok(event)
                        if event.paths.iter().any(|path| {
                            path.file_name()
                                .is_some_and(|name| Some(name) == file_name.as_deref())
                        }) =>
                    {
                        seen = true;
                        break;
                    }
                    Err(_) => return,
                    _ => {}
                }
            }
            if !seen {
                continue;
            }
            // Debounce: the state file lands before the image it names.
            std::thread::sleep(std::time::Duration::from_millis(WATCH_DEBOUNCE_MS));
            while rx.try_recv().is_ok() {}
            refresh_and_emit(&app);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid_rgb(r: u8, g: u8, b: u8) -> image::RgbImage {
        image::RgbImage::from_pixel(64, 64, image::Rgb([r, g, b]))
    }

    /// White samples to ~1, black to ~0.
    #[test]
    fn luminance_spans_black_to_white() {
        let white = luminance_of_rgb(&solid_rgb(255, 255, 255)).expect("white");
        let black = luminance_of_rgb(&solid_rgb(0, 0, 0)).expect("black");
        assert!((white - 1.0).abs() < 0.01, "{white}");
        assert!(black.abs() < 0.01, "{black}");
    }

    /// Mid-gray lands near 0.5 (perceived, not linear).
    #[test]
    fn luminance_of_mid_gray_is_mid() {
        let gray = luminance_of_rgb(&solid_rgb(128, 128, 128)).expect("gray");
        assert!((gray - 0.5).abs() < 0.02, "{gray}");
    }

    /// Green weighs heaviest in perceived brightness.
    #[test]
    fn luminance_weights_green_over_blue() {
        let green = luminance_of_rgb(&solid_rgb(0, 255, 0)).expect("green");
        let blue = luminance_of_rgb(&solid_rgb(0, 0, 255)).expect("blue");
        assert!(green > blue + 0.3, "{green} vs {blue}");
    }

    /// Garbage bytes decode to nothing, never panic.
    #[test]
    fn garbage_bytes_yield_none() {
        assert_eq!(luminance_of_bytes(b"not an image"), None);
        assert_eq!(luminance_of_bytes(&[]), None);
    }
}
