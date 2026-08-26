pub(crate) mod paths;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "linux")]
use linux as platform_impl;

pub(crate) struct SettingsCatalogEntry {
    pub(crate) title: &'static str,
    pub(crate) target: &'static str,
    pub(crate) candidate_id_suffix: &'static str,
    pub(crate) aliases: &'static str,
}

pub(crate) fn app_scan_roots() -> &'static [&'static str] {
    platform_impl::APP_SCAN_ROOTS
}

#[cfg(target_os = "linux")]
pub(crate) fn discover_linux_installed_apps(
    config: &crate::config::RuntimeConfig,
    tx: std::sync::mpsc::SyncSender<look_indexing::Candidate>,
) {
    linux::discover_installed_apps(config, tx)
}

pub(crate) fn file_scan_root_suffixes() -> &'static [&'static str] {
    platform_impl::FILE_SCAN_ROOT_SUFFIXES
}

pub(crate) fn settings_url_scheme_prefix() -> &'static str {
    platform_impl::SETTINGS_URL_SCHEME_PREFIX
}

pub(crate) fn settings_subtitle_prefix() -> &'static str {
    platform_impl::SETTINGS_SUBTITLE_PREFIX
}

pub(crate) fn settings_catalog() -> &'static [SettingsCatalogEntry] {
    platform_impl::SETTINGS_CATALOG
}

pub(crate) fn has_settings_app() -> bool {
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
    let on_gnome_de = desktop.split(':').any(|s| {
        matches!(
            s.trim(),
            "GNOME" | "Budgie" | "Cinnamon" | "Unity" | "Pantheon"
        )
    });
    if !on_gnome_de {
        return false;
    }
    use std::process::Command;
    Command::new("which")
        .arg("gnome-control-center")
        .env_remove("LD_LIBRARY_PATH")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
pub(crate) fn bluetooth_present() -> bool {
    std::fs::read_dir("/sys/class/bluetooth")
        .map(|mut entries| entries.any(|e| e.is_ok()))
        .unwrap_or(false)
}
