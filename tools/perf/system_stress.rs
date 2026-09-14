//! System-level stress: launcher toggle storm (D-Bus round trips), grim
//! capture cost, storage-layer throughput, and file-watcher event floods.
//!
//! Every scenario degrades to a SKIP line when its external dependency is
//! absent (no running Look instance, no grim, non-Linux), so the binary
//! always exits 0 and the orchestrator can still collect the rest.
//!
//! Usage: cargo run --release --manifest-path tools/perf/Cargo.toml --bin system_stress

use look_indexing::{Candidate, CandidateKind};
use std::hint::black_box;
use std::time::{Duration, Instant};

const TOGGLE_ROUNDS: usize = 100;
const GRIM_ROUNDS: usize = 50;
const STORE_CANDIDATES: usize = 10_000;
const WATCHER_EVENTS: usize = 1000;

fn percentile(sorted: &[u128], pct: u128) -> u128 {
    if sorted.is_empty() {
        return 0;
    }
    let idx = ((pct * sorted.len() as u128) / 100).min(sorted.len() as u128 - 1) as usize;
    sorted[idx]
}

fn print_latency(scenario: &str, mut samples: Vec<u128>, unit: &str) {
    if samples.is_empty() {
        println!("{scenario},SKIP,no_samples");
        return;
    }
    samples.sort_unstable();
    let n = samples.len();
    let total: u128 = samples.iter().copied().sum();
    let avg = total / n as u128;
    println!(
        "{scenario},iterations={n},unit={unit},p50={},p95={},p99={},avg={avg},min={},max={}",
        percentile(&samples, 50),
        percentile(&samples, 95),
        percentile(&samples, 99),
        samples.first().copied().unwrap_or(0),
        samples.last().copied().unwrap_or(0),
    );
}

/// RSS in KiB from /proc/self/status. Linux-only; 0 elsewhere.
fn rss_kib() -> u64 {
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/proc/self/status")
            .ok()
            .and_then(|text| {
                text.lines()
                    .find(|line| line.starts_with("VmRSS:"))
                    .and_then(|line| line.split_whitespace().nth(1))
                    .and_then(|kb| kb.parse().ok())
            })
            .unwrap_or(0)
    }
    #[cfg(not(target_os = "linux"))]
    {
        0
    }
}

