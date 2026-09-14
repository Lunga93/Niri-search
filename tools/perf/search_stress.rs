//! Extreme search stress: synthetic 10k/50k candidate indexes, rapid query
//! bursts modeling 10 keys/sec typing, and concurrent search threads.
//!
//! Unlike query_engine_bench (real user index, fixed patterns), this builds
//! synthetic indexes at controlled sizes so scaling behavior is measurable:
//! does p95 grow linearly with candidate count, and does concurrency
//! serialize on anything inside `QueryEngine::search`?
//!
//! Usage: cargo run --release --manifest-path tools/perf/Cargo.toml --bin search_stress

use look_engine::QueryEngine;
use look_indexing::{Candidate, CandidateKind};
use std::hint::black_box;
use std::time::Instant;

const LIMIT: usize = 40;
const QUERIES_PER_SCENARIO: usize = 1000;

// Realistic launcher query mix: empty browse, 1-3 char prefixes (the hot
// per-keystroke path), full words, prefixed modes, one regex.
const QUERY_MIX: &[&str] = &[
    "",
    "s",
    "sa",
    "saf",
    "safari",
    "v",
    "vs",
    "vsc",
    "vscode",
    "doc",
    "docu",
    "document",
    "net",
    "term",
    "terminal",
    "set",
    "a\"firefox",
    "f\"quarterly",
    "d\"down",
    "r\"^report.*2024",
];

const APP_TITLES: &[&str] = &[
    "Safari",
    "Firefox",
    "Chrome",
    "Terminal",
    "Finder",
    "Settings",
    "Music",
    "Photos",
    "Messages",
    "Mail",
    "Calendar",
    "Notes",
    "Reminders",
    "Maps",
    "Weather",
    "Clock",
    "Calculator",
    "Preview",
    "TextEdit",
    "Dictionary",
    "Contacts",
    "FaceTime",
    "Books",
    "Podcasts",
    "News",
    "Stocks",
    "VoiceMemos",
    "Freeform",
    "Keynote",
    "Pages",
    "Numbers",
    "Xcode",
    "Docker",
    "VSCode",
    "Spotify",
    "Slack",
    "Discord",
    "Zoom",
    "Teams",
];

const FILE_WORDS: &[&str] = &[
    "report",
    "quarterly",
    "budget",
    "invoice",
    "contract",
    "proposal",
    "memo",
    "agenda",
    "minutes",
    "notes",
    "draft",
    "final",
    "review",
    "summary",
    "analysis",
    "plan",
    "roadmap",
    "spec",
    "design",
    "mockup",
    "screenshot",
    "photo",
    "video",
    "audio",
    "backup",
    "archive",
    "export",
    "import",
    "sync",
    "config",
    "readme",
    "changelog",
];

const FILE_EXTS: &[&str] = &[
    "pdf", "docx", "md", "txt", "png", "jpg", "mp4", "csv", "json", "rs",
];

struct LatencyStats {
    label: String,
    iterations: usize,
    p50_us: u128,
    p95_us: u128,
    p99_us: u128,
    avg_us: u128,
    min_us: u128,
    max_us: u128,
}

fn summarize(label: String, mut samples: Vec<u128>) -> LatencyStats {
    samples.sort_unstable();
    let iterations = samples.len();
    let total: u128 = samples.iter().copied().sum();
    LatencyStats {
        label,
        iterations,
        p50_us: percentile(&samples, 50),
        p95_us: percentile(&samples, 95),
        p99_us: percentile(&samples, 99),
        avg_us: if iterations == 0 {
            0
        } else {
            total / iterations as u128
        },
        min_us: samples.first().copied().unwrap_or(0),
        max_us: samples.last().copied().unwrap_or(0),
    }
}

fn percentile(sorted: &[u128], pct: u128) -> u128 {
    if sorted.is_empty() {
        return 0;
    }
    let idx = ((pct * sorted.len() as u128) / 100).min(sorted.len() as u128 - 1) as usize;
    sorted[idx]
}

