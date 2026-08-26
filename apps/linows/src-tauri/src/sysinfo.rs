//! Cross-platform dispatch for the /sys command. Per-OS collectors live under
//! `platform/{linux,windows}/sysinfo.rs`.

use serde::Serialize;

#[derive(Serialize)]
pub struct SysInfoEntry {
    pub label: String,
    pub value: String,
}

#[tauri::command]
pub fn get_system_info() -> Vec<Vec<SysInfoEntry>> {
    crate::platform::linux::sysinfo::collect()
}

/// Compact system uptime for the launchpad info tile, shown in place of Battery
/// on a machine with no battery. `None` when unavailable on this OS.
#[tauri::command]
pub fn system_uptime() -> Option<String> {
    crate::platform::linux::sysinfo::uptime()
}
