use globset::{Glob, GlobBuilder};
use std::borrow::Cow;
use std::path::Path;

pub(crate) fn path_is_same_or_child(path: &str, parent: &str) -> bool {
    let normalized_path = normalize_path(path);
    let normalized_parent = normalize_path(parent);
    if normalized_parent.is_empty() {
        return false;
    }

    let parent_prefix = format!("{normalized_parent}/");
    normalized_path == normalized_parent || normalized_path.starts_with(parent_prefix.as_str())
}

pub(crate) fn candidate_id_path_component(path: &str) -> String {
    normalize_path(path).to_lowercase()
}

pub(crate) fn join_path(base: &str, child: &str) -> String {
    let trimmed_base = base.trim_end_matches('/');
    let trimmed_child = child.trim_start_matches('/');

    if trimmed_base.is_empty() {
        return format!("/{trimmed_child}");
    }
    if trimmed_child.is_empty() {
        return trimmed_base.to_string();
    }

    format!("{trimmed_base}/{trimmed_child}")
}

#[allow(dead_code)]
pub(crate) fn is_valid_filename_component(name: &str) -> bool {
    !name.is_empty() && name != "." && name != ".." && !name.contains('/')
}

#[allow(dead_code)]
pub(crate) fn is_valid_directory_component(name: &str) -> bool {
    is_valid_filename_component(name)
}

pub(crate) fn looks_like_absolute_path(path: &str) -> bool {
    path.starts_with('/') || Path::new(path).is_absolute()
}

pub(crate) fn expand_with_home(value: &str, home: Option<&str>) -> String {
    if let Some(rest) = value.strip_prefix("~/") {
        return home
            .map(|prefix| join_path(prefix, rest))
            .unwrap_or_else(|| value.to_string());
    }

    if looks_like_absolute_path(value) {
        return value.to_string();
    }

    home.map(|prefix| join_path(prefix, value))
        .unwrap_or_else(|| value.to_string())
}

/// Compile one ignore pattern into its glob. The caller groups globs into a
/// `GlobSet` so every candidate is matched against all patterns in a single
/// pass.
pub(crate) fn compile_ignore_glob(pattern: &str) -> Option<Glob> {
    let normalized = normalize_path(pattern);
    let mut builder = GlobBuilder::new(&normalized);
    builder.literal_separator(true);
    builder.build().ok()
}

#[cfg(test)]
pub(crate) fn compile_ignore_matcher(pattern: &str) -> Option<globset::GlobMatcher> {
    compile_ignore_glob(pattern).map(|glob| glob.compile_matcher())
}

fn normalize_path(path: &str) -> Cow<str> {
    Cow::Borrowed(trim_trailing_slashes(path))
}

fn trim_trailing_slashes(path: &str) -> &str {
    let mut end = path.len();
    while end > 1 && path.as_bytes()[end - 1] == b'/' {
        end -= 1;
    }
    &path[..end]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn absolute_path_check() {
        assert!(looks_like_absolute_path("/tmp"));
        assert!(!looks_like_absolute_path("relative/path"));
    }

    #[test]
    fn join_path_uses_forward_slash() {
        assert_eq!(join_path("/Users/demo", "Projects"), "/Users/demo/Projects");
        assert_eq!(join_path("/", "Projects"), "/Projects");
    }

    #[test]
    fn expand_with_home_handles_absolute_and_relative_inputs() {
        assert_eq!(
            expand_with_home("~/Projects", Some("/Users/demo")),
            "/Users/demo/Projects"
        );
        assert_eq!(
            expand_with_home("Documents", Some("/Users/demo")),
            "/Users/demo/Documents"
        );
        assert_eq!(expand_with_home("/tmp", Some("/Users/demo")), "/tmp");
        assert_eq!(expand_with_home("~/Desktop", Some("/")), "/Desktop");
    }

    #[test]
    fn filename_validation() {
        assert!(is_valid_filename_component("report.md"));
        assert!(is_valid_filename_component("name\\with-backslash"));
        assert!(!is_valid_filename_component("name/with-slash"));
    }

    #[test]
    fn directory_component_validation_matches_filename_rules() {
        assert!(is_valid_directory_component("Desktop"));
        assert!(!is_valid_directory_component("nested/name"));
    }
}