fn print_stats(stat: &LatencyStats, extra: &str) {
    let throughput = if stat.avg_us == 0 {
        0.0
    } else {
        1_000_000.0 / stat.avg_us as f64
    };
    println!(
        "{},iterations={},p50_us={},p95_us={},p99_us={},avg_us={},min_us={},max_us={},throughput_per_sec={:.0}{}",
        stat.label,
        stat.iterations,
        stat.p50_us,
        stat.p95_us,
        stat.p99_us,
        stat.avg_us,
        stat.min_us,
        stat.max_us,
        throughput,
        extra,
    );
}

/// Deterministic synthetic index: apps cycle through real names, files get
/// word + number + extension combos so fuzzy matching has realistic hit
/// density (not all-miss, not all-hit).
fn build_candidates(count: usize) -> Vec<Candidate> {
    let mut out = Vec::with_capacity(count);
    for i in 0..count {
        if i % 10 == 0 {
            let title = APP_TITLES[i % APP_TITLES.len()];
            out.push(Candidate::new(
                &format!("app-{i}"),
                CandidateKind::App,
                title,
                &format!("/Applications/{title}.app"),
            ));
        } else {
            let word = FILE_WORDS[i % FILE_WORDS.len()];
            let ext = FILE_EXTS[i % FILE_EXTS.len()];
            let title = format!("{word}-{i}.{ext}");
            out.push(Candidate::new(
                &format!("file-{i}"),
                CandidateKind::File,
                &title,
                &format!("/home/user/Documents/{title}"),
            ));
        }
    }
    out
}

fn bench_sequential(engine: &QueryEngine, label: String) -> LatencyStats {
    let mut samples = Vec::with_capacity(QUERIES_PER_SCENARIO);
    for i in 0..QUERIES_PER_SCENARIO {
        let query = QUERY_MIX[i % QUERY_MIX.len()];
        let started = Instant::now();
        let results = engine.search(query, LIMIT);
        black_box(results.len());
        samples.push(started.elapsed().as_micros());
    }
    summarize(label, samples)
}

/// 4 threads hammering the same engine: QueryEngine is shared by reference,
/// so this measures whether search serializes internally. Each thread runs
/// a quarter of the query mix; samples merge into one distribution.
fn bench_concurrent(engine: &QueryEngine, label: String) -> LatencyStats {
    let per_thread = QUERIES_PER_SCENARIO / 4;
    std::thread::scope(|scope| {
        let mut handles = Vec::new();
        for t in 0..4 {
            handles.push(scope.spawn(move || {
                let mut samples = Vec::with_capacity(per_thread);
                for i in 0..per_thread {
                    let query = QUERY_MIX[(i * 4 + t) % QUERY_MIX.len()];
                    let started = Instant::now();
                    let results = engine.search(query, LIMIT);
                    black_box(results.len());
                    samples.push(started.elapsed().as_micros());
                }
                samples
            }));
        }
        let mut merged = Vec::with_capacity(QUERIES_PER_SCENARIO);
        for handle in handles {
            merged.extend(handle.join().expect("stress thread panicked"));
        }
        summarize(label, merged)
    })
}

fn main() {
    println!("# search_stress (extreme)");
    println!("limit={LIMIT} queries_per_scenario={QUERIES_PER_SCENARIO}");
    println!(
        "scenario,iterations,p50_us,p95_us,p99_us,avg_us,min_us,max_us,throughput_per_sec,extra"
    );

    for size in [1_000usize, 10_000, 50_000] {
        let build_started = Instant::now();
        let engine = QueryEngine::new(build_candidates(size));
        let build_ms = build_started.elapsed().as_millis();

        let seq = bench_sequential(&engine, format!("sequential,n={size}"));
        print_stats(&seq, &format!(",index_build_ms={build_ms}"));

        let conc = bench_concurrent(&engine, format!("concurrent4,n={size}"));
        print_stats(&conc, "");
    }
}
