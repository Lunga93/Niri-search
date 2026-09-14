// Keystroke-to-paint pipeline marks. Ring-buffered, always on: a mark is
// one performance.now() call (~50ns), invisible next to the pipeline it
// measures. Stages, in order: input -> search-start -> ipc-end ->
// published -> render-start -> render-end -> paint.
//
// Read it from the devtools console via window.__lookPerf (wired in app.js):
//   __lookPerf.clear()
//   ... type a sentence ...
//   __lookPerf.report()   // per-keystroke stage latencies + settle time
//
// Attribution: downstream marks carry the query string and attach to the
// most recent input with the same query. Typing a sentence produces unique
// prefixes per keystroke, so attribution is exact there; retyping an
// identical query keeps last-wins (fine for settle analysis).

const MAX_MARKS = 5000;
const marks = [];

export function mark(stage, detail = null) {
    if (marks.length >= MAX_MARKS) marks.splice(0, marks.length - MAX_MARKS + 1);
    marks.push({ t: Math.round(performance.now() * 100) / 100, stage, detail });
}

export function clear() {
    marks.length = 0;
}

export function trace() {
    return marks.slice();
}

// Main-thread block detector: a 10ms heartbeat, gaps over 50ms recorded
// with timestamps. Correlate blocks against stage marks to tell "this
// stage is slow" from "the loop was stuck elsewhere while this stage was
// pending". Cheap enough to leave on (one timer, capped buffer).
const blocks = [];
const BLOCK_THRESHOLD_MS = 50;
const MAX_BLOCKS = 200;
let beatTimer = null;
let lastBeat = 0;

export function startHeartbeat() {
    if (beatTimer) return;
    lastBeat = performance.now();
    const beat = () => {
        const now = performance.now();
        const gap = now - lastBeat;
        // Hidden pages get timers throttled to ~1Hz: those ~1000ms gaps are
        // the throttle, not main-thread work. Recording them floods the
        // capped buffer and evicts the real typing-time blocks.
        if (gap > BLOCK_THRESHOLD_MS && !document.hidden) {
            blocks.push({ t: Math.round(now * 10) / 10, gap: Math.round(gap * 10) / 10 });
            if (blocks.length > MAX_BLOCKS) blocks.shift();
        }
        lastBeat = now;
        beatTimer = setTimeout(beat, 10);
    };
    beatTimer = setTimeout(beat, 10);
}

// Per-keystroke stage latencies, keyed by input order. A keystroke with no
// downstream marks (superseded inside the debounce window) reports nulls —
// that absence IS data: it counts keystrokes the user typed but the UI
// never answered.
export function report() {
    const inputs = [];
    const byQuery = new Map();
    for (const mark of marks) {
        if (mark.stage === 'input') {
            const entry = { query: mark.detail, input: mark.t };
            inputs.push(entry);
            if (!byQuery.has(mark.detail)) byQuery.set(mark.detail, []);
            byQuery.get(mark.detail).push(entry);
        } else {
            const bucket = byQuery.get(mark.detail);
            if (bucket && bucket.length > 0) {
                const entry = bucket[bucket.length - 1];
                if (entry[mark.stage] === undefined) entry[mark.stage] = mark.t;
            }
        }
    }
    const rows = inputs.map((entry, i) => {
        const delta = (stage) =>
            entry[stage] === undefined ? null : Math.round((entry[stage] - entry.input) * 10) / 10;
        return {
            i,
            query: entry.query,
            optimisticMs: delta('optimistic'),
            debounceMs: delta('search-start'),
            ipcMs:
                entry['search-start'] === undefined || entry['ipc-end'] === undefined
                    ? null
                    : Math.round((entry['ipc-end'] - entry['search-start']) * 10) / 10,
            mergeMs:
                entry['ipc-end'] === undefined || entry['publish-start'] === undefined
                    ? null
                    : Math.round((entry['publish-start'] - entry['ipc-end']) * 10) / 10,
            callbackMs:
                entry['publish-start'] === undefined || entry.callback === undefined
                    ? null
                    : Math.round((entry.callback - entry['publish-start']) * 10) / 10,
            renderMs:
                entry.callback === undefined || entry['render-end'] === undefined
                    ? null
                    : Math.round((entry['render-end'] - entry.callback) * 10) / 10,
            domMs:
                entry['render-start'] === undefined || entry['render-end'] === undefined
                    ? null
                    : Math.round((entry['render-end'] - entry['render-start']) * 10) / 10,
            paintMs:
                entry['render-end'] === undefined || entry.paint === undefined
                    ? null
                    : Math.round((entry.paint - entry['render-end']) * 10) / 10,
            totalMs: delta('paint'),
        };
    });
    const lastInput = inputs.length > 0 ? inputs[inputs.length - 1].input : null;
    const lastMark = marks.length > 0 ? marks[marks.length - 1].t : null;
    const answered = rows.filter((row) => row.totalMs !== null).length;
    return {
        keystrokes: inputs.length,
        answered,
        dropped: inputs.length - answered,
        settleMs:
            lastInput === null || lastMark === null
                ? null
                : Math.round((lastMark - lastInput) * 10) / 10,
        blocks: blocks.slice(),
        rows,
    };
}
