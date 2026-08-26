//! Platform-specific code.
//!
//! Cross-platform Tauri commands and types stay here. Per-OS implementations
//! live under `platform/linux/`. `platform/shared.rs` holds helpers reused
//! across platforms.

pub mod linux;

pub mod shared;

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

// --- Icon resolution (cross-platform Tauri command + cache) ---

pub struct IconCache(pub Mutex<HashMap<String, Option<String>>>);

impl IconCache {
    pub fn new() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

/// The kind the frontend asks with for an image a block or row named.
const DECLARED_ICON_KIND: &str = "declared";

#[derive(Serialize)]
pub struct IconResult {
    pub data_url: Option<String>,
}

#[tauri::command]
pub fn get_icon(
    cache: State<'_, IconCache>,
    kind: String,
    path: String,
    id: Option<String>,
) -> IconResult {
    let key = format!("{kind}:{path}");

    {
        let map = cache.0.lock().unwrap();
        if let Some(cached) = map.get(&key) {
            return IconResult {
                data_url: cached.clone(),
            };
        }
    }

    let data_url = if kind == DECLARED_ICON_KIND {
        // The named image IS the icon, so read it rather than ask the theme.
        shared::read_icon_file(&path)
    } else {
        resolve_icon(&kind, &path, id.as_deref())
    };

    {
        let mut map = cache.0.lock().unwrap();
        map.insert(key, data_url.clone());
    }

    IconResult { data_url }
}

fn resolve_icon(kind: &str, path: &str, id: Option<&str>) -> Option<String> {
    match kind {
        "app" => linux::icons::resolve_app_icon(path, id),
        "folder" => linux::icons::resolve_themed_icon("folder"),
        _ => linux::icons::resolve_file_icon(path),
    }
}

/// One blurred rectangle in window-local logical pixels. The frontend sends
/// these: only it knows which surfaces are painted (the window at inner-gap 0,
/// each tile once the panes float). Lives here, not in the Linux backend,
/// because it is a command parameter.
#[derive(serde::Deserialize, Clone, Copy)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub struct BlurRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

// --- Platform info (cross-platform Tauri command) ---

#[derive(Serialize)]
pub struct PlatformInfo {
    pub os: String,
    pub has_compositor: bool,
    /// Compositor name when known ("hyprland", "sway", "gnome", "kde", ...).
    /// Exposed to the frontend so CSS can branch on compositor-specific bugs
    /// (e.g. WebKitGTK backdrop-filter glitches on Hyprland).
    pub compositor: Option<String>,
    /// True when a virtual GPU was detected at startup (VM). Hardware
    /// acceleration is already off; the frontend must also drop backdrop
    /// blur or software compositing ghost-renders stale layers.
    pub virtual_gpu: bool,
    /// True when the compositor grants behind-window blur on request. A
    /// capability, not a setting: it only tells the frontend whether Blur
    /// Opacity has real frost to thin.
    pub compositor_blur: bool,
}

#[tauri::command]
pub fn get_platform() -> PlatformInfo {
    let os = std::env::consts::OS.to_string();
    let has_compositor = linux::transparency::has_compositor();
    let compositor = linux::wm::detect_compositor();
    let virtual_gpu = linux::gpu::virtual_gpu_detected();
    let compositor_blur = linux::blur::is_supported();

    PlatformInfo {
        os,
        has_compositor,
        compositor,
        virtual_gpu,
        compositor_blur,
    }
}

// --- Drive enumeration (no-op on Linux) ---

#[derive(Serialize)]
pub struct CandidateDrive {
    pub letter: String,
    pub root: String,
}

#[tauri::command]
pub fn list_candidate_drives() -> Vec<CandidateDrive> {
    Vec::new()
}

// --- Window effects (no-op on Linux) ---

#[tauri::command]
pub fn set_window_effect(window: tauri::Window, effect: String) -> Result<(), String> {
    let _ = (window, effect);
    Ok(())
}
