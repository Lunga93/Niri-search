// Frontend perf: times the synchronous per-keystroke logic (catalog.js —
// the prefix/command/URL short-circuit that runs before any IPC) under
// Node, plus prints a webview snippet for the browser-only halves
// (IPC round-trip, DOM rebuild) that must run inside the Tauri webview.
//
// Usage: node apps/linows/tests/perf-browser.js
// Webview part: paste the printed snippet into the Look devtools console
// while the launcher is visible, with results on screen.

import {
    isPrefixedQuery,
    isCommandSuggestionQuery,
    prefixSuggestionResults,
    commandSuggestionResults,
    webUrlResult,
    placeUrlRow,
    calcResult,
    classifyResultId,
    isSyntheticResultId,
} from '../src/js/catalog.js';

const ITERATIONS = 10_000;

function percentile(sorted, pct) {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((pct * sorted.length) / 100));
    return sorted[idx];
}

function bench(label, fn) {
    const samples = [];
    for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        fn(i);
        samples.push((performance.now() - start) * 1000);
    }
    samples.sort((a, b) => a - b);
    const total = samples.reduce((a, b) => a + b, 0);
    const avg = total / samples.length;
    console.log(
        `${label},iterations=${ITERATIONS},p50_us=${percentile(samples, 50).toFixed(1)}` +
            `,p95_us=${percentile(samples, 95).toFixed(1)},p99_us=${percentile(samples, 99).toFixed(1)}` +
            `,avg_us=${avg.toFixed(1)},min_us=${samples[0].toFixed(1)},max_us=${samples[samples.length - 1].toFixed(1)}` +
            `,throughput_per_sec=${(1_000_000 / avg).toFixed(0)}`,
    );
}

// Keystroke simulation: what search.js calls synchronously per input event
// before the 70ms debounce fires (the "is this a mode switch?" gate).
const KEYSTROKE_QUERIES = ['', 's', 'sa', '/', '/k', 'a"', 'f"no', 'd"do', 'g', 'goo', '2+2', 't"he'];

console.log('# perf-browser (catalog hot path)');
console.log('bench,iterations,p50_us,p95_us,p99_us,avg_us,min_us,max_us,throughput_per_sec');

bench('classify_mixed', (i) => {
    const q = KEYSTROKE_QUERIES[i % KEYSTROKE_QUERIES.length];
    isPrefixedQuery(q);
    isCommandSuggestionQuery(q);
});

bench('prefix_suggestions', (i) => {
    prefixSuggestionResults(KEYSTROKE_QUERIES[i % KEYSTROKE_QUERIES.length]);
});

bench('command_suggestions', (i) => {
    commandSuggestionResults(i % 2 === 0 ? '/' : '/ki');
});

bench('url_rows', (i) => {
    webUrlResult('https://example.com/page-' + i, 'Example', 100 - (i % 50));
    placeUrlRow({ id: 'weburl:x' }, true, [{ id: 'a' }, { id: 'b' }]);
});

bench('calc_row', (i) => {
    calcResult('2+' + i, String(2 + i));
});

bench('classify_ids', (i) => {
    const ids = ['prefixhint:a', 'cmdhint:/kill', 'websuggest:foo', 'weburl:https://x.test', 'calc:1+1', 'file:///home/user/doc.pdf'];
    classifyResultId(ids[i % ids.length]);
    isSyntheticResultId(ids[i % ids.length]);
});

// Full keystroke gate: everything search.js runs synchronously per input.
bench('keystroke_gate', (i) => {
    const q = KEYSTROKE_QUERIES[i % KEYSTROKE_QUERIES.length];
    if (isPrefixedQuery(q)) prefixSuggestionResults(q);
    else if (isCommandSuggestionQuery(q)) commandSuggestionResults(q);
    classifyResultId('file:///home/user/doc.pdf');
});

console.log('');
console.log('# --- webview snippet (paste into Look devtools console) ---');
console.log(`const __perf = async () => {
  // 1. DOM rebuild cost: wipe + restore the live results list 20x.
  const list = document.getElementById('results-list');
  console.log('dom_rows_on_screen=' + list.querySelectorAll('.result-row').length);
  const html = list.innerHTML;
  let a = performance.now();
  for (let i = 0; i < 20; i++) { list.innerHTML = ''; list.innerHTML = html; }
  console.log('dom_rebuild_20x_ms=' + (performance.now() - a).toFixed(1));
  // 2. Keystroke-to-paint: synthetic input event, MutationObserver stops
  // the clock on the first results-list mutation (covers debounce + IPC +
  // render, the real per-keystroke budget).
  const input = document.getElementById('query');
  const once = () => new Promise((resolve) => {
    const t0 = performance.now();
    const obs = new MutationObserver(() => {
      obs.disconnect();
      resolve(performance.now() - t0);
    });
    obs.observe(list, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(-1); }, 3000);
  });
  for (const q of ['r', 're', 'rep', 'repo', 'repor', 'report']) {
    const p = once();
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('keystroke_paint query=' + q + ' ms=' + (await p).toFixed(1));
    await new Promise((r) => setTimeout(r, 400));
  }
};
__perf();`);
