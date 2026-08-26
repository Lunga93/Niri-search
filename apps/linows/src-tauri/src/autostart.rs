//! Cross-platform autostart Tauri commands. Real per-OS implementations live in
//! `platform::linux::autostart`.

#[tauri::command]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    crate::platform::linux::autostart::set(enabled)
}

#[tauri::command]
pub fn get_autostart() -> bool {
    crate::platform::linux::autostart::get()
}
