//! System dark/light following for the Look theme.
//!
//! WebKitGTK does not deliver `prefers-color-scheme` change events on this
//! stack (verified: flipping the portal setting produced no matchMedia
//! event, window visible or not), so the backend watches the source of
//! truth directly: the xdg-desktop-portal Settings
//! `org.freedesktop.appearance color-scheme` (`SettingChanged` signal).
//! 0 = no preference, 1 = prefer dark, 2 = prefer light.
//!
//! Push-only: the frontend resolves the boot theme itself (a static
//! matchMedia read works) and applies changes only while no explicit
//! ui_theme is stored. Emits `os-theme-changed` with `{ light: bool }`.
//! No session bus, no portal: the watcher exits quietly and the theme stays
//! however boot left it.

use futures_util::StreamExt;

const PORTAL_BUS: &str = "org.freedesktop.portal.Desktop";
const PORTAL_PATH: &str = "/org/freedesktop/portal/desktop";
const PORTAL_IFACE: &str = "org.freedesktop.portal.Settings";
const APPEARANCE_NAMESPACE: &str = "org.freedesktop.appearance";
const COLOR_SCHEME_KEY: &str = "color-scheme";

/// Portal color-scheme value meaning explicit "prefer light".
const COLOR_SCHEME_PREFER_LIGHT: u32 = 2;

/// Portal color-scheme 0 ('default') is the light choice on this desktop:
/// the OS toggle flips prefer-dark <-> default without touching gtk-theme
/// (verified: gtk-theme stays 'Adwaita-dark' either way), and libadwaita
/// apps render 'default' with the light stylesheet. So 0 and 2 are light,
/// 1 is dark, unknown values resolve dark (the app default).
fn is_light_scheme(scheme: u32) -> bool {
    matches!(scheme, 0 | COLOR_SCHEME_PREFER_LIGHT)
}

fn emit(app: &tauri::AppHandle, light: bool) {
    use tauri::Emitter;
    eprintln!("[look:os-theme] changed light={light}");
    let _ = app.emit(
        crate::consts::EVENT_OS_THEME_CHANGED,
        serde_json::json!({ "light": light }),
    );
}

async fn watch_loop(app: tauri::AppHandle) {
    let Ok(conn) = zbus::Connection::session().await else {
        return;
    };
    let Ok(settings) = zbus::Proxy::new(&conn, PORTAL_BUS, PORTAL_PATH, PORTAL_IFACE).await else {
        return;
    };
    let Ok(mut changes) = settings.receive_signal("SettingChanged").await else {
        return;
    };
    // Same-value writes still notify (dconf notifies per write), and the
    // portal may repeat a change, so emit only on transitions. Otherwise a
    // chatty desktop spams identical applies (observed: 16 lines/one flip).
    let mut last: Option<bool> = None;
    while let Some(msg) = changes.next().await {
        let Ok((namespace, key, value)) = msg
            .body()
            .deserialize::<(String, String, zbus::zvariant::OwnedValue)>()
        else {
            continue;
        };
        if namespace != APPEARANCE_NAMESPACE || key != COLOR_SCHEME_KEY {
            continue;
        }
        let value = zbus::zvariant::Value::from(value);
        let scheme = match value {
            zbus::zvariant::Value::U32(v) => v,
            _ => continue,
        };
        let light = is_light_scheme(scheme);
        if last == Some(light) {
            continue;
        }
        last = Some(light);
        emit(&app, light);
    }
}

/// Spawn the portal watcher; quiet no-ops when D-Bus or the portal is
/// absent, mirroring `wallpaper::start_watcher`.
pub fn start_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let Ok(rt) = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        else {
            return;
        };
        rt.block_on(watch_loop(app));
    });
}

#[cfg(test)]
mod tests {
    use super::is_light_scheme;

    #[test]
    fn default_resolves_light() {
        assert!(is_light_scheme(0));
    }

    #[test]
    fn prefer_dark_resolves_dark() {
        assert!(!is_light_scheme(1));
    }

    #[test]
    fn prefer_light_resolves_light() {
        assert!(is_light_scheme(2));
    }

    #[test]
    fn unknown_value_resolves_dark() {
        assert!(!is_light_scheme(99));
    }
}
