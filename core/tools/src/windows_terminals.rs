// Stub for Linux-only build

pub struct WindowsTerminal {
    pub names: &'static [&'static str],
    pub in_directory: &'static [&'static str],
    pub then_run: Option<&'static [&'static str]>,
    pub source: &'static str,
}

pub const WINDOWS_TERMINALS: &[WindowsTerminal] = &[];

pub fn argv(_terminal: &str, _dir: &str, _command: &[&str]) -> Option<Vec<String>> {
    None
}

pub fn entry(_name: &str) -> Option<&'static WindowsTerminal> {
    None
}