/// 100 rapid Toggle calls against a running Look instance. Measures the
/// D-Bus round trip only (compositor work happens async); a slow toggle
/// here means the hotkey path itself is saturated.
fn scenario_toggle_storm() {
    let probe = std::process::Command::new("gdbus")
        .args([
            "call",
            "--session",
            "--dest",
            "com.look.Desktop",
            "--object-path",
            "/com/look/Desktop",
            "--method",
            "com.look.Desktop.Toggle",
        ])
        .output();
    let Ok(probe) = probe else {
        println!("toggle_storm,SKIP,gdbus_missing");
        return;
    };
    if !probe.status.success() {
        println!("toggle_storm,SKIP,no_look_instance");
        return;
    }
    let mut samples = Vec::with_capacity(TOGGLE_ROUNDS);
    for _ in 0..TOGGLE_ROUNDS {
        let started = Instant::now();
        let out = std::process::Command::new("gdbus")
            .args([
                "call",
                "--session",
                "--dest",
                "com.look.Desktop",
                "--object-path",
                "/com/look/Desktop",
                "--method",
                "com.look.Desktop.Toggle",
            ])
            .output();
        if out.is_ok_and(|o| o.status.success()) {
            samples.push(started.elapsed().as_micros());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    // Leave the window where we found it: even rounds return to start.
    print_latency("toggle_storm", samples, "us");
}

/// 50 grim captures of an 800x600 region: process spawn + JPEG encode.
/// This is the dominant cost on the window-show path (see wallpaper.rs).
fn scenario_grim_capture() {
    #[cfg(not(target_os = "linux"))]
    {
        println!("grim_capture,SKIP,non_linux");
        return;
    }
    #[cfg(target_os = "linux")]
    {
        let probe = std::process::Command::new("grim")
            .args(["-t", "jpeg", "-q", "60", "-g", "0,0 8x8", "-"])
            .output();
        if probe.is_err() {
            println!("grim_capture,SKIP,grim_missing");
            return;
        }
        let mut samples = Vec::with_capacity(GRIM_ROUNDS);
        let mut bytes = 0usize;
        for _ in 0..GRIM_ROUNDS {
            let started = Instant::now();
            let out = std::process::Command::new("grim")
                .args(["-t", "jpeg", "-q", "60", "-g", "100,100 800x600", "-"])
                .output();
            match out {
                Ok(o) if o.status.success() => {
                    bytes = o.stdout.len();
                    samples.push(started.elapsed().as_millis());
                }
                _ => break,
            }
        }
        print_latency("grim_capture", samples, "ms");
        println!("grim_capture_bytes,last_capture={bytes}");
    }
}

/// Storage-layer throughput: upsert 10k synthetic candidates into an
/// in-memory store, then load them back. Isolates SQLite from the
/// filesystem walk so regressions in the store itself are visible.
fn scenario_store_roundtrip() {
    let rss_before = rss_kib();
    let mut store = match look_storage::SqliteStore::open_in_memory() {
        Ok(store) => store,
        Err(err) => {
            println!("store_roundtrip,SKIP,{err}");
            return;
        }
    };
    let candidates: Vec<Candidate> = (0..STORE_CANDIDATES)
        .map(|i| {
            Candidate::new(
                &format!("file-{i}"),
                CandidateKind::File,
                &format!("stress-document-{i}.pdf"),
                &format!("/tmp/stress/stress-document-{i}.pdf"),
            )
        })
        .collect();

    let started = Instant::now();
    if let Err(err) = store.upsert_candidates(&candidates) {
        println!("store_roundtrip,SKIP,upsert_failed:{err}");
        return;
    }
    let upsert_ms = started.elapsed().as_millis();

    let started = Instant::now();
    let loaded = store.load_candidates(None);
    let load_ms = started.elapsed().as_millis();
    match loaded {
        Ok(rows) => {
            black_box(rows.len());
            println!(
                "store_roundtrip,n={STORE_CANDIDATES},upsert_ms={upsert_ms},load_ms={load_ms},loaded={}",
                rows.len()
            );
        }
        Err(err) => println!("store_roundtrip,SKIP,load_failed:{err}"),
    }
    println!(
        "store_roundtrip_rss,rss_before_kib={rss_before},rss_after_kib={}",
        rss_kib()
    );
}

/// Watcher flood: 1000 rapid file creates in a temp dir, counting how many
/// raw notify events arrive and how fast the channel drains. Models the
/// apt-install-burst / npm-install scenario at the OS-event layer.
fn scenario_watcher_flood() {
    use notify::{RecursiveMode, Watcher};
    use std::sync::mpsc;

    let dir = std::env::temp_dir().join(format!("look-stress-{}", std::process::id()));
    if std::fs::create_dir_all(&dir).is_err() {
        println!("watcher_flood,SKIP,tempdir_failed");
        return;
    }
    let (tx, rx) = mpsc::channel();
    let mut watcher = match notify::RecommendedWatcher::new(tx, notify::Config::default()) {
        Ok(watcher) => watcher,
        Err(err) => {
            println!("watcher_flood,SKIP,watcher_failed:{err}");
            return;
        }
    };
    if watcher.watch(&dir, RecursiveMode::NonRecursive).is_err() {
        println!("watcher_flood,SKIP,watch_failed");
        return;
    }
    // Let the watcher arm before producing events.
    std::thread::sleep(Duration::from_millis(200));

    let started = Instant::now();
    for i in 0..WATCHER_EVENTS {
        let _ = std::fs::write(dir.join(format!("f{i}.tmp")), b"x");
    }
    let produce_ms = started.elapsed().as_millis();

    let drain_started = Instant::now();
    let mut received = 0usize;
    while rx.recv_timeout(Duration::from_secs(5)).is_ok() {
        received += 1;
        if drain_started.elapsed() > Duration::from_secs(10) {
            break;
        }
        // Drain whatever is already queued without blocking.
        while rx.try_recv().is_ok() {
            received += 1;
        }
        if received >= WATCHER_EVENTS {
            // Give coalesced duplicates a moment to stop arriving.
            std::thread::sleep(Duration::from_millis(300));
            while rx.try_recv().is_ok() {
                received += 1;
            }
            break;
        }
    }
    let drain_ms = drain_started.elapsed().as_millis();
    println!(
        "watcher_flood,produced={WATCHER_EVENTS},produce_ms={produce_ms},events_received={received},drain_ms={drain_ms}"
    );
    let _ = std::fs::remove_dir_all(&dir);
}

fn main() {
    println!("# system_stress");
    scenario_toggle_storm();
    scenario_grim_capture();
    scenario_store_roundtrip();
    scenario_watcher_flood();
}
