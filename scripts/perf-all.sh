#!/usr/bin/env bash
# Runs the full Look perf battery and collects results into one timestamped
# directory. Rust binaries run in release; the browser half prints a webview
# snippet (manual step — paste into Look devtools, save output next to the rest).
#
# Usage: bash scripts/perf-all.sh [out-dir]
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$ROOT/.perf-results/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"

export PATH="$HOME/.cargo/bin:$PATH"

run_bin() {
    local bin="$1"
    echo "=== $bin ==="
    if cargo run --quiet --release --manifest-path "$ROOT/tools/perf/Cargo.toml" --bin "$bin" > "$OUT/$bin.txt" 2> "$OUT/$bin.stderr"; then
        tail -n +1 "$OUT/$bin.txt"
    else
        echo "FAILED (see $OUT/$bin.stderr)"
        tail -5 "$OUT/$bin.stderr"
    fi
    echo ""
}

{
    echo "# Look perf battery — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# host: $(uname -srm)  cpu: $(nproc)  mem_kb: $(awk '/MemTotal/{print $2}' /proc/meminfo 2>/dev/null || echo unknown)"
    echo ""
    run_bin search_stress
    run_bin ipc_stress
    run_bin system_stress
} | tee "$OUT/summary.txt"

echo "--- browser half (manual) ---"
node "$ROOT/apps/linows/tests/perf-browser.js" | tee "$OUT/perf-browser.txt" | head -12
echo ""
echo "Results in $OUT"
echo "Next: paste the webview snippet from $OUT/perf-browser.txt into Look devtools,"
echo "save the console output as $OUT/webview.txt, and compare against the next run."
