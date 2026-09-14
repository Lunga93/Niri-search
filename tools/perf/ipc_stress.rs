//! IPC serialization stress: full vs compact JSON for launcher-sized and
//! extreme payloads, plus concurrent serialization.
//!
//! The FFI bridge can't be a dependency here (its workspace has unrelated
//! missing crates), so this serializes `LaunchResult` directly — the same
//! struct the Tauri `search` command returns. "Full" is serde_json of the
//! struct; "compact" strips subtitle/icon/action to the fields the row
//! renderer actually needs, modeling search_json_compact.
//!
//! Usage: cargo run --release --manifest-path tools/perf/Cargo.toml --bin ipc_stress

use look_engine::QueryEngine;
use look_indexing::{Candidate, CandidateKind};
use std::hint::black_box;
use std::time::Instant;

const ITERATIONS: usize = 10_000;

#[derive(serde::Serialize)]
struct CompactResult<'a> {
    id: &'a str,
    title: &'a str,
    path: &'a str,
    score: i64,
}

fn summarize(label: &str, mut samples: Vec<u128>, payload_bytes: usize) {
    samples.sort_unstable();
    let n = samples.len();
    let total: u128 = samples.iter().copied().sum();
    let avg = if n == 0 { 0 } else { total / n as u128 };
    let throughput = if avg == 0 {
        0.0
    } else {
        1_000_000.0 / avg as f64
    };
    println!(
        "{label},iterations={n},payload_bytes={payload_bytes},p50_us={},p95_us={},p99_us={},avg_us={avg},min_us={},max_us={},throughput_per_sec={throughput:.0}",
        percentile(&samples, 50),
        percentile(&samples, 95),
        percentile(&samples, 99),
        samples.first().copied().unwrap_or(0),
        samples.last().copied().unwrap_or(0),
    );
}

fn percentile(sorted: &[u128], pct: u128) -> u128 {
    if sorted.is_empty() {
        return 0;
    }
    let idx = ((pct * sorted.len() as u128) / 100).min(sorted.len() as u128 - 1) as usize;
    sorted[idx]
}

fn bench_full(payload: &[look_engine::LaunchResult], label: &str) {
    // Serialize once for the byte count, then time the rest.
    let bytes = serde_json::to_string(payload)
        .expect("full serialize")
        .len();
    let mut samples = Vec::with_capacity(ITERATIONS);
    for _ in 0..ITERATIONS {
        let started = Instant::now();
        let json = serde_json::to_string(payload).expect("full serialize");
        black_box(json.len());
        samples.push(started.elapsed().as_micros());
    }
    summarize(&format!("full,{label}"), samples, bytes);
}

fn bench_compact(payload: &[look_engine::LaunchResult], label: &str) {
    let compact: Vec<CompactResult> = payload
        .iter()
        .map(|r| CompactResult {
            id: &r.id,
            title: &r.title,
            path: &r.path,
            score: r.score,
        })
        .collect();
    let bytes = serde_json::to_string(&compact)
        .expect("compact serialize")
        .len();
    let mut samples = Vec::with_capacity(ITERATIONS);
    for _ in 0..ITERATIONS {
        let started = Instant::now();
        let json = serde_json::to_string(&compact).expect("compact serialize");
        black_box(json.len());
        samples.push(started.elapsed().as_micros());
    }
    summarize(&format!("compact,{label}"), samples, bytes);
}

fn bench_concurrent_full(payload: &[look_engine::LaunchResult]) {
    let json_len = std::thread::scope(|scope| {
        let mut handles = Vec::new();
        for _ in 0..4 {
            handles.push(scope.spawn(|| {
                let mut total = 0usize;
                for _ in 0..ITERATIONS / 4 {
                    let json = serde_json::to_string(payload).expect("full serialize");
                    total += json.len();
                }
                total
            }));
        }
        handles
            .into_iter()
            .map(|h| h.join().expect("stress thread panicked"))
            .sum::<usize>()
    });
    black_box(json_len);
    println!(
        "concurrent4_full,threads=4,iterations_each={},total_bytes={json_len}",
        ITERATIONS / 4
    );
}

fn main() {
    // Realistic payloads: run real searches against a 10k synthetic index
    // and keep the result vecs, so field lengths match production.
    let mut candidates = Vec::with_capacity(10_000);
    for i in 0..10_000 {
        candidates.push(Candidate::new(
            &format!("file-{i}"),
            CandidateKind::File,
            &format!("quarterly-report-{i}-final-draft.pdf"),
            &format!("/home/user/Documents/reports/quarterly-report-{i}-final-draft.pdf"),
        ));
    }
    let engine = QueryEngine::new(candidates);

    println!("# ipc_stress");
    println!(
        "mode,payload,iterations,payload_bytes,p50_us,p95_us,p99_us,avg_us,min_us,max_us,throughput_per_sec"
    );

    let small = engine.search("repo", 5);
    let launcher = engine.search("report", 40);
    let extreme = engine.search("report", 100);
    println!(
        "# result_counts: small={} launcher={} extreme={}",
        small.len(),
        launcher.len(),
        extreme.len()
    );

    bench_full(&small, "n=5");
    bench_compact(&small, "n=5");
    bench_full(&launcher, "n=40");
    bench_compact(&launcher, "n=40");
    bench_full(&extreme, "n=100");
    bench_compact(&extreme, "n=100");

    bench_concurrent_full(&launcher);
}
